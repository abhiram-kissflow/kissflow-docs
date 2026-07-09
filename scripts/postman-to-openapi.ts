/**
 * Full spec regeneration procedure, when the Kissflow API changes:
 * 1. Export the updated Postman collection to JSON.
 * 2. npm run openapi:convert -- <path-to-collection.json>
 * 3. npm run openapi:normalize-auth -- .tmp/openapi-draft.json .tmp/openapi-normalized.json
 * 4. Diff .tmp/openapi-normalized.json against public/openapi/kissflow-api.json —
 *    manually port real changes forward (new/changed operations), don't overwrite
 *    the enriched spec wholesale, since re-running steps 2-3 regenerates only
 *    structure, not the schema/example enrichment from Task 5's agent passes.
 * 5. npm run openapi:lint before committing.
 *
 * Note: response bodies that aren't valid JSON (binary placeholders, truncated/malformed
 * pastes) are auto-sanitized to "{}" before conversion, with a warning logged per
 * occurrence, since postman-to-openapi cannot parse non-JSON example bodies. The
 * sanitized copy is written to .tmp/postman-collection-sanitized.json; the original
 * source file is never modified.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import postmanToOpenApi from 'postman-to-openapi';

const [, , collectionPath] = process.argv;
const OUTPUT_PATH = '.tmp/openapi-draft.json';
const SANITIZED_COLLECTION_PATH = '.tmp/postman-collection-sanitized.json';

if (!collectionPath) {
  console.error('Usage: npx tsx scripts/postman-to-openapi.ts <path-to-postman-collection.json>');
  process.exit(1);
}

function sanitizeUnparseableResponseBodies(
  node: unknown,
  path: string[] = [],
  currentOperationName = 'unknown operation',
): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) =>
      sanitizeUnparseableResponseBodies(item, [...path, String(i)], currentOperationName),
    );
    return;
  }
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>;
    const operationName =
      typeof obj.name === 'string' && obj.request ? obj.name : currentOperationName;

    if (typeof obj.body === 'string') {
      try {
        JSON.parse(obj.body);
      } catch {
        console.warn(
          `Sanitizing unparseable response body at ${path.join('.')} (operation: ${operationName})`,
        );
        obj.body = '{}';
      }
    }
    for (const [key, value] of Object.entries(obj)) {
      sanitizeUnparseableResponseBodies(value, [...path, key], operationName);
    }
  }
}

async function main() {
  mkdirSync('.tmp', { recursive: true });

  const raw = JSON.parse(readFileSync(collectionPath, 'utf-8'));
  sanitizeUnparseableResponseBodies(raw);
  writeFileSync(SANITIZED_COLLECTION_PATH, JSON.stringify(raw));

  await postmanToOpenApi(SANITIZED_COLLECTION_PATH, OUTPUT_PATH, {
    outputFormat: 'json',
    defaultTag: 'General',
  });
  console.log(`Draft OpenAPI spec written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
