import Link from 'next/link';
import { PersonaNav } from '@/components/persona-nav';

export default function HomePage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-16">
      <h1 className="text-4xl font-bold text-fd-foreground mb-4">
        Kissflow Documentation
      </h1>
      <p className="text-lg text-fd-muted-foreground mb-8">
        Learn how to use, build, administer, and extend Kissflow.
      </p>

      <h2 className="text-xl font-semibold text-fd-foreground mb-4">
        Choose your path
      </h2>
      <PersonaNav />

      <div className="mt-12 flex gap-4">
        <Link
          href="/docs/get-started"
          className="px-4 py-2 rounded-md bg-fd-primary text-fd-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          Get Started
        </Link>
        <Link
          href="/docs/reference/glossary"
          className="px-4 py-2 rounded-md border border-fd-border text-fd-foreground font-medium hover:bg-fd-accent transition-colors"
        >
          Glossary
        </Link>
      </div>
    </main>
  );
}
