#!/usr/bin/env node
// One-off retag script: videos under "Dog is my Copilot/" in the archive
// are currently tagged project: "alphabets" but belong to their own project.
// Retag them as project: "DIMCP" (short form; display aliases can be added
// later if Dyl prefers the long name).
//
// Run: node scripts/retag-dimcp.mjs          (dry-run)
//      node scripts/retag-dimcp.mjs --write  (apply)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const write = process.argv.includes('--write');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const videosDir = join(__dirname, '..', 'src', 'content', 'videos');

const files = readdirSync(videosDir).filter(f => f.endsWith('.json'));
let matched = 0, updated = 0, alreadyCorrect = 0;

for (const f of files) {
  const path = join(videosDir, f);
  const data = JSON.parse(readFileSync(path, 'utf8'));

  // Match: archivePath contains "Dog is my Copilot" (the folder on disk)
  const isDimcp = data.archivePath?.includes('Dog is my Copilot');
  if (!isDimcp) continue;

  matched++;
  if (data.project === 'DIMCP') { alreadyCorrect++; continue; }

  // Add "dimcp" to tags if not already there
  const tags = new Set(data.tags || []);
  tags.add('dimcp');

  const updatedData = {
    ...data,
    project: 'DIMCP',
    tags: [...tags],
  };

  console.log(`  ${data.project || '(none)'} → DIMCP  ${f}`);

  if (write) {
    writeFileSync(path, JSON.stringify(updatedData, null, 2) + '\n', 'utf8');
  }
  updated++;
}

console.log();
console.log(`--- summary ---`);
console.log(`Matched (Dog is my Copilot): ${matched}`);
console.log(`Already correct (project: DIMCP): ${alreadyCorrect}`);
console.log(`Updated: ${updated}${write ? '' : ' (dry-run — pass --write to apply)'}`);
