import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactCompiler: true,
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.clerk.com https://*.clerk.accounts.dev",
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://*.supabase.co https://*.clerk.com wss://*.supabase.co https://api.anthropic.com https://api.stripe.com",
            "frame-src 'self' https://*.clerk.com",
            "font-src 'self'",
          ].join('; '),
        },
      ],
    },
    {
      source: '/api/:path*',
      headers: [
        { key: 'Cache-Control', value: 'no-store, max-age=0' },
      ],
    },
  ],
};
export default nextConfig;
