'use client';

import Link from 'next/link';
import '@scalar/api-reference-react/style.css';
import { ApiReferenceReact } from '@scalar/api-reference-react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

// Replace Scalar's "Powered by Scalar" attribution with the Kissflow wordmark.
// Targets the attribution link by its stable href (utility classes change across
// Scalar versions). Scalar sets body.light-mode / body.dark-mode, so the white
// logo is swapped in on dark; prefers-color-scheme is a fallback.
const brandingCss = `
a[href="https://www.scalar.com"] {
  font-size: 0 !important;
  line-height: 0 !important;
  pointer-events: none;
}
a[href="https://www.scalar.com"]::after {
  content: "";
  display: block;
  width: 96px;
  height: 15px;
  background: url("${basePath}/kissflow-logo.png") left center / contain no-repeat;
}
body.dark-mode a[href="https://www.scalar.com"]::after {
  background-image: url("${basePath}/kissflow-logo-white.png");
}
@media (prefers-color-scheme: dark) {
  body:not(.light-mode) a[href="https://www.scalar.com"]::after {
    background-image: url("${basePath}/kissflow-logo-white.png");
  }
}

/* Markdown tables: Scalar uses table-layout:fixed + word-break:break-word, so
   narrow columns break mid-word ("HTTP" -> "HT TP"). Size columns to content
   and only break at word boundaries. */
.scalar-app table {
  table-layout: auto !important;
  width: 100% !important;
}
.scalar-app th,
.scalar-app td {
  word-break: normal !important;
  overflow-wrap: break-word !important;
}
`;

export default function ApiReferencePage() {
  return (
    <>
      <Link
        href={`${basePath}/docs/get-started`}
        className="fixed bottom-4 right-4 z-50 rounded-md border border-fd-border bg-fd-card px-3 py-1.5 text-xs text-fd-foreground shadow-lg hover:border-fd-primary/50"
      >
        ← Back to Docs
      </Link>
      <ApiReferenceReact
        configuration={{
          url: `${basePath}/openapi/kissflow-api.json`,
          // Route try-it requests through our same-origin proxy so the browser
          // isn't blocked by CORS (the Kissflow API sends no ACAO for the docs
          // origin). Only works on the dynamic Vercel deploy; harmless on the
          // static GitHub Pages mirror where try-it can't run anyway.
          proxyUrl: `${basePath}/api/scalar-proxy`,
          customCss: brandingCss,
          authentication: {
            // Kissflow requires BOTH headers together (X-Access-Key-Id +
            // X-Access-Key-Secret). The nested array is an AND requirement, so
            // the panel pre-selects and sends both — a flat array would be OR
            // and a bare string only picked one, which 403'd for missing secret.
            preferredSecurityScheme: [['accessKeyId', 'accessKeySecret']],
          },
        }}
      />
    </>
  );
}
