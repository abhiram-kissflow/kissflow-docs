# Postman → Scalar API Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Kissflow Postman API collection into a Scalar-rendered `/api-reference` route, wired into the Fumadocs nav as a second dropdown entry alongside `/docs`.

**Architecture:** `/api-reference` is a standalone Next.js route (not part of the Fumadocs page tree) that mounts `@scalar/api-reference-react` against a static, committed OpenAPI spec. The spec is produced by mechanically converting the Postman collection, deterministically normalizing its auth headers into proper OpenAPI security schemes, then enriching it module-by-module via dispatched agents. `DocsLayout`'s native `tabs` prop supplies the dropdown UI on the `/docs` side.

**Tech Stack:** Next.js (App Router), Fumadocs UI 16.9.3, `@scalar/api-reference-react`, `postman-to-openapi`, `@redocly/cli`, `tsx` (existing script runner), Node's built-in `node:test` (no new test framework).

## Global Constraints

- Implements `docs/superpowers/specs/2026-07-09-postman-to-scalar-api-reference-design.md`. SDK docs (developers.kissflow.com) migration and operation-level `ScalarEmbed` deep-linking are explicitly out of scope for this plan.
- Postman source file (local, not committed to the repo): `/Users/abhiram/Downloads/Kissflow API documentation.postman_collection.json`.
- Final spec lives at `public/openapi/kissflow-api.json` — never under `content/` (Fumadocs MDX loader territory).
- Auth model: two `apiKey`/`in: header` security schemes (`accessKeyId` → `X-Access-Key-Id`, `accessKeySecret` → `X-Access-Key-Secret`) combined via a single AND security requirement (`security: [{ accessKeyId: [], accessKeySecret: [] }]`). Never model this as one shared scheme.
- Node engine note: `@scalar/api-reference-react` requires Node `>=22`; `@redocly/cli` requires Node `>=22.12.0 || >=20.19.0 <21.0.0`. Verified empirically on this machine (Node v21.7.1, outside both ranges): `npm install` and `redocly lint` both still run, printing a non-fatal engine warning. Treat the warning as expected noise, not a blocker — do not add Node-version-pinning infra to work around it.
- No new test framework: use Node's built-in `node:test` + `node:assert/strict` for the one piece of pure, testable logic in this plan (auth normalization). Everything else is verified by running the actual command and inspecting output, consistent with this repo's existing `tsx`-script conventions.
- Repo has no `content/develop/api/` articles yet — do not author placeholder articles as part of this plan; that's separate content work.

---

### Task 1: Install dependencies and add npm scripts

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `@scalar/api-reference-react` (dependency), `postman-to-openapi` and `@redocly/cli` (devDependencies) available in `node_modules`; npm scripts `openapi:convert`, `openapi:normalize-auth`, `openapi:lint`.

- [ ] **Step 1: Install the runtime dependency**

Run: `npm install @scalar/api-reference-react@^0.9.54`
Expected: `package.json` `dependencies` gains `"@scalar/api-reference-react": "^0.9.54"`. An engine warning for Node `>=22` may print — expected, non-fatal (see Global Constraints).

- [ ] **Step 2: Install the dev-only dependencies**

Run: `npm install -D postman-to-openapi@^3.0.1 @redocly/cli@^2.38.0`
Expected: `package.json` `devDependencies` gains both entries.

- [ ] **Step 3: Add npm scripts**

Edit `package.json`, in the `"scripts"` block, add:

```json
"openapi:convert": "npx tsx scripts/postman-to-openapi.ts",
"openapi:normalize-auth": "npx tsx scripts/apply-auth-normalization.ts",
"openapi:lint": "npx redocly lint public/openapi/kissflow-api.json"
```

- [ ] **Step 4: Verify the packages resolve**

Run: `npx tsx -e "import('@scalar/api-reference-react').then(m => console.log(Object.keys(m)))"`
Expected output includes: `ApiReferenceReact`

Run: `npx tsx -e "import('postman-to-openapi').then(m => console.log(typeof m.default))"`
Expected output: `function`

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add Scalar, postman-to-openapi, and Redocly CLI dependencies"
```

---

### Task 2: Postman → OpenAPI draft conversion script

**Files:**
- Create: `scripts/postman-to-openapi.ts`
- Modify: `.gitignore` (add `/.tmp`)

**Interfaces:**
- Consumes: `postman-to-openapi` default export `(collectionPath: string, outputPath: string | null, options: { outputFormat?: 'json' | 'yaml'; defaultTag?: string }) => Promise<string>` (Task 1).
- Produces: `.tmp/openapi-draft.json` (gitignored, local-only draft) when run against a real Postman collection file.

- [ ] **Step 1: Add `.tmp` to `.gitignore`**

Edit `.gitignore`, add under the `# generated content` section:

