interface OpenApiOperation {
  parameters?: Array<{ name: string; in: string; [key: string]: unknown }>;
  security?: Array<Record<string, string[]>>;
  [key: string]: unknown;
}

interface OpenApiDocument {
  components?: { securitySchemes?: Record<string, unknown>; [key: string]: unknown };
  paths: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

const ACCESS_KEY_ID_HEADER = 'X-Access-Key-Id';
const ACCESS_KEY_SECRET_HEADER = 'X-Access-Key-Secret';
const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

export function normalizeAuth(doc: OpenApiDocument): OpenApiDocument {
  const securitySchemes = {
    accessKeyId: { type: 'apiKey', in: 'header', name: ACCESS_KEY_ID_HEADER },
    accessKeySecret: { type: 'apiKey', in: 'header', name: ACCESS_KEY_SECRET_HEADER },
  };

  const paths: OpenApiDocument['paths'] = {};
  for (const [path, methods] of Object.entries(doc.paths)) {
    const normalizedMethods: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(methods)) {
      if (!HTTP_METHODS.includes(key)) {
        normalizedMethods[key] = value;
        continue;
      }
      const operation = value as OpenApiOperation;
      const remainingParams = (operation.parameters ?? []).filter(
        (p) =>
          !(
            p.in === 'header' &&
            (p.name === ACCESS_KEY_ID_HEADER || p.name === ACCESS_KEY_SECRET_HEADER)
          ),
      );
      normalizedMethods[key] = {
        ...operation,
        parameters: remainingParams,
        security: [{ accessKeyId: [], accessKeySecret: [] }],
      };
    }
    paths[path] = normalizedMethods;
  }

  return {
    ...doc,
    components: {
      ...doc.components,
      securitySchemes: {
        ...doc.components?.securitySchemes,
        ...securitySchemes,
      },
    },
    paths,
  };
}
