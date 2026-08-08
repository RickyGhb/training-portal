import { test, expect, loginAs, DEMO_USERS, DEMO_PASSWORD } from "./fixtures";

test.describe("Authentication", () => {
  test("logs in with valid credentials and reaches the dashboard", async ({ page }) => {
    await loginAs(page, DEMO_USERS.ceo.username);
    await expect(page.getByRole("heading", { name: /welcome, reese/i })).toBeVisible();
  });

  test("rejects an invalid password without revealing which field was wrong", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill(DEMO_USERS.ceo.username);
    await page.getByLabel("Password").fill("definitely-not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid username or password/i)).toBeVisible();
  });

  test("rejects an unknown username with the same generic error", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("no-such-user-e2e");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText(/invalid username or password/i)).toBeVisible();
  });

  test("signs out and blocks access to protected pages afterward", async ({ page }) => {
    await loginAs(page, DEMO_USERS.consultant.username);
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
