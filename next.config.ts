import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Configurar para externalizar pdf-parse no servidor
  serverExternalPackages: ['pdf-parse'],
  // Configurações para Vercel
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse'],
  },
};

export default nextConfig;
