import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: [
    '@prisma/client',
    '@electric-sql/pglite',
    '@electric-sql/pglite-socket',
  ],
};

export default nextConfig;
