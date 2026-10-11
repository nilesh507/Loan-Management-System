import { parse } from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const rootEnv = fileURLToPath(new URL("../../.env", import.meta.url));
if (existsSync(rootEnv)) {
  const publicApiUrl = parse(readFileSync(rootEnv)).NEXT_PUBLIC_API_URL;
  if (publicApiUrl) process.env.NEXT_PUBLIC_API_URL ??= publicApiUrl;
}

const apiOrigin = process.env.API_ORIGIN?.replace(/\/$/, "");

const nextConfig = {
  async rewrites() {
    if (!apiOrigin) return [];

    return [
      {
        source: "/api/v1/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
    ];
  },
};
export default nextConfig;
