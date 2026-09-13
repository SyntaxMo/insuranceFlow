import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteFooter, SiteHeader } from "@/components/layout/SiteChrome";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: "InsureFlow | Motor insurance, made simple",
  description:
    "Explore connected digital motor policy and claim workflows in the InsureFlow portfolio demonstration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="min-h-full flex flex-col antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
