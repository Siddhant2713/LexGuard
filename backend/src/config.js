import { fileURLToPath } from "node:url";

// Load backend/.env regardless of the working directory; real env vars take precedence.
try {
  process.loadEnvFile(fileURLToPath(new URL("../.env", import.meta.url)));
} catch {
  /* no .env file — rely on the process environment */
}

const env = process.env;

const required = (name) => {
  if (!env[name]) throw new Error(`${name} is required. Set it in backend/.env`);
  return env[name];
};

export const config = {
  port: Number(env.PORT || 8000),
  allowedOrigins: (env.ALLOWED_ORIGINS || "http://localhost:3000,http://localhost:3001")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean),

  get mongodbUri() { return required("MONGODB_URI"); },
  // Signing key for session JWTs. Generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  get jwtSecret() {
    const secret = required("JWT_SECRET");
    if (secret.length < 32) throw new Error("JWT_SECRET must be at least 32 characters.");
    return secret;
  },
  jwtExpiresInSec: 7 * 24 * 60 * 60,
  cookie: {
    name: "lexguard_session",
    // `secure` is required for SameSite=None (cross-site frontend/API in production).
    secure: env.NODE_ENV === "production",
    sameSite: env.COOKIE_SAMESITE || "lax",
  },
  bcryptRounds: 12,
  maxFailedLogins: 5,
  lockMinutes: 15,
  // Set to the number of reverse proxies in front of the API so rate limiting sees real client IPs.
  trustProxy: Number(env.TRUST_PROXY || 0),

  get groqApiKey() { return required("GROQ_API_KEY"); },

  groqModel: env.GROQ_MODEL || "openai/gpt-oss-120b",
  groqChatModel: env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b",
  // Pass 3 only summarizes Pass 2's output. Groq budgets tokens per model, so running it on a
  // different model than Pass 2 means it doesn't queue behind Pass 2's token usage.
  groqAggregationModel: env.GROQ_AGGREGATION_MODEL || env.GROQ_CHAT_MODEL || "openai/gpt-oss-20b",

  // gpt-oss models spend part of this budget on reasoning, so keep headroom above the JSON size.
  maxTokens: { pass1: 3000, pass2: 1200, aggregation: 1000, chat: 1024, compare: 1800 },
  // Changes sent to the model per comparison; the diff itself always covers every clause.
  maxCompareChanges: 12,
  reasoningEffort: env.GROQ_REASONING_EFFORT || "low",
  // Groq's free tier allows 8000 tokens/min per model; requested max_tokens count against it.
  tpmLimit: Number(env.GROQ_TPM || 8000),
  maxClausesPass2: 10,
  pass2Concurrency: Number(env.PASS2_CONCURRENCY || 3),
  chatTopK: 3,
  // Pass 1 sees only this much of the document. 16k chars (~4k tokens) fits the free-tier TPM
  // alongside the output budget; raise it (with GROQ_TPM) on a paid tier.
  maxContextChars: Number(env.MAX_CONTEXT_CHARS || 16_000),
  maxUploadBytes: 20 * 1024 * 1024,

  // ─── Plans & billing ───────────────────────────────────────────────────────
  // Live keys from Razorpay Dashboard → Account & Settings → API Keys.
  get razorpayKeyId() { return required("RAZORPAY_KEY_ID"); },
  get razorpayKeySecret() { return required("RAZORPAY_KEY_SECRET"); },
  // A secret you choose when adding the webhook (Dashboard → Webhooks) for POST /billing/webhook.
  // Optional: without it the webhook is disabled and payments are confirmed by /billing/verify alone.
  razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET || null,
  // Pro is a one-time pass: this amount (in paise) buys `days` of Pro, stacked on any time left.
  pro: { amount: 49_900, currency: "INR", days: 30 },
  freeUploadsPerMonth: 3,
  retryDelaysMs: [5000, 15000, 30000],
};
