import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep project root anchored to frontend so dependency resolution
  // does not drift to repo-level lockfiles during Playwright/web runs.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
