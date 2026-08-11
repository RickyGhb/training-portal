import { test, expect, loginAs, DEMO_USERS, disposableUsername, deleteDisposableUsers, DISPOSABLE_PASSWORD } from "./fixtures";

async function createConsultantWithTrainerAndOtter(
  page: import("@playwright/test").Page,
  { consultantUsername, trainerName, otterName }: { consultantUsername: string; trainerName: string; otterName: string }
) {
  await page.goto("/users/new");
  await page.getByLabel("Account type").selectOption("CONSULTANT");
  await page.getByLabel("First name").fill("E2E");
  await page.getByLabel("Last name").fill("Consult");
  await page.getByLabel("Technology").selectOption("Java Developer");
  await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
  await page.getByLabel("Coordinator").selectOption({ index: 1 });
  await page.getByLabel("Offshore Office").selectOption("LOCATION_1");
  await page.getByLabel("Username").fill(consultantUsername);
  await page.getByLabel("Visa Type").selectOption("H1B");
  await page.getByLabel("Date of Birth").fill("1995-01-01");
  await page.getByLabel("Trainer (optional — can assign later)").selectOption({ label: trainerName });
  await page.getByLabel("Otter Team reviewer (optional — can assign later)").selectOption({ label: otterName });
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("E2E Consult created.")).toBeVisible();
}

test.describe("Trainer / Otter Team feedback", () => {
  test.afterEach(() => {
    deleteDisposableUsers();
  });

  test("Trainer submits a verdict for their assigned consultant", async ({ page }) => {
    const trainerUsername = disposableUsername("trainer");
    const otterUsername = disposableUsername("otter");
    const consultantUsername = disposableUsername("consult");

    await loginAs(page, DEMO_USERS.ceo.username);

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("TRAINER");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Trainer");
    await page.getByLabel("Username").fill(trainerUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Technology").selectOption("Java Developer");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E Trainer created.")).toBeVisible();

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("OTTER_TEAM");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Otter");
    await page.getByLabel("Username").fill(otterUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    // OTTER_TEAM has no Location/Office/Technology field at all.
    await expect(page.getByLabel("Technology")).toHaveCount(0);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E Otter created.")).toBeVisible();

    await createConsultantWithTrainerAndOtter(page, {
      consultantUsername,
      trainerName: "E2E Trainer (Java Developer)",
      otterName: "E2E Otter",
    });

    await loginAs(page, trainerUsername, DISPOSABLE_PASSWORD);
    await expect(page).toHaveURL(/\/trainer\/consultants/);
    const card = page.locator(".card", { hasText: consultantUsername });
    await expect(card).toBeVisible();

    await card.getByLabel("Verdict").selectOption("READY");
    await card.getByLabel("Notes (optional)").fill("Demo went well.");
    const submitButton = card.getByRole("button", { name: "Submit feedback" });
    await submitButton.click();
    await expect(card.getByText("Feedback submitted.")).toBeVisible();
    // Scoped to the "Latest verdict" paragraph specifically - the same text
    // also appears as an <option> in the still-present verdict <select>.
    await expect(card.locator("p", { hasText: "Latest verdict" })).toContainText("Good to go with marketing");
  });

  test("Otter Team member submits a NOT_READY verdict", async ({ page }) => {
    const otterUsername = disposableUsername("otter2");
    const trainerUsername = disposableUsername("trainer2");
    const consultantUsername = disposableUsername("consult2");

    await loginAs(page, DEMO_USERS.ceo.username);

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("TRAINER");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Trainer2");
    await page.getByLabel("Username").fill(trainerUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Technology").selectOption("Java Developer");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E Trainer2 created.")).toBeVisible();

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("OTTER_TEAM");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Otter2");
    await page.getByLabel("Username").fill(otterUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E Otter2 created.")).toBeVisible();

    await createConsultantWithTrainerAndOtter(page, {
      consultantUsername,
      trainerName: "E2E Trainer2 (Java Developer)",
      otterName: "E2E Otter2",
    });

    await loginAs(page, otterUsername, DISPOSABLE_PASSWORD);
    await expect(page).toHaveURL(/\/otter\/consultants/);
    const card = page.locator(".card", { hasText: consultantUsername });

    await card.getByLabel("Verdict").selectOption("NOT_READY");
    await card.getByRole("button", { name: "Submit feedback" }).click();
    await expect(card.getByText("Feedback submitted.")).toBeVisible();
    await expect(card.locator("p", { hasText: "Latest verdict" })).toContainText("Not yet");
  });

  test("Trainer is redirected away from the Otter-only page and vice versa", async ({ page }) => {
    const trainerUsername = disposableUsername("trainer3");
    const otterUsername = disposableUsername("otter3");

    await loginAs(page, DEMO_USERS.ceo.username);

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("TRAINER");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Trainer3");
    await page.getByLabel("Username").fill(trainerUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Technology").selectOption("Java Developer");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E Trainer3 created.")).toBeVisible();

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("OTTER_TEAM");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("Otter3");
    await page.getByLabel("Username").fill(otterUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E Otter3 created.")).toBeVisible();

    // Each page redirects a wrong-role visitor to /dashboard, which then
    // redirects TRAINER/OTTER_TEAM further to their own landing page - the
    // net effect is still "kicked away", just via a chained redirect.
    await loginAs(page, trainerUsername, DISPOSABLE_PASSWORD);
    await page.goto("/otter/consultants");
    await expect(page).toHaveURL(/\/trainer\/consultants/);

    await loginAs(page, otterUsername, DISPOSABLE_PASSWORD);
    await page.goto("/trainer/consultants");
    await expect(page).toHaveURL(/\/otter\/consultants/);
  });
});
