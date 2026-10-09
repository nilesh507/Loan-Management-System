import {
  detailsSchema,
  eligibility,
  terms,
  paise,
  Reason,
} from "@creditsea/shared";
import { z } from "zod";
export function evaluateDetails(input: unknown) {
  const details = detailsSchema.parse(input);
  const result = eligibility(details);
  return {
    details: {
      fullName: details.fullName,
      pan: details.pan,
      dateOfBirth: details.dateOfBirth,
      monthlySalaryPaise: paise(details.monthlySalary),
      employmentMode: details.employmentMode,
    },
    result,
  };
}
export function reevaluate(saved: {
  fullName?: string | null;
  pan?: string | null;
  dateOfBirth?: string | null;
  monthlySalaryPaise?: number | null;
  employmentMode?: string | null;
}) {
  return eligibility(
    detailsSchema.parse({
      fullName: saved.fullName,
      pan: saved.pan,
      dateOfBirth: saved.dateOfBirth,
      monthlySalary: (saved.monthlySalaryPaise ?? 0) / 100,
      employmentMode: saved.employmentMode,
    }),
  );
}
export { terms };
export type EligibilityResult = { eligible: boolean; reasons: Reason[] };
export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(100).optional(),
});
