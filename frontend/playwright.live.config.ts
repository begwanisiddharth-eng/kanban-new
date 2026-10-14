import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runs the live specs against the real OpenAI API (needs OPENAI_API_KEY).
// Serial on purpose, to stay inside the account's rate limits.
//
// The webServer processes below load the root .env themselves, but this
// config file's own process does not; without this, test.skip(!process.env
// .OPENAI_API_KEY) in the specs always skips, reporting a false "passed".
// This file has no "type": "module" in frontend/package.json, so it runs as
// CommonJS (Playwright's own loader): __dirname, not import.meta.url.
const ENV_FILE = join(__dirname, "..", ".env");
if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

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
