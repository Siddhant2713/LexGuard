import { config } from "../config.js";
import { HttpError } from "../lib/httpError.js";
import { Usage } from "../models/index.js";

// What each plan may do. Routes check these; the frontend only mirrors them for display.
//   free: 3 uploads per calendar month (UTC), clause analysis, chat
//   pro:  unlimited uploads, export, share links, compare

export const proRequired = (feature) =>
  Object.assign(new HttpError(402, `${feature} is part of LexGuard Pro.`), { code: "PRO_REQUIRED" });

export const currentPeriod = (now = new Date()) => now.toISOString().slice(0, 7);

/** First instant of next month (UTC), when the free allowance resets. */
export function periodResetsAt(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
}

export async function uploadsThisPeriod(userId) {
  const row = await Usage.findOne({ user_id: userId, period: currentPeriod() }).lean();
  return row?.uploads ?? 0;
}

/**
 * Claims one upload from the free allowance before any expensive work starts, and returns a
 * function that gives it back if the upload then fails. Pro users aren't counted.
 *
 * The claim is one conditional increment (`uploads < limit`), so concurrent uploads can't
 * overshoot the limit. The month's row is created first on its own, because a conditional
 * upsert would race other first-of-the-month claims on the unique index.
 */
export async function claimUpload(user) {
  if (user.isPro()) return async () => {};
  const filter = { user_id: user._id, period: currentPeriod() };
  try {
    await Usage.updateOne(filter, { $setOnInsert: { uploads: 0 } }, { upsert: true });
  } catch (err) {
    if (err.code !== 11000) throw err; // another claim created it first
  }
  const claimed = await Usage.updateOne({ ...filter, uploads: { $lt: config.freeUploadsPerMonth } }, { $inc: { uploads: 1 } });
  if (!claimed.modifiedCount) {
    throw Object.assign(
      new HttpError(402, `You've used all ${config.freeUploadsPerMonth} free contracts this month. Upgrade to Pro for unlimited contracts.`),
      { code: "QUOTA_EXCEEDED" },
    );
  }
  return async () => {
    await Usage.updateOne({ ...filter, uploads: { $gt: 0 } }, { $inc: { uploads: -1 } });
  };
}
