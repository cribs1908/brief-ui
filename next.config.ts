import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // Evita che la build fallisca per errori ESLint preesistenti
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
