import { z } from "zod";
export const ROLES = [
  "ADMIN",
  "SALES",
  "SANCTION",
  "DISBURSEMENT",
  "COLLECTION",
  "BORROWER",
] as const;
export type Role = (typeof ROLES)[number];
export const STATUSES = [
  "APPLIED",
  "SANCTIONED",
  "REJECTED",
  "DISBURSED",
  "CLOSED",
] as const;
export type LoanStatus = (typeof STATUSES)[number];
export const employment = z.enum(["SALARIED", "SELF_EMPLOYED", "UNEMPLOYED"]);
const hasPaisePrecision = (value: number) =>
  Number.isSafeInteger(Math.round(value * 100)) &&
  Math.abs(Math.round(value * 100) / 100 - value) < 1e-8;
export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100),
    email: z
      .email()
      .max(254)
      .transform((v) => v.toLowerCase()),
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });
export const loginSchema = z.object({
  email: z.email().transform((v) => v.toLowerCase()),
  password: z.string().min(1),
});
export const detailsSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  pan: z.string().trim().toUpperCase().max(20),
  dateOfBirth: z.iso.date(),
  monthlySalary: z
    .number()
    .finite()
    .min(0)
    .max(100000000)
    .refine(hasPaisePrecision, "Use at most two decimal places."),
  employmentMode: employment,
});
export const loanSchema = z.object({
  principalRupees: z.number().int().min(50000).max(500000),
  tenureDays: z.number().int().min(30).max(365),
});
export const rejectionSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});
export const paymentSchema = z.object({
  utr: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{6,40}$/),
  amountRupees: z
    .number()
    .positive()
    .max(1000000)
    .refine(hasPaisePrecision, "Use at most two decimal places."),
  paymentDate: z.iso.date(),
});
export const paise = (rupees: number) => {
  const value = Math.round(rupees * 100);
  if (!Number.isSafeInteger(value) || Math.abs(value / 100 - rupees) > 1e-8)
    throw new Error("Use at most two decimal places");
  return value;
};
export const interestPaise = (principalPaise: number, tenureDays: number) =>
  Math.round((principalPaise * 12 * tenureDays) / 36500);
export const terms = (principalRupees: number, tenureDays: number) => {
  const principalPaise = paise(principalRupees);
  const interest = interestPaise(principalPaise, tenureDays);
  return {
    principalPaise,
    tenureDays,
    annualInterestRatePercent: 12,
    interestPaise: interest,
    totalRepaymentPaise: principalPaise + interest,
  };
};
export const formatINR = (valuePaise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    valuePaise / 100,
  );
export type Reason = { field: string; code: string; message: string };
export function eligibility(
  details: z.infer<typeof detailsSchema>,
  today = new Date(),
): { eligible: boolean; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const [year, month, day] = details.dateOfBirth.split("-").map(Number);
  const birth = new Date(Date.UTC(year, month - 1, day));
  const now = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  );
  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day ||
    birth > now
  )
    reasons.push({
      field: "dateOfBirth",
      code: "INVALID_DATE",
      message: "Enter a valid past date of birth.",
    });
  else {
    let age = now.getUTCFullYear() - year;
    if (
      now.getUTCMonth() + 1 < month ||
      (now.getUTCMonth() + 1 === month && now.getUTCDate() < day)
    )
      age--;
    if (age < 23 || age > 50)
      reasons.push({
        field: "dateOfBirth",
        code: "AGE_RANGE",
        message: "Applicant must be 23 to 50 years old.",
      });
  }
  if (details.monthlySalary < 25000)
    reasons.push({
      field: "monthlySalary",
      code: "MINIMUM_SALARY",
      message: "Monthly salary must be at least ₹25,000.",
    });
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(details.pan))
    reasons.push({
      field: "pan",
      code: "PAN_FORMAT",
      message: "Enter a PAN in the format ABCDE1234F.",
    });
  if (details.employmentMode === "UNEMPLOYED")
    reasons.push({
      field: "employmentMode",
      code: "EMPLOYMENT",
      message: "Unemployed applicants are not eligible.",
    });
  return { eligible: reasons.length === 0, reasons };
}
