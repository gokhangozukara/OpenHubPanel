import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { errorMessage, errors } from "../features/general/messages";
import { catalogs, isLocale, preferredLocale, translate } from "./locale";

describe("interface languages", () => {
  it("catalogs every workspace feedback and literal interface message", () => {
    const messages = new Set([...Object.values(errors), errorMessage("UNKNOWN")]);
    for (const name of ["panel", "form"]) {
      const source = readFileSync(`apps/web/src/features/general/${name}.tsx`, "utf8");
      for (const match of source.matchAll(/\b(?:t|setMessage)\("([^"]+)"/g)) {
        if (match[1]) messages.add(match[1]);
      }
    }
    for (const message of messages)
      for (const catalog of Object.values(catalogs))
        expect(Object.hasOwn(catalog, message), message).toBe(true);
  });
  it("has matching nonempty messages and placeholders in all catalogs", () => {
    const keys = Object.keys(catalogs.en).sort();
    for (const catalog of Object.values(catalogs)) {
      expect(Object.keys(catalog).sort()).toEqual(keys);
      for (const key of keys) {
        const message = catalog[key as keyof typeof catalogs.en];
        expect(message.trim().length).toBeGreaterThan(0);
        expect(message.match(/\{\w+\}/g)?.sort() ?? []).toEqual(key.match(/\{\w+\}/g)?.sort() ?? []);
      }
    }
  });

  it("selects the first supported browser language with an English fallback", () => {
    expect(preferredLocale(["fr-FR", "de-AT", "tr-TR"])).toBe("de");
    expect(preferredLocale(["tr-TR"])).toBe("tr");
    expect(preferredLocale(["en-GB"])).toBe("en");
    expect(preferredLocale(["fr-FR"])).toBe("en");
    expect(preferredLocale([])).toBe("en");
    expect(isLocale("__proto__")).toBe(false);
    expect(isLocale("de-DE")).toBe(false);
  });

  it("interpolates whole messages without interpreting user text", () => {
    expect(translate("en", "{name} details", { name: "{count} <test>" })).toBe("{count} <test> details");
    expect(translate("tr", "{count} members", { count: 3 })).toBe(
      catalogs.tr["{count} members"].replace("{count}", "3"),
    );
    expect(translate("en", "{count} members")).toBe("{count} members");
    expect(translate("de", "Uncatalogued proper name")).toBe("Uncatalogued proper name");
    expect(translate("de", "toString")).toBe("toString");
  });
});
