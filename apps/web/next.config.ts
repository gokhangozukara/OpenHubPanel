import path from "node:path";
import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";
const config: NextConfig = {
  basePath: process.env.OPENHUB_BASE_PATH ?? "",
  poweredByHeader: false,
  devIndicators: false,
  output: "standalone",
  transpilePackages: [
    "@openhubpanel/contracts",
    "@openhubpanel/security",
    "@openhubpanel/db",
    "@openhubpanel/observability",
  ],
  turbopack: { root: path.resolve(import.meta.dirname, "../..") },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
        ],
      },
    ];
  },
};
export default config;
