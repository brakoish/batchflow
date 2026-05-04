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
    // GET-only batch/recipe/worker/org data — stale-while-revalidate so workers
    // see their last data instantly, even if the network is sketchy.
    {
      urlPattern: ({ url, request }) =>
        request.method === 'GET' &&
        /\/api\/(batches|recipes|workers|organizations|shifts|dashboard)/i.test(url.pathname),
      handler: 'NetworkFirst',
      options: {
        cacheName: 'batchflow-api',
        networkTimeoutSeconds: 5,
        expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 }, // 1 day
        cacheableResponse: { statuses: [0, 200] },
      },
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
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
        ],
      },
    ]
  },
}

module.exports = withPWA(nextConfig)
