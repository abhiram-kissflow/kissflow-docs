'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

type From = 'user' | 'assistant' | 'system';

export type MessageProps = ComponentProps<'div'> & {
  from: From;
};

export function Message({ from, className, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        'flex w-full',
        from === 'user' ? 'justify-end' : 'justify-start',
        className,
      )}
      {...props}
    />
  );
}

export type MessageContentProps = ComponentProps<'div'> & {
  from?: From;
};

export function MessageContent({ from = 'assistant', className, ...props }: MessageContentProps) {
  return (
    <div
      className={cn(
        'max-w-[92%] rounded-lg px-3 py-2 text-sm',
        from === 'user' ? 'bg-fd-primary/12' : 'bg-fd-muted',
        className,
      )}
      {...props}
    />
  );
}

export type MessageResponseProps = ComponentProps<'div'>;

export function MessageResponse({ className, ...props }: MessageResponseProps) {
  return <div className={cn('whitespace-pre-wrap', className)} {...props} />;
}
