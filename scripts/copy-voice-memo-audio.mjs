#!/usr/bin/env node
// Copy voice memo .m4a files from the Dropbox archive into public/media/
// for in-page <audio> playback.
//
// Only copies for currently-published voice memos (so the unpublished /
// flagged-by-content-scan memos stay archive-only).
//
// Source layout:
//   archivePath in each voice_memo entry points at
//   "CRFW Archive/_Documentation/Voice Memos/<YYYYMMDD HHMMSS>.m4a"
//
// Target layout:
//   public/media/voice-memos/<slug>.m4a
//   where slug = entry filename without .json
//
// Idempotent: skips files that already exist with matching size.
//
// Dry-run by default; pass --write to apply.

import { readFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ARCHIVE_ROOT = join(homedir(), 'Library', 'CloudStorage', 'Dropbox', 'CRFW');
const VM_DIR = join(REPO_ROOT, 'src/content/voice_memos');
const TARGET_DIR = join(REPO_ROOT, 'public/media/voice-memos');

const WRITE = process.argv.includes('--write');

const files = readdirSync(VM_DIR).filter(f => f.endsWith('.json'));
let scanned = 0;
let willCopy = 0;
let copied = 0;
let skippedUnpublished = 0;
let skippedExisting = 0;
let missingSource = 0;
let totalBytes = 0;

if (WRITE && !existsSync(TARGET_DIR)) {
  mkdirSync(TARGET_DIR, { recursive: true });
}

for (const f of files) {
  scanned++;
  const data = JSON.parse(readFileSync(join(VM_DIR, f), 'utf8'));
  if (data.published === false) { skippedUnpublished++; continue; }

  const slug = f.replace(/\.json$/, '');
  const archiveRelative = data.archivePath;
  if (!archiveRelative) { missingSource++; continue; }

  // archivePath stored as e.g. "CRFW Archive/_Documentation/Voice Memos/20150914 232447.m4a"
  const sourcePath = join(ARCHIVE_ROOT, archiveRelative);
  if (!existsSync(sourcePath)) { missingSource++; continue; }

  const targetPath = join(TARGET_DIR, `${slug}.m4a`);

  if (existsSync(targetPath)) {
    const srcSize = statSync(sourcePath).size;
    const tgtSize = statSync(targetPath).size;
    if (srcSize === tgtSize) { skippedExisting++; continue; }
  }

  willCopy++;
  totalBytes += statSync(sourcePath).size;

  if (WRITE) {
    copyFileSync(sourcePath, targetPath);
    copied++;
  }
}

const mb = (totalBytes / 1024 / 1024).toFixed(1);

console.log(`\n── Voice memo audio copy ${WRITE ? 'APPLY' : 'DRY-RUN'} ──`);
console.log(`Scanned voice_memos:        ${scanned}`);
console.log(`Skipped (unpublished):      ${skippedUnpublished}`);
console.log(`Skipped (already in place): ${skippedExisting}`);
console.log(`Missing source m4a:         ${missingSource}`);
console.log(`${WRITE ? 'Copied' : 'Would copy'}: ${WRITE ? copied : willCopy} files (${mb} MB)`);
if (!WRITE) console.log(`\nRun with --write to apply.`);
