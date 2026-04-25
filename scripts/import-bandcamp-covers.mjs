#!/usr/bin/env node
// Import album covers from the Bandcamp metadata archive folders.
//
// Source: ~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/bandcamp/
// Each <project>__<slug>/ folder has a cover.jpg next to its metadata.json.
//
// Match logic:
//   - Read all releases with `bandcampUrl` set.
//   - Parse the URL: https://<artist>.bandcamp.com/{album,track}/<slug>
//   - Look for cover.jpg at <archive>/_Documentation/bandcamp/<artist>__<slug>/cover.jpg
//   - If present and the release has no `coverArt:` field yet, copy and set.
//
// Never overwrites an existing coverArt: field — preserves curator decisions.
//
// Dry-run by default. Pass --write to apply.

import {
  readdirSync, existsSync, copyFileSync, writeFileSync,
  readFileSync, mkdirSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const archiveRoot = join(homedir(), 'Library', 'CloudStorage', 'Dropbox', 'CRFW');
const bandcampRoot = join(archiveRoot, 'CRFW Archive', '_Documentation', 'bandcamp');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');
const releasesDir = join(repoRoot, 'src/content/releases');
const mediaRoot = join(repoRoot, 'public/media/releases');

// ── Parse bandcamp URL ───────────────────────────────────────────────────────
// https://killdby.bandcamp.com/album/court-clothes → { artist: 'killdby', slug: 'court-clothes', kind: 'album' }
function parseBandcampUrl(url) {
  const m = String(url).match(/https?:\/\/([^.]+)\.bandcamp\.com\/(album|track)\/([^/?#]+)/);
  if (!m) return null;
  return { artist: m[1], kind: m[2], slug: m[3] };
}

// ── Read frontmatter ─────────────────────────────────────────────────────────
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return null;
  return { frontmatter: m[1], body: m[2] };
}
function getScalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return undefined;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  return v;
}
function hasField(fm, key) {
  return new RegExp(`^${key}:\\s*\\S`, 'm').test(fm);
}
function setScalar(fm, key, value) {
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  const line = `${key}: ${JSON.stringify(value)}`;
  if (re.test(fm)) return fm.replace(re, line);
  return fm.trimEnd() + '\n' + line + '\n';
}

// ── Main ─────────────────────────────────────────────────────────────────────
const files = readdirSync(releasesDir).filter(f => f.endsWith('.md'));
let scanned = 0;
let candidates = 0;
let copied = 0;
let skippedExisting = 0;
let skippedNoBandcamp = 0;
let skippedNoFolder = 0;

for (const file of files) {
  scanned++;
  const path = join(releasesDir, file);
  const text = readFileSync(path, 'utf8');
  const fm = splitFrontmatter(text);
  if (!fm) continue;
  const slug = file.replace(/\.md$/, '');

  const bandcampUrl = getScalar(fm.frontmatter, 'bandcampUrl');
  if (!bandcampUrl) { skippedNoBandcamp++; continue; }

  const parsed = parseBandcampUrl(bandcampUrl);
  if (!parsed) { skippedNoBandcamp++; continue; }

  // Look for the cover in the bandcamp metadata folder
  const folderName = `${parsed.artist}__${parsed.slug}`;
  const folder = join(bandcampRoot, folderName);
  if (!existsSync(folder)) { skippedNoFolder++; continue; }

  let coverPath = join(folder, 'cover.jpg');
  if (!existsSync(coverPath)) {
    coverPath = join(folder, 'cover.png');
    if (!existsSync(coverPath)) { skippedNoFolder++; continue; }
  }

  candidates++;

  // Don't overwrite existing coverArt
  if (hasField(fm.frontmatter, 'coverArt')) {
    skippedExisting++;
    continue;
  }

  const ext = coverPath.endsWith('.png') ? 'png' : 'jpg';
  const targetMedia = join(mediaRoot, slug, `cover.${ext}`);
  const coverArtField = `/media/releases/${slug}/cover.${ext}`;

  console.log(`  ${WRITE ? '[WRITTEN]' : '[DRY-RUN]'} ${slug.padEnd(40)} ← ${folderName}/cover.${ext}`);

  if (WRITE) {
    mkdirSync(dirname(targetMedia), { recursive: true });
    copyFileSync(coverPath, targetMedia);
    const newFm = setScalar(fm.frontmatter, 'coverArt', coverArtField);
    writeFileSync(path, `---\n${newFm}\n---\n${fm.body}`);
    copied++;
  }
}

console.log(`\n── Bandcamp cover import ${WRITE ? 'APPLY' : 'DRY-RUN'} ──`);
console.log(`  Scanned releases:     ${scanned}`);
console.log(`  With bandcampUrl:     ${scanned - skippedNoBandcamp}`);
console.log(`  Folder + cover found: ${candidates}`);
console.log(`  Already have coverArt: ${skippedExisting}`);
console.log(`  ${WRITE ? 'Copied' : 'Would copy'}: ${WRITE ? copied : (candidates - skippedExisting)}`);
if (!WRITE) console.log(`\nRun with --write to apply.`);
