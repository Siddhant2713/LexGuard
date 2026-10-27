import { config } from "../config.js";
import { callGroqJson } from "./groq.js";
import { Pass1Result, RiskAnalysis, AggregationResult } from "../lib/schemas.js";
import { pass1System, pass1User } from "../prompts/pass1.js";
import { pass2System, pass2User } from "../prompts/pass2.js";
import { aggregationSystem, aggregationUser } from "../prompts/aggregation.js";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

// Pass 1: structural extraction
export async function runPass1(rawText) {
  const data = await callGroqJson({
    system: pass1System,
    user: pass1User({ document_text: rawText.slice(0, config.maxContextChars) }),
    maxTokens: config.maxTokens.pass1,
  });
  data.clauses = (data.clauses ?? [])
    .sort((a, b) => (b.suspicion_score ?? 0) - (a.suspicion_score ?? 0))
    .slice(0, 15);

  const parsed = Pass1Result.safeParse(data);
  if (!parsed.success) throw new Error(`Pass 1 schema validation failed: ${parsed.error.message}`);
  if (!parsed.data.clauses.length) {
    throw Object.assign(new Error("No analyzable clauses were found. This doesn't look like a contract or agreement."), {
      code: "NO_CLAUSES",
    });
  }
  return parsed.data;
}

// Pass 2: per-clause risk analysis with bounded concurrency
async function analyzeClause(clause, documentType) {
  try {
    const data = await callGroqJson({
      system: pass2System,
      user: pass2User({
        document_type: documentType,
        clause_id: clause.id,
        heading: clause.heading,
        category: clause.category,
        clause_text: clause.text,
      }),
      maxTokens: config.maxTokens.pass2,
    });
    return RiskAnalysis.parse(data);
  } catch (err) {
    console.error(`Pass 2 failed for clause ${clause.id}: ${err.message}`);
    return null;
  }
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

// onProgress(done, total) fires as each clause finishes, for the progress screen.
export async function runPass2(pass1, onProgress = () => {}) {
  const clauses = pass1.clauses.slice(0, config.maxClausesPass2);
  let done = 0;
  const results = await mapWithConcurrency(clauses, config.pass2Concurrency, async (c) => {
    const result = await analyzeClause(c, pass1.document_type);
    onProgress(++done, clauses.length);
    return result;
  });
  const valid = results.filter(Boolean);
  if (valid.length < results.length) {
    console.error(`Pass 2: ${results.length - valid.length}/${results.length} clause analyses failed`);
  }
  if (!valid.length) throw new Error("All clause analyses failed. Check your GROQ_API_KEY and model quota.");
  return valid.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4));
}

// Pass 3: overall aggregation
export async function runAggregation(riskReport, documentType) {
  const summary = riskReport.map(({ severity, risk_type, affects, plain_english }) => ({
    severity, risk_type, affects, plain_english,
  }));
  const data = await callGroqJson({
    system: aggregationSystem,
    user: aggregationUser({ document_type: documentType, clauses_json: JSON.stringify(summary, null, 2) }),
    maxTokens: config.maxTokens.aggregation,
    model: config.groqAggregationModel,
  });
  const parsed = AggregationResult.safeParse(data);
  if (!parsed.success) throw new Error(`Aggregation schema validation failed: ${parsed.error.message}`);
  return parsed.data;
}

export function summarizeSeverities(riskReport) {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const { severity } of riskReport) if (severity in summary) summary[severity]++;
  return summary;
}
