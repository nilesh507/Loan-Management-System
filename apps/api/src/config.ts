import { config } from "dotenv";
import path from "path";
config({ path: path.resolve(__dirname, "../../../.env") });
import { z } from "zod";
export const env = z
  .object({
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().int().default(4000),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    JWT_EXPIRES_IN: z.string().default("8h"),
    FRONTEND_URL: z.url(),
    UPLOAD_DIR: z.string().default("storage"),
  })
  .parse(process.env);
export const uploadDir = path.resolve(__dirname, "..", env.UPLOAD_DIR);
