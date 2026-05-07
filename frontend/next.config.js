/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
          NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
          NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001',
    },
    experimental: {
          outputFileTracingIncludes: {
                  '/*': ['./node_modules/**'],
          },
    },
};

module.exports = nextConfig;
