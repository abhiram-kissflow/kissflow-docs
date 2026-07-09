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
  images: {
    unoptimized: staticExport,
  },
  turbopack: {
    root: __dirname,
  },
  ...(staticExport ? { output: 'export' } : {}),
};

export default withMDX(config);
