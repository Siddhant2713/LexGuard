import jwt from "jsonwebtoken";
import { config } from "../config.js";

const ISSUER = "lexguard";

export const signToken = (user) =>
  jwt.sign({ tv: user.token_version }, config.jwtSecret, {
    algorithm: "HS256",
    subject: String(user._id),
    issuer: ISSUER,
    expiresIn: config.jwtExpiresInSec,
  });

// Pinning the algorithm blocks `alg: none` and HS/RS confusion attacks. Returns null if invalid.
export function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"], issuer: ISSUER });
  } catch {
    return null;
  }
}

const cookieBase = () => ({
  httpOnly: true, // not readable from JS, so an XSS bug can't steal the session
  secure: config.cookie.secure,
  sameSite: config.cookie.sameSite,
  path: "/",
});

export const setSessionCookie = (res, token) =>
  res.cookie(config.cookie.name, token, { ...cookieBase(), maxAge: config.jwtExpiresInSec * 1000 });

export const clearSessionCookie = (res) => res.clearCookie(config.cookie.name, cookieBase());
