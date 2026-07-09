import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Art thumbnails are served as plain <img> through images.weserv.nl (SVG->webp),
  // so we don't use next/image and need no remotePatterns / image optimization.
  reactStrictMode: true,
}

export default nextConfig
