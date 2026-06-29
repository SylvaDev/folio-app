import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@folio/shared'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'covers.openlibrary.org' },
      { protocol: 'https', hostname: '*.supabase.co' },
      // Google Books cover thumbnails (used as a fallback provider during imports)
      { protocol: 'https', hostname: 'books.google.com' },
      { protocol: 'https', hostname: 'books.googleusercontent.com' },
    ],
  },
  experimental: {
    serverActions: { allowedOrigins: ['localhost:3001', 'localhost:3000', 'foliotbr.app', 'www.foliotbr.app'] },
  },
}

export default nextConfig
