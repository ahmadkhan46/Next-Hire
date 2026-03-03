import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },
};

export default nextConfig;
