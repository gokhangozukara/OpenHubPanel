"use client";

import { LanguageSelector, useLocale } from "@/i18n/provider";

export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLocale();
  return (
    <main className="welcome-page">
      <div className="welcome-card">
        <LanguageSelector />
        <h1>{t("Something went wrong.")}</h1>
        <p className="muted">{t("Please try again. Internal system details are kept out of this screen.")}</p>
        <button type="button" className="button primary" onClick={reset}>
          {t("Try again")}
        </button>
      </div>
    </main>
  );
}
