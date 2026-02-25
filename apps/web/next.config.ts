import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@mywords/shared'],
};

export default nextConfig;
