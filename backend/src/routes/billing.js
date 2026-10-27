import { Router } from "express";
import rateLimit from "express-rate-limit";
import { wrap } from "../lib/wrap.js";
import { requireAuth } from "../middleware/auth.js";
import * as billing from "../controllers/billingController.js";

export const billingRouter = Router();

const limit = (windowMin, max) =>
  rateLimit({ windowMs: windowMin * 60_000, max, standardHeaders: true, legacyHeaders: false,
    message: { detail: "Too many payment attempts. Please try again later." } });

billingRouter.get("/", requireAuth, wrap(billing.status));
billingRouter.post("/order", requireAuth, limit(60, 15), wrap(billing.createOrder));
billingRouter.post("/verify", requireAuth, limit(15, 30), wrap(billing.verify));
