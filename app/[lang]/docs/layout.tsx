import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import AIChatLauncher from '@/components/ai-chat-launcher';
import { PersistentDocsTabMenu } from '@/components/persistent-docs-tab-menu';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  const tree = source.getPageTree();

  return (
    <>
      <DocsLayout
        tree={tree}
        tabs={false}
        sidebar={{ banner: <PersistentDocsTabMenu /> }}
        {...baseOptions('docs')}
      >
        {children}
      </DocsLayout>
      <AIChatLauncher />
    </>
  );
}