```
.tmp/
```

- [ ] **Step 2: Write the conversion script**

Create `scripts/postman-to-openapi.ts`:

```ts
import { mkdirSync } from 'fs';
import postmanToOpenApi from 'postman-to-openapi';

const [, , collectionPath] = process.argv;
const OUTPUT_PATH = '.tmp/openapi-draft.json';

if (!collectionPath) {
  console.error('Usage: npx tsx scripts/postman-to-openapi.ts <path-to-postman-collection.json>');
  process.exit(1);
}

async function main() {
  mkdirSync('.tmp', { recursive: true });
  await postmanToOpenApi(collectionPath, OUTPUT_PATH, {
    outputFormat: 'json',
    defaultTag: 'General',
  });
  console.log(`Draft OpenAPI spec written to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Run the conversion against the real collection**

Run: `npm run openapi:convert -- "/Users/abhiram/Downloads/Kissflow API documentation.postman_collection.json"`
Expected: `Draft OpenAPI spec written to .tmp/openapi-draft.json`, and the file exists.

Verify: `npx tsx -e "const d = require('./.tmp/openapi-draft.json'); console.log(Object.keys(d.paths).length)"`
Expected: a number close to 106 (one path per distinct URL pattern — some requests may share a path with different methods, so this can be somewhat lower than the raw request count).

- [ ] **Step 4: Document the regeneration procedure**

Add a doc comment to the top of `scripts/postman-to-openapi.ts`, above the imports:

```ts
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
 */
```

- [ ] **Step 5: Commit the script (not the draft output)**

```bash
git add scripts/postman-to-openapi.ts .gitignore
git commit -m "feat: add Postman-to-OpenAPI draft conversion script"
```

---

### Task 3: Auth normalization (TDD)

**Files:**
- Create: `scripts/normalize-openapi-auth.ts`
- Create: `scripts/normalize-openapi-auth.test.ts`
- Create: `scripts/apply-auth-normalization.ts`

**Interfaces:**
- Consumes: `.tmp/openapi-draft.json` (Task 2).
- Produces: `normalizeAuth(doc: OpenApiDocument): OpenApiDocument` (pure function, used by Task 5 agents' mental model of the spec's auth shape); `public/openapi/kissflow-api.json` (seed commit, seeded from the normalized draft).

- [ ] **Step 1: Write the failing test**

Create `scripts/normalize-openapi-auth.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuth } from './normalize-openapi-auth';

test('strips the two access-key headers and adds a combined security requirement', () => {
  const input = {
    paths: {
      '/user/2/{account_id}/{user_id}': {
        get: {
          parameters: [
            { name: 'X-Access-Key-Id', in: 'header' },
            { name: 'X-Access-Key-Secret', in: 'header' },
            { name: 'account_id', in: 'path' },
          ],
        },
      },
    },
  };

  const result = normalizeAuth(input as any);
  const op = (result.paths['/user/2/{account_id}/{user_id}'] as any).get;

  assert.deepEqual(op.parameters, [{ name: 'account_id', in: 'path' }]);
  assert.deepEqual(op.security, [{ accessKeyId: [], accessKeySecret: [] }]);
  assert.deepEqual(result.components?.securitySchemes?.accessKeyId, {
    type: 'apiKey',
    in: 'header',
    name: 'X-Access-Key-Id',
  });
  assert.deepEqual(result.components?.securitySchemes?.accessKeySecret, {
    type: 'apiKey',
    in: 'header',
    name: 'X-Access-Key-Secret',
  });
});

test('leaves path-level keys other than HTTP methods untouched', () => {
  const input = {
    paths: {
      '/foo': {
        parameters: [{ name: 'shared', in: 'query' }],
        get: { parameters: [] },
      },
    },
  };

  const result = normalizeAuth(input as any);
  assert.deepEqual((result.paths['/foo'] as any).parameters, [{ name: 'shared', in: 'query' }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test scripts/normalize-openapi-auth.test.ts`
Expected: FAIL — `Cannot find module './normalize-openapi-auth'`

- [ ] **Step 3: Write the implementation**

Create `scripts/normalize-openapi-auth.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test scripts/normalize-openapi-auth.test.ts`
Expected: PASS — `2 tests passed`

- [ ] **Step 5: Write the CLI wrapper**

Create `scripts/apply-auth-normalization.ts`:

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { normalizeAuth } from './normalize-openapi-auth';

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: npx tsx scripts/apply-auth-normalization.ts <input.json> <output.json>');
  process.exit(1);
}

