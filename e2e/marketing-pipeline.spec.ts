import { test, expect, loginAs, DEMO_USERS, disposableUsername, deleteDisposableUsers, DISPOSABLE_PASSWORD } from "./fixtures";

test.describe("Post-training placement pipeline (Trainer + Otter dual sign-off)", () => {
  test.afterEach(() => {
    deleteDisposableUsers();
  });

  test("a consultant flips to In Marketing only once BOTH Trainer and Otter Team verdicts are READY", async ({ page }) => {
    const trainerUsername = disposableUsername("pltrainer");
    const otterUsername = disposableUsername("plotter");
    const consultantUsername = disposableUsername("plconsult");

    await loginAs(page, DEMO_USERS.ceo.username);

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("TRAINER");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("PLTrainer");
    await page.getByLabel("Username").fill(trainerUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Technology").selectOption("Java Developer");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E PLTrainer created.")).toBeVisible();

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("OTTER_TEAM");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("PLOtter");
    await page.getByLabel("Username").fill(otterUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E PLOtter created.")).toBeVisible();

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("CONSULTANT");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("PLConsult");
    await page.getByLabel("Technology").selectOption("Java Developer");
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Coordinator").selectOption({ index: 1 });
    await page.getByLabel("Offshore Office").selectOption("LOCATION_1");
    await page.getByLabel("Username").fill(consultantUsername);
    await page.getByLabel("Visa Type").selectOption("H1B");
    await page.getByLabel("Date of Birth").fill("1995-01-01");
    await page.getByLabel("Trainer (optional — can assign later)").selectOption({ label: "E2E PLTrainer (Java Developer)" });
    await page.getByLabel("Otter Team reviewer (optional — can assign later)").selectOption({ label: "E2E PLOtter" });
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E PLConsult created.")).toBeVisible();

    // Trainer submits READY.
    await loginAs(page, trainerUsername, DISPOSABLE_PASSWORD);
    const trainerCard = page.locator(".card", { hasText: consultantUsername });
    await trainerCard.getByLabel("Verdict").selectOption("READY");
    await trainerCard.getByRole("button", { name: "Submit feedback" }).click();
    await expect(trainerCard.getByText("Feedback submitted.")).toBeVisible();

    // Only one of two verdicts is READY so far - consultant must still show "In Training".
    await loginAs(page, consultantUsername, DISPOSABLE_PASSWORD);
    await expect(page.getByText("In Training")).toBeVisible();
    await expect(page.getByText("In Marketing")).toHaveCount(0);

    // Otter Team submits READY - this is the one that should flip the status.
    await loginAs(page, otterUsername, DISPOSABLE_PASSWORD);
    const otterCard = page.locator(".card", { hasText: consultantUsername });
    await otterCard.getByLabel("Verdict").selectOption("READY");
    await otterCard.getByRole("button", { name: "Submit feedback" }).click();
    await expect(otterCard.getByText("Feedback submitted.")).toBeVisible();

    // Now both verdicts are READY - the consultant should see "In Marketing".
    await loginAs(page, consultantUsername, DISPOSABLE_PASSWORD);
    await expect(page.getByText("In Marketing")).toBeVisible();
  });
});
