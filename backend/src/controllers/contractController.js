import { randomBytes, randomUUID } from "node:crypto";
import { config } from "../config.js";
import { HttpError } from "../lib/httpError.js";
import { ChatRequest, CompareInput } from "../lib/schemas.js";
import { splitClauses } from "../lib/chunker.js";
import { extractDocument, hasValidMagic } from "../lib/parser.js";
import { Session, Chunk, ChatMessage, Comparison } from "../models/index.js";
import { runPass1, runPass2, runAggregation, summarizeSeverities } from "../services/analyzer.js";
import { streamChat } from "../services/chat.js";
import { compareSessions } from "../services/compare.js";
import { claimUpload } from "../services/plans.js";

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

  // Free plan: take one of the month's uploads now, and hand it back if anything below fails.
  const release = await claimUpload(req.user);
  try {
    res.json(await processUpload(req, file, filename));
  } catch (err) {
    await release();
    throw err;
  }
}

async function processUpload(req, file, filename) {
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

  return {
    session_id: sessionId,
    document_type: pass1.document_type,
    parties: pass1.parties,
    governing_law: pass1.governing_law,
    clause_count: pass1.clauses.length,
    pass1_clauses: pass1.clauses,
  };
}

export async function analyze(req, res) {
  const sessionId = String(req.query.session_id ?? "");
  if (!sessionId) throw new HttpError(422, "session_id is required.");
  const session = await findOwnedSession(req, sessionId);
  if (!session.pass1_result) throw new HttpError(400, "Pass 1 has not completed for this session.");

  const scope = { session_id: sessionId, user_id: req.user._id };
  // Fire-and-forget: a lost progress write only makes the bar lag, never fails the analysis.
  const saveProgress = (done, total) =>
    Session.updateOne(scope, { analysis_progress: { done, total } }).catch(() => {});

  let riskReport, aggregation;
  try {
    saveProgress(0, Math.min(session.pass1_result.clauses.length, config.maxClausesPass2));
    riskReport = await runPass2(session.pass1_result, saveProgress);
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
  await Session.updateOne(scope, { risk_report: riskReport, aggregation, summary, analysis_progress: null });
  res.json({ session_id: sessionId, risk_report: riskReport, aggregation, summary });
}

// How far a running /analyze has got. `total` is the number of clauses Pass 2 analyzes.
export async function analyzeProgress(req, res) {
  const sessionId = String(req.query.session_id ?? "");
  if (!sessionId) throw new HttpError(422, "session_id is required.");
  const s = await findOwnedSession(req, sessionId);
  res.set("Cache-Control", "no-store");
  res.json({ analyzed: Boolean(s.aggregation), progress: s.analysis_progress ?? null });
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
    share_token: s.share_token ?? null,
  });
}

export async function chatHistory(req, res) {
  const { sessionId } = req.params;
  await findOwnedSession(req, sessionId, "Session not found.");
  const n = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const rows = await ChatMessage.find({ user_id: req.user._id, session_id: sessionId }).sort({ createdAt: -1 }).limit(n).lean();
  res.json({ session_id: sessionId, messages: rows.reverse().map(({ role, content }) => ({ role, content })) });
}

// Removes the contract with its report, chunks and chat. Scoped by owner like every other read.
export async function deleteContract(req, res) {
  const { sessionId } = req.params;
  await findOwnedSession(req, sessionId, "Session not found.");
  const scope = { user_id: req.user._id, session_id: String(sessionId) };
  await Promise.all([
    Session.deleteOne(scope),
    Chunk.deleteMany(scope),
    ChatMessage.deleteMany(scope),
    Comparison.deleteMany({ user_id: req.user._id, $or: [{ base_session_id: scope.session_id }, { revised_session_id: scope.session_id }] }),
  ]);
  res.json({ ok: true });
}

// ─── Sharing (Pro) ───────────────────────────────────────────────────────────

// Returns the report's share token, creating one on first use. 24 random bytes: unguessable,
// and the only thing that grants access to the shared report.
export async function shareContract(req, res) {
  const s = await findOwnedSession(req, req.params.sessionId, "Session not found.");
  if (!s.aggregation) throw new HttpError(400, "Finish the analysis before sharing it.");
  if (s.share_token) return res.json({ share_token: s.share_token });
  const token = randomBytes(24).toString("base64url");
  await Session.updateOne({ _id: s._id, user_id: req.user._id }, { share_token: token });
  res.status(201).json({ share_token: token });
}

