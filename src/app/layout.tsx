import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Glass Cutting Calculator & Management System",
  description: "Enterprise-grade real-time price calculator and quote management system for glass cutting operations.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
