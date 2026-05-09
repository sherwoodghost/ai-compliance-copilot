/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
          NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002/api/v1',
          NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3002',
    },
    // Transpile ESM-only packages that Next.js webpack can't handle natively
    transpilePackages: [
        'y-protocols',
        'yjs',
        'lib0',
        '@hocuspocus/provider',
        '@hocuspocus/common',
        '@tiptap/y-tiptap',
    ],
    experimental: {
        // Suppress harmless hydration mismatches from loading states
        optimizePackageImports: ['@tiptap/react', '@tiptap/starter-kit'],
    },
};

module.exports = nextConfig;
