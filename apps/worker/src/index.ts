import { logEvent } from "@openhubpanel/observability";
import { parseRuntimeConfig } from "@openhubpanel/security";
import { Worker } from "bullmq";
import { createWorkerConnection } from "./connection";

const config = parseRuntimeConfig(process.env, process.env.NODE_ENV === "production");
const connection = createWorkerConnection(config.REDIS_URL);
connection.on("error", (error) => logEvent("worker.connection_error", { error }));
// The foundation worker handles no business commands. Unsupported work fails explicitly.
const worker = new Worker(
  "openhubpanel",
  async (job) => {
    if (job.name !== "system.ping") throw new Error("UNSUPPORTED_JOB");
    return { status: "ok" };
  },
  {
    connection,
    concurrency: 1,
  },
);
worker.on("ready", () => logEvent("worker.ready"));
worker.on("error", (error) => logEvent("worker.error", { error }));
worker.on("failed", (job, error) => logEvent("worker.failed", { jobId: job?.id, error }));
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    if (stopping) return;
    stopping = true;
    try {
      await worker.close();
    } catch (error) {
      logEvent("worker.shutdown_error", { error });
      process.exitCode = 1;
    } finally {
      connection.disconnect();
    }
  });
