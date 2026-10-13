import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3100;
const CHAT_PORT = 3101;
const FAKE_GROQ_PORT = 3199;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node tests/e2e/fake-groq.mjs",
      port: FAKE_GROQ_PORT,
      env: { FAKE_GROQ_PORT: String(FAKE_GROQ_PORT) },
    },
    {
      command: `uv run --directory ../chat uvicorn app.main:app --port ${CHAT_PORT}`,
      url: `http://127.0.0.1:${CHAT_PORT}/health`,
      env: {
        GROQ_API_KEY: "test-key",
        GROQ_API_BASE: `http://127.0.0.1:${FAKE_GROQ_PORT}/v1`,
      },
      timeout: 120_000,
    },
    {
      command: "npm run build && npm start --prefix ../backend",
      url: `http://localhost:${PORT}/api/auth/me`,
      env: {
        PORT: String(PORT),
        CHAT_URL: `http://127.0.0.1:${CHAT_PORT}`,
        DATABASE_PATH: join(tmpdir(), `kanban-e2e-${Date.now()}.db`),
      },
      timeout: 180_000,
    },
  ],
});
