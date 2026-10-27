import mongoose from "mongoose";

const { Schema, model } = mongoose;
const Mixed = Schema.Types.Mixed;

// Nested AI results are validated by zod before they reach here, so they're stored as-is.
const sessionSchema = new Schema(
  {
    session_id: { type: String, required: true, unique: true },
    // Owner. Every read/write of a session is scoped by this, which is the authorization rule.
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    filename: { type: String, required: true },
    document_type: { type: String, default: "" },
    parties: { type: [String], default: [] },
    governing_law: { type: String, default: null },
    pass1_result: { type: Mixed, default: null },
    risk_report: { type: [Mixed], default: [] },
    aggregation: { type: Mixed, default: null },
    summary: { type: Mixed, default: {} },
    // Pass 2 progress while /analyze runs, polled by the progress screen.
    analysis_progress: { type: Mixed, default: null },
    // Set while the report is shared. Anyone holding it can read the report (not the chat).
    share_token: { type: String, default: undefined },
  },
  { timestamps: true, minimize: false },
);
sessionSchema.index({ share_token: 1 }, { unique: true, sparse: true });

const chunkSchema = new Schema({
  // Denormalized owner (same as the parent session's) so queries can be scoped without a join.
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  session_id: { type: String, required: true },
  chunk_id: { type: String, required: true },
  heading: { type: String, required: true },
  text: { type: String, required: true },
});
chunkSchema.index({ session_id: 1, chunk_id: 1 }, { unique: true });
chunkSchema.index({ user_id: 1, session_id: 1 });
// Chat retrieval: $text search scoped by session_id.
chunkSchema.index({ heading: "text", text: "text" });

const chatMessageSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    session_id: { type: String, required: true },
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

chatMessageSchema.index({ user_id: 1, session_id: 1, createdAt: -1 });

// One row per Razorpay order. Status only moves forward: created → paid → refunded.
const paymentSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    order_id: { type: String, required: true, unique: true },
    payment_id: { type: String, default: null },
    amount: { type: Number, required: true }, // paise
    currency: { type: String, required: true },
    days: { type: Number, required: true },
    status: { type: String, enum: ["created", "paid", "refunded"], default: "created" },
    paid_at: { type: Date, default: null },
    method: { type: String, default: null },
  },
  { timestamps: true },
);

// Free-plan upload counter per calendar month (UTC). Kept apart from sessions so deleting a
// contract doesn't hand the upload back.
const usageSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  period: { type: String, required: true }, // "2026-10"
  uploads: { type: Number, default: 0 },
});
usageSchema.index({ user_id: 1, period: 1 }, { unique: true });

const comparisonSchema = new Schema(
  {
    comparison_id: { type: String, required: true, unique: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    base_session_id: { type: String, required: true },
    revised_session_id: { type: String, required: true },
    result: { type: Mixed, required: true },
  },
  { timestamps: true, minimize: false },
);
comparisonSchema.index({ user_id: 1, base_session_id: 1, revised_session_id: 1 }, { unique: true });

export const Session = model("Session", sessionSchema);
export const Chunk = model("Chunk", chunkSchema);
export const ChatMessage = model("ChatMessage", chatMessageSchema);
export const Payment = model("Payment", paymentSchema);
export const Usage = model("Usage", usageSchema);
export const Comparison = model("Comparison", comparisonSchema);
