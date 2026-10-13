import cookieParser from "cookie-parser";
import express from "express";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { authRouter } from "./routes/auth";
import { boardsRouter } from "./routes/boards";

const FRONTEND_DIR =
  process.env.FRONTEND_DIR ??
  fileURLToPath(new URL("../../frontend/out", import.meta.url));

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());

  app.use("/api/auth", authRouter);
  app.use("/api/boards", boardsRouter);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  if (existsSync(FRONTEND_DIR)) {
    app.use(express.static(FRONTEND_DIR, { extensions: ["html"] }));
    app.use((_req, res) => {
      res.status(404).sendFile(join(FRONTEND_DIR, "404.html"));
    });
  }
  return app;
}
