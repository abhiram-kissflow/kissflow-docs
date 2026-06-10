import { z } from 'zod';

export const contentTypes = [
  'overview',
  'guide',
  'reference',
  'tutorial',
  'use-case',
  'troubleshooting',
] as const;

export const personas = [
  'end-user',
  'citizen-developer',
  'admin',
  'pro-developer',
  'shared',
] as const;

export const sections = [
  'get-started',
  'use',
  'build',
  'admin',
  'develop',
  'reference',
  'whats-new',
  'app-store',
] as const;

export const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  contentType: z.enum(contentTypes),
  persona: z.enum(personas),
  section: z.enum(sections),
  planAvailability: z
    .object({
      basic: z.boolean().default(true),
      enterprise: z.boolean().default(true),
    })
    .optional(),
  lastVerifiedAgainst: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type Frontmatter = z.infer<typeof frontmatterSchema>;
