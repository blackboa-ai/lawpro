/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  // Fix workspace root warning when multiple lockfiles exist
  outputFileTracingRoot: __dirname,
}

module.exports = nextConfig