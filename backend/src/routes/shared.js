import { Router } from "express";
import rateLimit from "express-rate-limit";
import { HttpError } from "../lib/httpError.js";
import { wrap } from "../lib/wrap.js";
import { Session } from "../models/index.js";
import { User } from "../models/User.js";

// Public, read-only reports behind a share link. No auth: the token is the credential.
export const sharedRouter = Router();

const TOKEN = /^[A-Za-z0-9_-]{32}$/;
const GONE = "This link isn't active. Ask the person who shared it for a new one.";

sharedRouter.get(
  "/:token",
  rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false, message: { detail: "Rate limit exceeded. Please slow down." } }),
  wrap(async (req, res) => {
    const { token } = req.params;
    if (!TOKEN.test(token)) throw new HttpError(404, GONE);
    const s = await Session.findOne({ share_token: token }).lean();
    // Sharing is a Pro feature, so links stop working when the owner's Pro runs out.
    const owner = s && (await User.findById(s.user_id));
    if (!s || !s.aggregation || !owner?.isPro()) throw new HttpError(404, GONE);

    res.set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" });
    // Only the report: no ids, owner details or chat.
    res.json({
      filename: s.filename,
      pass1_result: s.pass1_result,
      risk_report: s.risk_report,
      aggregation: s.aggregation,
      summary: s.summary,
    });
  }),
);
