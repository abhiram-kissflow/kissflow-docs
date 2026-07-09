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
          authentication: {
            preferredSecurityScheme: 'accessKeyId',
          },
        }}
      />
    </>
  );
}
