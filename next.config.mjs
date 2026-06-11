import { createMDX } from 'fumadocs-mdx/next';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const config = {
  output: 'export',
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true, // Required for static export
  },
  turbopack: {
    root: __dirname,
  },
};

export default withMDX(config);
