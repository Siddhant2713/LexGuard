import { config } from "../config.js";
import { HttpError } from "../lib/httpError.js";
import { User } from "../models/User.js";
import { verifyToken } from "../services/tokenService.js";

// Authentication: resolves the session cookie (or a Bearer token for non-browser clients)
// to a live user and attaches it as req.user. Everything downstream scopes data by req.user.id.
export async function requireAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    const token = req.cookies?.[config.cookie.name] ?? (header?.startsWith("Bearer ") ? header.slice(7) : null);
    const payload = token && verifyToken(token);
    if (!payload) throw new HttpError(401, "Authentication required.");

    const user = await User.findById(payload.sub);
    // A deleted user or a bumped token_version revokes the token immediately.
    if (!user || user.token_version !== payload.tv) throw new HttpError(401, "Authentication required.");

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}
