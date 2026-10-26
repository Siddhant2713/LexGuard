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
  },
  { timestamps: true, minimize: false },
);

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

export const Session = model("Session", sessionSchema);
export const Chunk = model("Chunk", chunkSchema);
export const ChatMessage = model("ChatMessage", chatMessageSchema);
