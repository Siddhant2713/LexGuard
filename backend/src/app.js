import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import multer from "multer";

import { config } from "./config.js";
import { HttpError } from "./lib/httpError.js";
import { originGuard } from "./middleware/security.js";
import { authRouter } from "./routes/auth.js";
import { contractsRouter } from "./routes/contracts.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", config.trustProxy);
  app.disable("x-powered-by");

  app.use(helmet());
  app.use(cors({ origin: config.allowedOrigins, credentials: true, methods: ["GET", "POST", "DELETE"] }));
  app.use(express.json({ limit: "100kb" }));
  app.use(cookieParser());
  app.use(originGuard);

  app.get("/health", (_req, res) => res.json({ status: "ok", version: "2.0.0" }));
  app.use("/auth", authRouter);
  app.use(contractsRouter);

  // Error shape `{ detail }` matches what the frontend already reads.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (res.headersSent) return res.end();
    if (err instanceof multer.MulterError) {
      const tooBig = err.code === "LIMIT_FILE_SIZE";
      return res.status(tooBig ? 413 : 400).json({ detail: tooBig ? "File too large. Maximum size is 20MB." : err.message });
    }
    // Malformed JSON body or oversized payload from express.json()
    if (err.type === "entity.parse.failed") return res.status(400).json({ detail: "Malformed JSON body." });
    if (err.type === "entity.too.large") return res.status(413).json({ detail: "Request body too large." });

    if (err instanceof HttpError) return res.status(err.status).json({ detail: err.message, ...(err.fields && { fields: err.fields }) });
    console.error(err);
    res.status(500).json({ detail: "Internal server error" });
  });
  return app;
}
