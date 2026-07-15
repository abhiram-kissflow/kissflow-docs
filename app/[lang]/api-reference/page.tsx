'use client';

import Link from 'next/link';
import '@scalar/api-reference-react/style.css';
import { ApiReferenceReact } from '@scalar/api-reference-react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

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
