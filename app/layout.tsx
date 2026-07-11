import { Provider } from '@/components/provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import Script from 'next/script';
import './global.css';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
          <Provider>{children}</Provider>
        </TooltipProvider>
      </body>
    </html>
  );
}
