import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Configurar para externalizar pdf-parse e pdfjs-dist no servidor
  serverExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  // Configurações para Vercel
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'pdfjs-dist'],
  },
};

export default nextConfig;
