#!/usr/bin/env node
// Match scraped YouTube channel video lists to existing video stubs in
// src/content/videos/, patching `youtubeId` on confident matches.
//
// Inputs:
//   /tmp/crfw-yt/colinrfw.psv  ← `yt-dlp --flat-playlist` output (pipe-delim)
//   /tmp/crfw-yt/tudaloos.psv
//   src/content/videos/*.json  ← existing entries
//
// Process:
//   1. For each YT row (id, title, date, duration), normalize the title.
//   2. For each video JSON entry without a youtubeId yet, normalize its title
//      (strip archive prefixes, extensions, parenthetical noise).
//   3. Score every (yt, video) pair: normalized-equality → 100,
//      one-contains-the-other → 80, token-overlap ≥ 0.7 → 70, else 0.
//   4. Each YT video binds to its best-scoring video stub (mutual best wins;
//      ties go to the entry with closer year).
//   5. Score ≥ 80 → confident, patch youtubeId. Score 60–79 → write to
//      youtube-match-report.md for curator review. Score < 60 → unmatched.
//   6. Output a per-channel summary.
//
// Dry-run by default; --write applies the patches.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const VIDEO_DIR = join(REPO_ROOT, 'src/content/videos');
const REPORT_PATH = join(REPO_ROOT, 'youtube-match-report.md');
const WRITE = process.argv.includes('--write');

// ── Normalize a title for matching ────────────────────────────────────────────
function normalize(s) {
  return String(s)
    .toLowerCase()
    // Strip archive-specific prefixes that don't appear on YouTube
    .replace(/^crfw[_ ]\d{4}[_ ]/, '')
    .replace(/^crfw_tudaloos_\d{4}-?\d*_video[_ ]rips?\//, '')
    // Strip extensions
    .replace(/\.(mov|mp4|m4v|webm|avi)\b/g, '')
    // Strip "[www.tubegrip.com]" / "[archive]" tags
    .replace(/\[[^\]]+\]/g, '')
    // Underscores → spaces, multi-space → single
    .replace(/[_]/g, ' ')
    // Remove punctuation other than alphanumerics + spaces
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Token overlap (Jaccard-like)
function tokenOverlap(a, b) {
  const A = new Set(normalize(a).split(' ').filter(t => t.length >= 2));
  const B = new Set(normalize(b).split(' ').filter(t => t.length >= 2));
  if (!A.size || !B.size) return 0;
  let common = 0;
  for (const t of A) if (B.has(t)) common++;
  return common / Math.max(A.size, B.size);
}

function score(ytTitle, entryTitle) {
  const a = normalize(ytTitle);
  const b = normalize(entryTitle);
  if (!a || !b) return 0;
  if (a === b) return 100;
  // One fully contains the other (after normalize)
  if ((a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b))) return 85;
  const ov = tokenOverlap(a, b);
  if (ov >= 0.85) return 80;
  if (ov >= 0.70) return 70;
  if (ov >= 0.50) return 60;
  return 0;
}

// ── Load YT channel rows ─────────────────────────────────────────────────────
function loadChannel(path, label) {
  let lines;
  try { lines = readFileSync(path, 'utf8').split('\n').filter(Boolean); }
  catch (e) { console.warn(`[WARN] couldn't read ${path}: ${e.message}`); return []; }
  return lines.map(line => {
    const [id, title, uploadDate, duration] = line.split('|');
    return { id, title: title || id, uploadDate, duration, channel: label };
  });
}

const ytVideos = [
  ...loadChannel('/tmp/crfw-yt/colinrfw.psv', 'colinrfw'),
  ...loadChannel('/tmp/crfw-yt/tudaloos.psv', 'tudaloos'),
].filter(y => y.id && y.id !== 'NA');

// ── Load existing entries ────────────────────────────────────────────────────
const files = readdirSync(VIDEO_DIR).filter(f => f.endsWith('.json'));
const entries = files.map(f => {
  const data = JSON.parse(readFileSync(join(VIDEO_DIR, f), 'utf8'));
  return {
    file: f,
    path: join(VIDEO_DIR, f),
    title: data.title || '',
    year: data.date ? data.date.slice(0, 4) : '',
    youtubeId: data.youtubeId || '',
    data,
  };
});

const alreadyHasYtId = entries.filter(e => e.youtubeId).length;

