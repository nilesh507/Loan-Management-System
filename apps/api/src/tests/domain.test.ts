import { describe, it, expect } from "vitest";
import {
  detailsSchema,
  eligibility,
  loanSchema,
  terms,
  paise,
} from "@creditsea/shared";
const base = {
  fullName: "Test Borrower",
  pan: "ABCDE1234F",
  dateOfBirth: "1990-05-10",
  monthlySalary: 25000,
  employmentMode: "SALARIED" as const,
};
describe("business rule engine", () => {
  it("accepts exactly 23 and exactly 50 years old", () => {
    expect(
      eligibility(
        { ...base, dateOfBirth: "2003-05-10" },
        new Date("2026-05-10"),
      ).eligible,
    ).toBe(true);
    expect(
      eligibility(
        { ...base, dateOfBirth: "1976-05-10" },
        new Date("2026-05-10"),
      ).eligible,
    ).toBe(true);
  });
  it("rejects before 23rd birthday and after 50th", () => {
    expect(
      eligibility(
        { ...base, dateOfBirth: "2003-05-11" },
        new Date("2026-05-10"),
      ).eligible,
    ).toBe(false);
    expect(
      eligibility(
        { ...base, dateOfBirth: "1975-05-10" },
        new Date("2026-05-10"),
      ).eligible,
    ).toBe(false);
  });
  it("handles leap day by completed calendar years", () => {
    expect(
      eligibility(
        { ...base, dateOfBirth: "2004-02-29" },
        new Date("2027-02-28"),
      ).eligible,
    ).toBe(false);
    expect(
      eligibility(
        { ...base, dateOfBirth: "2004-02-29" },
        new Date("2027-03-01"),
      ).eligible,
    ).toBe(true);
  });
  it("checks salary boundary, PAN and employment together", () => {
    const failed = eligibility(
      {
        ...base,
        monthlySalary: 24999,
        pan: "BAD",
        employmentMode: "UNEMPLOYED",
      },
      new Date("2026-10-09"),
    );
    expect(failed.reasons.map((r) => r.code)).toEqual([
      "MINIMUM_SALARY",
      "PAN_FORMAT",
      "EMPLOYMENT",
    ]);
    expect(
      eligibility(
        { ...base, employmentMode: "SELF_EMPLOYED" },
        new Date("2026-10-09"),
      ).eligible,
    ).toBe(true);
  });
  it("normalizes PAN and rejects malformed salary or PAN inputs", () => {
    const normalized = detailsSchema.parse({ ...base, pan: "abcde1234f" });
    expect(normalized.pan).toBe("ABCDE1234F");
    expect(eligibility(normalized, new Date("2026-10-09")).eligible).toBe(true);
    for (const pan of ["ABCD1234F", "ABCDE12#4F", "ABCDE12345"])
      expect(
        eligibility({ ...base, pan }, new Date("2026-10-09")).eligible,
      ).toBe(false);
    for (const monthlySalary of [NaN, Infinity, -1, 25000.001])
      expect(detailsSchema.safeParse({ ...base, monthlySalary }).success).toBe(
        false,
      );
    expect(
      eligibility({ ...base, monthlySalary: 24999 }, new Date("2026-10-09"))
        .eligible,
    ).toBe(false);
  });
});
describe("financial calculations", () => {
  it("uses simple interest with 365 day denominator", () => {
    expect(terms(100000, 365)).toMatchObject({
      principalPaise: 10000000,
      interestPaise: 1200000,
      totalRepaymentPaise: 11200000,
    });
    expect(terms(50000, 30).interestPaise).toBe(49315);
    expect(terms(500000, 365).totalRepaymentPaise).toBe(56000000);
  });
  it("rejects fractional paise", () => {
    expect(() => paise(1.001)).toThrow();
    expect(paise(1.01)).toBe(101);
  });
  it("enforces principal and tenure boundaries and rounds interest independently", () => {
    for (const [principalRupees, tenureDays] of [
      [49999, 30],
      [500001, 30],
      [50000, 29],
      [50000, 366],
    ])
      expect(
        loanSchema.safeParse({ principalRupees, tenureDays }).success,
      ).toBe(false);
    for (const principalRupees of [50000, 500000])
      for (const tenureDays of [30, 365]) {
        const quote = terms(principalRupees, tenureDays);
        const numerator =
          BigInt(principalRupees * 100) * 12n * BigInt(tenureDays);
        const expectedInterest = Number((numerator + 18250n) / 36500n);
        expect(quote.interestPaise).toBe(expectedInterest);
        expect(quote.totalRepaymentPaise).toBe(
          principalRupees * 100 + expectedInterest,
        );
      }
  });
});
