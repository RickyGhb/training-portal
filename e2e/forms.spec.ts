import {
  test,
  expect,
  loginAs,
  DEMO_USERS,
  disposableUsername,
  deleteDisposableUsers,
  deleteDisposableForms,
  DISPOSABLE_PASSWORD,
} from "./fixtures";

test.describe("Forms", () => {
  test.afterEach(() => {
    // Forms first: a granted disposable user can't be deleted while a
    // FormAccessGrant row still references them (Restrict FK) — see
    // scripts/e2e-cleanup-disposable-forms.ts.
    deleteDisposableForms();
    deleteDisposableUsers();
  });

  test("CEO builds a form, a visitor submits it publicly, and access is gated until granted", async ({ page }) => {
    const trainerUsername = disposableUsername("formtrainer");
    const formTitle = `E2E Form ${Date.now()}`;
    const answerValue = "Ada Lovelace";

    await loginAs(page, DEMO_USERS.ceo.username);

    // Build the form.
    await page.goto("/forms");
    await page.getByLabel("Title").fill(formTitle);
    await page.getByRole("button", { name: "Create form" }).click();
    await expect(page).toHaveURL(/\/forms\/[^/]+\/edit/);
    const formId = page.url().match(/\/forms\/([^/]+)\/edit/)![1];

    await page.getByRole("button", { name: "+ Add question" }).click();
    const addModal = page.locator(".modal-panel");
    await addModal.getByLabel("Question", { exact: true }).fill("Full name");
    await addModal.getByLabel("Required").check();
    await addModal.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Full name")).toBeVisible();

    const slugText = await page.locator("code", { hasText: "/f/" }).textContent();
    const slug = slugText!.trim().replace(/^\/f\//, "");

    // A staff account with no relationship to this form (not the creator,
    // not CEO, no organizational-hierarchy match, no grant yet).
    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("TRAINER");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("FormTrainer");
    await page.getByLabel("Username").fill(trainerUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Technology").selectOption("Java Developer");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E FormTrainer created.")).toBeVisible();

    // Without a grant, the Trainer is redirected away from this form's responses.
    await loginAs(page, trainerUsername, DISPOSABLE_PASSWORD);
    await page.goto(`/forms/${formId}/submissions`);
    await expect(page).toHaveURL(/\/forms$/);

    // CEO grants the Trainer access.
    await loginAs(page, DEMO_USERS.ceo.username);
    await page.goto(`/forms/${formId}/edit`);
    await page.getByLabel("Username").fill(trainerUsername);
    await page.getByRole("button", { name: "Share" }).click();
    await expect(page.getByText("can now see this form's data.")).toBeVisible();

    // An anonymous visitor fills out the public form.
    await page.context().clearCookies();
    await page.goto(`/f/${slug}`);
    await page.getByLabel("Full name").fill(answerValue);
    await page.getByRole("button", { name: "Submit" }).click();
    await expect(page.getByText("Thanks — your response was submitted.")).toBeVisible();

    // The granted Trainer can now see the response.
    await loginAs(page, trainerUsername, DISPOSABLE_PASSWORD);
    await page.goto(`/forms/${formId}/submissions`);
    await expect(page).toHaveURL(new RegExp(`/forms/${formId}/submissions$`));
    await expect(page.getByText("1 response")).toBeVisible();
    await page.getByText("View").click();
    await expect(page.getByText(answerValue)).toBeVisible();
  });
});
