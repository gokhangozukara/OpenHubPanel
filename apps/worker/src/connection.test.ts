import { expect, it } from "vitest";
import { createWorkerConnection } from "./connection";

it("preserves Redis database, escaped credentials, TLS and IPv6", () => {
  const target = new URL("rediss://[::1]:6380/4");
  target.username = encodeURIComponent("queue user");
  target.password = encodeURIComponent("synthetic@:/%");
  const connection = createWorkerConnection(target.href);
  try {
    expect(connection.options.host).toBe("::1");
    expect(Number(connection.options.port)).toBe(6380);
    expect(Number(connection.options.db)).toBe(4);
    expect(connection.options.username).toBe("queue user");
    expect(connection.options.password).toBe("synthetic@:/%");
    expect(connection.options.tls).toBeDefined();
    expect(connection.options.maxRetriesPerRequest).toBeNull();
    expect(connection.status).toBe("wait");
  } finally {
    connection.disconnect();
  }
});
