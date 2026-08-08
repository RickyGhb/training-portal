import { test as base, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/**
 * This suite runs against the app's one and only database — a real, shared
 * Supabase instance also used for live demos (see scripts/seed-demo.ts).
 * There is no separate test DB. Safety rules that follow from that:
 *
 *  - Journeys that only need to *view* data log in as one of the seeded demo
 *    accounts below and never mutate anything.
 *  - Journeys that must create/edit/delete a user do so through a disposable
 *    account whose username is prefixed "e2e-" + a random run id, and every
 *    test that creates one MUST delete it via `deleteDisposableUsers()` in an
 *    `afterEach`/`afterAll` — never leave e2e-prefixed rows behind.
 *  - Nothing here ever touches the seeded demo accounts' own state (no
 *    deactivating/deleting/resetting spatel, tbrooks, tempadmin, etc.),
 *    since those are what tomorrow's live demo walks through.
 */

export const DEMO_PASSWORD = "Demo#2026!";

export const DEMO_USERS = {
  ceo: { username: "tempadmin", role: "CEO" as const },
  manager: { username: "arivera", role: "MANAGER" as const },
  locationManager: { username: "mlee", role: "LOCATION_MANAGER" as const },
  coordinator: { username: "tbrooks", role: "COORDINATOR" as const },
  consultant: { username: "spatel", role: "CONSULTANT" as const },
};

export async function loginAs(page: Page, username: string, password = DEMO_PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** A unique, clearly-disposable username for a single test run. Never reused across tests. */
export function disposableUsername(label: string) {
  const runId = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  return `e2e-${label}-${runId}`.toLowerCase().slice(0, 48);
}

export const DISPOSABLE_PASSWORD = "E2eTestPass!42";

/**
 * Hard-deletes every user whose username starts with "e2e-". Call from
 * afterEach/afterAll in any test that creates one. Runs as a `tsx`-loaded
 * child process rather than importing the generated Prisma client directly
 * into the Playwright test process — see scripts/e2e-cleanup-disposable-users.ts.
 */
export function deleteDisposableUsers() {
  const repoRoot = join(__dirname, "..");
  execFileSync(
    process.execPath,
    ["--env-file=.env.local", "-r", "tsx/cjs", "scripts/e2e-cleanup-disposable-users.ts"],
    { cwd: repoRoot, stdio: "inherit" }
  );
}

export const test = base;
export { expect };
