import HeroAsk from '@/components/hero-ask';
import { PersonaNav } from '@/components/persona-nav';

export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-4 py-16">
      <HeroAsk />
      <section>
        <h2 className="mb-4 text-center text-sm font-semibold uppercase tracking-wide text-fd-muted-foreground">
          Or browse by role
        </h2>
        <PersonaNav />
      </section>
    </main>
  );
}
