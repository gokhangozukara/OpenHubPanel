import { logEvent } from "@openhubpanel/observability";
import { parseRuntimeConfig } from "@openhubpanel/security";
import { Worker } from "bullmq";

const config = parseRuntimeConfig(process.env, process.env.NODE_ENV === "production");
const redis = new URL(config.REDIS_URL);
// The foundation worker handles no business commands. Unsupported work fails explicitly.
const worker = new Worker(
  "openhubpanel",
  async (job) => {
    if (job.name !== "system.ping") throw new Error("UNSUPPORTED_JOB");
    return { status: "ok" };
  },
  {
    connection: {
      host: redis.hostname,
      port: Number(redis.port || 6379),
      password: redis.password || undefined,
      username: redis.username || undefined,
      ...(redis.protocol === "rediss:" ? { tls: {} } : {}),
    },
    concurrency: 1,
  },
);
worker.on("ready", () => logEvent("worker.ready"));
worker.on("error", (error) => logEvent("worker.error", { error }));
worker.on("failed", (job, error) => logEvent("worker.failed", { jobId: job?.id, error }));
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    await worker.close();
    process.exit(0);
  });
