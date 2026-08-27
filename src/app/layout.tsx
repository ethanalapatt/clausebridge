import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClauseBridge — Structured Contract Redlining Room",
  description:
    "A structured contract-redlining room where a human sets non-negotiables and their browser agent retrieves exact clause context and stages independently approvable redlines through WebMCP. Fictional demo data only; not legal advice.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
