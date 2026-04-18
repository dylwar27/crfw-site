#!/usr/bin/env node
// Stage 2 of ig-archive: normalize gallery-dl's output into manifest.json.
//
// Reads  <out>/<handle>/*.json               (gallery-dl sidecars)
// Writes <out>/<handle>/manifest.json        (normalized, schema-versioned)
//
// Manifest is the stable contract any downstream consumer should read —
// gallery-dl's raw sidecars remain on disk for readers who need the full
// IG GraphQL node.
//
// Flags:
//   --handle <name>     required; account handle
//   --out <dir>         root of the archive (default: ./ig-archive)
//   --verbose           print each post as it's normalized
//   --dry-run           do not write manifest.json; print summary only

import {
  readdirSync, readFileSync, writeFileSync, existsSync, statSync,
} from 'node:fs';
import { join, extname, basename } from 'node:path';

const SCHEMA_VERSION = 1;

// --- CLI ---
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const handle = flag('--handle');
const outRoot = flag('--out') || './ig-archive';
const verbose = args.includes('--verbose');
const dryRun = args.includes('--dry-run');

if (!handle) {
  console.error('error: --handle <name> is required');
  process.exit(2);
}

const handleClean = handle.replace(/^@/, '');
const sourceDir = join(outRoot, handleClean);

if (!existsSync(sourceDir) || !statSync(sourceDir).isDirectory()) {
  console.error(`error: source directory not found: ${sourceDir}`);
  console.error(`did you run fetch.sh ${handleClean} first?`);
  process.exit(1);
}

// --- Helpers ---

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v', '.webm']);

function classifyExt(filename) {
  const ext = extname(filename).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return null;
}

// gallery-dl emits dates like "2018-01-31 00:30:30" — sometimes UTC,
// sometimes local depending on IG's current behavior. We treat as UTC
// and emit an ISO string so the consumer has unambiguous ordering.
function toIsoUtc(galleryDate) {
  if (!galleryDate) return null;
  const m = String(galleryDate).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
}