const doc = JSON.parse(readFileSync(inputPath, 'utf-8'));
const normalized = normalizeAuth(doc);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(normalized, null, 2) + '\n');
console.log(`Normalized spec written to ${outputPath}`);
```

- [ ] **Step 6: Run it against the real draft to seed the committed spec**

Run: `npm run openapi:normalize-auth -- .tmp/openapi-draft.json public/openapi/kissflow-api.json`
Expected: `Normalized spec written to public/openapi/kissflow-api.json`

Verify no duplicated auth headers remain:
Run: `npx tsx -e "const d = require('./public/openapi/kissflow-api.json'); const bad = Object.values(d.paths).flatMap(m => Object.values(m)).filter(op => (op.parameters||[]).some(p => p.name === 'X-Access-Key-Id')); console.log('remaining duplicated headers:', bad.length)"`
Expected: `remaining duplicated headers: 0`

- [ ] **Step 7: Commit**

```bash
git add scripts/normalize-openapi-auth.ts scripts/normalize-openapi-auth.test.ts scripts/apply-auth-normalization.ts public/openapi/kissflow-api.json
git commit -m "feat: seed public/openapi/kissflow-api.json with normalized auth scheme"
```

---

### Task 4: OpenAPI lint gate

**Files:**
- Create: `redocly.yaml`

**Interfaces:**
- Consumes: `public/openapi/kissflow-api.json` (Task 3).
- Produces: `npm run openapi:lint` — exit code 0 on structurally valid specs, non-zero on genuinely broken ones (missing required fields, broken `$ref`s, invalid types). Used as a gate in Task 5 and Task 9.

- [ ] **Step 1: Add a minimal-ruleset Redocly config**

Redocly's default `recommended` ruleset enforces stylistic completeness (per-operation tags, license info, 4xx responses, etc.) that would fail this spec for reasons unrelated to correctness. Create `redocly.yaml`:

```yaml
extends:
  - minimal
```

- [ ] **Step 2: Run the lint gate against the seed spec**

Run: `npm run openapi:lint`
Expected: exit code 0, output ending in `Woohoo! Your API description is valid. 🎉` (possibly with warnings — warnings are fine, only errors fail the `minimal` ruleset).

- [ ] **Step 3: Verify the gate actually catches real breakage**

Run: `cp public/openapi/kissflow-api.json /tmp/broken-spec.json && npx tsx -e "const fs=require('fs'); const d=JSON.parse(fs.readFileSync('/tmp/broken-spec.json')); delete d.info; fs.writeFileSync('/tmp/broken-spec.json', JSON.stringify(d))" && npx redocly lint /tmp/broken-spec.json; echo "exit: $?"`
Expected: exit code 1 (non-zero) — confirms the gate fails on structurally invalid specs, not just passes everything.

- [ ] **Step 4: Commit**

```bash
git add redocly.yaml
git commit -m "chore: add minimal-ruleset Redocly lint gate for the OpenAPI spec"
```

---

### Task 5: Agent-assisted enrichment, 6 modules

**Files:**
- Modify: `public/openapi/kissflow-api.json` (six times, once per module)

**Interfaces:**
- Consumes: `public/openapi/kissflow-api.json` (Task 4, lint-passing seed), the local Postman collection file (path in Global Constraints), `npm run openapi:lint` (Task 4).
- Produces: the same file, enriched, still lint-passing, after all six passes.

This task is content authoring, not code — each step dispatches one agent (via the `Agent` tool, `subagent_type: general-purpose`, since it needs Read/Edit/Bash access, not a fresh-context specialist) with the prompt template below, substituting `{MODULE_NAME}` and `{MODULE_FOLDER}` from the table.

**Prompt template** (verbatim, substitute the two placeholders from the table below):

```
Enrich the OpenAPI spec at public/openapi/kissflow-api.json for the "{MODULE_NAME}"
module only.

Source of truth for this module's endpoints: the Postman collection at
"/Users/abhiram/Downloads/Kissflow API documentation.postman_collection.json",
folder "{MODULE_FOLDER}". Every request in that folder has a description and
up to 4 response examples — use them as the ground truth for what to fill in.

For every path/method in public/openapi/kissflow-api.json that corresponds to
a request in the "{MODULE_FOLDER}" folder:
1. Fill in the operation's summary/description from the Postman request's
   description if it's missing or a low-quality auto-generated stub.
2. Fill in request body schema (types, required fields, example values) from
   the Postman request body and its description.
