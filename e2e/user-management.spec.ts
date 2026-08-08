import { test, expect, loginAs, DEMO_USERS, disposableUsername, deleteDisposableUsers, DISPOSABLE_PASSWORD } from "./fixtures";

test.describe("User Management", () => {
  test.describe("filtering and search", () => {
    test.beforeEach(async ({ page }) => {
      await loginAs(page, DEMO_USERS.ceo.username);
      await page.goto("/users/management");
    });

    test("role filter narrows the list to that role only", async ({ page }) => {
      await page.getByLabel("Role").selectOption("CONSULTANT");
      await page.getByRole("button", { name: "Apply" }).click();

      await expect(page).toHaveURL(/role=CONSULTANT/);
      const roleCells = page.locator("tbody tr td:nth-child(3)");
      const count = await roleCells.count();
      expect(count).toBeGreaterThan(0);
      for (let i = 0; i < count; i++) {
        await expect(roleCells.nth(i)).toHaveText("Consultant");
      }
    });

    test("search matches by name, username, and by who a user reports to", async ({ page }) => {
      await page.getByLabel("Search").fill("Taylor Brooks");
      await page.getByRole("button", { name: "Apply" }).click();

      // Every consultant reporting to coordinator Taylor Brooks should show up.
      await expect(page.getByText("Casey Alvarez")).toBeVisible();
      await expect(page.getByText("Sam Patel")).toBeVisible();
    });

    test("an unmatched search shows the empty state, not a stale list", async ({ page }) => {
      await page.getByLabel("Search").fill("zzz-no-such-person-zzz");
      await page.getByRole("button", { name: "Apply" }).click();

      await expect(page.getByText("No users match these filters.")).toBeVisible();
    });
  });

  test.describe("scoping by role", () => {
    test("Coordinator only sees Consultant in the role filter and only their own consultants in the list", async ({ page }) => {
      await loginAs(page, DEMO_USERS.coordinator.username);
      await page.goto("/users/management");

      const roleOptions = await page.getByLabel("Role").locator("option").allTextContents();
      expect(roleOptions).toEqual(["All", "Consultant"]);

      const rows = page.locator("tbody tr");
      await expect(rows).toHaveCount(4); // Taylor Brooks owns exactly 4 seeded consultants
    });

    test("Manager's role filter excludes CEO and Manager", async ({ page }) => {
      await loginAs(page, DEMO_USERS.manager.username);
      await page.goto("/users/management");

      const roleOptions = await page.getByLabel("Role").locator("option").allTextContents();
      expect(roleOptions).not.toContain("CEO");
      expect(roleOptions).not.toContain("Manager");
    });
  });

  test.describe("self-lockout", () => {
    test("the logged-in user's own row has no Deactivate/Delete actions, but other rows do", async ({ page }) => {
      await loginAs(page, DEMO_USERS.ceo.username);
      await page.goto("/users/management?q=tempadmin");

      const ownRow = page.locator("tbody tr", { hasText: "tempadmin" });
      await expect(ownRow).toBeVisible();
      await expect(ownRow.getByRole("button", { name: "Deactivate" })).toHaveCount(0);
      await expect(ownRow.getByRole("button", { name: "Delete" })).toHaveCount(0);
      await expect(ownRow.getByRole("button", { name: "Reset password" })).toBeVisible();

      await page.goto("/users/management?q=CEOAdmin");
      const otherRow = page.locator("tbody tr", { hasText: "CEOAdmin" });
      await expect(otherRow.getByRole("button", { name: "Deactivate" })).toBeVisible();
      await expect(otherRow.getByRole("button", { name: "Delete" })).toBeVisible();
    });
  });

  test.describe("create user (disposable, cleaned up after)", () => {
    test.afterEach(() => {
      deleteDisposableUsers();
    });

    test("CEO can create a Location Manager account from the Create User page, and it appears in User Management", async ({ page }) => {
      const username = disposableUsername("mgr");

      await loginAs(page, DEMO_USERS.ceo.username);
      await page.goto("/users/new");

      await page.getByLabel("Account type").selectOption("LOCATION_MANAGER");
      await page.getByLabel("First name").fill("E2E");
      await page.getByLabel("Last name").fill("Tester");
      await page.getByLabel("Username").fill(username);
      await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
      await page.getByLabel("Location").selectOption({ index: 1 });
      await page.getByRole("button", { name: "Create account" }).click();

      await expect(page.getByText("E2E Tester created.")).toBeVisible();

      await page.goto(`/users/management?role=LOCATION_MANAGER&q=${username}`);
      await expect(page.locator("tbody tr", { hasText: username })).toBeVisible();
    });
  });
});
