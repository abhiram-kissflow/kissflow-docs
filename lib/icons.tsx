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
} from '@phosphor-icons/react/dist/ssr';

/**
 * Phosphor Icons — duotone weight, dark warm tone.
 * Consistent sizing, no viewBox issues.
 */

const iconProps = {
  size: 18,
  weight: 'duotone' as const,
  color: '#371f1f',
};

export const sectionIcons: Record<string, ReactNode> = {
  'get-started': <RocketLaunch {...iconProps} />,
  use: <CursorClick {...iconProps} />,
  build: <GridFour {...iconProps} />,
  admin: <ShieldCheck {...iconProps} />,
  develop: <Code {...iconProps} />,
  reference: <BookOpen {...iconProps} />,
  'whats-new': <Sparkle {...iconProps} />,
  'app-store': <Storefront {...iconProps} />,
};
