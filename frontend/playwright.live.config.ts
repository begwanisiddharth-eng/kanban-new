import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runs the live specs against the real Groq API (needs GROQ_API_KEY).
// Serial and slow on purpose: the free tier allows 8,000 tokens a minute.
const PORT = 3200;
const CHAT_PORT = 3201;

export default defineConfig({
  testDir: "tests/live",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 60_000 },
  reporter: "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: `uv run --directory ../chat uvicorn app.main:app --port ${CHAT_PORT}`,
      url: `http://127.0.0.1:${CHAT_PORT}/health`,
      timeout: 120_000,
    },
    {
      command: "npm run build && npm start --prefix ../backend",
      url: `http://localhost:${PORT}/api/auth/me`,
      env: {
        PORT: String(PORT),
        CHAT_URL: `http://127.0.0.1:${CHAT_PORT}`,
        DATABASE_PATH: join(tmpdir(), `kanban-live-${Date.now()}.db`),
      },
      timeout: 180_000,
    },
  ],
});
