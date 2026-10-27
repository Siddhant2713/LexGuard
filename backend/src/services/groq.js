import Groq from "groq-sdk";
import { config } from "../config.js";

// maxRetries: 0 — retries are handled below so they respect our token budget.
let client;
export const getGroq = () => (client ??= new Groq({ apiKey: config.groqApiKey, maxRetries: 0 }));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── Token budget ────────────────────────────────────────────────────────────
// Groq meters tokens-per-minute per model as a token bucket that refills continuously
// (x-ratelimit-remaining-tokens climbs back at limit/60 per second; x-ratelimit-reset-tokens is
// seconds, not a minute). We mirror that locally so calls wait only as long as Groq would make
// them, instead of eating 429s. A call reserves its estimated worst case up front, then gets the
// unused part back as soon as the real usage is known.
const buckets = new Map();

const estimateTokens = (chars, maxTokens) => Math.ceil(chars / 3.5) + maxTokens;

export async function reserveTokens(model, chars, maxTokens) {
  const capacity = Math.floor(config.tpmLimit * 0.9);
  const perMs = capacity / 60_000;
  const cost = Math.min(estimateTokens(chars, maxTokens), capacity); // never wait for an impossible fit
  if (!buckets.has(model)) buckets.set(model, { level: capacity, at: Date.now() });
  const bucket = buckets.get(model);
  const refill = () => {
    const now = Date.now();
    bucket.level = Math.min(capacity, bucket.level + (now - bucket.at) * perMs);
    bucket.at = now;
  };

  for (;;) {
    refill();
    if (bucket.level >= cost) {
      bucket.level -= cost;
      let settled = false;
      return {
        // Refund what the call didn't use. Usage includes reasoning tokens.
        settle: (actual) => {
          if (settled || actual == null) return;
          settled = true;
          refill();
          bucket.level = Math.min(capacity, bucket.level + Math.max(0, cost - actual));
        },
      };
    }
    await sleep(Math.ceil((cost - bucket.level) / perMs) + 50);
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
export async function callGroqJson({ system, user, maxTokens, model = config.groqModel }) {
  let tokens = maxTokens;
  for (let attempt = 1; ; attempt++) {
    const budget = await reserveTokens(model, system.length + user.length, tokens);
    try {
      const res = await getGroq().chat.completions.create({
        model,
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
      // Groq didn't run a rejected request, so none of its reservation was spent.
      if (err?.status === 429) budget.settle(0);
      if (!isRetryable(err) || attempt >= MAX_ATTEMPTS) throw err;
      if (isTruncatedJson(err)) tokens = Math.min(Math.ceil(tokens * 1.5), 4096);
      const wait = err?.status === 429 ? (retryAfterMs(err) ?? 5000) : 1000 * attempt;
      console.warn(`Retryable Groq error (${String(err.message).slice(0, 90)}), retry ${attempt} in ${wait}ms`);
      await sleep(wait);
    }
  }
}
