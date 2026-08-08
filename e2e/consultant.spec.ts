import { test, expect, loginAs, DEMO_USERS } from "./fixtures";

// Read-only journey: spatel is one of the accounts used in tomorrow's live
// demo, so this suite only ever navigates and asserts — it never marks a
// video complete or otherwise changes seeded progress state.
test.describe("Consultant learning journey (read-only)", () => {
  test("can browse from My Courses into a course's video list", async ({ page }) => {
    await loginAs(page, DEMO_USERS.consultant.username);

    await page.locator("nav").getByRole("link", { name: "My Courses" }).click();
    await expect(page).toHaveURL(/\/my-courses/);
    await expect(page.getByRole("heading", { name: "My Courses" })).toBeVisible();

    const firstCourseLink = page.locator("a[href^='/my-courses/']").first();
    await expect(firstCourseLink).toBeVisible();
    const courseName = await firstCourseLink.textContent();
    await firstCourseLink.click();

    await expect(page).toHaveURL(/\/my-courses\/[^/]+$/);
    if (courseName) {
      await expect(page.getByRole("heading", { name: courseName.trim() })).toBeVisible();
    }
    await expect(page.getByText(/videos completed/)).toBeVisible();
  });

  test("cannot see other consultants or any management surface", async ({ page }) => {
    await loginAs(page, DEMO_USERS.consultant.username);

    const nav = page.locator("nav");
    await expect(nav.getByRole("link", { name: "User Management" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Locations" })).toHaveCount(0);
  });
});
