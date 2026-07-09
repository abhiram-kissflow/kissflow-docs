'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type SuggestionsProps = ComponentProps<'div'>;

export function Suggestions({ className, ...props }: SuggestionsProps) {
  return <div className={cn('flex flex-wrap gap-2', className)} {...props} />;
}

export type SuggestionProps = Omit<ComponentProps<'button'>, 'onClick'> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export function Suggestion({ suggestion, onClick, className, ...props }: SuggestionProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(suggestion)}
      className={cn(
        'max-w-full rounded-full border border-fd-border bg-fd-background px-3 py-1.5 text-left text-sm text-fd-foreground hover:bg-fd-muted',
        className,
      )}
      {...props}
    >
      {suggestion}
    </button>
  );
}
