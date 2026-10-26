import { z } from "zod";

// Every auth input passes through these. Using z.string() (not z.any()) also defeats NoSQL
// operator injection such as { "email": { "$gt": "" } }, and .strict() rejects unknown fields
// so nobody can smuggle in fields like `role` or `token_version`.

const noControlChars = (s) => !/[\u0000-\u001f\u007f]/.test(s);

const email = z
  .string({ required_error: "Email is required" })
  .trim()
  .toLowerCase()
  .max(254, "Email is too long")
  .email("Enter a valid email address")
  .refine(noControlChars, "Email contains invalid characters");

// Letters (any language), digits and a few name punctuation marks. Rejecting < > & " ` etc.
// at the door means stored names can never carry markup, whatever renders them later.
const name = z
  .string({ required_error: "Name is required" })
  .trim()
  .min(1, "Name is required")
  .max(60, "Name must be 60 characters or fewer")
  .regex(/^[\p{L}\p{M}0-9][\p{L}\p{M}0-9 .'-]*$/u, "Name may only contain letters, numbers, spaces, . ' -");

// bcrypt only hashes the first 72 BYTES, so longer passwords would be silently truncated.
const password = z
  .string({ required_error: "Password is required" })
  .min(8, "Password must be at least 8 characters")
  .refine((p) => Buffer.byteLength(p) <= 72, "Password must be at most 72 bytes")
  .refine(noControlChars, "Password contains invalid characters")
  .refine((p) => /\p{L}/u.test(p) && /\d/.test(p), "Password must contain at least one letter and one number");

export const RegisterInput = z.object({ name, email, password }).strict();

// Login deliberately skips the strength rules: it must accept whatever was stored, and must
// not reveal the rules to someone probing.
export const LoginInput = z
  .object({
    email,
    password: z.string().min(1).refine((p) => Buffer.byteLength(p) <= 72).refine(noControlChars),
  })
  .strict();
