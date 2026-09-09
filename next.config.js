/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip ESLint and TypeScript during `next build` (Vercel / CI).
  // Run `npx tsc --noEmit` and lint locally when you want those checks.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'prisma'],
  },
}

module.exports = nextConfig
