import type { Metadata } from "next";
import "./globals.css";
import IdleTimeout from "@/components/IdleTimeout";
import { getSystemSettings } from "@/lib/settings";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const settings = await getSystemSettings();
    const title = settings?.siteTitle || "Glass Cutting Calculator & Management System";
    const faviconUrl = settings?.favicon?.url || "/favicon.ico";
    
    return {
      title,
      description: "Enterprise-grade real-time price calculator and quote management system for glass cutting operations.",
      icons: {
        icon: faviconUrl,
        shortcut: faviconUrl,
        apple: faviconUrl,
      }
    };
  } catch (err) {
    console.error("Error generating metadata:", err);
    return {
      title: "Glass Cutting Calculator & Management System",
      description: "Enterprise-grade real-time price calculator and quote management system for glass cutting operations.",
    };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let lang = "en";
  try {
    const settings = await getSystemSettings();
    lang = settings?.defaultLanguage || "en";
  } catch (err) {
    console.error("Error fetching language in layout:", err);
  }

  return (
    <html lang={lang} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <IdleTimeout />
        {children}
      </body>
    </html>
  );
}
