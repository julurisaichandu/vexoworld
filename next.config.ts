import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages merged into tabs; old links and bookmarks still land somewhere.
  async redirects() {
    return [
      { source: "/agent", destination: "/", permanent: false },
      { source: "/conversations", destination: "/missions?tab=conversations", permanent: false },
      { source: "/activity", destination: "/missions?tab=activity", permanent: false },
      { source: "/connections", destination: "/explore?tab=connections", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
