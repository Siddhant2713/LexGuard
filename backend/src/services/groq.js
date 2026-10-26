import Groq from "groq-sdk";
import { config } from "../config.js";

// maxRetries: 0 — retries are handled below so they respect our token budget.
let client;
export const getGroq = () => (client ??= new Groq({ apiKey: config.groqApiKey, maxRetries: 0 }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Token budget ────────────────────────────────────────────────────────────
// Groq enforces tokens-per-minute per model, counting the requested max_tokens at admission.
// We keep a 60s sliding window per model and wait before sending instead of eating 429s.
const WINDOW_MS = 60_000;
const windows = new Map();

const estimateTokens = (chars, maxTokens) => Math.ceil(chars / 3.5) + maxTokens;

export async function reserveTokens(model, chars, maxTokens) {
  const limit = Math.floor(config.tpmLimit * 0.9);
  const cost = Math.min(estimateTokens(chars, maxTokens), limit); // never wait for an impossible fit
  const entries = windows.get(model) ?? [];
  windows.set(model, entries);

  for (;;) {
    const now = Date.now();
    while (entries.length && now - entries[0].at >= WINDOW_MS) entries.shift();
    const used = entries.reduce((n, e) => n + e.tokens, 0);
    if (used + cost <= limit) {
      const entry = { at: now, tokens: cost };
      entries.push(entry);
      // Once the real usage is known, shrink the reservation so other calls can proceed.
      return { settle: (actual) => actual && (entry.tokens = Math.min(actual, entry.tokens)) };
    }
    await sleep(Math.max(entries[0].at + WINDOW_MS - now, 100) + 50);
  }
}

// ─── JSON calls ──────────────────────────────────────────────────────────────
const stripFences = (t) => t.trim().replace(/^```(?:json)?\n?/, "").replace(/```$/, "").trim();
const cleanJson = (t) => stripFences(t).replace(/,\s*([}\]])/g, "$1");

// Seconds the server asked us to wait, from the retry-after header or the error message.
function retryAfterMs(err) {
  const header = Number(err?.headers?.["retry-after"]);
  if (header > 0) return header * 1000 + 500;
  const m = /try again in ([\d.]+)(ms|s)/i.exec(err?.message ?? "");
  if (m) return Number(m[1]) * (m[2] === "ms" ? 1 : 1000) + 500;
  return null;
}

const isTruncatedJson = (err) => err?.status === 400 && /json_validate_failed/.test(err?.message ?? "");

function isRetryable(err) {
  if (err instanceof SyntaxError || isTruncatedJson(err)) return true;
  if (err?.status === 429 || err?.status >= 500) return true;
  return /connection|ECONN|ENOTFOUND|timeout/i.test(String(err?.message));
}

const MAX_ATTEMPTS = 4;

// Calls Groq in JSON mode. Retries on rate limits (honouring retry-after), 5xx, network errors,
// malformed JSON, and output cut off by max_tokens (retried with a larger budget).
export async function callGroqJson({ system, user, maxTokens }) {
  let tokens = maxTokens;
  for (let attempt = 1; ; attempt++) {
    const budget = await reserveTokens(config.groqModel, system.length + user.length, tokens);
    try {
      const res = await getGroq().chat.completions.create({
        model: config.groqModel,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        reasoning_effort: config.reasoningEffort,
        temperature: 0.1,
        max_tokens: tokens,
      });
      budget.settle(res.usage?.total_tokens);
      return JSON.parse(cleanJson(res.choices[0].message.content));
    } catch (err) {
      if (!isRetryable(err) || attempt >= MAX_ATTEMPTS) throw err;
      if (isTruncatedJson(err)) tokens = Math.min(Math.ceil(tokens * 1.5), 4096);
      const wait = err?.status === 429 ? (retryAfterMs(err) ?? 5000) : 1000 * attempt;
      console.warn(`Retryable Groq error (${String(err.message).slice(0, 90)}), retry ${attempt} in ${wait}ms`);
      await sleep(wait);
    }
  }
}
