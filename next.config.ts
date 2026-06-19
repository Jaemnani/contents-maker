import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Remotion's bundler/renderer are heavy Node-only packages (esbuild, webpack, native
  // compositor binaries). Keep them external so Next/Turbopack doesn't try to bundle them.
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "esbuild",
  ],
};

export default nextConfig;
