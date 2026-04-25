#!/usr/bin/env node
// One-shot publish-policy pass (Session 19+ direction).
//
// Rules:
//   - photos: publish if has sourceUrl (i.e., already public on the broader internet)
//   - videos: publish only if has youtubeId / youtubeEmbed / vimeoEmbed / sourceUrl
//   - releases: publish if has bandcampUrl / coverArt / non-empty summary; hide otherwise
//
// Dry-run by default; pass --write to apply.
//
// Voice memos, events, sets are left alone.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const WRITE = process.argv.includes('--write');

function listJson(dir) {
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => join(dir, f));
}
function listMd(dir) {
  return readdirSync(dir).filter(f => f.endsWith('.md')).map(f => join(dir, f));
}

// ── Photos ─────────────────────────────────────────────────────────────────────
function applyPhotos() {
  const dir = join(ROOT, 'src/content/photos');
  const files = listJson(dir);
  let flips = { 'false→true': 0, 'true→false': 0, unchanged: 0, no_decision: 0 };
  for (const f of files) {
    const data = JSON.parse(readFileSync(f, 'utf8'));
    const hasSourceUrl = !!(data.sourceUrl && String(data.sourceUrl).trim() !== '');
    const want = hasSourceUrl;  // publish if has public URL
    const have = data.published !== false;  // default true
    if (!hasSourceUrl) { flips.no_decision++; continue; }  // no policy verdict → skip
    if (want === have) { flips.unchanged++; continue; }
    flips[want ? 'false→true' : 'true→false']++;
    if (WRITE) {
      data.published = want;
      writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
    }
  }
  return flips;
}

// ── Videos ─────────────────────────────────────────────────────────────────────
function applyVideos() {
  const dir = join(ROOT, 'src/content/videos');
  const files = listJson(dir);
  let flips = { 'false→true': 0, 'true→false': 0, unchanged: 0 };
  for (const f of files) {
    const data = JSON.parse(readFileSync(f, 'utf8'));
    const hasExternal =
      !!(data.youtubeId && String(data.youtubeId).trim() !== '') ||
      !!(data.youtubeEmbed && String(data.youtubeEmbed).trim() !== '') ||
      !!(data.vimeoEmbed && String(data.vimeoEmbed).trim() !== '') ||
      !!(data.sourceUrl && String(data.sourceUrl).trim() !== '');
    const want = hasExternal;
    const have = data.published !== false;
    if (want === have) { flips.unchanged++; continue; }
    flips[want ? 'false→true' : 'true→false']++;
    if (WRITE) {
      data.published = want;
      writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
    }
  }
  return flips;
}

// ── Releases ──────────────────────────────────────────────────────────────────
function applyReleases() {
  const dir = join(ROOT, 'src/content/releases');
  const files = listMd(dir);
  let flips = { 'false→true': 0, 'true→false': 0, unchanged: 0 };
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!m) continue;
    const fm = m[1], body = m[2];

    // Heuristics: any of the three signals → curated
    const hasBandcamp = /^bandcampUrl:\s*\S/m.test(fm);
    const hasCoverArt = /^coverArt:\s*\S/m.test(fm);
    // summary can be inline or block scalar; consider non-empty if not just "" / ''
    const summaryInline = fm.match(/^summary:\s*"([^"]*)"\s*$/m);
    const summaryBlock = fm.match(/^summary:\s*[>|]\s*\n((?:\s+\S.*\n?)+)/m);
    const summarySingle = fm.match(/^summary:\s*'([^']*)'\s*$/m);
    let hasSummary = false;
    if (summaryInline && summaryInline[1].trim()) hasSummary = true;
    if (summarySingle && summarySingle[1].trim()) hasSummary = true;
    if (summaryBlock && summaryBlock[1].trim()) hasSummary = true;

    const curated = hasBandcamp || hasCoverArt || hasSummary;
    const want = curated;

    const pubMatch = fm.match(/^published:\s*(\S+)\s*$/m);
    const have = pubMatch ? pubMatch[1] === 'true' : true;  // default true

    if (want === have) { flips.unchanged++; continue; }
    flips[want ? 'false→true' : 'true→false']++;
    if (WRITE) {
      let newFm;
      if (pubMatch) {
        newFm = fm.replace(/^published:\s*\S+\s*$/m, `published: ${want}`);
      } else {
        newFm = fm.trimEnd() + `\npublished: ${want}\n`;
      }
      const out = `---\n${newFm.replace(/\n*$/, '\n')}---\n${body}`;
      writeFileSync(f, out);
    }
  }
  return flips;
}

const photoFlips = applyPhotos();
const videoFlips = applyVideos();
const releaseFlips = applyReleases();

console.log(`\n── Publish policy ${WRITE ? 'APPLY' : 'DRY-RUN'} ──`);
console.log(`Photos:   ${JSON.stringify(photoFlips)}`);
console.log(`Videos:   ${JSON.stringify(videoFlips)}`);
console.log(`Releases: ${JSON.stringify(releaseFlips)}`);
if (!WRITE) console.log(`\nRun with --write to apply.`);
