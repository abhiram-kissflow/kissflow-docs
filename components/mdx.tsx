import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { PlanBadge } from '@/components/plan-badge';
import { PersonaNav } from '@/components/persona-nav';
import { ScalarEmbed } from '@/components/scalar-embed';
import { RoadmapBoard } from '@/components/roadmap-board';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    PlanBadge,
    PersonaNav,
    ScalarEmbed,
    RoadmapBoard,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
