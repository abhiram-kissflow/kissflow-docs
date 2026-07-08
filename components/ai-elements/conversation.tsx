'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

export type ConversationProps = ComponentProps<'div'>;

export function Conversation({ className, ...props }: ConversationProps) {
  return <div className={cn('relative flex-1 overflow-y-auto', className)} {...props} />;
}

export type ConversationContentProps = ComponentProps<'div'>;

export function ConversationContent({ className, ...props }: ConversationContentProps) {
  return <div className={cn('flex flex-col gap-4 p-3', className)} {...props} />;
}
