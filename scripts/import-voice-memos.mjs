#!/usr/bin/env node
// Import voice memo transcripts from the CRFW Archive into src/content/voice_memos/.
//
// Source: ~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Voice Memos/
// Pattern: each voice memo is a pair of files:
//   YYYYMMDD HHMMSS.m4a  (audio)
//   YYYYMMDD HHMMSS.txt  (Whisper transcript)
//
// We DO NOT copy the m4a files into public/ (too large for git).
// We emit one JSON entry per memo with the transcript text and metadata.
//
// Flags:
//   --write          (without: dry-run, prints plan only)
//   --limit N        (optional; first N only)
//   --source <path>  (override archive path)

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const write = args.includes('--write');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const sourceIdx = args.indexOf('--source');
const source = sourceIdx >= 0
  ? args[sourceIdx + 1]
  : join(homedir(), 'Library', 'CloudStorage', 'Dropbox', 'CRFW', 'CRFW Archive', '_Documentation', 'Voice Memos');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, 'src', 'content', 'voice_memos');
mkdirSync(outDir, { recursive: true });

if (!existsSync(source)) {
  console.error(`Source folder not found: ${source}`);
  process.exit(2);
}

const files = readdirSync(source);
const m4aFiles = files.filter(f => f.endsWith('.m4a')).sort();
const txtSet = new Set(files.filter(f => f.endsWith('.txt')));

console.log(`Source:      ${source}`);
console.log(`m4a files:   ${m4aFiles.length}`);
console.log(`txt files:   ${txtSet.size}`);
console.log(`Mode:        ${write ? 'WRITE' : 'dry-run'}`);
console.log();

let imported = 0;
const skipped = [];

for (const m4a of m4aFiles) {
  if (imported >= limit) break;

  const stem = m4a.replace(/\.m4a$/, '');
  const txtFile = stem + '.txt';

  if (!txtSet.has(txtFile)) {
    skipped.push(stem);
    continue;
  }

  // Parse date from filename: "YYYYMMDD HHMMSS" → "YYYY-MM-DD"
  const match = stem.match(/^(\d{4})(\d{2})(\d{2})\s+(\d{2})(\d{2})(\d{2})$/);
  if (!match) {
    console.log(`  SKIP (bad filename format): ${stem}`);
    skipped.push(stem);
    continue;
  }
  const [, yyyy, mm, dd] = match;
  const date = `${yyyy}-${mm}-${dd}`;

  // Read transcript
  const transcript = readFileSync(join(source, txtFile), 'utf8').trim();

  // Build slug from stem (replace spaces with dashes)
  const slug = stem.replace(/\s+/g, '-');
  const outPath = join(outDir, `${slug}.json`);

  const entry = {
    date,
    transcript,
    archivePath: `CRFW Archive/_Documentation/Voice Memos/${m4a}`,
    tags: ['voice-memo'],
  };

  console.log(`  IMPORT  ${slug}  (${date}, ${transcript.length} chars)`);

  if (write) {
    writeFileSync(outPath, JSON.stringify(entry, null, 2) + '\n', 'utf8');
  }
  imported++;
}

console.log();
console.log(`--- summary ---`);
console.log(`IMPORTED:           ${imported}`);
console.log(`Skipped (no txt):   ${skipped.length}`);
if (skipped.length > 0) {
  console.log(`  Missing transcripts: ${skipped.join(', ')}`);
}
