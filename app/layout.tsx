import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { AdminProviders } from "@/components/providers/AdminProviders";
import "./globals.css";

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0f766e",
};

export const metadata: Metadata = {
  title: {
    default: "Bunoraa Admin v2",
    template: "%s | Bunoraa Admin v2",
  },
  description: "Enterprise-grade administrative workspace for Bunoraa operations.",
  applicationName: "Bunoraa Admin v2",
  robots: { index: false, follow: false },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Bunoraa Admin",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        <AntdRegistry>
          <AdminProviders>{children}</AdminProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
