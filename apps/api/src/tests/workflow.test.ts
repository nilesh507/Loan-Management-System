import { beforeAll, afterAll, describe, it, expect } from "vitest";
import mongoose from "mongoose";
import request from "supertest";
import bcrypt from "bcryptjs";
import { unlink } from "fs/promises";
import path from "path";
import app from "../app";
import { User, Loan, Draft } from "../models";
import { uploadDir } from "../config";
import { seedAccounts } from "../seed-accounts";
const db = `creditsea_test_${Date.now()}`;
let borrower: ReturnType<typeof request.agent>,
  admin: ReturnType<typeof request.agent>,
  sales: ReturnType<typeof request.agent>,
  sanction: ReturnType<typeof request.agent>,
  disbursement: ReturnType<typeof request.agent>,
  collection: ReturnType<typeof request.agent>;
let loanId = "";
async function login(email: string) {
  const agent = request.agent(app);
  const response = await agent
    .post("/api/v1/auth/login")
    .send({ email, password: "CreditSea@123" });
  expect(response.status).toBe(200);
  return agent;
}
beforeAll(async () => {
  await mongoose.connect(`mongodb://127.0.0.1:27017/${db}`, {
    serverSelectionTimeoutMS: 5000,
  });
  await Promise.all([User.init(), Draft.init(), Loan.init()]);
  const passwordHash = await bcrypt.hash("CreditSea@123", 10);
  for (const role of [
    "ADMIN",
    "SALES",
    "SANCTION",
    "DISBURSEMENT",
    "COLLECTION",
  ])
    await User.create({
      fullName: `Test ${role}`,
      email: `${role.toLowerCase()}@test.demo`,
      role,
      passwordHash,
    });
  admin = await login("admin@test.demo");
  sales = await login("sales@test.demo");
  sanction = await login("sanction@test.demo");
  disbursement = await login("disbursement@test.demo");
  collection = await login("collection@test.demo");
}, 15000);
afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
describe("real MongoDB workflow", () => {
  it("returns structured 429 after repeated login attempts for one account", async () => {
    const email = `rate-limit-${Date.now()}@test.demo`;
    for (let attempt = 0; attempt < 10; attempt++)
      expect(
        (
          await request(app)
            .post("/api/v1/auth/login")
            .send({ email, password: "wrong" })
        ).status,
      ).toBe(401);
    const blocked = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "wrong" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
    expect(blocked.headers["content-type"]).toContain("application/json");
  });
  it("registers, checks credentials and enforces roles", async () => {
    const email = `borrower-${Date.now()}@test.demo`;
    const signup = await request(app).post("/api/v1/auth/register").send({
      fullName: "Test Borrower",
      email,
      password: "CreditSea@123",
      confirmPassword: "CreditSea@123",
      role: "ADMIN",
    });
    expect(signup.status).toBe(201);
    expect(signup.body.data.role).toBe("BORROWER");
    expect(
      (
        await request(app).post("/api/v1/auth/register").send({
          fullName: "Test Borrower",
          email,
          password: "CreditSea@123",
          confirmPassword: "CreditSea@123",
        })
      ).status,
    ).toBe(409);
    borrower = await login(email);
    expect(
      (await sales.get("/api/v1/operations/sales/leads")).body.data.items.some(
        (lead: { email: string }) => lead.email === email,
      ),
    ).toBe(true);
    expect((await borrower.get("/api/v1/auth/me")).body.data.role).toBe(
      "BORROWER",
    );
    expect(
      (await borrower.get("/api/v1/operations/sanction/loans")).status,
    ).toBe(403);
    expect(
      (await sanction.get("/api/v1/operations/collection/loans")).status,
    ).toBe(403);
  });
  it("enforces the six-role module matrix on actual API requests", async () => {
    const agents = {
      ADMIN: admin,
      SALES: sales,
      SANCTION: sanction,
      DISBURSEMENT: disbursement,
      COLLECTION: collection,
      BORROWER: borrower,
    };
    const modules = [
      "sales/leads",
      "sanction/loans",
      "disbursement/loans",
      "collection/loans",
    ];
    for (const [role, agent] of Object.entries(agents)) {
      for (const module of modules) {
        const allowed =
          role === "ADMIN" || module.startsWith(role.toLowerCase());
        expect(
          (await agent.get(`/api/v1/operations/${module}`)).status,
          `${role} ${module}`,
        ).toBe(allowed ? 200 : 403);
      }
    }
    expect(
      (await request(app).get("/api/v1/operations/sales/leads")).status,
    ).toBe(401);
  });
  it("blocks failed BRE, accepts correction and uploads a real PDF signature", async () => {
    const bad = await borrower
      .put("/api/v1/applications/me/personal-details")
      .send({
        fullName: "Test Borrower",
        pan: "BAD",
        dateOfBirth: "2008-01-01",
        monthlySalary: 24999,
        employmentMode: "UNEMPLOYED",
      });
    expect(bad.status).toBe(200);
    expect(bad.body.data.eligibility.reasons).toHaveLength(4);
    expect(
      (
        await borrower
          .post("/api/v1/applications/me/submit")
          .send({ principalRupees: 100000, tenureDays: 365 })
      ).status,
    ).toBe(422);
    const good = await borrower
      .put("/api/v1/applications/me/personal-details")
      .send({
        fullName: "Test Borrower",
        pan: "ABCDE1234F",
        dateOfBirth: "1990-01-01",
        monthlySalary: 25000,
        employmentMode: "SALARIED",
      });
    expect(good.body.data.eligibility.eligible).toBe(true);
    expect(
      (
        await borrower
          .post("/api/v1/applications/me/salary-slip")
          .attach("file", Buffer.from("not a pdf"), "fake.pdf")
      ).status,
    ).toBe(422);
    expect(
      (
        await borrower
          .post("/api/v1/applications/me/salary-slip")
          .attach("file", Buffer.alloc(5 * 1024 * 1024 + 1), "large.pdf")
      ).status,
    ).toBe(413);
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
    expect(
      (
        await borrower
          .post("/api/v1/applications/me/salary-slip")
          .attach("file", pdf, "synthetic.pdf")
      ).status,
    ).toBe(201);
    expect(
      (await sanction.get("/api/v1/applications/me/salary-slip")).status,
    ).toBe(403);
  });
  it("applies, sanctions, disburses, pays and closes", async () => {
    const created = await borrower
      .post("/api/v1/applications/me/submit")
      .send({ principalRupees: 100000, tenureDays: 365 });
    expect(created.status).toBe(201);
    loanId = created.body.data._id;
    expect(created.body.data.totalRepaymentPaise).toBe(11200000);
    expect(created.body.data.applicationSnapshot.pan).toBe("ABCDE1234F");
    expect(created.body.data.salarySlip.originalFilename).toBe("synthetic.pdf");
    const borrowerEmail = (await borrower.get("/api/v1/auth/me")).body.data
      .email;
    expect(
      (await sales.get("/api/v1/operations/sales/leads")).body.data.items.some(
        (lead: { email: string }) => lead.email === borrowerEmail,
      ),
    ).toBe(false);
    expect(
      (
        await borrower
          .post("/api/v1/applications/me/submit")
          .send({ principalRupees: 100000, tenureDays: 365 })
      ).status,
    ).toBe(409);
    expect(
      (
        await borrower.post(
          `/api/v1/operations/sanction/loans/${loanId}/approve`,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await sanction.post(
          `/api/v1/operations/sanction/loans/${loanId}/approve`,
        )
      ).status,
    ).toBe(200);
    const disbursementView = await disbursement.get(
      `/api/v1/operations/disbursement/loans/${loanId}`,
    );
    expect(disbursementView.status).toBe(200);
    expect(disbursementView.body.data.applicationSnapshot.pan).toBeUndefined();
    expect(disbursementView.body.data.salarySlip).toBeUndefined();
    expect(
      (
        await sanction.post(
          `/api/v1/operations/sanction/loans/${loanId}/approve`,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await disbursement.post(
          `/api/v1/operations/disbursement/loans/${loanId}/disburse`,
        )
      ).status,
    ).toBe(200);
    const collectionView = await collection.get(
      `/api/v1/operations/collection/loans/${loanId}`,
    );
    expect(collectionView.status).toBe(200);
    expect(collectionView.body.data.applicationSnapshot.pan).toBeUndefined();
    const first = await collection
      .post(`/api/v1/operations/collection/loans/${loanId}/payments`)
      .send({
        utr: "TEST-UTR-0001",
        amountRupees: 50000,
        paymentDate: "2026-10-09",
      });
    expect(first.status).toBe(201);
    expect(first.body.data.status).toBe("DISBURSED");
    expect(
      (
        await collection
          .post(`/api/v1/operations/collection/loans/${loanId}/payments`)
          .send({
            utr: "TEST-UTR-0001",
            amountRupees: 1,
            paymentDate: "2026-10-09",
          })
      ).status,
    ).toBe(409);
    expect(
      (
        await collection
          .post(`/api/v1/operations/collection/loans/${loanId}/payments`)
          .send({
            utr: "TEST-UTR-0002",
            amountRupees: 62000.01,
            paymentDate: "2026-10-09",
          })
      ).status,
    ).toBe(422);
    const last = await collection
      .post(`/api/v1/operations/collection/loans/${loanId}/payments`)
      .send({
        utr: "TEST-UTR-0003",
        amountRupees: 62000,
        paymentDate: "2026-10-09",
      });
    expect(last.status).toBe(201);
    expect(last.body.data.status).toBe("CLOSED");
    expect(last.body.data.paidAmountPaise).toBe(11200000);
    expect(
      (
        await collection
          .post(`/api/v1/operations/collection/loans/${loanId}/payments`)
          .send({
            utr: "TEST-UTR-AFTER-CLOSE",
            amountRupees: 1,
            paymentDate: "2026-10-09",
          })
      ).status,
    ).toBe(409);
    expect(
      (
        await disbursement.post(
          `/api/v1/operations/disbursement/loans/${loanId}/disburse`,
        )
      ).status,
    ).toBe(409);
    expect(
      (await sales.post(`/api/v1/operations/sanction/loans/${loanId}/approve`))
        .status,
    ).toBe(403);
    expect(
      (
        await sanction.post(
          `/api/v1/operations/disbursement/loans/${loanId}/disburse`,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await disbursement
          .post(`/api/v1/operations/collection/loans/${loanId}/payments`)
          .send({
            utr: "TEST-UTR-WRONG-ROLE",
            amountRupees: 1,
            paymentDate: "2026-10-09",
          })
      ).status,
    ).toBe(403);
    expect(
      (
        await borrower.get(
          `/api/v1/operations/sanction/loans/${loanId}/salary-slip`,
        )
      ).status,
    ).toBe(403);
    const persisted = await Loan.findById(loanId);
    expect(persisted?.status).toBe("CLOSED");
    expect(persisted?.payments).toHaveLength(2);
    expect(
      (await borrower.get(`/api/v1/loans/me/${loanId}`)).body.data.status,
    ).toBe("CLOSED");
  });
  it("checks borrower ownership and atomic concurrent payment limits", async () => {
    const email = `other-${Date.now()}@test.demo`;
    await request(app).post("/api/v1/auth/register").send({
      fullName: "Other Borrower",
      email,
      password: "CreditSea@123",
      confirmPassword: "CreditSea@123",
    });
    const other = await login(email);
    expect((await other.get(`/api/v1/loans/me/${loanId}`)).status).toBe(404);
    await other.put("/api/v1/applications/me/personal-details").send({
      fullName: "Other Borrower",
      pan: "ABCDE1234F",
      dateOfBirth: "1990-01-01",
      monthlySalary: 25000,
      employmentMode: "SALARIED",
    });
    await other
      .post("/api/v1/applications/me/salary-slip")
      .attach("file", Buffer.from("%PDF-1.4\n%%EOF"), "other.pdf");
    const applied = await other
      .post("/api/v1/applications/me/submit")
      .send({ principalRupees: 100000, tenureDays: 365 });
    const otherId = applied.body.data._id;
    await sanction.post(`/api/v1/operations/sanction/loans/${otherId}/approve`);
    await disbursement.post(
      `/api/v1/operations/disbursement/loans/${otherId}/disburse`,
    );
    expect(
      (
        await collection
          .post(`/api/v1/operations/collection/loans/${otherId}/payments`)
          .send({
            utr: "TEST-UTR-0001",
            amountRupees: 1,
            paymentDate: "2026-10-09",
          })
      ).status,
    ).toBe(409);
    const results = await Promise.all(
      ["TEST-UTR-0004", "TEST-UTR-0005"].map((utr) =>
        collection
          .post(`/api/v1/operations/collection/loans/${otherId}/payments`)
          .send({ utr, amountRupees: 70000, paymentDate: "2026-10-09" }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    const persisted = await Loan.findById(otherId);
    expect(persisted?.paidAmountPaise).toBe(7000000);
    expect(persisted?.payments).toHaveLength(1);
    const sameUtr = await Promise.all(
      [1, 2].map(() =>
        collection
          .post(`/api/v1/operations/collection/loans/${otherId}/payments`)
          .send({
            utr: "TEST-UTR-SAME-RACE",
            amountRupees: 1000,
            paymentDate: "2026-10-09",
          }),
      ),
    );
    expect(sameUtr.map((r) => r.status).sort()).toEqual([201, 409]);
    expect((await Loan.findById(otherId))?.payments).toHaveLength(2);
    expect(
      (
        await collection
          .post(`/api/v1/operations/collection/loans/${otherId}/payments`)
          .send({
            utr: "TEST-UTR-DECIMAL",
            amountRupees: 0.001,
            paymentDate: "2026-10-09",
          })
      ).status,
    ).toBe(400);
    expect(
      (await sanction.get(`/api/v1/operations/sanction/loans/${loanId}`))
        .status,
    ).toBe(404);
    expect(
      (
        await sanction.get(
          `/api/v1/operations/sanction/loans/${loanId}/salary-slip`,
        )
      ).status,
    ).toBe(404);
    expect(
      (await collection.get(`/api/v1/operations/collection/loans/${loanId}`))
        .status,
    ).toBe(200);
  });
  it("rejects an applied loan with a reason and forbids all later transitions", async () => {
    const email = `rejected-${Date.now()}@test.demo`;
    await request(app).post("/api/v1/auth/register").send({
      fullName: "Rejected Applicant",
      email,
      password: "CreditSea@123",
      confirmPassword: "CreditSea@123",
    });
    const applicant = await login(email);
    await applicant.put("/api/v1/applications/me/personal-details").send({
      fullName: "Rejected Applicant",
      pan: "ABCDE1234F",
      dateOfBirth: "1990-01-01",
      monthlySalary: 25000,
      employmentMode: "SALARIED",
    });
    await applicant
      .post("/api/v1/applications/me/salary-slip")
      .attach("file", Buffer.from("%PDF-1.4\n%%EOF"), "rejected.pdf");
    const applied = await applicant
      .post("/api/v1/applications/me/submit")
      .send({ principalRupees: 50000, tenureDays: 30 });
    const rejectedId = applied.body.data._id;
    expect(
      (
        await disbursement.post(
          `/api/v1/operations/disbursement/loans/${rejectedId}/disburse`,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await collection
          .post(`/api/v1/operations/collection/loans/${rejectedId}/payments`)
          .send({
            utr: "TEST-UTR-BEFORE-DISBURSE",
            amountRupees: 1,
            paymentDate: "2026-10-09",
          })
      ).status,
    ).toBe(409);
    expect(
      (
        await sanction
          .post(`/api/v1/operations/sanction/loans/${rejectedId}/reject`)
          .send({ reason: "No" })
      ).status,
    ).toBe(400);
    const rejected = await sanction
      .post(`/api/v1/operations/sanction/loans/${rejectedId}/reject`)
      .send({ reason: "Incomplete documentation" });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.status).toBe("REJECTED");
    expect(
      (
        await sanction.post(
          `/api/v1/operations/sanction/loans/${rejectedId}/approve`,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await disbursement.post(
          `/api/v1/operations/disbursement/loans/${rejectedId}/disburse`,
        )
      ).status,
    ).toBe(409);
    expect(
      (await applicant.get(`/api/v1/loans/me/${rejectedId}`)).body.data
        .rejectionReason,
    ).toBe("Incomplete documentation");
  });
  it("does not create a loan when its uploaded document has disappeared", async () => {
    const email = `missing-file-${Date.now()}@test.demo`;
    await request(app).post("/api/v1/auth/register").send({
      fullName: "Missing File",
      email,
      password: "CreditSea@123",
      confirmPassword: "CreditSea@123",
    });
    const applicant = await login(email);
    await applicant.put("/api/v1/applications/me/personal-details").send({
      fullName: "Missing File",
      pan: "ABCDE1234F",
      dateOfBirth: "1990-01-01",
      monthlySalary: 25000,
      employmentMode: "SALARIED",
    });
    await applicant
      .post("/api/v1/applications/me/salary-slip")
      .attach("file", Buffer.from("%PDF-1.4\n%%EOF"), "missing.pdf");
    const account = await User.findOne({ email });
    const draft = await Draft.findOne({ borrowerId: account?._id });
    await unlink(path.join(uploadDir, draft!.salarySlip!.storageKey!));
    expect(
      (
        await applicant
          .post("/api/v1/applications/me/submit")
          .send({ principalRupees: 100000, tenureDays: 365 })
      ).status,
    ).toBe(422);
    expect(await Loan.countDocuments({ borrowerId: account?._id })).toBe(0);
  });
  it("lets admin perform every operational transition", async () => {
    const email = `admin-flow-${Date.now()}@test.demo`;
    await request(app).post("/api/v1/auth/register").send({
      fullName: "Admin Flow",
      email,
      password: "CreditSea@123",
      confirmPassword: "CreditSea@123",
    });
    const applicant = await login(email);
    await applicant.put("/api/v1/applications/me/personal-details").send({
      fullName: "Admin Flow",
      pan: "ABCDE1234F",
      dateOfBirth: "1990-01-01",
      monthlySalary: 25000,
      employmentMode: "SALARIED",
    });
    await applicant
      .post("/api/v1/applications/me/salary-slip")
      .attach("file", Buffer.from("%PDF-1.4\n%%EOF"), "admin-flow.pdf");
    const applied = await applicant
      .post("/api/v1/applications/me/submit")
      .send({ principalRupees: 100000, tenureDays: 365 });
    const id = applied.body.data._id;
    expect(
      (await admin.post(`/api/v1/operations/sanction/loans/${id}/approve`)).body
        .data.status,
    ).toBe("SANCTIONED");
    expect(
      (await admin.post(`/api/v1/operations/disbursement/loans/${id}/disburse`))
        .body.data.status,
    ).toBe("DISBURSED");
    const paid = await admin
      .post(`/api/v1/operations/collection/loans/${id}/payments`)
      .send({
        utr: `ADMIN-UTR-${Date.now()}`,
        amountRupees: 112000,
        paymentDate: "2026-10-09",
      });
    expect(paid.status).toBe(201);
    expect(paid.body.data.status).toBe("CLOSED");
    expect((await Loan.findById(id))?.paidAmountPaise).toBe(11200000);
  });
  it("does not promote a borrower occupying a demo executive email", async () => {
    const occupied = await User.create({
      fullName: "Unrelated Borrower",
      email: "admin@creditsea.demo",
      passwordHash: await bcrypt.hash("AnotherPassword123", 10),
      role: "BORROWER",
    });
    await expect(seedAccounts()).rejects.toThrow("already occupied");
    expect((await User.findById(occupied.id))?.role).toBe("BORROWER");
    await User.deleteOne({ _id: occupied.id });
    await seedAccounts();
    await seedAccounts();
    expect(await User.countDocuments({ email: /@creditsea\.demo$/ })).toBe(6);
  });
});
