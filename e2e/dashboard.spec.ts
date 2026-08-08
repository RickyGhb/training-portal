import { test, expect, loginAs, DEMO_USERS } from "./fixtures";

test.describe("Dashboard (merged Reports view)", () => {
  test("CEO sees org-wide stats, breakdowns, and an Export button that stays fully in view", async ({ page }) => {
    await loginAs(page, DEMO_USERS.ceo.username);

    await expect(page.getByRole("heading", { name: /welcome, reese/i })).toBeVisible();
    await expect(page.getByText("Total consultants")).toBeVisible();
    await expect(page.getByText("Consultants by training path")).toBeVisible();
    await expect(page.getByText("Consultants by coordinator")).toBeVisible();

    const exportLink = page.getByRole("link", { name: "Export", exact: true });
    await expect(exportLink).toBeVisible();
    // Regression check for the header-overflow bug: the export button must be
    // within the viewport, not pushed off the right edge by a wide table.
    const box = await exportLink.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);

    await expect(exportLink).toHaveAttribute("href", /\/reports\/exports/);
  });

  test("Coordinator dashboard is scoped to their own consultants only, with no Export button", async ({ page }) => {
    await loginAs(page, DEMO_USERS.coordinator.username);

    await expect(page.getByText("Your consultants only.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Export" })).toHaveCount(0);

    // Taylor Brooks owns exactly 4 seeded consultants.
    await expect(page.getByText("Total consultants")).toBeVisible();
    await expect(page.locator(".stat-number").first()).toHaveText("4");
  });

  test("Consultant dashboard shows personal progress, not the org-wide report", async ({ page }) => {
    await loginAs(page, DEMO_USERS.consultant.username);

    await expect(page.getByText("Complete", { exact: true })).toBeVisible();
    await expect(page.getByText("Videos completed")).toBeVisible();
    await expect(page.getByRole("link", { name: "Go to My Courses" })).toBeVisible();
    // Org-wide breakdowns must never leak into the consultant's own dashboard.
    await expect(page.getByText("Consultants by coordinator")).toHaveCount(0);
  });
});
