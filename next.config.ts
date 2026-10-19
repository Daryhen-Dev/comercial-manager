import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Next externalizes @prisma/client and prisma by default, but NOT the driver
  // adapter. Without this, Turbopack tries to bundle the mssql -> tedious ->
  // @azure/identity -> open -> powershell-utils chain into the auth route and
  // fails to resolve powershell.exe on Windows.
  serverExternalPackages: ["@prisma/adapter-mssql", "mssql", "tedious"],
  turbopack: {
    rules: {
      // Scoped to the global stylesheet on purpose. A `*.css` glob also matched
      // `*.module.css`, and `as: "*.css"` forced those through as plain CSS:
      // the file compiled and shipped, but the module exported no class names,
      // so every `styles.x` was undefined and nothing applied.
      "**/globals.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
