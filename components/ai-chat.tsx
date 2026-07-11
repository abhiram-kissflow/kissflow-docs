'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  isFileUIPart,
  isTextUIPart,
  type FileUIPart,
  type UIMessage,
} from 'ai';
import {
  Command,
  ImagePlus,
  Loader2,
  Mic,
  Paperclip,
  SendHorizontal,
  Smile,
  Square,
} from 'lucide-react';
import { Conversation, ConversationContent } from '@/components/ai-elements/conversation';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/cn';

const STARTER_SUGGESTIONS = [
  'How do decision tables work in Kissflow?',
  'Show setup guides for approvals and automations.',
  'Where can I find API documentation for process actions?',
  'Help me troubleshoot common publish issues.',
];

const EMOJI_SET = ['🙂', '✅', '🚀', '🎯', '🛠️', '📎'];

const SLASH_COMMANDS = [
  {
    id: '/guide',
    label: 'Find a guide',
    template: 'Find documentation for: ',
  },
  {
    id: '/api',
    label: 'Find API docs',
    template: 'Find API documentation for: ',
  },
  {
    id: '/docs',
    label: 'Search docs',
    template: 'Search Kissflow help docs for: ',
  },
  {
    id: '/troubleshoot',
    label: 'Troubleshoot',
    template: 'Help me troubleshoot: ',
  },
];

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function messageText(message: UIMessage): string {
  return message.parts.filter(isTextUIPart).map((part) => part.text).join('');
}