// ── Score every (yt, entry-without-id) pair ──────────────────────────────────
const candidates = []; // {yt, entry, score}
for (const yt of ytVideos) {
  let best = null;
  for (const entry of entries) {
    if (entry.youtubeId) continue;  // skip already-mapped
    const sc = score(yt.title, entry.title);
    if (sc === 0) continue;
    if (!best || sc > best.score) best = { yt, entry, score: sc };
  }
  if (best) candidates.push(best);
}

// Sort by score (highest first); apply each match only if BOTH the YT video
// and the entry are still unbound. (Mutual exclusivity.)
candidates.sort((a, b) => b.score - a.score);
const usedYtIds = new Set();
const usedEntryFiles = new Set();
const matches = [];
for (const c of candidates) {
  if (usedYtIds.has(c.yt.id) || usedEntryFiles.has(c.entry.file)) continue;
  usedYtIds.add(c.yt.id);
  usedEntryFiles.add(c.entry.file);
  matches.push(c);
}

const confident = matches.filter(m => m.score >= 80);
const review    = matches.filter(m => m.score >= 60 && m.score < 80);
const unmatched = ytVideos.filter(y => !usedYtIds.has(y.id));

// ── Apply patches ────────────────────────────────────────────────────────────
let patched = 0;
for (const m of confident) {
  m.entry.data.youtubeId = m.yt.id;
  if (WRITE) {
    writeFileSync(m.entry.path, JSON.stringify(m.entry.data, null, 2) + '\n');
    patched++;
  }
}

// ── Write a curator review report ────────────────────────────────────────────
const reportLines = [];
reportLines.push(`# YouTube match report\n`);
reportLines.push(`Generated by \`scripts/match-youtube-ids.mjs\` on ${new Date().toISOString().slice(0, 10)}.`);
reportLines.push(``);
reportLines.push(`- YT videos scraped: ${ytVideos.length}`);
reportLines.push(`- Entries already with youtubeId before run: ${alreadyHasYtId}`);
reportLines.push(`- High-confidence matches (≥80, ${WRITE ? 'patched' : 'would patch'}): ${confident.length}`);
reportLines.push(`- Review-needed matches (60–79): ${review.length}`);
reportLines.push(`- Unmatched YT videos: ${unmatched.length}`);
reportLines.push(``);

if (review.length > 0) {
  reportLines.push(`## Review needed\n`);
  reportLines.push(`Each row is a possible match. To accept, manually add \`youtubeId: <id>\` to the listed entry. To reject, just leave alone.`);
  reportLines.push(``);
  reportLines.push(`| score | YT title | YT id | entry title | entry file |`);
  reportLines.push(`|------:|---|---|---|---|`);
  for (const m of review) {
    reportLines.push(`| ${m.score} | ${m.yt.title.replace(/\|/g, '\\|')} | \`${m.yt.id}\` | ${m.entry.title.replace(/\|/g, '\\|')} | \`${m.entry.file}\` |`);
  }
  reportLines.push(``);
}

if (unmatched.length > 0) {
  reportLines.push(`## Unmatched YT videos (no decent entry-title match)\n`);
  reportLines.push(`These probably need NEW video entries created. Use the existing import-video-stubs.mjs as a template, or hand-craft.`);
  reportLines.push(``);
  reportLines.push(`| YT title | YT id | duration |`);
  reportLines.push(`|---|---|---:|`);
  for (const u of unmatched) {
    reportLines.push(`| ${u.title.replace(/\|/g, '\\|')} | \`${u.id}\` | ${u.duration || ''} |`);
  }
  reportLines.push(``);
}

writeFileSync(REPORT_PATH, reportLines.join('\n'));

// ── Console summary ──────────────────────────────────────────────────────────
console.log(`\n── YouTube match ${WRITE ? 'APPLY' : 'DRY-RUN'} ──`);
console.log(`YT videos:                  ${ytVideos.length}`);
console.log(`Already mapped:             ${alreadyHasYtId}`);
console.log(`Confident matches (≥80):    ${confident.length}${WRITE ? ' (patched)' : ' (would patch)'}`);
console.log(`Review needed (60-79):      ${review.length} → see ${REPORT_PATH}`);
console.log(`Unmatched YT videos:        ${unmatched.length} → see ${REPORT_PATH}`);

console.log(`\nSample confident matches (first 8):`);
for (const m of confident.slice(0, 8)) {
  console.log(`  ${m.score}  "${m.yt.title}" → ${m.entry.file}  [${m.yt.id}]`);
}
if (!WRITE) console.log(`\nRun with --write to apply.`);
