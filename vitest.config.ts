import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/**/*.test.ts",
      "apps/web/src/i18n/*.test.ts",
      "apps/web/src/server/pilot/*.test.ts",
      "apps/web/src/server/operator/*.test.ts",
      "apps/worker/src/*.test.ts",
      "tests/tooling/*.test.ts",
    ],
    environment: "node",
  },
});
