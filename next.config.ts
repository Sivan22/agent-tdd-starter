import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Playwright drives the dev server on 127.0.0.1; allow it to load dev resources.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
