import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' blob: data: https: http:;
  font-src 'self' data:;
  connect-src 'self' https: http: ws: wss:;
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
`;

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), browsing-topics=()" },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

if (isProduction) {
  securityHeaders.push({ key: "Content-Security-Policy", value: cspHeader.replace(/\s{2,}/g, " ").trim() });
}

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  productionBrowserSourceMaps: false,
  output: isProduction ? "standalone" : undefined,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.bunoraa.com" },
      { protocol: "https", hostname: "**.bunoraa.net" },
      { protocol: "https", hostname: "**.cloudflarestorage.com" },
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.hf.space" },
    ],
  },
  serverExternalPackages: ["sharp"],
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
