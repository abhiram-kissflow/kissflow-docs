'use client';

import { useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, Loader2, Sparkle } from 'lucide-react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

interface Citation {
  nodeId: string;
  snippet: string;
}
interface AskResult {
  answer: string;
  citations: Citation[];
  insufficientEvidence: boolean;
}

const EXAMPLES = [
  'How do I set up API authentication?',
  'How do decision tables work?',
  'How do I back up my account data?',
];

function Answer({ text }: { text: string }) {
  return (
    <div className="prose prose-sm max-w-none text-fd-foreground [&_a]:font-medium [&_a]:text-[#CF2C91] [&_a]:underline [&_code]:rounded [&_code]:bg-fd-muted [&_code]:px-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5">
      <ReactMarkdown components={{ a: (p) => <a {...p} target="_blank" rel="noreferrer" /> }}>
        {text}
      </ReactMarkdown>
    </div>
  );
}

// Deduplicate citations by nodeId (the model sometimes cites the same node twice).
function uniqueSources(citations: Citation[]): Citation[] {
  const seen = new Set<string>();
  return citations.filter((c) => (seen.has(c.nodeId) ? false : (seen.add(c.nodeId), true)));
}

export default function HeroAsk() {
  const [query, setQuery] = useState('');
  const [asked, setAsked] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState(false);

  async function ask(q: string) {
    const text = q.trim();
    if (text.length < 2 || loading) return;
    setAsked(text);
    setQuery('');
    setResult(null);
    setError(false);
    setLoading(true);
    try {
      const res = await fetch(`${basePath}/api/rag/ask`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: text }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setResult((await res.json()) as AskResult);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const sources = result ? uniqueSources(result.citations) : [];
  const abstained = result && (result.insufficientEvidence || !result.answer.trim());

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-fd-foreground sm:text-4xl">
          Ask the Kissflow docs
        </h1>
        <p className="mt-2 text-fd-muted-foreground">
          Get a grounded answer with sources, or browse by role below.
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(query);
        }}
        className="flex items-center gap-2 rounded-2xl border border-fd-border bg-fd-card px-4 py-3 shadow-sm focus-within:border-[#CF2C91]/50"
      >
        <Sparkle className="h-5 w-5 shrink-0 text-[#CF2C91]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask anything about Kissflow…"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-fd-muted-foreground"
          disabled={loading}
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || query.trim().length < 2}
          aria-label="Ask"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#CF2C91] text-white transition hover:bg-[#b92682] disabled:bg-fd-muted disabled:text-fd-muted-foreground"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
        </button>
      </form>

      {!result && !loading && !error ? (
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
      ) : null}

      {asked && (loading || result || error) ? (
        <div className="mt-6 rounded-2xl border border-fd-border bg-fd-card p-5">
          <div className="mb-3 text-sm font-medium text-fd-muted-foreground">{asked}</div>

          {loading ? (
            <div className="inline-flex items-center gap-2 text-sm text-fd-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-[#CF2C91]" />
              Searching the docs and composing a grounded answer…
            </div>
          ) : error ? (
            <p className="text-sm text-fd-muted-foreground">
              The assistant is unavailable right now. Browse the docs by role below.
            </p>
          ) : abstained ? (
            <p className="text-sm text-fd-muted-foreground">
              I couldn&apos;t find that in the Kissflow docs. Try rephrasing, or browse by role below.
            </p>
          ) : (
            <>
              <Answer text={result!.answer} />
              {sources.length > 0 ? (
                <div className="mt-4 border-t border-fd-border pt-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fd-muted-foreground">
                    Sources
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {sources.map((s) => (
                      <Link
                        key={s.nodeId}
                        href={s.nodeId}
                        className="truncate text-sm text-[#CF2C91] hover:underline"
                      >
                        {s.nodeId}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
