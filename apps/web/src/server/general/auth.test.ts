import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { checkCompromisedPassword } from "./auth";

afterEach(() => vi.unstubAllGlobals());
describe("general password breach check", () => {
  it("sends only a five-character hash prefix and rejects a breached suffix", async () => {
    const password = "synthetic breach fixture";
    const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
    const fetch = vi.fn().mockResolvedValue(new Response(`${sha.slice(5)}:12\r\n`));
    vi.stubGlobal("fetch", fetch);
    await expect(checkCompromisedPassword(password)).rejects.toThrow("PASSWORD_COMPROMISED");
    expect(fetch.mock.calls[0]?.[0]).toBe(`https://api.pwnedpasswords.com/range/${sha.slice(0, 5)}`);
    expect(JSON.stringify(fetch.mock.calls)).not.toContain(password);
    expect(JSON.stringify(fetch.mock.calls)).not.toContain(sha);
  });
  it("accepts zero-count padding and a nonmatching suffix", async () => {
    const password = "synthetic padding fixture";
    const sha = createHash("sha1").update(password).digest("hex").toUpperCase();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(`${sha.slice(5)}:0\r\n${"B".repeat(35)}:2\r\n`)),
    );
    await expect(checkCompromisedPassword(password)).resolves.toBeUndefined();
  });
  it.each(["network", "html", "status", "oversized"])(
    "fails closed for %s provider failures",
    async (kind) => {
      const fetch =
        kind === "network"
          ? vi.fn().mockRejectedValue(new Error("private upstream detail"))
          : vi
              .fn()
              .mockResolvedValue(
                new Response(
                  kind === "html"
                    ? "<html>failure</html>"
                    : kind === "oversized"
                      ? "A".repeat(262145)
                      : "Unavailable",
                  { status: kind === "status" ? 503 : 200 },
                ),
              );
      vi.stubGlobal("fetch", fetch);
      await expect(checkCompromisedPassword("synthetic failure fixture")).rejects.toThrow(
        "PASSWORD_CHECK_UNAVAILABLE",
      );
    },
  );
});
