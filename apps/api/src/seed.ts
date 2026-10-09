import mongoose from "mongoose";
import { env } from "./config";
import { seedAccounts } from "./seed-accounts";

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  try {
    await seedAccounts();
  } finally {
    await mongoose.disconnect();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});
