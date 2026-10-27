import { Router } from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { config } from "../config.js";
import { wrap } from "../lib/wrap.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePro } from "../middleware/plan.js";
import * as contracts from "../controllers/contractController.js";

export const contractsRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.maxUploadBytes } });
const limit = (max) =>
  rateLimit({ windowMs: 60_000, max, standardHeaders: true, legacyHeaders: false,
    message: { detail: "Rate limit exceeded. Please slow down." } });

contractsRouter.use(requireAuth);

contractsRouter.get("/contracts", wrap(contracts.listContracts));
contractsRouter.delete("/contracts/:sessionId", wrap(contracts.deleteContract));
contractsRouter.post("/upload", limit(10), upload.single("file"), wrap(contracts.upload));
contractsRouter.post("/analyze", limit(5), wrap(contracts.analyze));
contractsRouter.get("/analyze/progress", wrap(contracts.analyzeProgress));
contractsRouter.post("/chat", wrap(contracts.chat));
contractsRouter.get("/report/:sessionId", wrap(contracts.report));
contractsRouter.get("/chat/:sessionId/history", wrap(contracts.chatHistory));

// Pro features. requirePro answers 402 before any work is done.
contractsRouter.post("/contracts/:sessionId/share", requirePro("Sharing reports"), wrap(contracts.shareContract));
contractsRouter.delete("/contracts/:sessionId/share", wrap(contracts.unshareContract));
contractsRouter.get("/comparisons", requirePro("Comparing contracts"), wrap(contracts.listComparisons));
contractsRouter.post("/compare", requirePro("Comparing contracts"), limit(5), wrap(contracts.createComparison));
contractsRouter.get("/compare/:comparisonId", requirePro("Comparing contracts"), wrap(contracts.getComparison));
