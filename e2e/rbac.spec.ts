import { test, expect, loginAs, DEMO_USERS } from "./fixtures";

test.describe("RBAC route boundaries", () => {
  test("Coordinator is redirected away from CEO-only pages", async ({ page }) => {
    await loginAs(page, DEMO_USERS.coordinator.username);

    for (const path of ["/locations", "/audit-logs", "/catalog/training-paths", "/users/ceos"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("Consultant is redirected away from every management page", async ({ page }) => {
    await loginAs(page, DEMO_USERS.consultant.username);

    for (const path of ["/users/management", "/locations", "/reports/exports"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("Manager cannot reach CEO-only Locations or catalog structure pages", async ({ page }) => {
    await loginAs(page, DEMO_USERS.manager.username);

    for (const path of ["/locations", "/catalog/training-paths"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard/);
    }
  });

  test("An unauthenticated visitor hitting any protected page lands on /login", async ({ page }) => {
    await page.goto("/users/management");
    await expect(page).toHaveURL(/\/login/);
  });
});
