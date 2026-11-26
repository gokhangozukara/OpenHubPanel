"use client";
import { ArrowRight, Blocks, Code2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { LanguageSelector, useLocale } from "@/i18n/provider";

export function HomeScreen({
  preview,
  general = false,
  operator = false,
}: {
  preview: boolean;
  general?: boolean;
  operator?: boolean;
}) {
  const { t } = useLocale();
  return (
    <main className="welcome-page">
      <div className="welcome-card">
        <LanguageSelector />
        <span className="brand-symbol">
          <Blocks size={26} aria-hidden="true" />
        </span>
        <p className="eyebrow">OPENHUBPANEL</p>
        <h1>All in one panel.</h1>
        <p className="welcome-description">
          {t("Your websites, applications, and team.")}
          <br />
          {t("One home for managing them all.")}
        </p>
        <div className="welcome-actions">
          {general && (
            <Link href="/workspace" className="button primary">
              {t("Team workspaces")} <ArrowRight size={16} />
            </Link>
          )}
          {operator && (
            <Link href="/live" className="button secondary">
              {t("Live workspace")} <ArrowRight size={16} />
            </Link>
          )}
          {preview && (
            <Link href="/preview" className="button primary">
              {t("Explore the panel")} <ArrowRight size={16} />
            </Link>
          )}
          <a className="button secondary" href="https://github.com/gokhangozukara/OpenHubPanel">
            <Code2 size={16} /> GitHub
          </a>
        </div>
        <p className="welcome-note">
          <ShieldCheck size={16} aria-hidden="true" /> {t("In development · Open source under MIT")}
        </p>
        {preview ? (
          <p className="muted small">
            {t("The panel preview uses sample data and does not connect to live systems.")}
          </p>
        ) : (
          <p className="muted small">
            {t("Management access is not enabled yet. Setup and development details are on GitHub.")}
          </p>
        )}
      </div>
    </main>
  );
}
