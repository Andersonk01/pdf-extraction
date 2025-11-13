import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Configurar para externalizar pdf-parse no servidor (necessário para Vercel)
  serverExternalPackages: ['pdf-parse'],
};

export default nextConfig;
