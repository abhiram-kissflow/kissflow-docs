import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { PlanBadge } from '@/components/plan-badge';
import { PersonaNav } from '@/components/persona-nav';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    PlanBadge,
    PersonaNav,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
