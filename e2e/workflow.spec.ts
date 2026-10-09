import { test, expect } from "@playwright/test";
test("borrower to closed loan across all executive roles", async ({ page }) => {
  const email = `browser-${Date.now()}@creditsea.demo`;
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/signup");
  await page.getByLabel("Full name").fill("Browser Borrower");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("CreditSea@123");
  await page.getByLabel("Confirm password").fill("CreditSea@123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/apply\/personal/);
  await page.getByLabel("Full name").fill("Browser Borrower");
  await page.getByLabel("PAN").fill("ABCDE1234F");
  await page.getByLabel("Date of birth").fill("1990-01-01");
  await page.getByLabel("Monthly salary").fill("24999");
  await page.getByRole("button", { name: "Check eligibility" }).click();
  await expect(page.getByText("Monthly salary must be at least")).toBeVisible();
  await page.getByLabel("Monthly salary").fill("25000");
  await page.getByRole("button", { name: "Check eligibility" }).click();
  await expect(page).toHaveURL(/\/apply\/documents/);
  await page.locator("input[type=file]").setInputFiles({
    name: "synthetic.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4\n%%EOF"),
  });
  await page.getByRole("button", { name: "Upload document" }).click();
  await expect(page.getByText("Uploaded successfully")).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page.getByText("₹1,12,000.00")).toBeVisible();
  await page.getByRole("button", { name: "Apply for loan" }).click();
  await expect(page).toHaveURL(/\/loans\/[a-f0-9]{24}/);
  await expect(page.getByText("PENDING REVIEW")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  async function roleLogin(role: string) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(`${role}@creditsea.demo`);
    await page.getByLabel("Password").fill("CreditSea@123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/${role}`));
  }
  await roleLogin("sanction");
  await page
    .getByRole("row", { name: new RegExp(email) })
    .getByRole("button", { name: "Review" })
    .click();
  await page.getByRole("button", { name: "Approve loan" }).click();
  await expect(page.getByText("Action completed successfully.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await roleLogin("disbursement");
  await page
    .getByRole("row", { name: new RegExp(email) })
    .getByRole("button", { name: "Review" })
    .click();
  await page.getByRole("button", { name: "Mark as disbursed" }).click();
  await expect(page.getByText("Action completed successfully.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await roleLogin("collection");
  await page
    .getByRole("row", { name: new RegExp(email) })
    .getByRole("button", { name: "Review" })
    .click();
  await page.getByLabel("UTR number").fill(`BROWSER-UTR-${Date.now()}-1`);
  await page.getByLabel("Amount (₹)").fill("50000");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Action completed successfully.")).toBeVisible();
  await page
    .getByRole("row", { name: new RegExp(email) })
    .getByRole("button", { name: "Review" })
    .click();
  await page.getByLabel("UTR number").fill(`BROWSER-UTR-${Date.now()}-2`);
  await page.getByLabel("Amount (₹)").fill("62000");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Action completed successfully.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("CreditSea@123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/loans/);
  await page
    .getByRole("link", { name: /Loan #/ })
    .first()
    .click();
  await expect(page.getByText("CLOSED")).toBeVisible();
  await expect(page.getByText("₹0.00")).toBeVisible();
});

test("public screens remain usable at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const route of ["/", "/signup", "/login"]) {
    await page.goto(route);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await expect(page.getByLabel("Email address")).toBeVisible();
});

test("frontend denies another team's route and hides content after session expiry", async ({
  page,
  context,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill("sales@creditsea.demo");
  await page.getByLabel("Password").fill("CreditSea@123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard\/sales/);
  await page.goto("/dashboard/collection");
  await expect(
    page.getByRole("heading", { name: "Access denied" }),
  ).toBeVisible();
  await page.goto("/dashboard/sales");
  await expect(
    page.getByRole("heading", { name: "Pre-application leads" }),
  ).toBeVisible();
  await context.clearCookies();
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.getByText("Please sign in")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pre-application leads" }),
  ).toHaveCount(0);
});
