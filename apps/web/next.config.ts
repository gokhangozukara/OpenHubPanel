import path from "node:path";
import type { NextConfig } from "next";

const production = process.env.NODE_ENV === "production";
const config: NextConfig = {
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
          {
            key: "Content-Security-Policy",
            value: `default-src 'self'; script-src 'self' 'unsafe-inline'${production ? "" : " 'unsafe-eval'"}; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'${production ? "" : " ws://127.0.0.1:* ws://localhost:*"}; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`,
          },
          ...(production ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
        ],
      },
    ];
  },
};
export default config;
