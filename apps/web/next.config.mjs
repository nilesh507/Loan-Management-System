import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) {
  const publicApiUrl = parse(readFileSync(rootEnv)).NEXT_PUBLIC_API_URL;
  if (publicApiUrl) process.env.NEXT_PUBLIC_API_URL ??= publicApiUrl;
}

const nextConfig = {};
export default nextConfig;