// Trailing-hashtags-only lines get peeled into a separate array; body
// text and mid-caption hashtags stay in the body. Preserves the
// original caption verbatim as well so consumers don't lose fidelity.
function splitCaption(raw) {
  if (!raw) return { body: '', hashtags: [] };
  const trimmed = String(raw).trim();
  const lines = trimmed.split('\n');
  const hashtags = [];
  let bodyEnd = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) { bodyEnd = i; continue; }
    const lineTags = [...line.matchAll(/#([\p{L}\p{N}_]+)/gu)].map(m => m[1].toLowerCase());
    const withoutTags = line.replace(/#[\p{L}\p{N}_]+/gu, '').trim();
    if (lineTags.length > 0 && withoutTags === '') {
      hashtags.unshift(...lineTags);
      bodyEnd = i;
    } else {
      break;
    }
  }
  return {
    body: lines.slice(0, bodyEnd).join('\n').trim(),
    hashtags: [...new Set(hashtags)],
  };
}

function scraperVersion() {
  // Best-effort; the consumer only cares that we recorded what tool wrote this.
  return 'gallery-dl';
}

// --- Main ---

// Collect sidecar JSONs. Skip profile-info sidecars and our own manifest.
const jsonFiles = readdirSync(sourceDir)
  .filter(f => f.endsWith('.json') && f !== 'manifest.json' && !f.endsWith('_profile.json'))
  .sort();

if (jsonFiles.length === 0) {
  console.error(`error: no gallery-dl sidecars in ${sourceDir}`);
  console.error('did you run fetch.sh yet?');
  process.exit(1);
}

// Group by post_shortcode. gallery-dl writes one sidecar per media file,
// so carousels produce N sidecars that share a shortcode.
const groups = new Map();
let ownerUsername = handleClean;
let ownerFullname = null;

for (const jsonFile of jsonFiles) {
  let meta;
  try { meta = JSON.parse(readFileSync(join(sourceDir, jsonFile), 'utf8')); }
  catch (e) {
    console.warn(`skip (parse): ${jsonFile} — ${e.message}`);
    continue;
  }
  const shortcode = meta.post_shortcode || meta.shortcode;
  if (!shortcode) {
    console.warn(`skip (no shortcode): ${jsonFile}`);
    continue;
  }
  const mediaFile = jsonFile.replace(/\.json$/, '');
  const mediaPath = join(sourceDir, mediaFile);
  if (!existsSync(mediaPath)) {
    console.warn(`skip (no media): ${jsonFile} — expected ${mediaFile}`);
    continue;
  }
  const mediaType = classifyExt(mediaFile);
  if (!mediaType) {
    console.warn(`skip (unknown media type): ${mediaFile}`);
    continue;
  }
  if (!groups.has(shortcode)) groups.set(shortcode, []);
  groups.get(shortcode).push({ meta, mediaFile, mediaType });

  // Opportunistically grab account-level info — first occurrence wins.
  if (!ownerFullname && meta.fullname) ownerFullname = meta.fullname;
  if (meta.username && meta.username !== ownerUsername) ownerUsername = meta.username;
}

// Sort each group by `num` so the primary item is first.
for (const items of groups.values()) {
  items.sort((a, b) => (a.meta.num ?? 1) - (b.meta.num ?? 1));
}

// Normalize each group into a post entry.
const posts = [];
for (const [shortcode, items] of groups) {
  const primary = items[0];
  const extras = items.slice(1);
  const primaryIsVideo = primary.mediaType === 'video';
  const isCarousel = items.length > 1;

  let kind;
  if (isCarousel) {
    kind = primaryIsVideo ? 'carousel-video' : 'carousel-photo';
  } else {
    kind = primaryIsVideo ? 'video' : 'photo';
  }

  const rawCaption = primary.meta.description || '';
  const { body, hashtags } = splitCaption(rawCaption);

  const post = {
    shortcode,
    url: primary.meta.post_url || `https://www.instagram.com/p/${shortcode}/`,
    date: toIsoUtc(primary.meta.post_date || primary.meta.date),
    kind,
    caption: rawCaption || null,
    caption_body: body || null,
    caption_hashtags: hashtags,
    location: primary.meta.location?.name || null,
    media_count: items.length,
    primary: {
      file: primary.mediaFile,
      type: primary.mediaType,
    },
    extras: extras.map(it => ({
      file: it.mediaFile,
      type: it.mediaType,
    })),
  };
  posts.push(post);

  if (verbose) {
    console.log(`  ${kind.padEnd(15)} ${shortcode}  ${post.date || '????'}  (${items.length} item${isCarousel ? 's' : ''})`);
  }
}

// Newest first for consumer convenience.
posts.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

const manifest = {
  schema_version: SCHEMA_VERSION,
  handle: handleClean,
  fullname: ownerFullname,
  source: 'instagram.com',
  scraper: scraperVersion(),
  scraped_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  post_count: posts.length,
  posts,
};

console.log();
console.log(`handle:          @${handleClean}${ownerFullname ? ` (${ownerFullname})` : ''}`);
console.log(`posts:           ${posts.length}`);
console.log(`photos:          ${posts.filter(p => p.kind === 'photo').length}`);
console.log(`videos:          ${posts.filter(p => p.kind === 'video').length}`);
console.log(`carousel-photo:  ${posts.filter(p => p.kind === 'carousel-photo').length}`);
console.log(`carousel-video:  ${posts.filter(p => p.kind === 'carousel-video').length}`);

if (dryRun) {
  console.log();
  console.log('dry-run; no manifest written.');
  process.exit(0);
}

const manifestPath = join(sourceDir, 'manifest.json');
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log();
console.log(`manifest.json written to ${manifestPath}`);
