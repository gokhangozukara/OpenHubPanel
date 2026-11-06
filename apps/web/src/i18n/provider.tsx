"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { catalogs, isLocale, type Locale, localeCookie, preferredLocale, translate } from "./locale";

type LocaleContext = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
};
const Context = createContext<LocaleContext | null>(null);

export function LocaleProvider({
  initialLocale,
  detectBrowser,
  children,
}: {
  initialLocale: Locale;
  detectBrowser: boolean;
  children: React.ReactNode;
}) {
  const [locale, updateLocale] = useState(initialLocale);

  function setLocale(next: Locale) {
    if (!isLocale(next)) return;
    updateLocale(next);
    try {
      localStorage.setItem(localeCookie, next);
    } catch {
      // Language selection still works when browser storage is unavailable.
    }
    const secure = location.protocol === "https:" ? "; Secure" : "";
    try {
      // biome-ignore lint/suspicious/noDocumentCookie: Cosmetic preference only; document.cookie supports browsers without Cookie Store.
      document.cookie = `${localeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch {
      // The current selection also works when cookies are blocked.
    }
  }

  useEffect(() => {
    if (!detectBrowser) return;
    let next = preferredLocale(navigator.languages);
    try {
      const saved = localStorage.getItem(localeCookie);
      if (isLocale(saved)) next = saved;
    } catch {
      // Browser preferences are the fallback when local storage is blocked.
    }
    updateLocale(next);
  }, [detectBrowser]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return (
    <Context.Provider value={{ locale, setLocale, t: (key, values) => translate(locale, key, values) }}>
      {children}
    </Context.Provider>
  );
}

export function useLocale() {
  const context = useContext(Context);
  if (!context) throw new Error("useLocale must be used inside LocaleProvider");
  return context;
}

export function LanguageSelector() {
  const { locale, setLocale, t } = useLocale();
  return (
    <label className="language-selector">
      <span className="sr-only">{t("Language")}</span>
      <select
        value={locale}
        onChange={(event) => {
          if (isLocale(event.target.value)) setLocale(event.target.value);
        }}
      >
        <option value="en" lang="en">
          {catalogs.en.English}
        </option>
        <option value="tr" lang="tr">
          {catalogs.tr.Turkish}
        </option>
        <option value="de" lang="de">
          {catalogs.de.German}
        </option>
      </select>
    </label>
  );
}
