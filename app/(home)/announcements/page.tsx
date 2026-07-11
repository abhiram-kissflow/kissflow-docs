import fs from 'node:fs';
import path from 'node:path';
import type { Metadata } from 'next';
import AnnouncementsFeed, { type Announcement } from '@/components/announcements-feed';

export const metadata: Metadata = {
  title: 'Product Announcements',
  description:
    'Every new Kissflow feature, enhancement, and improvement as it ships — pulled from the Kissflow Community, newest first.',
};

function loadAnnouncements(): Announcement[] {
  try {
    const file = path.join(process.cwd(), 'public', 'announcements.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Announcement[];
  } catch {
    return [];
  }
}

export default function AnnouncementsPage() {
  const items = loadAnnouncements();
  return <AnnouncementsFeed items={items} />;
}