// Allowed on any plan, so a lapsed subscriber can still take a link down.
export async function unshareContract(req, res) {
  const s = await findOwnedSession(req, req.params.sessionId, "Session not found.");
  await Session.updateOne({ _id: s._id, user_id: req.user._id }, { $unset: { share_token: 1 } });
  res.json({ ok: true });
}

// ─── Compare (Pro) ───────────────────────────────────────────────────────────

const contractRef = (s) => ({ session_id: s.session_id, filename: s.filename, document_type: s.document_type, created_at: s.createdAt });

export async function createComparison(req, res) {
  const parsed = CompareInput.safeParse(req.body);
  if (!parsed.success) throw new HttpError(422, parsed.error.issues[0]?.message ?? "Pick two contracts to compare.");
  const { base_session_id, revised_session_id } = parsed.data;

  const [base, revised] = await Promise.all([findOwnedSession(req, base_session_id, "Contract not found."), findOwnedSession(req, revised_session_id, "Contract not found.")]);
  if (!base.aggregation || !revised.aggregation) throw new HttpError(400, "Both contracts need a finished analysis before they can be compared.");

  const scope = { user_id: req.user._id, base_session_id, revised_session_id };
  const existing = await Comparison.findOne(scope, "comparison_id").lean();
  if (existing) return res.json({ comparison_id: existing.comparison_id });

  let result;
  try {
    result = await compareSessions(req.user._id, base, revised);
  } catch (err) {
    console.error(`Compare failed: ${err.message}`);
    throw new HttpError(500, `Comparison failed: ${err.message}`);
  }
  const comparisonId = randomUUID();
  try {
    await Comparison.create({ ...scope, comparison_id: comparisonId, result });
  } catch (err) {
    // A concurrent request for the same pair won the insert; use its result.
    if (err.code !== 11000) throw err;
    const winner = await Comparison.findOne(scope, "comparison_id").lean();
    return res.json({ comparison_id: winner.comparison_id });
  }
  res.status(201).json({ comparison_id: comparisonId });
}

export async function getComparison(req, res) {
  const c = await Comparison.findOne({ comparison_id: String(req.params.comparisonId), user_id: req.user._id }).lean();
  if (!c) throw new HttpError(404, "Comparison not found.");
  const [base, revised] = await Promise.all([
    Session.findOne({ session_id: c.base_session_id, user_id: req.user._id }, "session_id filename document_type createdAt").lean(),
    Session.findOne({ session_id: c.revised_session_id, user_id: req.user._id }, "session_id filename document_type createdAt").lean(),
  ]);
  if (!base || !revised) throw new HttpError(404, "Comparison not found.");
  res.json({ comparison_id: c.comparison_id, created_at: c.createdAt, base: contractRef(base), revised: contractRef(revised), ...c.result });
}

export async function listComparisons(req, res) {
  const rows = await Comparison.find({ user_id: req.user._id }, "comparison_id base_session_id revised_session_id createdAt result.verdict")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const ids = [...new Set(rows.flatMap((r) => [r.base_session_id, r.revised_session_id]))];
  const sessions = await Session.find({ user_id: req.user._id, session_id: { $in: ids } }, "session_id filename").lean();
  const name = Object.fromEntries(sessions.map((s) => [s.session_id, s.filename]));
  res.json({
    comparisons: rows.map((r) => ({
      comparison_id: r.comparison_id,
      created_at: r.createdAt,
      verdict: r.result?.verdict ?? null,
      base_filename: name[r.base_session_id] ?? "",
      revised_filename: name[r.revised_session_id] ?? "",
    })),
  });
}

// Everything the signed-in user has analyzed, newest first.
export async function listContracts(req, res) {
  const rows = await Session.find(
    { user_id: req.user._id },
    "session_id filename document_type createdAt aggregation.overall_risk aggregation.risk_score summary share_token",
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
      shared: Boolean(s.share_token),
    })),
  });
}
