import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { getLayoutTabs } from 'fumadocs-ui/layouts/shared';
import { baseOptions } from '@/lib/layout.shared';
import AIChatLauncher from '@/components/ai-chat-launcher';
import { Code2 } from 'lucide-react';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  const tree = source.getPageTree();

  return (
    <>
      <DocsLayout
        tree={tree}
        tabs={[
          ...getLayoutTabs(tree),
          {
            title: 'SDK Guide',
            description: 'Build custom components with the Kissflow JavaScript SDK.',
            url: 'https://developers.kissflow.com/gettingstarted/',
            icon: <Code2 />,
            props: {
              target: '_blank',
              rel: 'noopener noreferrer',
            },
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
