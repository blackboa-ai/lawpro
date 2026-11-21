/** @type {import('next').NextConfig} */
// Preview requests use a same-origin rewrite so Render's production CORS
// allowlist does not need to trust every temporary Vercel preview hostname.
const isPreview = process.env.VERCEL_ENV === 'preview';
const backendUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

const nextConfig = {
  env: { NEXT_PUBLIC_LAWPRO_PREVIEW_PROXY: isPreview ? '1' : '0' },
  async rewrites() {
    return isPreview ? [
      { source: '/api/v1/:path*', destination: `${backendUrl}/api/v1/:path*` },
    ] : [];
  },
  images: {
    domains: ['localhost'],
  },
  // Fix workspace root warning when multiple lockfiles exist
  outputFileTracingRoot: __dirname,
}

module.exports = nextConfig