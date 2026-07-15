import { createMDX } from 'fumadocs-mdx/next';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
const staticExport = process.env.STATIC_EXPORT === 'true' || Boolean(basePath);

const config = {
  basePath,
  assetPrefix: basePath || undefined,
  // This is a public allowlist, not a credential. Expose it so the client-side
  // media renderer applies the same policy as server-side RAG preparation.
  env: {
    RAG_MEDIA_ALLOWED_HOSTS: process.env.RAG_MEDIA_ALLOWED_HOSTS ?? '',
  },
  images: {
    unoptimized: staticExport,
  },
  turbopack: {
    root: __dirname,
  },
  ...(staticExport
    ? { output: 'export' }
    : {
        // /docs has no index page; hideLocale also 307s /en/docs down to /docs.
        async redirects() {
          return [
            { source: '/docs', destination: '/docs/get-started', permanent: false },
            { source: '/:lang(en|es)/docs', destination: '/:lang/docs/get-started', permanent: false },
          ];
        },
      }),
};

export default withMDX(config);
