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
  themeColor: "#f3f5f9",
};

export const metadata: Metadata = {
  title: {
    default: "Bunoraa Admin",
    template: "%s | Bunoraa Admin",
  },
  description: "Enterprise-grade administrative workspace for Bunoraa operations.",
  applicationName: "Bunoraa",
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
        <script dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("bunoraa-admin-v2:theme");var r="light";if(t){var s=JSON.parse(t).state;if(s){r=s.mode||"light";if(r==="system"){r=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"}}}var root=document.documentElement;root.classList.remove("light","dark");root.classList.add(r);root.style.colorScheme=r==="dark"?"dark":"light";var m=document.querySelector("meta[name=\\"theme-color\\"]");if(m)m.setAttribute("content",r==="dark"?"#0b1120":"#f3f5f9")}catch(e){}}())`,
        }} />
      </head>
      <body>
        <AntdRegistry>
          <AdminProviders>{children}</AdminProviders>
        </AntdRegistry>
      </body>
    </html>
  );
}
