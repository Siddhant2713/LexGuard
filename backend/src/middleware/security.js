import { config } from "../config.js";
import { HttpError } from "../lib/httpError.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// CSRF defence in depth on top of SameSite cookies: a state-changing request that carries an
// Origin header must come from an allowed frontend. Browsers always send Origin on cross-site
// POSTs, so a forged form on another site is rejected. Non-browser clients send none.
export function originGuard(req, _res, next) {
  const origin = req.headers.origin;
  if (!SAFE_METHODS.has(req.method) && origin && !config.allowedOrigins.includes(origin)) {
    return next(new HttpError(403, "Origin not allowed."));
  }
  next();
}
