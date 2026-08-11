import { test, expect, loginAs, DEMO_USERS, disposableUsername, deleteDisposableUsers, DISPOSABLE_PASSWORD } from "./fixtures";

test.describe("Offshore Manager / Offshore Team Lead", () => {
  test.afterEach(() => {
    deleteDisposableUsers();
  });

  test("Offshore Manager creates a Team Lead, assigns a consultant to them, and the Team Lead sees only that consultant", async ({
    page,
  }) => {
    const managerUsername = disposableUsername("offmgr");
    const teamLeadUsername = disposableUsername("teamlead");
    const consultantUsername = disposableUsername("consult");

    // CEO creates an Offshore Manager scoped to LOCATION_1.
    await loginAs(page, DEMO_USERS.ceo.username);
    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("OFFSHORE_MANAGER");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("OffMgr");
    await page.getByLabel("Username").fill(managerUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Offshore Office").selectOption("LOCATION_1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E OffMgr created.")).toBeVisible();

    // CEO creates a Consultant in the same office (no team lead assigned yet).
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
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E Consult created.")).toBeVisible();

    // Offshore Manager creates a Team Lead — no Location/Office fields shown (office is inherited).
    await loginAs(page, managerUsername, DISPOSABLE_PASSWORD);
    await page.goto("/offshore/team-leads");
    await expect(page.getByLabel("Location")).toHaveCount(0);
    await expect(page.getByLabel("Offshore Office")).toHaveCount(0);
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("TeamLead");
    await page.getByLabel("Username").fill(teamLeadUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E TeamLead created.")).toBeVisible();

    // Offshore Manager assigns the consultant to that Team Lead via the auto-submitting select.
    await page.goto("/offshore/consultants");
    const consultantRow = page.locator("tbody tr", { hasText: consultantUsername });
    await consultantRow.locator('select[name="teamLeadId"]').selectOption({ label: "E2E TeamLead" });
    await expect(consultantRow.locator('select[name="teamLeadId"]')).toHaveValue(/.+/);

    // Team Lead logs in and sees exactly that consultant, nobody else.
    await loginAs(page, teamLeadUsername, DISPOSABLE_PASSWORD);
    await expect(page).toHaveURL(/\/offshore\/my-consultants/);
    await expect(page.getByText(consultantUsername)).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
  });

  test("Offshore Team Lead is redirected away from the Manager-only Consultant Data page", async ({ page }) => {
    const managerUsername = disposableUsername("offmgr2");
    const teamLeadUsername = disposableUsername("teamlead2");

    await loginAs(page, DEMO_USERS.ceo.username);
    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("OFFSHORE_MANAGER");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("OffMgr2");
    await page.getByLabel("Username").fill(managerUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Offshore Office").selectOption("LOCATION_2");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E OffMgr2 created.")).toBeVisible();

    await loginAs(page, managerUsername, DISPOSABLE_PASSWORD);
    await page.goto("/offshore/team-leads");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("TeamLead2");
    await page.getByLabel("Username").fill(teamLeadUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E TeamLead2 created.")).toBeVisible();

    await loginAs(page, teamLeadUsername, DISPOSABLE_PASSWORD);
    await page.goto("/offshore/consultants");
    // /offshore/consultants redirects a non-Manager to /dashboard, which then
    // redirects OFFSHORE_TEAM_LEAD further to its own landing page - the net
    // effect is still "kicked away from the Manager-only page", just via a
    // chained redirect rather than landing on /dashboard itself.
    await expect(page).toHaveURL(/\/offshore\/my-consultants/);
  });

  test("an Offshore Manager's Team Lead list is scoped to their own office only", async ({ page }) => {
    const managerAUsername = disposableUsername("offmgra");
    const managerBUsername = disposableUsername("offmgrb");
    const teamLeadAUsername = disposableUsername("tla");

    await loginAs(page, DEMO_USERS.ceo.username);

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("OFFSHORE_MANAGER");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("MgrA");
    await page.getByLabel("Username").fill(managerAUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Offshore Office").selectOption("LOCATION_1");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E MgrA created.")).toBeVisible();

    await page.goto("/users/new");
    await page.getByLabel("Account type").selectOption("OFFSHORE_MANAGER");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("MgrB");
    await page.getByLabel("Username").fill(managerBUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByLabel("Offshore Office").selectOption("LOCATION_2");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E MgrB created.")).toBeVisible();

    await loginAs(page, managerAUsername, DISPOSABLE_PASSWORD);
    await page.goto("/offshore/team-leads");
    await page.getByLabel("First name").fill("E2E");
    await page.getByLabel("Last name").fill("TLA");
    await page.getByLabel("Username").fill(teamLeadAUsername);
    await page.getByLabel("Password").fill(DISPOSABLE_PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("E2E TLA created.")).toBeVisible();

    // Manager B (different office) must not see Manager A's Team Lead.
    await loginAs(page, managerBUsername, DISPOSABLE_PASSWORD);
    await page.goto("/offshore/team-leads");
    await expect(page.getByText(teamLeadAUsername)).toHaveCount(0);
  });
});
