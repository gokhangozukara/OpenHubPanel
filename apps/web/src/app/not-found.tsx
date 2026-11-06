"use client";
import Link from "next/link";

import { LanguageSelector, useLocale } from "@/i18n/provider";

export default function NotFound() {
  const { t } = useLocale();
  return (
    <main className="welcome-page">
      <div className="welcome-card">
        <LanguageSelector />
        <p className="eyebrow">404</p>
        <h1>{t("Page not found.")}</h1>
        <p className="muted">{t("Check the link or head back to the home page.")}</p>
        <Link href="/" className="button primary">
          {t("Back to home")}
        </Link>
      </div>
    </main>
  );
}
