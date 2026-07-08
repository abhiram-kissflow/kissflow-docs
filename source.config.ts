import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { z } from 'zod';

// pageSchema strips unknown keys by default, so our custom frontmatter
// fields (persona, tags, redirectTo, etc. — see lib/frontmatter.ts) must be
// declared here too, or they silently vanish from page.data at build time.
const extendedPageSchema = pageSchema.extend({
  contentType: z.string().optional(),
  persona: z.string().optional(),
  section: z.string().optional(),
  planAvailability: z
    .object({ basic: z.boolean().optional(), enterprise: z.boolean().optional() })
    .optional(),
  lastVerifiedAgainst: z.string().optional(),
  tags: z.array(z.string()).optional(),
  redirectTo: z.string().optional(),
});

// You can customize Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections
export const docs = defineDocs({
  dir: 'content',
  docs: {
    schema: extendedPageSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    // MDX options
  },
});
