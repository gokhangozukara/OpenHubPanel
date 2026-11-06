import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";

const admin = randomBytes(32).toString("hex");
const app = randomBytes(32).toString("hex");
const redis = randomBytes(32).toString("hex");
const values = {
  APP_ORIGIN: "http://localhost:3000",
  DATABASE_URL: `postgresql://openhub_app:${app}@localhost:54329/openhubpanel`,
  MIGRATION_DATABASE_URL: `postgresql://openhub_admin:${admin}@localhost:54329/openhubpanel`,
  REDIS_URL: `redis://:${redis}@localhost:63799`,
  POSTGRES_PASSWORD: admin,
  APP_DATABASE_PASSWORD: app,
  REDIS_PASSWORD: redis,
  ENCRYPTION_KEY: randomBytes(32).toString("hex"),
  READINESS_TOKEN: randomBytes(32).toString("hex"),
};
try {
  await writeFile(
    ".env",
    `${Object.entries(values)
      .map(([key, value]) => `${key}=${value}`)
      .join("\n")}\n`,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Created ignored .env with unique local credentials. No values were printed. Start infrastructure with pnpm infra:up.",
  );
} catch (error) {
  if (error.code === "EEXIST") console.log(".env already exists; kept without modifications.");
  else throw error;
}
