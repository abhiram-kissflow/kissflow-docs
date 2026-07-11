import type { ReactNode } from 'react';
import {
  RocketLaunch,
  CursorClick,
  GridFour,
  ShieldCheck,
  Code,
  BookOpen,
  Sparkle,
  Storefront,
  MapTrifold,
  Flask,
} from '@phosphor-icons/react/dist/ssr';

/**
 * Phosphor Icons — duotone weight, inherits text color so it
 * adapts to light/dark theme.
 * Consistent sizing, no viewBox issues.
 */

const iconProps = {
  size: 18,
  weight: 'duotone' as const,
  color: 'currentColor',
};

export const sectionIcons: Record<string, ReactNode> = {
  'get-started': <RocketLaunch {...iconProps} />,
  use: <CursorClick {...iconProps} />,
  build: <GridFour {...iconProps} />,
  admin: <ShieldCheck {...iconProps} />,
  develop: <Code {...iconProps} />,
  reference: <BookOpen {...iconProps} />,
  'whats-new': <Sparkle {...iconProps} />,
  roadmap: <MapTrifold {...iconProps} />,
  'pre-release-notes': <Flask {...iconProps} />,
  'app-store': <Storefront {...iconProps} />,
};