3. Fill in response schemas for each status code using the Postman response
   examples — infer types from the example JSON, mark fields required if
   they appear in every example, add the example itself under `examples`.
4. Do NOT touch the `security` field or re-add `X-Access-Key-Id` /
   `X-Access-Key-Secret` as parameters — auth is already normalized as a
   shared `accessKeyId` + `accessKeySecret` security requirement. Leave it
   alone.
5. Do NOT modify any path that does not belong to the "{MODULE_FOLDER}"
   folder.

After editing, run `npm run openapi:lint` and fix any errors it reports in
the paths you touched (warnings are fine). Report back which paths you
enriched and the final lint exit code.
```

Module substitution table:

| `{MODULE_NAME}` | `{MODULE_FOLDER}` (exact Postman folder name) |
|---|---|
| Users and groups | Users and groups |
| Portals | Portals |
| Processes | Processes |
| Boards | Boards |
| Dataforms and dataform views | Dataforms and dataform views |
| Dataset and dataset views | Dataset and dataset views |

- [ ] **Step 1: Dispatch the enrichment agent for "Users and groups"**

Use the `Agent` tool with the prompt template above, `{MODULE_NAME}` = `Users and groups`, `{MODULE_FOLDER}` = `Users and groups`.

After it returns: run `npm run openapi:lint`. Expected: exit code 0.
Run: `git diff --stat public/openapi/kissflow-api.json` and confirm only paths under the Users/Groups module changed (spot-check a few path keys against the Postman folder's request URLs).
Commit: `git add public/openapi/kissflow-api.json && git commit -m "docs: enrich OpenAPI spec — Users and groups module"`

- [ ] **Step 2: Dispatch the enrichment agent for "Portals"**

Same procedure as Step 1, with `{MODULE_NAME}` = `Portals`, `{MODULE_FOLDER}` = `Portals`.
Commit message: `"docs: enrich OpenAPI spec — Portals module"`

- [ ] **Step 3: Dispatch the enrichment agent for "Processes"**

Same procedure, `{MODULE_NAME}` = `Processes`, `{MODULE_FOLDER}` = `Processes`.
Commit message: `"docs: enrich OpenAPI spec — Processes module"`

- [ ] **Step 4: Dispatch the enrichment agent for "Boards"**

Same procedure, `{MODULE_NAME}` = `Boards`, `{MODULE_FOLDER}` = `Boards`.
Commit message: `"docs: enrich OpenAPI spec — Boards module"`

- [ ] **Step 5: Dispatch the enrichment agent for "Dataforms and dataform views"**

Same procedure, `{MODULE_NAME}` = `Dataforms and dataform views`, `{MODULE_FOLDER}` = `Dataforms and dataform views`.
Commit message: `"docs: enrich OpenAPI spec — Dataforms and dataform views module"`

- [ ] **Step 6: Dispatch the enrichment agent for "Dataset and dataset views"**

Same procedure, `{MODULE_NAME}` = `Dataset and dataset views`, `{MODULE_FOLDER}` = `Dataset and dataset views`.
Commit message: `"docs: enrich OpenAPI spec — Dataset and dataset views module"`

- [ ] **Step 7: Final lint pass over the fully-enriched spec**

Run: `npm run openapi:lint`
Expected: exit code 0.

---

### Task 6: `/api-reference` route

**Files:**
- Create: `app/api-reference/page.tsx`

**Interfaces:**
- Consumes: `ApiReferenceReact` from `@scalar/api-reference-react` (Task 1); `public/openapi/kissflow-api.json` (Task 5, fetched client-side by URL, not imported).
- Produces: the `/api-reference` route.

- [ ] **Step 1: Write the route**

Create `app/api-reference/page.tsx`:

```tsx
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
```

- [ ] **Step 2: Verify it renders**

Run: `npm run dev` (in background or a separate terminal)
Run: `curl -s http://localhost:3000/api-reference | grep -o "Kissflow API documentation" | head -1`
Expected: `Kissflow API documentation` (the spec's `info.title`, confirming the page fetched and rendered the spec — Scalar renders `info.title` into the page).

Open `http://localhost:3000/api-reference` in a browser, confirm: sidebar lists the 6 modules, clicking an operation shows request/response details, and the auth panel shows the two access-key header fields.

- [ ] **Step 3: Commit**

```bash
git add app/api-reference/page.tsx
git commit -m "feat: add /api-reference route rendering the Scalar API reference"
```

---

### Task 7: Nav dropdown (Docs / API Reference)

**Files:**
- Modify: `app/docs/layout.tsx`

**Interfaces:**
- Consumes: `LayoutTab` type from `fumadocs-ui/layouts/shared` (used implicitly via `DocsLayout`'s `tabs` prop); `lucide-react` icons (already a dependency).
- Produces: the sidebar dropdown switcher between `/docs` and `/api-reference`.

- [ ] **Step 1: Add the `tabs` prop to `DocsLayout`**

Read current `app/docs/layout.tsx` (already read during planning — 15 lines, imports `source`, `DocsLayout`, `baseOptions`, `AIChatLauncher`). Replace its contents:

```tsx
import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import AIChatLauncher from '@/components/ai-chat-launcher';
import { BookOpen, Braces } from 'lucide-react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <>
      <DocsLayout
        tree={source.getPageTree()}
        tabs={[
          {
            url: `${basePath}/docs/get-started`,
            title: 'Docs',
            description: 'Guides, admin settings, and how-to articles',
            icon: <BookOpen className="size-4" />,
          },
          {
            url: `${basePath}/api-reference`,
            title: 'API Reference',
            description: 'REST API endpoints, requests, and responses',
            icon: <Braces className="size-4" />,
          },
        ]}
        {...baseOptions()}
      >
        {children}
      </DocsLayout>
      <AIChatLauncher />
    </>
  );
}
```

- [ ] **Step 2: Verify it renders**

Run: `curl -s http://localhost:3000/docs/get-started | grep -o "API Reference" | head -1`
Expected: `API Reference`

Open `http://localhost:3000/docs/get-started` in a browser, confirm the sidebar shows a dropdown at the top with "Docs" as the active entry and "API Reference" as the other option; clicking "API Reference" navigates to `/api-reference`.

- [ ] **Step 3: Commit**

```bash
git add app/docs/layout.tsx
git commit -m "feat: add Docs / API Reference dropdown to the docs sidebar"
```

---

### Task 8: Repurpose `ScalarEmbed`

**Files:**
- Modify: `components/scalar-embed.tsx`

**Interfaces:**
- Consumes: `next/link`.
- Produces: `ScalarEmbed({ title, description, href? })` — `href` now optional, defaults to `/api-reference`; internal navigation instead of an external link.

- [ ] **Step 1: Update the component**

Replace `components/scalar-embed.tsx`:

```tsx
import Link from 'next/link';
import type { ReactNode } from 'react';

interface ScalarEmbedProps {
  title: string;
  description: string;
  href?: string;
}

/**
 * Links into the /api-reference Scalar route. Operation-level deep-linking
 * (via Scalar's generateOperationSlug) is a deliberate follow-up, not done
 * here — see docs/superpowers/specs/2026-07-09-postman-to-scalar-api-reference-design.md.
 */
export function ScalarEmbed({
  title,
  description,
  href = '/api-reference',
}: ScalarEmbedProps): ReactNode {
  return (
    <Link
      href={href}
      className="block p-4 my-4 rounded-lg border border-fd-border bg-fd-card hover:border-fd-primary/50 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm font-medium text-fd-primary">{title}</span>
      </div>
      <p className="text-sm text-fd-muted-foreground">{description}</p>
    </Link>
  );
}
```

- [ ] **Step 2: Verify no existing usages break**

Run: `npx tsx -e "const {execSync} = require('child_process'); console.log(execSync('grep -rl \"ScalarEmbed\" content --include=\"*.mdx\"').toString() || 'no usages in content')"`
Expected: `no usages in content` (confirmed at planning time — `content/develop/api/` is currently an empty stub with no `.mdx` files). If this prints file paths instead, open each and confirm the `href` prop (if any) still makes sense as an internal path; update as needed.

- [ ] **Step 3: Commit**

```bash
git add components/scalar-embed.tsx
git commit -m "feat: point ScalarEmbed at the internal /api-reference route"
```

---

### Task 9: Final integration verification

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Type check**

Run: `npm run types:check`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 2: Full build**

Run: `npm run build`
Expected: exits 0. Confirm `/api-reference` appears in the build output route list.

- [ ] **Step 3: OpenAPI lint, one more time**

Run: `npm run openapi:lint`
Expected: exit code 0.

- [ ] **Step 4: Manual walkthrough**

Run: `npm run dev`. In a browser:
1. Visit `/docs/get-started` — confirm the Docs/API Reference dropdown appears and works.
2. Click through to `/api-reference` — confirm all 6 modules appear in the sidebar, with enriched descriptions (not raw auto-generated stubs) on at least one operation per module.
3. Expand an operation, confirm the auth panel shows both `X-Access-Key-Id` and `X-Access-Key-Secret` fields together (not one, not duplicated).

- [ ] **Step 5: Push and open a PR** (only if explicitly requested — do not push automatically)
