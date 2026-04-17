#!/usr/bin/env node
// Backfill Whisper transcripts into existing video JSON entries.
//
// Source: ~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Videos/YYYY/
// For each video entry whose archivePath points to a .mov/.mp4/etc.,
// look for a sibling .txt file with the same stem. If found, read it
// and populate the `transcript` field (a new field, added to the
// videos schema in this PR).
//
// Existing transcript fields are NOT overwritten.
//
// Run: node scripts/import-video-transcripts.mjs          (dry-run)
//      node scripts/import-video-transcripts.mjs --write  (apply)

import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const write = process.argv.includes('--write');
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');
const videosDir = join(repoRoot, 'src', 'content', 'videos');
const archiveRoot = join(homedir(), 'Library', 'CloudStorage', 'Dropbox', 'CRFW');

const files = readdirSync(videosDir).filter(f => f.endsWith('.json'));
let scanned = 0, withTranscript = 0, alreadyHad = 0, notFound = 0, added = 0, totalChars = 0;

for (const f of files) {
  if (f.includes(' 2.json')) continue; // Dropbox sync artifacts; guarded by gitignore but some machines
  scanned++;
  const path = join(videosDir, f);
  const data = JSON.parse(readFileSync(path, 'utf8'));

  if (data.transcript) { alreadyHad++; continue; }
  if (!data.archivePath) { notFound++; continue; }

  // Reconstruct absolute path to the video file
  const absVideo = join(archiveRoot, data.archivePath);
  if (!existsSync(absVideo)) { notFound++; continue; }

  // Look for sibling .txt
  const ext = extname(absVideo);
  const stem = absVideo.slice(0, -ext.length);
  const txtPath = stem + '.txt';
  if (!existsSync(txtPath)) { notFound++; continue; }

  const transcript = readFileSync(txtPath, 'utf8').trim();
  if (!transcript) { notFound++; continue; }

  data.transcript = transcript;
  withTranscript++;
  added++;
  totalChars += transcript.length;

  console.log(`  + ${f}  (${transcript.length} chars)`);

  if (write) {
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
  }
}

console.log();
console.log(`--- summary ---`);
console.log(`Scanned videos:     ${scanned}`);
console.log(`Already had transcript: ${alreadyHad}`);
console.log(`Transcripts found + ${write ? 'added' : 'would add'}: ${added}`);
console.log(`No transcript file: ${notFound}`);
console.log(`Total chars ${write ? 'written' : 'would write'}: ${totalChars.toLocaleString()}`);
