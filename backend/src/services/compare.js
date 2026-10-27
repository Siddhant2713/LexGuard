import { config } from "../config.js";
import { diffClauses, diffRisks, normalizeHeading } from "../lib/compare.js";
import { ComparisonVerdict } from "../lib/schemas.js";
import { Chunk } from "../models/index.js";
import { compareSystem, compareUser } from "../prompts/compare.js";
import { callGroqJson } from "./groq.js";

const SEVERITY_RANK = { critical: 4, high: 3, medium: 2, low: 1 };
const clip = (s, n = 700) => (s && s.length > n ? `${s.slice(0, n)}…` : s);

// Flagged risks of a session, each labelled with its clause heading.
function risksOf(session) {
  const headings = Object.fromEntries((session.pass1_result?.clauses ?? []).map((c) => [c.id, c.heading]));
  return (session.risk_report ?? []).map((r) => ({ heading: headings[r.clause_id] ?? "", risk_type: r.risk_type, severity: r.severity }));
}

// Document order. Numeric, because "clause_100" sorts before "clause_11" as a string.
const clausesOf = async (userId, sessionId) => {
  const rows = await Chunk.find({ user_id: userId, session_id: sessionId }, "chunk_id heading text").lean();
  const n = (c) => Number(c.chunk_id.match(/\d+$/)?.[0] ?? 0);
  // Chunks keep their heading as the first line of the text; the diff shows it separately.
  return rows
    .sort((a, b) => n(a) - n(b))
    .map((c) => ({ ...c, text: c.text.startsWith(c.heading) ? c.text.slice(c.heading.length).trim() || c.text : c.text }));
};

// Used when the model call fails: the diff is still complete, only the commentary is missing.
function fallbackVerdict(before, after, changes) {
  const delta = after - before;
  const verdict = !changes.length ? "same" : delta <= -0.5 ? "better" : delta >= 0.5 ? "worse" : "mixed";
  const n = (kind) => changes.filter((c) => c.kind === kind).length;
  const summary = changes.length
    ? `${n("changed")} clause${n("changed") === 1 ? "" : "s"} changed, ${n("added")} added and ${n("removed")} removed. The overall risk score moved from ${before.toFixed(1)} to ${after.toFixed(1)}.`
    : "The two versions have the same clauses.";
  return { verdict, summary, changes: [] };
}

/** Builds the full comparison of two analyzed sessions owned by the same user. */
export async function compareSessions(userId, base, revised) {
  const [baseClauses, revisedClauses] = await Promise.all([clausesOf(userId, base.session_id), clausesOf(userId, revised.session_id)]);
  const { changes, unchanged } = diffClauses(baseClauses, revisedClauses);
  const risks = diffRisks(risksOf(base), risksOf(revised));

  // Show each change's severity before/after when a flagged risk sits on that clause.
  const riskByHeading = (list) => new Map(list.map((r) => [normalizeHeading(r.heading), r.severity]));
  const beforeSev = riskByHeading(risksOf(base));
  const afterSev = riskByHeading(risksOf(revised));
  for (const c of changes) {
    const h = normalizeHeading(c.heading);
    c.severity_before = c.kind === "added" ? null : (beforeSev.get(h) ?? null);
    c.severity_after = c.kind === "removed" ? null : (afterSev.get(h) ?? null);
  }

  const beforeScore = base.aggregation?.risk_score ?? 0;
  const afterScore = revised.aggregation?.risk_score ?? 0;

  // The model sees the changes most likely to matter: flagged ones first, then the most rewritten.
  const weight = (c) => Math.max(SEVERITY_RANK[c.severity_before] ?? 0, SEVERITY_RANK[c.severity_after] ?? 0);
  const forModel = [...changes]
    .sort((a, b) => weight(b) - weight(a) || a.similarity - b.similarity)
    .slice(0, config.maxCompareChanges)
    .map((c) => ({ key: c.key, kind: c.kind, heading: c.heading, before: clip(c.before), after: clip(c.after) }));

  let verdict;
  if (!forModel.length) {
    verdict = fallbackVerdict(beforeScore, afterScore, changes);
  } else {
    try {
      const data = await callGroqJson({
        system: compareSystem,
        user: compareUser({
          document_type: revised.document_type || "contract",
          before_score: beforeScore.toFixed(1),
          after_score: afterScore.toFixed(1),
          changes_json: JSON.stringify(forModel, null, 2),
        }),
        maxTokens: config.maxTokens.compare,
      });
      verdict = ComparisonVerdict.parse(data);
    } catch (err) {
      console.error(`Compare verdict failed: ${err.message}`);
      verdict = fallbackVerdict(beforeScore, afterScore, changes);
    }
  }

  const notes = new Map(verdict.changes.map((c) => [c.key, c]));
  return {
    verdict: verdict.verdict,
    summary: verdict.summary,
    before: { overall_risk: base.aggregation?.overall_risk ?? null, risk_score: beforeScore },
    after: { overall_risk: revised.aggregation?.overall_risk ?? null, risk_score: afterScore },
    unchanged,
    changes: changes.map((c) => ({ ...c, impact: notes.get(c.key)?.impact ?? null, note: notes.get(c.key)?.note ?? null })),
    risks,
  };
}
