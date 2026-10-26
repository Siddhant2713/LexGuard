import { randomUUID } from "node:crypto";
import { config } from "../config.js";
import { HttpError } from "../lib/httpError.js";
import { ChatRequest } from "../lib/schemas.js";
import { splitClauses } from "../lib/chunker.js";
import { extractDocument, hasValidMagic } from "../lib/parser.js";
import { Session, Chunk, ChatMessage } from "../models/index.js";
import { runPass1, runPass2, runAggregation, summarizeSeverities } from "../services/analyzer.js";
import { streamChat } from "../services/chat.js";

// Authorization: a session is only visible to its owner. Someone else's id returns the same
// 404 as a nonexistent one, so ids can't be probed.
const findOwnedSession = async (req, sessionId, notFound = "Session not found. Please re-upload the contract.") => {
  const session = await Session.findOne({ session_id: String(sessionId), user_id: req.user._id }).lean();
  if (!session) throw new HttpError(404, notFound);
  return session;
};

export async function upload(req, res) {
  const file = req.file;
  if (!file) throw new HttpError(400, "No file uploaded.");
  const filename = file.originalname || "contract";
  if (!/\.(pdf|docx?)$/i.test(filename)) throw new HttpError(400, "Only PDF and DOCX files are supported.");
  if (!hasValidMagic(file.buffer)) throw new HttpError(415, `File content does not match declared type: ${filename}`);

  let rawText;
  try {
    rawText = await extractDocument(file.buffer, filename);
  } catch (err) {
    throw new HttpError(422, err.message);
  }

  let pass1;
  try {
    pass1 = await runPass1(rawText);
  } catch (err) {
    if (err.code === "NO_CLAUSES") throw new HttpError(422, err.message);
    console.error(`Pass 1 failed: ${err.message}`);
    throw new HttpError(500, `AI analysis failed during structural extraction: ${err.message}`);
  }

  const sessionId = randomUUID();
  const chunks = splitClauses(rawText).map((c) => ({ user_id: req.user._id, session_id: sessionId, chunk_id: c.id, heading: c.heading, text: c.text }));
  await Session.create({
    session_id: sessionId,
    user_id: req.user._id,
    filename,
    document_type: pass1.document_type,
    parties: pass1.parties,
    governing_law: pass1.governing_law,
    pass1_result: pass1,
  });
  if (chunks.length) await Chunk.insertMany(chunks);

  res.json({
    session_id: sessionId,
    document_type: pass1.document_type,
    parties: pass1.parties,
    governing_law: pass1.governing_law,
    clause_count: pass1.clauses.length,
    pass1_clauses: pass1.clauses,
  });
}

export async function analyze(req, res) {
  const sessionId = String(req.query.session_id ?? "");
  if (!sessionId) throw new HttpError(422, "session_id is required.");
  const session = await findOwnedSession(req, sessionId);
  if (!session.pass1_result) throw new HttpError(400, "Pass 1 has not completed for this session.");

  let riskReport, aggregation;
  try {
    riskReport = await runPass2(session.pass1_result);
  } catch (err) {
    console.error(`Pass 2 failed for session ${sessionId}: ${err.message}`);
    throw new HttpError(500, `Risk analysis failed: ${err.message}`);
  }
  try {
    aggregation = await runAggregation(riskReport, session.pass1_result.document_type);
  } catch (err) {
    console.error(`Aggregation failed for session ${sessionId}: ${err.message}`);
    throw new HttpError(500, `Risk aggregation failed: ${err.message}`);
  }

  const summary = summarizeSeverities(riskReport);
  await Session.updateOne({ session_id: sessionId, user_id: req.user._id }, { risk_report: riskReport, aggregation, summary });
  res.json({ session_id: sessionId, risk_report: riskReport, aggregation, summary });
}

export async function chat(req, res) {
  const parsed = ChatRequest.safeParse(req.body);
  if (!parsed.success) throw new HttpError(422, "session_id and query are required.");
  const { session_id, query } = parsed.data;
  await findOwnedSession(req, session_id);

  await ChatMessage.create({ user_id: req.user._id, session_id, role: "user", content: query });

  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();

  let full = "";
  for await (const token of streamChat(req.user._id, session_id, query)) {
    full += token;
    // SSE is line-based, so newlines are escaped; the frontend restores them.
    res.write(`data: ${token.replace(/\n/g, "\\n")}\n\n`);
  }
  res.write("data: [DONE]\n\n");
  res.end();

  if (full) await ChatMessage.create({ user_id: req.user._id, session_id, role: "assistant", content: full });
}

export async function report(req, res) {
  const s = await findOwnedSession(req, req.params.sessionId, "Session not found.");
  if (!s.pass1_result) throw new HttpError(400, "Analysis not yet completed for this session.");
  res.json({
    session_id: s.session_id,
    filename: s.filename,
    storage_url: null,
    pass1_result: s.pass1_result,
    risk_report: s.risk_report,
    aggregation: s.aggregation,
    summary: s.summary,
  });
}

export async function chatHistory(req, res) {
  const { sessionId } = req.params;
  await findOwnedSession(req, sessionId, "Session not found.");
  const n = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const rows = await ChatMessage.find({ user_id: req.user._id, session_id: sessionId }).sort({ createdAt: -1 }).limit(n).lean();
  res.json({ session_id: sessionId, messages: rows.reverse().map(({ role, content }) => ({ role, content })) });
}

// Everything the signed-in user has analyzed, newest first.
export async function listContracts(req, res) {
  const rows = await Session.find(
    { user_id: req.user._id },
    "session_id filename document_type createdAt aggregation.overall_risk aggregation.risk_score summary",
  )
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  res.json({
    contracts: rows.map((s) => ({
      session_id: s.session_id,
      filename: s.filename,
      document_type: s.document_type,
      created_at: s.createdAt,
      analyzed: Boolean(s.aggregation),
      overall_risk: s.aggregation?.overall_risk ?? null,
      risk_score: s.aggregation?.risk_score ?? null,
      summary: s.summary,
    })),
  });
}
