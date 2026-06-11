'use client';

import { usePathname } from 'next/navigation';
import { useMemo, useRef, useEffect, useState } from 'react';
import { ChevronDown, ExternalLink, Github, FileText } from 'lucide-react';
import type { ReactNode } from 'react';

interface OpenPagePopoverProps {
  markdownUrl?: string;
  githubUrl?: string;
}

interface PopoverItem {
  title: string;
  href: string;
  icon: ReactNode;
}

export function OpenPagePopover({ markdownUrl, githubUrl }: OpenPagePopoverProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const items = useMemo(() => {
    const pageUrl =
      typeof window === 'undefined'
        ? pathname
        : new URL(pathname, window.location.origin).toString();

    const prompt = `Help me understand this documentation page: ${pageUrl}`;

    const list: (PopoverItem | false)[] = [
      !!githubUrl && {
        title: 'Open in GitHub',
        href: githubUrl,
        icon: <Github className="w-4 h-4" />,
      },
      !!markdownUrl && {
        title: 'View as Markdown',
        href: markdownUrl,
        icon: <FileText className="w-4 h-4" />,
      },
      {
        title: 'Open in Claude',
        href: `https://claude.ai/new?${new URLSearchParams({ q: prompt })}`,
        icon: (
          <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
            <path d="M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" />
          </svg>
        ),
      },
      {
        title: 'Open in ChatGPT',
        href: `https://chatgpt.com/?${new URLSearchParams({ hints: 'search', q: prompt })}`,
        icon: (
          <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
            <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" />
          </svg>
        ),
      },
      {
        title: 'Open in Gemini',
        href: `https://gemini.google.com/app?${new URLSearchParams({ q: prompt })}`,
        icon: (
          <svg viewBox="0 0 65 65" fill="currentColor" className="w-4 h-4">
            <path d="M32.447 0c.68 0 1.273.465 1.439 1.125a38.904 38.904 0 001.999 5.905c2.152 5 5.105 9.376 8.854 13.125 3.751 3.75 8.126 6.703 13.125 8.855a38.98 38.98 0 005.906 1.999c.66.166 1.124.758 1.124 1.438 0 .68-.464 1.273-1.125 1.439a38.902 38.902 0 00-5.905 1.999c-5 2.152-9.375 5.105-13.125 8.854-3.749 3.751-6.702 8.126-8.854 13.125a38.973 38.973 0 00-2 5.906 1.485 1.485 0 01-1.438 1.124c-.68 0-1.272-.464-1.438-1.125a38.913 38.913 0 00-2-5.905c-2.151-5-5.103-9.375-8.854-13.125-3.75-3.749-8.125-6.702-13.125-8.854a38.973 38.973 0 00-5.905-2A1.485 1.485 0 010 32.448c0-.68.465-1.272 1.125-1.438a38.903 38.903 0 005.905-2c5-2.151 9.376-5.104 13.125-8.854 3.75-3.749 6.703-8.125 8.855-13.125a38.972 38.972 0 001.999-5.905A1.485 1.485 0 0132.447 0z" />
          </svg>
        ),
      },
      {
        title: 'Open in Cursor',
        href: `https://cursor.com/link/prompt?${new URLSearchParams({ text: prompt })}`,
        icon: (
          <svg fill="currentColor" viewBox="0 0 24 24" className="w-4 h-4">
            <path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23" />
          </svg>
        ),
      },
    ];

    return list.filter(Boolean) as PopoverItem[];
  }, [githubUrl, markdownUrl, pathname]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md border border-fd-border bg-fd-secondary text-fd-secondary-foreground hover:bg-fd-accent transition-colors"
      >
        Open page
        <ChevronDown className="size-3.5 text-fd-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-lg border border-fd-border bg-fd-popover p-1 shadow-md">
          {items.map((item) => (
            <a
              key={item.href}
              href={item.href}
              rel="noreferrer noopener"
              target="_blank"
              onClick={() => setOpen(false)}
              className="text-sm p-2 rounded-lg inline-flex w-full items-center gap-2 hover:text-fd-accent-foreground hover:bg-fd-accent [&_svg]:size-4"
            >
              {item.icon}
              {item.title}
              <ExternalLink className="text-fd-muted-foreground size-3.5 ms-auto" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
