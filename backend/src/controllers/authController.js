import bcrypt from "bcryptjs";
import { config } from "../config.js";
import { HttpError } from "../lib/httpError.js";
import { RegisterInput, LoginInput } from "../lib/authSchemas.js";
import { User } from "../models/User.js";
import { signToken, setSessionCookie, clearSessionCookie } from "../services/tokenService.js";

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", config.bcryptRounds);
const BAD_CREDENTIALS = "Invalid email or password, or the account is temporarily locked.";

function parse(schema, body) {
  const result = schema.safeParse(body);
  if (result.success) return result.data;
  const fields = {};
  for (const issue of result.error.issues) fields[issue.path.join(".") || "_"] ??= issue.message;
  throw Object.assign(new HttpError(422, Object.values(fields)[0] ?? "Invalid input."), { fields });
}

export async function register(req, res) {
  const { name, email, password } = parse(RegisterInput, req.body);

  let user;
  try {
    user = await User.create({ name, email, password_hash: await bcrypt.hash(password, config.bcryptRounds) });
  } catch (err) {
    if (err.code === 11000) throw new HttpError(409, "An account with this email already exists.");
    throw err;
  }

  setSessionCookie(res, signToken(user));
  res.status(201).json({ user: user.toPublic() });
}

export async function login(req, res) {
  const { email, password } = parse(LoginInput, req.body);

  const user = await User.findOne({ email }).select("+password_hash");
  const locked = user?.lock_until && user.lock_until > new Date();
  // Always run bcrypt (against a dummy hash if needed) so timing is the same on every path.
  const valid = await bcrypt.compare(password, user && !locked ? user.password_hash : DUMMY_HASH);

  if (!user || locked || !valid) {
    if (user && !locked) {
      // Atomic increment: concurrent guesses can't slip past the counter.
      const updated = await User.findByIdAndUpdate(user._id, { $inc: { failed_logins: 1 } }, { new: true });
      if (updated.failed_logins >= config.maxFailedLogins) {
        await User.updateOne(
          { _id: user._id },
          { failed_logins: 0, lock_until: new Date(Date.now() + config.lockMinutes * 60_000) },
        );
      }
    }
    throw new HttpError(401, BAD_CREDENTIALS);
  }

  if (user.failed_logins || user.lock_until) {
    await User.updateOne({ _id: user._id }, { failed_logins: 0, lock_until: null });
  }
  setSessionCookie(res, signToken(user));
  res.json({ user: user.toPublic() });
}

// Bumps token_version so the token is dead server-side too, not just removed from the browser.
export async function logout(req, res) {
  await User.updateOne({ _id: req.user._id }, { $inc: { token_version: 1 } });
  clearSessionCookie(res);
  res.json({ ok: true });
}

export const me = (req, res) => res.json({ user: req.user.toPublic() });
