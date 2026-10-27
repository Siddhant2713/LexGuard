import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    // select:false keeps the hash out of every query unless explicitly requested.
    password_hash: { type: String, required: true, select: false },
    failed_logins: { type: Number, default: 0 },
    lock_until: { type: Date, default: null },
    // Bumping this invalidates every JWT issued earlier (logout-everywhere, password change).
    token_version: { type: Number, default: 0 },
    // Pro is active while this is in the future. Only the billing service writes it.
    pro_until: { type: Date, default: null },
    // Orders already credited to pro_until. Checked in the same atomic update that extends it,
    // so a payment confirmed by both the browser and the webhook is only counted once.
    pro_orders: { type: [String], default: [], select: false },
  },
  { timestamps: true },
);

userSchema.methods.isPro = function isPro(now = new Date()) {
  return Boolean(this.pro_until && this.pro_until > now);
};

userSchema.methods.toPublic = function toPublic() {
  return {
    id: String(this._id),
    name: this.name,
    email: this.email,
    created_at: this.createdAt,
    plan: this.isPro() ? "pro" : "free",
    pro_until: this.isPro() ? this.pro_until : null,
  };
};

export const User = mongoose.model("User", userSchema);
