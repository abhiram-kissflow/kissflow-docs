import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { Provider } from '@/components/provider';
import { TooltipProvider } from '@/components/ui/tooltip';
import './global.css';

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`} suppressHydrationWarning>
      <body className="flex flex-col min-h-screen font-sans" suppressHydrationWarning>
        <TooltipProvider>
          <Provider>{children}</Provider>
        </TooltipProvider>
      </body>
    </html>
  );
}
