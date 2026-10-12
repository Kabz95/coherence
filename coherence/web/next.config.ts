import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output keeps the production server self-contained for
  // containerized / Codespaces-hosted deployments of the symposium build.
  // Set COHERENCE_STATIC_EXPORT=1 for a fully static export (GitHub Pages).
  output: process.env.COHERENCE_STATIC_EXPORT ? "export" : "standalone",
  // This repo nests the web app under coherence/web with sibling lockfiles;
  // pin the tracing root so standalone builds trace the right directory.
  outputFileTracingRoot: __dirname,
  // Static-export tuning: Pages serves the app from a subpath, so assets and
  // links carry the base path and every route gets an index.html.
  ...(process.env.COHERENCE_STATIC_EXPORT
    ? {
        trailingSlash: true,
        images: { unoptimized: true },
        basePath: process.env.COHERENCE_BASE_PATH || "",
      }
    : {}),
};

export default nextConfig;
