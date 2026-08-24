import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DentMemo Consent",
  description: "Fast digital dental consent for clinics.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
