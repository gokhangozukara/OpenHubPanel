import { createDatabase } from "@openhubpanel/db";
import { parseRuntimeConfig } from "@openhubpanel/security";
import Redis from "ioredis";

export async function checkReadiness(): Promise<boolean> {
  const config = parseRuntimeConfig(process.env, process.env.NODE_ENV === "production");
  const database = createDatabase(config.DATABASE_URL);
  const redis = new Redis(config.REDIS_URL, {
    lazyConnect: true,
    connectTimeout: 3000,
    commandTimeout: 3000,
    maxRetriesPerRequest: 0,
    retryStrategy: () => null,
  });
  redis.on("error", () => {});
  try {
    await Promise.all([database`SELECT 1`, redis.connect()]);
    return (await redis.ping()) === "PONG";
  } finally {
    redis.disconnect();
    await database.end({ timeout: 2 });
  }
}
