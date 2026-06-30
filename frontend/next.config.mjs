import createNextIntlPlugin from 'next-intl/plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Point the next-intl plugin at our request-scoped i18n config.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Product/hero photography is hotlinked from Unsplash (images.unsplash.com) when the
  // generated catalogue is populated; otherwise local SVG placeholders are used.
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
  // Standalone output + monorepo trace root are ONLY for the Docker image. On Vercel
  // (process.env.VERCEL === '1') we use Vercel's default build pipeline, so we skip these
  // to avoid tracing files outside the deployed project root.
  ...(process.env.VERCEL
    ? {}
    : {
        output: 'standalone',
        experimental: {
          outputFileTracingRoot: path.join(__dirname, '..'),
        },
      }),
};

export default withNextIntl(nextConfig);
