import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { normalizeAuth } from './normalize-openapi-auth';

const [, , inputPath, outputPath] = process.argv;

if (!inputPath || !outputPath) {
  console.error('Usage: npx tsx scripts/apply-auth-normalization.ts <input.json> <output.json>');
  process.exit(1);
}

const doc = JSON.parse(readFileSync(inputPath, 'utf-8'));
const normalized = normalizeAuth(doc);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(normalized, null, 2) + '\n');
console.log(`Normalized spec written to ${outputPath}`);
