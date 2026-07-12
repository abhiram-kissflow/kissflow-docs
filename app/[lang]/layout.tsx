import { Provider } from '@/components/provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { siteMetadata } from '@/lib/site-metadata';
import { i18n } from '@/lib/i18n';
import Script from 'next/script';
import '../global.css';

export const metadata = siteMetadata;

export function generateStaticParams() {
  return i18n.languages.map((lang) => ({ lang }));
}

export default async function Layout({ params, children }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;

  return (
    <html lang={lang} suppressHydrationWarning>
      <Script id="time-aware-theme" strategy="beforeInteractive">{`
        try {
          var preference = localStorage.getItem('kissflow-docs-theme');
          var hour = new Date().getHours();
          var dark = preference === 'dark' || (preference !== 'light' && (hour >= 18 || hour < 6));
          document.documentElement.classList.toggle('dark', dark);
          document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
        } catch {}
      `}</Script>
      <body className="flex flex-col min-h-screen font-sans" suppressHydrationWarning>
        <TooltipProvider>
          <Provider locale={lang}>{children}</Provider>
        </TooltipProvider>
      </body>
    </html>
  );
}
