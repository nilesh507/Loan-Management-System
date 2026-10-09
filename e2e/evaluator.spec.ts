import { test, expect } from "@playwright/test";

const api = "http://localhost:4000/api/v1";
const password = "CreditSea@123";

function salarySlip() {
  const stream =
    "BT /F1 18 Tf 72 720 Td (CreditSea evaluator salary slip) Tj ET\n";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1))
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}

test("seeded accounts complete persistent journey and reject forbidden operations", async ({
  page,
  request,
}, testInfo) => {
  page.on("dialog", (dialog) => dialog.accept());
  const utr = `EVAL-${Date.now()}`;
  const paymentDate = new Date().toISOString().slice(0, 10);
  async function login(role: string) {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(`${role}@creditsea.demo`);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(
      role === "borrower" ? /\/loans$/ : new RegExp(`/dashboard/${role}$`),
    );
  }
  async function logout() {
    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  }
  async function reviewLoan(loanId: string) {
    await page
      .getByRole("article")
      .filter({ hasText: `Loan #${loanId.slice(-8).toUpperCase()}` })
      .getByRole("button", { name: "Review loan" })
      .click();
  }

  expect((await request.get(`${api}/health`)).status()).toBe(200);
  expect((await request.get(`${api}/operations/sanction/loans`)).status()).toBe(
    401,
  );
  await login("borrower");
  await page.goto("/apply/personal");
  await page.getByLabel("Full name").fill("Demo Borrower");
  await page.getByLabel("PAN").fill("INVALIDPAN");
  await page.getByLabel("Date of birth").fill("2007-01-01");
  await page.getByLabel("Monthly salary").fill("24999");
  await page.getByLabel("Employment mode").selectOption("UNEMPLOYED");
  await page.getByRole("button", { name: /Check eligibility/ }).click();
  for (const message of [
    "Applicant must be 23 to 50 years old.",
    "Monthly salary must be at least ₹25,000.",
    "Enter a PAN in the format ABCDE1234F.",
    "Unemployed applicants are not eligible.",
  ])
    await expect(page.getByText(message)).toBeVisible();
  expect(
    (
      await page.request.post(`${api}/applications/me/submit`, {
        data: { principalRupees: 100000, tenureDays: 365 },
      })
    ).status(),
  ).toBe(422);

  await page.getByLabel("PAN").fill("ABCDE1234F");
  await page.getByLabel("Date of birth").fill("1990-01-01");
  await page.getByLabel("Monthly salary").fill("25000");
  await page.getByLabel("Employment mode").selectOption("SALARIED");
  await page.getByRole("button", { name: /Check eligibility/ }).click();
  await expect(page).toHaveURL(/\/apply\/documents$/);
  await page.locator("input[type=file]").setInputFiles({
    name: "evaluator-salary-slip.pdf",
    mimeType: "application/pdf",
    buffer: salarySlip(),
  });
  await page
    .getByRole("button", { name: /^(Upload|Replace) document$/ })
    .click();
  await expect(page.getByText("Uploaded successfully")).toBeVisible();
  await page.getByRole("link", { name: "Continue" }).click();
  await expect(page.getByText("₹1,12,000.00")).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("borrower-config-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Apply for loan" }).click();
  await expect(page).toHaveURL(/\/loans\/[a-f0-9]{24}$/);
  const loanId = new URL(page.url()).pathname.split("/").pop() || "";
  expect(loanId).toMatch(/^[a-f0-9]{24}$/);
  await expect(page.getByText("PENDING REVIEW")).toBeVisible();
  expect(
    (
      await page.request.post(
        `${api}/operations/sanction/loans/${loanId}/approve`,
      )
    ).status(),
  ).toBe(403);
  await logout();

  await login("sales");
  expect(
    (await page.request.get(`${api}/operations/sanction/loans`)).status(),
  ).toBe(403);
  await page.goto("/dashboard/collection");
  await expect(
    page.getByRole("heading", { name: "Access denied" }),
  ).toBeVisible();
  await page.goto("/dashboard/sales");
  await expect(page.getByText("borrower@creditsea.demo")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("sales-mobile.png"),
    fullPage: true,
  });
  await logout();

  await login("sanction");
  expect(
    (
      await page.request.post(
        `${api}/operations/disbursement/loans/${loanId}/disburse`,
      )
    ).status(),
  ).toBe(403);
  await reviewLoan(loanId);
  await page.screenshot({
    path: testInfo.outputPath("sanction-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Approve loan" }).click();
  await expect(page.getByText("Action completed successfully.")).toBeVisible();
  expect(
    (
      await page.request.post(
        `${api}/operations/sanction/loans/${loanId}/approve`,
      )
    ).status(),
  ).toBe(409);
  await logout();

  await login("disbursement");
  await reviewLoan(loanId);
  await page.getByRole("button", { name: "Mark as disbursed" }).click();
  await expect(page.getByText("Action completed successfully.")).toBeVisible();
  expect(
    (
      await page.request.post(
        `${api}/operations/disbursement/loans/${loanId}/disburse`,
      )
    ).status(),
  ).toBe(409);
  await logout();

  await login("collection");
  const paymentUrl = `${api}/operations/collection/loans/${loanId}/payments`;
  expect(
    (
      await page.request.post(paymentUrl, {
        data: { utr: `${utr}-OVER`, amountRupees: 112000.01, paymentDate },
      })
    ).status(),
  ).toBe(422);
  expect(
    (
      await page.request.post(paymentUrl, {
        data: { utr: `${utr}-TINY`, amountRupees: 0.001, paymentDate },
      })
    ).status(),
  ).toBe(400);
  await reviewLoan(loanId);
  await page.getByLabel("UTR number").fill(`${utr}-ONE`);
  await page.getByLabel("Amount (₹)").fill("50000");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Action completed successfully.")).toBeVisible();
  expect(
    (
      await page.request.post(paymentUrl, {
        data: { utr: `${utr}-ONE`, amountRupees: 1, paymentDate },
      })
    ).status(),
  ).toBe(409);
  await reviewLoan(loanId);
  await page.getByLabel("UTR number").fill(`${utr}-TWO`);
  await page.getByLabel("Amount (₹)").fill("62000");
  await page.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByText("Action completed successfully.")).toBeVisible();
  expect(
    (
      await page.request.post(paymentUrl, {
        data: { utr: `${utr}-AFTER`, amountRupees: 1, paymentDate },
      })
    ).status(),
  ).toBe(409);
  await logout();

  await login("borrower");
  await page.goto(`/loans/${loanId}`);
  await expect(page.getByText("CLOSED", { exact: true })).toBeVisible();
  await expect(page.getByText("₹0.00")).toBeVisible();
  const loan = await (
    await page.request.get(`${api}/loans/me/${loanId}`)
  ).json();
  expect(loan.data.status).toBe("CLOSED");
  expect(loan.data.paidAmountPaise).toBe(11200000);
  expect(loan.data.payments).toHaveLength(2);
  console.log(`Persisted seeded-borrower loan: ${loanId}; UTR prefix: ${utr}`);
});
