import bcrypt from "bcryptjs";
import { Role } from "@creditsea/shared";
import { env } from "./config";
import { User } from "./models";

const demoRoles: Role[] = [
  "ADMIN",
  "SALES",
  "SANCTION",
  "DISBURSEMENT",
  "COLLECTION",
  "BORROWER",
];
const demoPassword = "CreditSea@123";

export async function seedAccounts() {
  if (env.NODE_ENV === "production")
    throw new Error("Demo seed is disabled in production");
  const passwordHash = await bcrypt.hash(demoPassword, 12);
  for (const role of demoRoles) {
    const email = `${role.toLowerCase()}@creditsea.demo`;
    const existing = await User.findOne({ email }).select("+passwordHash");
    if (existing) {
      if (
        existing.role !== role ||
        !(await bcrypt.compare(demoPassword, existing.passwordHash))
      )
        throw new Error(
          `Demo email ${email} is already occupied by a different account; no role or password was changed.`,
        );
    } else {
      await User.create({
        fullName: `Demo ${role.charAt(0) + role.slice(1).toLowerCase()}`,
        email,
        passwordHash,
        role,
      });
    }
    console.log(email);
  }
}
