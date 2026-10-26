import { Router } from "express";
import rateLimit from "express-rate-limit";
import { wrap } from "../lib/wrap.js";
import { requireAuth } from "../middleware/auth.js";
import * as auth from "../controllers/authController.js";

export const authRouter = Router();

const limiter = (windowMin, max) =>
  rateLimit({
    windowMs: windowMin * 60_000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { detail: "Too many attempts. Please try again later." },
  });

authRouter.post("/register", limiter(60, 10), wrap(auth.register));
authRouter.post("/login", limiter(15, 20), wrap(auth.login));
authRouter.post("/logout", requireAuth, wrap(auth.logout));
authRouter.get("/me", requireAuth, auth.me);
