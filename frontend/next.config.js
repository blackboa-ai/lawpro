/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    turbo: {
      rules: {
        '*.svg': {
          loaders: [],
          optimizer: false,
        },
      },
    },
  },
  images: {
    domains: ['localhost'],
  },
}

module.exports = nextConfig