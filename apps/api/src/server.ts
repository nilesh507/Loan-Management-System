import mongoose from "mongoose";
import app from "./app";
import { env } from "./config";
async function start() {
  await mongoose.connect(env.MONGODB_URI);
  await Promise.all([
    mongoose.model("User").init(),
    mongoose.model("ApplicationDraft").init(),
    mongoose.model("Loan").init(),
  ]);
  app.listen(env.PORT, () =>
    console.log(`CreditSea API listening on ${env.PORT}; MongoDB connected`),
  );
}
start().catch((error) => {
  console.error("Startup failed:", error);
  process.exit(1);
});
