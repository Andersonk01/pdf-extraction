import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {},
  // Configurar para externalizar pdf-parse no servidor
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
