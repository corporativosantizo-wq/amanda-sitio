import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    missingSuspenseWithCSRBailout: false,
  },
};
export default nextConfig;
