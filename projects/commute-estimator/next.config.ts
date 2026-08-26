import type { NextConfig } from 'next';
import path from 'path';

const nextConfig: NextConfig = {
  // This is one of several independent projects in a monorepo with its own
  // lockfile — pin the tracing root so Next doesn't guess wrong.
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
