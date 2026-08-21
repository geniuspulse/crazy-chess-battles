/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove X-Powered-By header for security + slight perf
  poweredByHeader: false,
  
  // Compress responses (usually on by default in Vercel, but explicit)
  compress: true,
  
  // App lives in src/app
  // WebSocket connections will go to play.crazychessbattles.com (added later)
};

export default nextConfig;
