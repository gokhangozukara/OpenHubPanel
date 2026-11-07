import { lookup } from "node:dns/promises";
import { EventEmitter } from "node:events";
import { request } from "node:https";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { approvedAddresses, remoteJson } from "./remote-http";

vi.mock("node:dns/promises", () => ({ lookup: vi.fn() }));
vi.mock("node:https", () => ({ request: vi.fn() }));
const resolve = vi.mocked(lookup),
  send = vi.mocked(request);
beforeEach(() => {
  resolve.mockReset();
  send.mockReset();
  resolve.mockResolvedValue([{ address: "1.1.1.1", family: 4 }] as never);
});
afterEach(() => vi.restoreAllMocks());
function respond(status = 200, body = '{"status":"ok"}', type = "application/json") {
  send.mockImplementation((_url, _options, callback) => {
    const req = new EventEmitter() as EventEmitter & {
      write: () => void;
      end: () => void;
      destroy: () => void;
    };
    req.write = () => {};
    req.destroy = () => {
      req.emit("close");
    };
    req.end = () =>
      queueMicrotask(() => {
        const response = Object.assign(new PassThrough(), {
          statusCode: status,
          headers: { "content-type": type },
        });
        (callback as (response: unknown) => void)(response);
        response.end(body);
        response.on("end", () => req.emit("close"));
      });
    return req as never;
  });
}
it("rejects any DNS result containing a private address before opening a socket", async () => {
  resolve.mockResolvedValue([
    { address: "1.1.1.1", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ] as never);
  await expect(approvedAddresses("api.example.com")).rejects.toThrow("CONNECTION_TARGET_BLOCKED");
  await expect(remoteJson("https://api.example.com/api", "/health", "synthetic-credential")).rejects.toThrow(
    "CONNECTION_TARGET_BLOCKED",
  );
  expect(send).not.toHaveBeenCalled();
});
it("pins the checked address in HTTPS lookup, preserves the host and handles a root base path", async () => {
  respond();
  expect(await remoteJson("https://api.example.com", "/health", "synthetic-credential")).toEqual({
    status: "ok",
  });
  const call = send.mock.calls[0] as unknown as [
    URL,
    {
      family: number;
      lookup: (
        host: string,
        options: unknown,
        callback: (error: unknown, address: string, family: number) => void,
      ) => void;
      headers: Record<string, string>;
    },
  ];
  expect(call[0].hostname).toBe("api.example.com");
  expect(call[0].pathname).toBe("/health");
  expect(call[1].family).toBe(4);
  const callback = vi.fn();
  call[1].lookup("api.example.com", {}, callback);
  expect(callback).toHaveBeenCalledWith(null, "1.1.1.1", 4);
  expect(call[1].headers.authorization).toBe("Bearer synthetic-credential");
});
it("rejects redirects, non-JSON and oversized responses without following another target", async () => {
  respond(302);
  await expect(remoteJson("https://api.example.com", "/health", "synthetic-credential")).rejects.toThrow(
    "CONNECTION_UNAVAILABLE",
  );
  expect(send).toHaveBeenCalledTimes(1);
  send.mockReset();
  respond(200, "<html>", "text/html");
  await expect(remoteJson("https://api.example.com", "/health", "synthetic-credential")).rejects.toThrow(
    "INCOMPATIBLE_CONNECTION",
  );
  send.mockReset();
  respond(200, "x".repeat(262145));
  await expect(remoteJson("https://api.example.com", "/health", "synthetic-credential")).rejects.toThrow(
    "CONNECTION_RESPONSE_TOO_LARGE",
  );
});
