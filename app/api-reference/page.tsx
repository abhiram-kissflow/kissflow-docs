'use client';

import '@scalar/api-reference-react/style.css';
import { ApiReferenceReact } from '@scalar/api-reference-react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function ApiReferencePage() {
  return (
    <ApiReferenceReact
      configuration={{
        url: `${basePath}/openapi/kissflow-api.json`,
        authentication: {
          preferredSecurityScheme: 'accessKeyId',
        },
      }}
    />
  );
}
