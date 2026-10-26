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
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return { id: String(this._id), name: this.name, email: this.email, created_at: this.createdAt };
};

export const User = mongoose.model("User", userSchema);
