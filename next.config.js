/** @type {import('next').NextConfig} */
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  fallbacks: {
    document: '/offline',
  },
  runtimeCaching: [
    // Never cache auth — must always hit network
    {
      urlPattern: /\/api\/auth\/.*/i,
      handler: 'NetworkOnly',
      options: {
        precacheFallback: { fallbackURL: '/offline' },
      },
    },
    // Authenticated API data must never be shared through a device-wide cache.
    // Static assets and the offline shell remain cached below.
    {
      urlPattern: ({ url }) => /\/api\//i.test(url.pathname),
      handler: 'NetworkOnly',
      options: {},
    },
    // Static assets / images
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'batchflow-images',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30d
      },
    },
    {
      urlPattern: /\.(?:js|css|woff2?)$/i,
      handler: 'StaleWhileRevalidate',
      options: {
        cacheName: 'batchflow-static',
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7d
      },
    },
  ],
  buildExcludes: [/app-build-manifest\.json$/],
})

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        // Basic hardening: no framing by other sites (protects the PIN pad),
        // no MIME sniffing, and no full URLs leaked to other sites.
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
