import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // convex/ has its own toolchain (convex dev); don't let Next typecheck it.
  typescript: { tsconfigPath: "./tsconfig.json" },
};

export default nextConfig;
