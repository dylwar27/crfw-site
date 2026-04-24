#!/usr/bin/env node
// publish-photo-sample.mjs — publish a demo sample of ~30 photos
// across 2013–2018 so year carousels show something for the family demo.
//
// Prefers photos with non-empty captions; falls back to first-by-date.
// Usage:
//   node scripts/publish-photo-sample.mjs            # dry-run, prints plan
//   node scripts/publish-photo-sample.mjs --write    # apply

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const write = args.includes('--write');
const PER_YEAR = 6;

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(__dirname, '..');
const photosDir = join(repo, 'src', 'content', 'photos');

const files = readdirSync(photosDir).filter(f => f.endsWith('.json')).sort();

// Group by year
const byYear = new Map();
for (const f of files) {
  const raw = readFileSync(join(photosDir, f), 'utf8');
  let data;
  try { data = JSON.parse(raw); } catch { continue; }
  if (data.published !== false) continue; // already published — skip
  const year = (data.date || '').slice(0, 4);
  if (!year || year < '2013' || year > '2018') continue;
  if (!byYear.has(year)) byYear.set(year, []);
  byYear.get(year).push({ f, data });
}

const toPublish = [];

for (const [year, entries] of [...byYear.entries()].sort()) {
  // Sort: captioned first, then by filename (date order)
  entries.sort((a, b) => {
    const ac = a.data.caption ? 0 : 1;
    const bc = b.data.caption ? 0 : 1;
    if (ac !== bc) return ac - bc;
    return a.f.localeCompare(b.f);
  });
  const pick = entries.slice(0, PER_YEAR);
  for (const { f, data } of pick) {
    toPublish.push({ f, data, year });
  }
}

console.log(`Mode: ${write ? 'WRITE' : 'dry-run'}`);
console.log(`Target: ${PER_YEAR} photos/year across 2013–2018\n`);

const byYearCount = new Map();
for (const { year } of toPublish) {
  byYearCount.set(year, (byYearCount.get(year) || 0) + 1);
}
for (const [year, count] of [...byYearCount.entries()].sort()) {
  console.log(`  ${year}: ${count} photos`);
}
console.log(`  TOTAL: ${toPublish.length} photos\n`);

for (const { f, data } of toPublish) {
  console.log(`  ${write ? 'publishing' : 'would publish'}: ${f}${data.caption ? ` — "${data.caption.slice(0, 50)}"` : ''}`);
  if (write) {
    data.published = true;
    writeFileSync(join(photosDir, f), JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

console.log(`\n${write ? 'Done.' : 'Dry-run — pass --write to apply.'}`);
