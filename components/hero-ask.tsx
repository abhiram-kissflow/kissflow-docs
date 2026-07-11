'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parsePartialJson } from 'ai';
import { ArrowUp, FileText, Loader2, Sparkle } from 'lucide-react';
import { PersonaNav } from '@/components/persona-nav';
import { WingField } from '@/components/wing-field';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

interface Source {
  url: string;
  title: string;
}
interface Turn {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  streaming?: boolean;
  abstained?: boolean;
  errored?: boolean;
}

const EXAMPLES = [
  'How do I set up API authentication?',
  'How do decision tables work?',
  'How do I back up my account data?',
];

function Markdown({ text }: { text: string }) {
  return (
    <div className="prose prose-sm max-w-none text-fd-foreground [&_a]:font-medium [&_a]:text-[#CF2C91] [&_a]:underline [&_code]:rounded [&_code]:bg-fd-muted [&_code]:px-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-3 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-fd-border [&_th]:bg-fd-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-fd-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

export default function HeroAsk() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const started = turns.length > 0;
  const lastAssistant = [...turns].reverse().find((t) => t.role === 'assistant');
  const sources = lastAssistant?.sources ?? [];

  function updateLastAssistant(patch: Partial<Turn>) {
    setTurns((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        if (next[i].role === 'assistant') {
          next[i] = { ...next[i], ...patch };
          break;
        }
      }
      return next;
    });
  }

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 2 || loading) return;

    const history = turns
      .filter((t) => !t.errored && !t.abstained)
      .map((t) => ({ role: t.role, content: t.content }));

    setInput('');
    setLoading(true);
    setTurns((prev) => [
      ...prev,
      { role: 'user', content: text },
      { role: 'assistant', content: '', streaming: true },
    ]);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }));

    try {
      const res = await fetch(`${basePath}/api/rag/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: text, history }),
      });
      if (!res.ok) throw new Error(String(res.status));

      const rawSources = res.headers.get('x-rag-sources');
      if (rawSources) {
        try {
          updateLastAssistant({ sources: JSON.parse(decodeURIComponent(rawSources)) as Source[] });
        } catch {
          /* ignore malformed header */
        }
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const { value: partial } = await parsePartialJson(buf);
          const answer = (partial as { answer?: string } | undefined)?.answer;
          if (typeof answer === 'string') updateLastAssistant({ content: answer });
        }
      }
      const { value: final } = await parsePartialJson(buf);
      const obj = (final ?? {}) as { answer?: string; insufficientEvidence?: boolean };
      updateLastAssistant({
        content: obj.answer ?? '',
        streaming: false,
        abstained: Boolean(obj.insufficientEvidence) || !obj.answer?.trim(),
      });
    } catch {
      updateLastAssistant({ streaming: false, errored: true });
    } finally {
      setLoading(false);
    }
  }

  const inputBar = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void ask(input);
      }}
      className="flex items-center gap-2 rounded-2xl border border-fd-border bg-fd-card px-4 py-3 shadow-sm focus-within:border-[#CF2C91]/50"
    >
      <Sparkle className="h-5 w-5 shrink-0 text-[#CF2C91]" />
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={started ? 'Ask a follow-up…' : 'Ask anything about Kissflow…'}
        className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fd-muted-foreground"
        disabled={loading}
        autoFocus
      />
      <button
        type="submit"
        disabled={loading || input.trim().length < 2}
        aria-label="Ask"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#CF2C91] text-white transition hover:bg-[#b92682] disabled:bg-fd-muted disabled:text-fd-muted-foreground"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
      </button>
    </form>
  );

  // Empty state — centered hero + persona cards.
  if (!started) {
    return (
      <div className="relative isolate">
        <WingField />
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-16">
          <div>
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-fd-foreground sm:text-4xl">
              Ask the Kissflow Documentation
            </h1>
            <p className="mt-2 text-fd-muted-foreground">
              Get a grounded, step-by-step answer with sources — or browse by role below.
            </p>
          </div>
          {inputBar}
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => void ask(ex)}
                className="rounded-full border border-fd-border bg-fd-background px-3 py-1.5 text-sm text-fd-muted-foreground hover:border-[#CF2C91]/40 hover:text-fd-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
          </div>
          <section>
            <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground">
              Or browse by role
            </h2>
            <PersonaNav />
          </section>
        </div>
      </div>
    );
  }

  // Conversation state — thread on the left, relevant articles on the right.
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-h-[70vh] flex-col">
        <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto pb-4">
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <div key={i} className="text-lg font-medium text-fd-foreground">
                {t.content}
              </div>
            ) : (
              <div key={i} className="rounded-2xl border border-fd-border bg-fd-card p-4">
                {t.streaming && !t.content ? (
                  <div className="inline-flex items-center gap-2 text-sm text-fd-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin text-[#CF2C91]" />
                    Searching the docs…
                  </div>
                ) : t.errored ? (
                  <p className="text-sm text-fd-muted-foreground">
                    The assistant is unavailable right now. Please try again.
                  </p>
                ) : t.abstained ? (
                  <p className="text-sm text-fd-muted-foreground">
                    I couldn&apos;t find that in the Kissflow docs. Try rephrasing, or browse by role.
                  </p>
                ) : (
                  <Markdown text={t.content} />
                )}
              </div>
            ),
          )}
        </div>
        <div className="pt-2">{inputBar}</div>
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-8">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">
            Relevant articles
          </div>
          <div className="flex flex-col gap-2">
            {sources.map((s) => (
              <Link
                key={s.url}
                href={s.url}
                className="flex items-start gap-2 rounded-xl border border-fd-border bg-fd-card px-3 py-2 text-sm hover:border-[#CF2C91]/40"
              >
                <FileText className="mt-0.5 h-4 w-4 shrink-0 text-[#CF2C91]" />
                <span className="text-fd-foreground">{s.title}</span>
              </Link>
            ))}
            {sources.length === 0 ? (
              <p className="text-sm text-fd-muted-foreground">No related articles.</p>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
