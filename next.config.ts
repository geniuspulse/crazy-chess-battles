import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remove X-Powered-By header for security + slight perf
  poweredByHeader: false,

  // Compress responses (usually on by default in Vercel, but explicit)
  compress: true,

  // App lives in src/app
  // WebSocket connections will go to play.crazychessbattles.com (added later)

  // This app is fully live/dynamic — wallet balances, ratings, games played,
  // clocks, etc. must never be served from a stale cache. Disable Next's
  // client-side Router Cache (which by default keeps a navigated-away page's
  // data fresh for up to 30s) so every tab switch re-fetches current data.
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 0,
    },
  },
};

export default nextConfig;
