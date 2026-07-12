'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { parsePartialJson } from 'ai';
import { ArrowUp, FileText, Loader2, Sparkle } from 'lucide-react';
import { PersonaNav } from '@/components/persona-nav';
import { WingField } from '@/components/wing-field';
import { useUIStrings } from '@/lib/ui-strings';
import { useI18n } from 'fumadocs-ui/contexts/i18n';

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

// Curated pool spanning the whole corpus (guides, admin, API, SDK). Three are
// picked at random per load so the starter questions vary across users.
const QUESTION_POOL = [
  'How do I set up API authentication?',
  'How do decision tables work?',
  'How do I back up my account data?',
  'How do I create an approval workflow?',
  'How do I build a form with field validations?',
  'How do I set up SSO for my account?',
  'How do I manage user roles and permissions?',
  'How do I connect an external data source?',
  'How do I publish and version an app?',
  'How do I call the Kissflow REST API?',
  'How do I troubleshoot API integration issues?',
  'What can I build with the Kissflow SDK?',
  'How do I create a custom component?',
  'How do webhooks work in Kissflow?',
  'How do I safelist IPs for data connections?',
  'How do I use boards to track work?',
];

function pickQuestions(count: number): string[] {
  const pool = [...QUESTION_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function Markdown({ text }: { text: string }) {
  // translate="no": browser auto-translate rewrites streamed answer DOM
  // (glued words, dropped fragments) — answers are already in the page locale.
  return (
    <div translate="no" className="prose prose-sm max-w-none text-fd-foreground [&_a]:font-medium [&_a]:text-[#CF2C91] [&_a]:underline [&_code]:rounded [&_code]:bg-fd-muted [&_code]:px-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_table]:my-3 [&_table]:block [&_table]:w-full [&_table]:overflow-x-auto [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-fd-border [&_th]:bg-fd-muted [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_td]:border [&_td]:border-fd-border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top">
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
  const strings = useUIStrings().hero;
  const { locale } = useI18n();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  // Stable initial slice for SSR/first paint; reshuffled on mount so each visit
  // (and each user) sees a different set without a hydration mismatch.
  const [examples, setExamples] = useState<string[]>(() => QUESTION_POOL.slice(0, 3));
  const scrollRef = useRef<HTMLDivElement>(null);
  // Sources of the in-flight ask, for the read-more fallback link.
  const lastSourcesRef = useRef<Source[]>([]);

  useEffect(() => {
    setExamples(pickQuestions(3));
  }, []);

  // The nav logo links to '/', but on the home page that's a same-route
  // navigation Next ignores — so clicking it must reset the conversation here.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest?.('a');
      if (anchor && anchor.closest('header') && anchor.querySelector('img')) {
        setTurns([]);
        setInput('');
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

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
        body: JSON.stringify({ query: text, history, locale }),
      });
      if (!res.ok) throw new Error(String(res.status));

      const rawSources = res.headers.get('x-rag-sources');
      lastSourcesRef.current = [];
      if (rawSources) {
        try {
          const parsed = JSON.parse(decodeURIComponent(rawSources)) as Source[];
          lastSourcesRef.current = parsed;
          updateLastAssistant({ sources: parsed });
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
      let content = obj.answer ?? '';
      // Every answer must carry a read-more link; if the model omitted it,
      // fall back to the top retrieved article.
      const firstSource = lastSourcesRef.current[0];
      if (content.trim() && !/\]\(/.test(content) && firstSource) {
        content += `\n\n${strings.readMore}: [${firstSource.title}](${firstSource.url})`;
      }
      updateLastAssistant({
        content,
        streaming: false,
        abstained: Boolean(obj.insufficientEvidence) || !content.trim(),
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
      className="flex items-center gap-3 rounded-2xl border border-fd-border bg-fd-card px-5 py-5 shadow-sm focus-within:border-[#CF2C91]/50"
    >
      <Sparkle className="h-5 w-5 shrink-0 text-[#CF2C91]" />
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={started ? strings.followUpPlaceholder : strings.placeholder}
        className="min-w-0 flex-1 bg-transparent text-lg outline-none placeholder:text-fd-muted-foreground"
        disabled={loading}
        autoFocus
      />
      <button
        type="submit"
        disabled={loading || input.trim().length < 2}
        aria-label={strings.askAria}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#CF2C91] text-white transition hover:bg-[#b92682] disabled:bg-fd-muted disabled:text-fd-muted-foreground"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
      </button>
    </form>
  );

  // Empty state — the whole hero fits in the first fold (no scroll).
  if (!started) {
    return (
      <div className="relative isolate flex min-h-[calc(100svh-3.5rem)] items-start overflow-hidden">
        <WingField />
        <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-8 pt-10 sm:pt-14">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-fd-foreground sm:text-4xl">
              {strings.title}
            </h1>
            <p className="mt-2 text-fd-muted-foreground">{strings.subtitle}</p>
          </div>
          {inputBar}
          <div className="flex flex-wrap justify-center gap-2">
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => void ask(ex)}
                className="rounded-full border border-fd-border bg-fd-background/70 px-3 py-1.5 text-sm text-fd-muted-foreground backdrop-blur-sm transition-colors hover:border-[#CF2C91]/40 hover:text-fd-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3">
            <div className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-fd-muted-foreground">
              {strings.browseFolders}
            </div>
            <PersonaNav />
          </div>
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
                    {strings.searching}
                  </div>
                ) : t.errored ? (
                  <p className="text-sm text-fd-muted-foreground">
                    {strings.unavailable}
                  </p>
                ) : t.abstained ? (
                  <p className="text-sm text-fd-muted-foreground">
                    {strings.notFound}
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
            {strings.relevantArticles}
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
              <p className="text-sm text-fd-muted-foreground">{strings.noRelated}</p>
            ) : null}
          </div>
        </div>
      </aside>
    </div>
  );
}
