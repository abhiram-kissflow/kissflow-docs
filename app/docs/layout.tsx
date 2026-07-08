import { source } from '@/lib/source';
import { DocsLayout } from 'fumadocs-ui/layouts/docs';
import { baseOptions } from '@/lib/layout.shared';
import AIChatLauncher from '@/components/ai-chat-launcher';

export default function Layout({ children }: LayoutProps<'/docs'>) {
  return (
    <>
      <DocsLayout tree={source.getPageTree()} {...baseOptions()}>
        {children}
      </DocsLayout>
      <AIChatLauncher />
    </>
  );
}
