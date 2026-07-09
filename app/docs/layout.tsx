import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import AIChatLauncher from '@/components/ai-chat-launcher';
import { BookOpen, Braces } from 'lucide-react';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <>
      <DocsLayout
        tree={source.getPageTree()}
        tabs={[
          {
            url: `${basePath}/docs/get-started`,
            title: 'Docs',
            description: 'Guides, admin settings, and how-to articles',
            icon: <BookOpen className="size-4" />,
          },
          {
            url: `${basePath}/api-reference`,
            title: 'API Reference',
            description: 'REST API endpoints, requests, and responses',
            icon: <Braces className="size-4" />,
          },
        ]}
        {...baseOptions()}
      >
        {children}
      </DocsLayout>
      <AIChatLauncher />
    </>
  );
}
