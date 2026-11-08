import { afterEach, describe, expect, it, vi } from "vitest";
import { errorMessage } from "./messages";
import { readState, requestJson } from "./request";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("workspace response boundary", () => {
  it("distinguishes offline, timeout, invalid response and unknown safe errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("private upstream details")));
    await expect(requestJson("/api")).rejects.toThrow("NETWORK_ERROR");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad gateway", { status: 502 })));
    await expect(requestJson("/api")).rejects.toThrow("UNAVAILABLE");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "untrusted secret" }), { status: 500 })),
    );
    try {
      await requestJson("/api");
    } catch (error) {
      expect(errorMessage((error as Error).message)).not.toContain("secret");
    }
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) =>
            init.signal.addEventListener("abort", () => reject(new Error("aborted"))),
          ),
      ),
    );
    const pending = expect(requestJson("/api", {}, 100)).rejects.toThrow("TIMEOUT");
    await vi.advanceTimersByTimeAsync(100);
    await pending;
  });
  it("never treats inherited object properties as a feedback message", () => {
    expect(errorMessage("toString")).toBe(errorMessage("UNKNOWN"));
    expect(errorMessage("__proto__")).toBe(errorMessage("UNKNOWN"));
  });
  it("rejects malformed state instead of rendering untrusted shapes", () => {
    for (const value of [
      null,
      {},
      { csrf: "x", authenticated: true, workspaces: [] },
      { csrf: "x".repeat(43), authenticated: true, workspaces: [null] },
    ])
      expect(() => readState(value)).toThrow("UNAVAILABLE");
    expect(readState({ csrf: "x".repeat(43), authenticated: false, workspaces: [] })).toEqual({
      csrf: "x".repeat(43),
      authenticated: false,
      workspaces: [],
    });
  });
});
