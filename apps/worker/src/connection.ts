import Redis from "ioredis";

// Let the driver preserve database selection, encoded credentials, IPv6, and TLS.
// Blocking BullMQ consumers require unlimited retries; they must not fail a job on reconnect.
export function createWorkerConnection(url: string) {
  return new Redis(url, { lazyConnect: true, maxRetriesPerRequest: null });
}
