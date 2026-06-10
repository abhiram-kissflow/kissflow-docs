import { readFileSync } from 'fs';

interface RedirectEntry {
  source: string;
  destination: string;
  permanent: boolean;
}

const MAPPING_FILE = 'scripts/url-mapping.csv';

try {
  const csv = readFileSync(MAPPING_FILE, 'utf-8');
  const redirects: RedirectEntry[] = [];

  for (const line of csv.split('\n').slice(1)) {
    const [oldSlug, newPath] = line.split(',').map((s) => s.trim());
    if (!oldSlug || !newPath) continue;

    redirects.push({
      source: `/documentation/${oldSlug}`,
      destination: newPath,
      permanent: true,
    });
  }

  console.log(JSON.stringify(redirects, null, 2));
} catch {
  console.error(`Create ${MAPPING_FILE} first with columns: oldSlug,newPath`);
  process.exit(1);
}
