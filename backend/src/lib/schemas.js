import { z } from "zod";

export const SEVERITIES = ["critical", "high", "medium", "low"];
export const CATEGORIES = [
  "employment", "ip", "privacy", "liability", "arbitration",
  "payment", "termination", "non_compete", "data", "other",
];

// LLMs return "HIGH", "non-compete", etc. — coerce into the allowed set instead of failing.
const severity = z.preprocess(
  (v) => (SEVERITIES.includes(String(v).toLowerCase()) ? String(v).toLowerCase() : "medium"),
  z.enum(SEVERITIES),
);
const category = z.preprocess((v) => {
  const c = String(v).toLowerCase().replace(/[-\s]/g, "_");
  return CATEGORIES.includes(c) ? c : "other";
}, z.enum(CATEGORIES));

export const RawClause = z.object({
  id: z.string(),
  heading: z.string(),
  text: z.string(),
  category,
  suspicion_score: z.coerce.number(),
});

export const Pass1Result = z.object({
  document_type: z.string(),
  parties: z.array(z.string()),
  governing_law: z.string().nullish().transform((v) => v ?? null),
  clauses: z.array(RawClause),
});

export const RiskAnalysis = z.object({
  clause_id: z.string(),
  severity,
  risk_type: z.string(),
  affects: z.array(z.string()),
  plain_english: z.string(),
  // Prepend rather than reject when the model forgets the required opener.
  consequence: z.string().transform((v) => (v.startsWith("If you sign this") ? v : `If you sign this, ${v}`)),
  red_flags: z.array(z.string()),
  negotiation_tip: z.string(),
});

export const AggregationResult = z.object({
  overall_risk: severity,
  risk_score: z.coerce.number(),
  major_concerns: z.array(z.string()),
  summary: z.string(),
  favors: z.string(),
});

export const ChatRequest = z.object({
  session_id: z.string().min(1),
  query: z.string().min(1).max(2000),
});

// ─── Billing / compare ───────────────────────────────────────────────────────

// What Razorpay Checkout hands the browser on success. Shapes are pinned so nothing but plain
// ids reaches a query.
export const VerifyPaymentInput = z
  .object({
    razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
    razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
    razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const sessionId = z.string().uuid();

export const CompareInput = z
  .object({ base_session_id: sessionId, revised_session_id: sessionId })
  .strict()
  .refine((v) => v.base_session_id !== v.revised_session_id, "Pick two different contracts.");

export const ComparisonVerdict = z.object({
  verdict: z.preprocess(
    (v) => (["better", "worse", "mixed", "same"].includes(String(v).toLowerCase()) ? String(v).toLowerCase() : "mixed"),
    z.enum(["better", "worse", "mixed", "same"]),
  ),
  summary: z.string(),
  changes: z
    .array(
      z.object({
        key: z.string(),
        impact: z.preprocess(
          (v) => (["better", "worse", "neutral"].includes(String(v).toLowerCase()) ? String(v).toLowerCase() : "neutral"),
          z.enum(["better", "worse", "neutral"]),
        ),
        note: z.string(),
      }),
    )
    .default([]),
});
