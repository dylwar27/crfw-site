#!/usr/bin/env node
// Import press articles + tributes from data/articles-snapshot.json
// into src/content/events/ as events with kind: "press".
//
// Idempotency: match by URL (unique key). Never overwrites existing
// entries; skips if an event with the same URL already exists.
//
// Also imports the SoundCloud "Dedication - For Colin Ward" tribute
// from data/embeds-snapshot.json as a press event with kind: "press".

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const write = args.includes('--write');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repo = join(__dirname, '..');
const eventsDir = join(repo, 'src', 'content', 'events');
const articlesSnapshot = JSON.parse(readFileSync(join(repo, 'data', 'articles-snapshot.json'), 'utf8'));
const embedsSnapshot = JSON.parse(readFileSync(join(repo, 'data', 'embeds-snapshot.json'), 'utf8'));

const articles = articlesSnapshot.sheets['Articles & Press'] || [];
const soundcloud = embedsSnapshot.sheets['SoundCloud Tracks'] || [];

// Build an index of existing event URLs to detect already-imported entries
const existingUrls = new Set();
for (const f of readdirSync(eventsDir)) {
  if (!f.endsWith('.md')) continue;
  const text = readFileSync(join(eventsDir, f), 'utf8');
  const m = text.match(/^url:\s*"?([^"\n]+?)"?\s*$/m);
  if (m) existingUrls.add(m[1].trim());
}

function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function yamlEscape(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function tagsFromType(typeStr) {
  const t = String(typeStr || '').toLowerCase();
  const tags = ['press'];
  if (t.includes('interview')) tags.push('interview');
  if (t.includes('obituary') || t.includes('memorial') || t.includes('tribute')) tags.push('tribute');
  if (t.includes('profile')) tags.push('profile');
  if (t.includes('westword')) tags.push('westword');
  if (t.includes('alphabets')) tags.push('alphabets');
  if (t.includes('killd by')) tags.push('killd-by');
  return [...new Set(tags)];
}

function renderPressEvent({ title, date, source, url, summary, typeStr, author }) {
  const tags = tagsFromType(typeStr);
  const tagBlock = tags.map(t => `  - ${t}`).join('\n');
  return `---
title: "${yamlEscape(title)}"
date: "${date}"
kind: press
${source ? `source: "${yamlEscape(source)}"\n` : ''}${url ? `url: "${yamlEscape(url)}"\n` : ''}${author ? `# author: ${yamlEscape(author)}\n` : ''}tags:
${tagBlock}
summary: "${yamlEscape(summary || '')}"
published: true
---

${typeStr ? `*${typeStr}*${source ? ` — ${source}` : ''}\n\n` : ''}${summary || ''}
${url ? `\n[Read the article](${url})` : ''}
`;
}

let created = 0, skipped = 0;

// --- Press articles ---
console.log(`--- Press articles (${articles.length} rows) ---\n`);
for (const row of articles) {
  const url = row.URL;
  if (!url) { console.log(`  skip (no URL): ${row.Title}`); continue; }
  if (existingUrls.has(url)) {
    console.log(`  skip (already imported): ${row.Title}`);
    skipped++;
    continue;
  }

  const date = row.Date;
  const slug = `press-${(date || '').slice(0, 10)}-${slugify(row.Title)}`.slice(0, 80);
  const outPath = join(eventsDir, `${slug}.md`);
  if (existsSync(outPath)) {
    console.log(`  ! slug collision: ${slug}`);
    skipped++;
    continue;
  }

  const content = renderPressEvent({
    title: row.Title,
    date: date || '2018',
    source: row.Source,
    url,
    summary: row.Summary,
    typeStr: row.Type,
    author: row.Author,
  });

  console.log(`  + ${slug}.md  ← ${row.Source} ${date}`);
  if (write) writeFileSync(outPath, content, 'utf8');
  created++;
}

// --- SoundCloud tribute ---
const tribute = soundcloud.find(r => r.Type === 'track' && /dedication/i.test(r.Title || ''));
if (tribute) {
  const url = tribute.URL;
  if (url && !existingUrls.has(url)) {
    const slug = `press-2018-soundcloud-thug-entrancer-dedication`;
    const outPath = join(eventsDir, `${slug}.md`);
    if (!existsSync(outPath)) {
      const content = `---
title: "Dedication — For Colin Ward"
date: "2018"
kind: press
source: "SoundCloud (Thug Entrancer)"
url: "${yamlEscape(url)}"
tags:
  - press
  - tribute
  - soundcloud
summary: "${yamlEscape(tribute.Description || '').slice(0, 500)}"
published: true
---

*Tribute track by Thug Entrancer.*

${tribute.Description || ''}

[Listen on SoundCloud](${url})
`;
      console.log(`  + ${slug}.md  ← SoundCloud tribute`);
      if (write) writeFileSync(outPath, content, 'utf8');
      created++;
    }
  }
}

console.log(`\n--- summary ---`);
console.log(`Created: ${created}`);
console.log(`Skipped: ${skipped}`);
console.log(write ? '' : '\n(dry-run — pass --write to apply)');
