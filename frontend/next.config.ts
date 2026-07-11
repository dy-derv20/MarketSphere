import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Next's own dev-mode indicator defaults to bottom-left, which collides
  // with FloatingChat's trigger (also fixed bottom-left per spec). Dev-only,
  // doesn't affect production builds either way.
  devIndicators: {
    position: "bottom-right",
  },
};

export default nextConfig;
