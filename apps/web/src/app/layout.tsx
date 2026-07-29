import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { CommandPalette } from "@/components/CommandPalette";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "MarketPulse — Sri Lanka Morning Market Brief",
  description:
    "The Sri Lanka morning market brief, told in order. Verified CBSL prints across money markets, FX, bills, shares, and macro — start with Money Market.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>
        <AppShell>{children}</AppShell>
        <CommandPalette />
      </body>
    </html>
  );
}
