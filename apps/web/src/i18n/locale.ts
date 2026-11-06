import de from "./locales/de.json";
import en from "./locales/en.json";
import tr from "./locales/tr.json";

export const locales = ["en", "tr", "de"] as const;
export type Locale = (typeof locales)[number];
export const localeCookie = "openhubpanel.locale";
export const catalogs = { en, tr, de };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.some((locale) => locale === value);
}

export function preferredLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return "en";
}

export function translate(locale: Locale, key: string, values: Record<string, string | number> = {}): string {
  const catalog = catalogs[locale];
  const template = Object.hasOwn(catalog, key) ? catalog[key as keyof typeof en] : key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}
