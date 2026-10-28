import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
import { existsSync } from "node:fs";
const env = {
  ...process.env,
  DATABASE_PATH: resolve("data/e2e-agent.sqlite"),
  ARTIFACT_DIR: resolve("data/e2e-artifacts"),
  AI_AGENT_TEST_MODE: "1",
  AI_PROVIDER_API_KEY: "e2e-placeholder-not-a-key",
  NEXT_TELEMETRY_DISABLED: "1",
} as Record<string, string>;
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    trace: "retain-on-failure",
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
        (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    },
  },
  webServer: [
    {
      command:
        "node --import tsx tests/fixtures/reset.ts && npm run dev -- --port 3100",
      url: "http://127.0.0.1:3100/api/status",
      reuseExistingServer: false,
      timeout: 90000,
      env,
    },
    {
      command: "node --import tsx tests/fixtures/worker.ts",
      url: "http://127.0.0.1:3101",
      reuseExistingServer: false,
      timeout: 30000,
      env,
    },
  ],
});
