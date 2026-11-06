import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenHubPanel — All in one panel",
  description: "Sitelerin, uygulamaların ve ekibin için ortak yönetim merkezi.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
