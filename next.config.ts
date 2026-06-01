import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Next.js from bundling these heavy native packages.
  // They must be loaded from node_modules at runtime, which is
  // required for correct behaviour in Vercel serverless functions.
  serverExternalPackages: ["pdfjs-dist", "mammoth", "pdf-parse", "canvas"],
};

export default nextConfig;
