import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output keeps the production server self-contained for
  // containerized / Codespaces-hosted deployments of the symposium build.
  output: "standalone",
  // This repo nests the web app under coherence/web with sibling lockfiles;
  // pin the tracing root so standalone builds trace the right directory.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
