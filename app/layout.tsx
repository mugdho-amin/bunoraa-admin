import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { AdminProviders } from "@/components/providers/AdminProviders";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
    shortcut: "/favicon.ico",
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/icons/bunoraa-admin.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
