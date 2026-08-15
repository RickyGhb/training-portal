import { defineConfig, devices } from "@playwright/test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Tests need DATABASE_URL (disposable-user teardown) and the app itself reads
// its own .env.local for the dev server — load it once here since Playwright's
// config isn't run through `node --env-file` the way the app's npm scripts are.
const envFile = join(__dirname, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf-8").split("\n")) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (!match) continue;
    const [, key, rawValue = ""] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^["']|["']$/g, "");
  }
}

const PORT = 3000;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // Single worker, not parallel: every test shares one real database and the
  // CONSULTANT role enforces a single active session, so two tests logging
  // in as the same demo consultant at once would revoke each other's session
  // mid-test. Not worth splitting across a separate test DB for this suite's
  // size — see e2e/fixtures.ts for the full data-safety rationale.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["html", { open: "never" }], ["github"]] : "html",
  timeout: 30_000,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Reuses an already-running `npm run dev` locally (fast iteration); CI always
  // boots a fresh server against the real DB, so mutating tests must clean up
  // after themselves — see e2e/fixtures.ts.
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    // Nearly every spec's first action logs in as the same seeded CEO
    // account (see e2e/fixtures.ts's loginAs()) — running the full suite
    // against an environment where Upstash IS configured would otherwise
    // exhaust that account's per-username login limit partway through. See
    // src/lib/rateLimit.ts's `disabled` guard. Never set outside this file.
    env: { ...process.env, RATE_LIMIT_DISABLED: "true" },
  },
});
