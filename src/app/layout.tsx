import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AXORA Admin",
    template: "%s · AXORA Admin",
  },
  description:
    "AXORA — бүх онлайн дэлгүүрийг нэг төвөөс удирдах Super Admin платформ.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
