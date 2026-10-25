import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server be opened from a phone on the local network.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
  // Lets tests build into a separate folder while a dev server uses .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  env: {
    // Versions the service worker, so each deploy replaces the offline cache.
    NEXT_PUBLIC_APP_VERSION:
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
      Date.now().toString(36),
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
