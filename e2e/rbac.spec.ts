import { test, expect, loginAs, DEMO_USERS } from "./fixtures";

test.describe("RBAC route boundaries", () => {
  test("Coordinator is redirected away from CEO-only pages", async ({ page }) => {
    await loginAs(page, DEMO_USERS.coordinator.username);

    for (const path of ["/locations", "/audit-logs", "/catalog/training-paths"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("Orphaned legacy per-role user-list routes redirect to the consolidated list", async ({ page }) => {
    await loginAs(page, DEMO_USERS.ceo.username);

    for (const path of ["/users/managers", "/users/location-managers", "/users/coordinators", "/users/consultants", "/users/ceos"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/users\/management/);
    }
  });

  test("Consultant is redirected away from every management page", async ({ page }) => {
    await loginAs(page, DEMO_USERS.consultant.username);

    for (const path of ["/users/management", "/locations", "/reports/exports"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("Location Manager cannot reach CEO-only Locations page", async ({ page }) => {
    await loginAs(page, DEMO_USERS.manager.username);

    await page.goto("/locations");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Location Manager can reach catalog structure pages (Training Paths, Courses)", async ({ page }) => {
    await loginAs(page, DEMO_USERS.manager.username);

    for (const path of ["/catalog/training-paths", "/catalog/courses"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, "\\/")));
    }
  });

  test("An unauthenticated visitor hitting any protected page lands on /login", async ({ page }) => {
    await page.goto("/users/management");
    await expect(page).toHaveURL(/\/login/);
  });
});
