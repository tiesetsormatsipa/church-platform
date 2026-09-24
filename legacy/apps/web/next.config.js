const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /\/api\/v1\/home\/.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-home', expiration: { maxEntries: 10, maxAgeSeconds: 300 } },
    },
    {
      urlPattern: /\/api\/v1\/branches\/.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-branches', expiration: { maxEntries: 50, maxAgeSeconds: 600 } },
    },
    {
      urlPattern: /\/api\/v1\/geo\/.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-geo', expiration: { maxEntries: 20, maxAgeSeconds: 3600 } },
    },
    {
      urlPattern: /\/api\/v1\/features\/.*/i,
      handler: 'NetworkFirst',
      options: { cacheName: 'api-features', expiration: { maxEntries: 5, maxAgeSeconds: 60 } },
    },
    {
      urlPattern: /\.(?:png|jpg|jpeg|svg|webp|avif|ico|mp3|wav|pdf)$/i,
      handler: 'CacheFirst',
      options: { cacheName: 'local-media', expiration: { maxEntries: 120, maxAgeSeconds: 30 * 24 * 60 * 60 } },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
