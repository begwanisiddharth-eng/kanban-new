import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

const API_URL = process.env.API_URL ?? "http://localhost:4000";

// Builds are a static export served by the backend. In development the
// Next.js dev server proxies /api to the backend instead.
export default function config(phase: string): NextConfig {
  // The repo root has its own lockfile; keep Next.js scoped to frontend/.
  const base = { outputFileTracingRoot: process.cwd() };
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    return {
      ...base,
      rewrites: async () => [
        { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      ],
    };
  }
  return { ...base, output: "export" };
}
