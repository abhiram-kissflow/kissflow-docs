'use client';

import type { SourceUrlUIPart, UIMessage, UIMessagePart } from 'ai';
import { useChat } from '@chat-adapter/web/react';
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
} from '@/components/ai-elements/message';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import {
  Suggestion,
  Suggestions,
} from '@/components/ai-elements/suggestion';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface AIChatProps {
  threadId?: string;
  className?: string;
}

const STARTER_SUGGESTIONS = [
  'How do decision tables work in Kissflow?',
  'Show process and application routes related to watchlists.',
  'How do I create and use subitems?',
  'What docs explain evaluation settings?',
];

function isSourcePart(part: UIMessagePart<any, any>): part is SourceUrlUIPart {
  return part.type === 'source-url';
}

export default function AIChat({ threadId = 'docs-assistant-main', className }: AIChatProps) {
  const { messages, sendMessage, status, stop } = useChat({
    api: '/api/chat',
    threadId,
  });
  const [input, setInput] = useState('');

  const isBusy = status === 'submitted' || status === 'streaming';

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="mb-2 text-xs text-muted-foreground">
        Powered by Help Articles + Frontend Graph + Backend Graph.
      </div>

      <div className="min-h-0 flex-1 rounded-md border bg-card">
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <Suggestions className="pb-2">
                {STARTER_SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    onClick={(text) => {
                      void sendMessage({ text });
                    }}
                    suggestion={suggestion}
                  />
                ))}
              </Suggestions>
            ) : null}

            {messages.map((message: UIMessage) => {
              const sources = message.parts.filter(isSourcePart);
              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {sources.length > 0 ? (
                      <Sources>
                        <SourcesTrigger count={sources.length} />
                        <SourcesContent>
                          {sources.map((source) => (
                            <Source href={source.url} key={source.sourceId} title={source.title ?? source.url} />
                          ))}
                        </SourcesContent>
                      </Sources>
                    ) : null}

                    {message.parts.map((part, index) => {
                      if (part.type === 'text') {
                        return <MessageResponse key={`${message.id}-text-${index}`}>{part.text}</MessageResponse>;
                      }

                      if (part.type === 'reasoning') {
                        return (
                          <Reasoning isStreaming={part.state === 'streaming'} key={`${message.id}-reasoning-${index}`}>
                            <ReasoningTrigger />
                            <ReasoningContent>{part.text}</ReasoningContent>
                          </Reasoning>
                        );
                      }

                      return null;
                    })}
                  </MessageContent>
                </Message>
              );
            })}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const text = input.trim();
          if (!text) return;
          setInput('');
          await sendMessage({ text });
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask about docs, frontend graph, or backend graph..."
          className="min-h-[64px] flex-1 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          disabled={isBusy}
        />
        {isBusy ? (
          <button
            type="button"
            className="self-end rounded-md border px-3 py-2 text-sm"
            onClick={() => {
              void stop();
            }}
          >
            Stop
          </button>
        ) : (
          <button type="submit" className="self-end rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground">
            Send
          </button>
        )}
      </form>
    </div>
  );
}
