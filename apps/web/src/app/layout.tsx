import type { Metadata } from "next";
import { cookies } from "next/headers";
import { isLocale, localeCookie } from "@/i18n/locale";
import { LocaleProvider } from "@/i18n/provider";
import "./globals.css";
import "./workspace.css";

export const metadata: Metadata = {
  title: "OpenHubPanel — All in one panel",
  description: "One home for your websites, applications, and the people who manage them.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const saved = (await cookies()).get(localeCookie)?.value;
  const locale = isLocale(saved) ? saved : "en";
  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale} detectBrowser={!isLocale(saved)}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