function messageFiles(message: UIMessage): FileUIPart[] {
  return message.parts.filter(isFileUIPart);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function MarkdownMessage({ text }: { text: string }) {
  // react-markdown v9+ removed the `className` prop, so the styling lives on a
  // wrapping div; the descendant selectors ([&_a], [&_p], …) apply the same.
  return (
    <div className="break-words text-fd-foreground [&_a]:font-medium [&_a]:text-[#CF2C91] [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-[#b92682] [&_code]:rounded [&_code]:bg-fd-background [&_code]:px-1 [&_code]:py-0.5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:mb-2 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-xs [&_th]:border [&_th]:border-fd-border [&_th]:bg-fd-background [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-fd-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: (props) => <a {...props} target="_blank" rel="noreferrer" />,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function AIChat() {
  const { messages, sendMessage, status, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
    id: 'kissflow-docs-assistant',
  });

  const [input, setInput] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [linkedFiles, setLinkedFiles] = useState<FileUIPart[]>([]);
  const [showEmojiMenu, setShowEmojiMenu] = useState(false);
  const [showGifInput, setShowGifInput] = useState(false);
  const [gifUrl, setGifUrl] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speechRef = useRef<SpeechRecognitionLike | null>(null);
  const busy = status === 'submitted' || status === 'streaming';
  const showSlashCommands = input.trimStart().startsWith('/');

  const pendingFilePreviews = useMemo(
    () =>
      pendingFiles.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        isImage: file.type.startsWith('image/'),
      })),
    [pendingFiles],
  );

  useEffect(() => {
    return () => {
      pendingFilePreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [pendingFilePreviews]);

  useEffect(() => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };

    const RecognitionCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
    if (!RecognitionCtor) return;

    const recognition = new RecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = (event as { results?: ArrayLike<ArrayLike<{ transcript: string }>> }).results
        ? Array.from((event as { results: ArrayLike<ArrayLike<{ transcript: string }>> }).results)
            .map((result) => result?.[0]?.transcript ?? '')
            .join(' ')
            .trim()
        : '';
      if (!transcript) return;
      setInput((prev) => `${prev}${prev.trim().length ? ' ' : ''}${transcript}`.trim());
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    speechRef.current = recognition;
    setVoiceSupported(true);

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.stop();
    };
  }, []);

  async function buildPendingFileParts(): Promise<FileUIPart[]> {
    return Promise.all(
      pendingFiles.map(async (file) => ({
        type: 'file' as const,
        mediaType: file.type || 'application/octet-stream',
        filename: file.name,
        url: await fileToDataUrl(file),
      })),
    );
  }

  async function submitMessage(overrideText?: string) {
    if (busy) return;

    const text = (overrideText ?? input).trim();
    if (!text && pendingFiles.length === 0 && linkedFiles.length === 0) return;

    const fileParts = [...(await buildPendingFileParts()), ...linkedFiles];
    const messageTextValue = text || 'Attached files for context.';

    setInput('');
    setPendingFiles([]);
    setLinkedFiles([]);
    setGifUrl('');
    setShowGifInput(false);
    setShowEmojiMenu(false);

    if (fileParts.length > 0) {
      await sendMessage({ text: messageTextValue, files: fileParts });
      return;
    }

    await sendMessage({ text: messageTextValue });
  }

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files)
      .filter((file) => file.size <= 10 * 1024 * 1024)
      .slice(0, 6);
    setPendingFiles((prev) => [...prev, ...accepted].slice(0, 6));
  }

  function toggleVoice() {
    if (!voiceSupported || !speechRef.current || busy) return;

    if (listening) {
      speechRef.current.stop();
      setListening(false);
      return;
    }

    setListening(true);
    speechRef.current.start();
  }

  function applySlashCommand(template: string) {
    setInput(template);
  }

  function addGifLink() {
    const value = gifUrl.trim();
    if (!isValidHttpUrl(value)) return;

    setLinkedFiles((prev) => [
      ...prev,
      {
        type: 'file',
        mediaType: 'image/gif',
        filename: 'gif.gif',
        url: value,
      },
    ]);
    setGifUrl('');
    setShowGifInput(false);
  }

  return (
    <div className="flex h-full min-h-0 flex-col text-fd-foreground">
      {busy ? (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-1.5 text-xs text-fd-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#CF2C91]" />
            Thinking through docs context...
          </div>
          <button
            type="button"
            onClick={() => stop()}
            className="inline-flex items-center gap-1 rounded-full border border-fd-border px-2 py-1 text-[11px]"
          >
            <Square className="h-3 w-3" />
            Stop
          </button>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.5rem] border border-fd-border bg-fd-card">
        <Conversation className="h-full">
          <ConversationContent className="gap-3 p-4">
            {messages.length === 0 ? (
              <Message from="assistant">
                <MessageContent
                  from="assistant"
                  className="max-w-[94%] rounded-3xl border border-fd-border bg-fd-muted px-4 py-3"
                >
                  <MessageResponse className="space-y-2">
                    <div className="text-xl font-semibold leading-none">Hi there</div>
                    <div className="text-base text-fd-foreground">
                      Ask me about Kissflow docs, APIs, and setup steps, and I will guide you step by step.
                    </div>
                  </MessageResponse>
                </MessageContent>
              </Message>
            ) : null}

            {messages.map((message) => {
              const text = messageText(message);
              const files = messageFiles(message);

              return (
                <Message from={message.role} key={message.id}>
                  <MessageContent
                    from={message.role}
                    className={cn(
                      'rounded-3xl border px-3 py-2',
                      message.role === 'user'
                        ? 'border-[#CF2C91]/30 bg-[#CF2C91]/10'
                        : 'border-fd-border bg-fd-muted',
                    )}
                  >
                    <MessageResponse className="space-y-2">
                      {text ? (
                        message.role === 'assistant' ? (
                          <MarkdownMessage text={text} />
                        ) : (
                          <div className="whitespace-pre-wrap">{text}</div>
                        )
                      ) : null}
                      {files.length > 0 ? (
                        <div className="grid gap-2">
                          {files.map((file) => {
                            const isImage = file.mediaType.startsWith('image/');
                            return (
                              <a
                                key={`${message.id}-${file.url}`}
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-fd-border bg-fd-background p-2 text-xs hover:bg-fd-muted"
                              >
                                {isImage ? (
                                  <img
                                    src={file.url}
                                    alt={file.filename ?? 'Image attachment'}
                                    className="mb-2 max-h-40 w-full rounded-lg object-cover"
                                  />
                                ) : null}
                                <div className="truncate">{file.filename ?? file.url}</div>
                                <div className="text-[11px] text-fd-muted-foreground">{file.mediaType}</div>
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                    </MessageResponse>
                  </MessageContent>
                </Message>
              );
            })}

            {messages.length === 0 ? (
              <Suggestions>
                {STARTER_SUGGESTIONS.map((suggestion) => (
                  <Suggestion
                    key={suggestion}
                    suggestion={suggestion}
                    onClick={(text) => {
                      void submitMessage(text);
                    }}
                    className="rounded-full border border-fd-border bg-fd-background text-fd-foreground hover:bg-fd-muted"
                  />
                ))}
              </Suggestions>
            ) : null}

            {busy ? (
              <Message from="assistant">
                <MessageContent
                  from="assistant"
                  className="rounded-3xl border border-fd-border bg-fd-muted px-3 py-2"
                >
                  <MessageResponse className="inline-flex items-center gap-2 text-sm text-fd-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-[#CF2C91]" />
                    Generating a grounded response...
                  </MessageResponse>
                </MessageContent>
              </Message>
            ) : null}
          </ConversationContent>
        </Conversation>
      </div>

      {pendingFilePreviews.length > 0 || linkedFiles.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2 rounded-2xl border border-fd-border bg-fd-card p-2">
          {pendingFilePreviews.map((preview) => (
            <button
              key={preview.url}
              type="button"
              onClick={() =>
                setPendingFiles((prev) => prev.filter((file) => file !== preview.file))
              }
              className="group relative max-w-40 overflow-hidden rounded-xl border border-fd-border bg-fd-background text-left text-xs"
            >
              {preview.isImage ? (
                <img src={preview.url} alt={preview.file.name} className="h-20 w-full object-cover" />
              ) : (
                <div className="p-2">{preview.file.name}</div>
              )}
              <div className="truncate px-2 py-1 text-[11px] text-fd-muted-foreground">{preview.file.name}</div>
              <span className="absolute right-1 top-1 hidden rounded bg-black/70 px-1 text-[10px] text-white group-hover:block">
                remove
              </span>
            </button>
          ))}
          {linkedFiles.map((file) => (
            <button
              key={file.url}
              type="button"
              onClick={() => setLinkedFiles((prev) => prev.filter((value) => value.url !== file.url))}
              className="rounded-xl border border-fd-border bg-fd-background px-2 py-1 text-xs"
            >
              {file.filename ?? 'linked media'}
            </button>
          ))}
        </div>
      ) : null}

      {showSlashCommands ? (
        <div className="mt-2 rounded-xl border border-fd-border bg-fd-card p-2">
          {SLASH_COMMANDS.map((command) => (
            <button
              key={command.id}
              type="button"
              onClick={() => applySlashCommand(command.template)}
              className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-fd-muted"
            >
              <span className="font-medium">{command.id}</span>
              <span className="text-fd-muted-foreground">{command.label}</span>
            </button>
          ))}
        </div>
      ) : null}

      {showGifInput ? (
        <div className="mt-2 flex gap-2 rounded-xl border border-fd-border bg-fd-card p-2">
          <input
            value={gifUrl}
            onChange={(event) => setGifUrl(event.target.value)}
            placeholder="Paste GIF URL"
            className="flex-1 rounded-md border border-fd-border bg-fd-background px-2 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#CF2C91]/30"
          />
          <button
            type="button"
            onClick={addGifLink}
            className="rounded-md bg-[#CF2C91] px-2 py-1 text-xs text-white"
          >
            Add
          </button>
        </div>
      ) : null}

      <form
        className="mt-3 rounded-[1.6rem] border border-fd-border bg-fd-card p-3"
        onSubmit={async (event) => {
          event.preventDefault();
          await submitMessage();
        }}
      >
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question..."
          className="min-h-[68px] w-full resize-none bg-transparent px-1 text-base outline-none placeholder:text-fd-muted-foreground"
          rows={2}
          disabled={busy}
        />

        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="relative flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-full p-2 text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground"
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.txt,.md,.csv"
              multiple
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.currentTarget.value = '';
              }}
            />

            <button
              type="button"
              onClick={() => setShowEmojiMenu((value) => !value)}
              className="rounded-full p-2 text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground"
              aria-label="Insert emoji"
            >
              <Smile className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setInput('/')}
              className="rounded-full p-2 text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground"
              aria-label="Slash commands"
            >
              <Command className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setShowGifInput((value) => !value)}
              className="rounded-full p-2 text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground"
              aria-label="Add GIF"
            >
              <ImagePlus className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={toggleVoice}
              disabled={!voiceSupported || busy}
              className={cn(
                'rounded-full p-2 text-fd-muted-foreground hover:bg-fd-muted hover:text-fd-foreground disabled:opacity-50',
                listening ? 'bg-[#CF2C91]/20 text-[#CF2C91]' : '',
              )}
              aria-label="Voice input"
            >
              <Mic className="h-4 w-4" />
            </button>

            {showEmojiMenu ? (
              <div className="absolute bottom-11 left-0 z-10 flex gap-1 rounded-xl border border-fd-border bg-fd-card p-1.5">
                {EMOJI_SET.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="rounded-md px-1.5 py-1 hover:bg-fd-muted"
                    onClick={() => {
                      setInput((prev) => `${prev}${prev.length ? ' ' : ''}${emoji}`);
                      setShowEmojiMenu(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            disabled={busy || (input.trim().length === 0 && pendingFiles.length === 0 && linkedFiles.length === 0)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#CF2C91] text-white transition hover:bg-[#b92682] disabled:bg-fd-muted disabled:text-fd-muted-foreground"
            aria-label="Send message"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <SendHorizontal className="h-5 w-5" />}
          </button>
        </div>
      </form>

      <div className="mt-2 text-center text-[11px] text-fd-muted-foreground">
        By chatting with us, you agree to our Privacy Policy.
      </div>
    </div>
  );
}
