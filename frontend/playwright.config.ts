import { defineConfig, devices } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 3100;

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
  webServer: {
    command: "npm run build && npm start --prefix ../backend",
    url: `http://localhost:${PORT}/api/auth/me`,
    env: {
      PORT: String(PORT),
      DATABASE_PATH: join(tmpdir(), `kanban-e2e-${Date.now()}.db`),
    },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
