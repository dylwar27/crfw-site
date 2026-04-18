#!/usr/bin/env node
// Import Instagram posts fetched by scripts/fetch-instagram.sh (gallery-dl)
// into the photos and videos collections.
//
// Input:  tmp/instagram/<handle>/*.{jpg,mp4,json}  (gallery-dl output)
//         one .json sidecar per media file; carousel items share a
//         post_shortcode but each item is a separate file.
// Output: src/content/photos/<slug>.json    (image / carousel-image-first posts)
//         src/content/videos/<slug>.json    (video / carousel-video-first posts)
//         public/media/photos/<slug>/*      (primary + carousel extras)
//         public/media/videos/<slug>/*.mp4  (primary) + .jpg (poster if present)
//
// Slug:    ig-<handle>-<shortcode>
// Draft:   every new entry is written with published: false.
// Idempotent: skips shortcodes that already have entries. Safe to re-run
//             after an incremental gallery-dl fetch.
//
// Flags:
//   --user <handle>         required
//   --source <path>         override tmp/instagram/<handle>
//   --tag <slug>            extra tag on every entry (instagram-personal, etc.)
//   --limit N               stop after N posts (for dry-run smoke tests)
//   --write                 touch disk (default: dry-run)

import {
  readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync,
  copyFileSync,
} from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- CLI ---
const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
const write = args.includes('--write');
const user = flag('--user');
const sourceOverride = flag('--source');
const extraTag = flag('--tag');
const limit = flag('--limit') ? parseInt(flag('--limit'), 10) : Infinity;

if (!user) {
  console.error('error: --user <handle> is required');
  process.exit(2);
}

// --- Paths ---
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');
const sourceDir = sourceOverride || join(repoRoot, 'tmp', 'instagram', user);
const photosOutDir = join(repoRoot, 'src', 'content', 'photos');
const videosOutDir = join(repoRoot, 'src', 'content', 'videos');
const photosMediaDir = join(repoRoot, 'public', 'media', 'photos');
const videosMediaDir = join(repoRoot, 'public', 'media', 'videos');

if (!existsSync(sourceDir)) {
  console.error(`error: source directory not found: ${sourceDir}`);
  console.error(`did you run ./scripts/fetch-instagram.sh ${user} first?`);
  process.exit(1);
}

// --- Helpers ---
function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

// Split caption into (body, trailing-hashtags). Mid-caption hashtags
// stay in the body so we don't mangle prose.
function splitCaption(raw) {
  if (!raw) return { body: '', tags: [] };
  const trimmed = raw.trim();
  const lines = trimmed.split('\n');
  const tags = [];
  let bodyEnd = lines.length;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) { bodyEnd = i; continue; }
    const lineTags = [...line.matchAll(/#([\p{L}\p{N}_]+)/gu)].map(m => m[1].toLowerCase());
    const withoutTags = line.replace(/#[\p{L}\p{N}_]+/gu, '').trim();
    if (lineTags.length > 0 && withoutTags === '') {
      tags.unshift(...lineTags);
      bodyEnd = i;
    } else {
      break;
    }
  }
  return {
    body: lines.slice(0, bodyEnd).join('\n').trim(),
    tags: [...new Set(tags)],
  };
}

// gallery-dl's date is "YYYY-MM-DD HH:MM:SS" in post local or UTC —
// either way, the first ten chars are the calendar date we want.
function toFuzzyDate(postDate) {
  if (!postDate) return undefined;
  const m = String(postDate).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : undefined;
}

// --- Main ---
console.log(`User:     @${user}`);
console.log(`Source:   ${sourceDir}`);
console.log(`Mode:     ${write ? 'WRITE' : 'dry-run'}`);
if (extraTag) console.log(`Tag:      ${extraTag}`);
if (limit !== Infinity) console.log(`Limit:    ${limit}`);
console.log();

// Existing shortcodes (across both collections) → idempotent re-runs.
const slugPrefix = `ig-${slugify(user)}-`;
const existingShortcodes = new Set();
for (const dir of [photosOutDir, videosOutDir]) {
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const slug = f.slice(0, -5);
    if (slug.startsWith(slugPrefix)) {
      existingShortcodes.add(slug.slice(slugPrefix.length));
    }
  }
}

// gallery-dl writes one .json per media file. Group them by post_shortcode.
// JSON filename pattern we set: <shortcode>_<num>.<ext>.json
const allJsons = readdirSync(sourceDir).filter(f => f.endsWith('.json')).sort();

const groups = new Map(); // shortcode → [{ meta, mediaPath }]
for (const jsonFile of allJsons) {
  const jsonPath = join(sourceDir, jsonFile);
  let meta;
  try { meta = JSON.parse(readFileSync(jsonPath, 'utf8')); }
  catch { continue; }
  const shortcode = meta.post_shortcode || meta.shortcode;
  if (!shortcode) continue;
  // Media file = json filename minus trailing ".json"
  const mediaFile = jsonFile.replace(/\.json$/, '');
  const mediaPath = join(sourceDir, mediaFile);
  if (!existsSync(mediaPath)) continue;
  if (!groups.has(shortcode)) groups.set(shortcode, []);
  groups.get(shortcode).push({ meta, mediaFile, mediaPath });
}

// Sort each group by num so primary is first.
for (const items of groups.values()) {
  items.sort((a, b) => (a.meta.num ?? 1) - (b.meta.num ?? 1));
}

// Iterate in post-date order (oldest first on disk; emit newest first).
const sortedShortcodes = [...groups.keys()].sort((a, b) => {
  const da = groups.get(a)[0].meta.post_date || '';
  const db = groups.get(b)[0].meta.post_date || '';
  return db.localeCompare(da);
});

let written = 0, skippedExisting = 0, skippedNoMedia = 0;

for (const shortcode of sortedShortcodes) {
  if (written >= limit) break;
  if (existingShortcodes.has(shortcode)) {
    skippedExisting++;
    continue;
  }
  const items = groups.get(shortcode);
  if (!items || items.length === 0) {
    skippedNoMedia++;
    continue;
  }
  const primary = items[0];
  const primaryIsVideo = !!primary.meta.video_url;

  const date = toFuzzyDate(primary.meta.post_date);
  const rawCaption = primary.meta.description || '';
  const { body, tags: hashtagTags } = splitCaption(rawCaption);
  const caption = body || undefined;

  const slug = `${slugPrefix}${shortcode}`;
  const sourceUrl = primary.meta.post_url || `https://www.instagram.com/p/${shortcode}/`;
  const tags = [
    ...hashtagTags,
    ...(extraTag ? [extraTag] : []),
  ];

  const extras = items.slice(1);
  const isCarousel = items.length > 1;
  const archivePath = `CRFW Archive/Instagram/@${user}/${primary.mediaFile}`;

  if (!primaryIsVideo) {
    // Photo entry. Primary + extras land flat in public/media/photos/<slug>/.
    const destDir = join(photosMediaDir, slug);
    const primaryDestName = `primary${extname(primary.mediaFile)}`;
    const publicPrimary = `/media/photos/${slug}/${primaryDestName}`;
    const extraPublic = extras.map(it =>
      `/media/photos/${slug}/${it.mediaFile}`
    );

    const entry = {
      ...(date && { date }),
      src: publicPrimary,
      ...(caption && { caption }),
      ...(tags.length > 0 && { tags }),
      source: 'instagram',
      sourceUrl,
      ...(extraPublic.length > 0 && { carouselExtras: extraPublic }),
      archivePath,
      published: false,
    };

    console.log(`  PHOTO       ${slug}  ${date || '????'}  (${items.length} item${isCarousel ? 's' : ''})`);
    if (write) {
      mkdirSync(destDir, { recursive: true });
      copyFileSync(primary.mediaPath, join(destDir, primaryDestName));
      for (const it of extras) {
        copyFileSync(it.mediaPath, join(destDir, it.mediaFile));
      }
      writeFileSync(
        join(photosOutDir, `${slug}.json`),
        JSON.stringify(entry, null, 2) + '\n',
        'utf8',
      );
    }
  } else {
    // Video entry. No separate poster from gallery-dl by default — the
    // first frame is embedded in the mp4 and browsers render it.
    const destDir = join(videosMediaDir, slug);
    const primaryExt = extname(primary.mediaFile);
    const primaryDestName = `${slug}${primaryExt}`;
    const publicPrimary = `/media/videos/${slug}/${primaryDestName}`;
    const extraPublic = extras.map(it =>
      `/media/videos/${slug}/${it.mediaFile}`
    );

    const entry = {
      title: `Instagram post ${shortcode}`,
      ...(date && { date }),
      localSrc: publicPrimary,
      ...(caption && { summary: caption }),
      ...(tags.length > 0 && { tags }),
      kind: 'other',
      sourceUrl,
      ...(extraPublic.length > 0 && { carouselExtras: extraPublic }),
      archivePath,
      published: false,
    };

    console.log(`  VIDEO       ${slug}  ${date || '????'}  (${items.length} item${isCarousel ? 's' : ''})`);
    if (write) {
      mkdirSync(destDir, { recursive: true });
      copyFileSync(primary.mediaPath, join(destDir, primaryDestName));
      for (const it of extras) {
        copyFileSync(it.mediaPath, join(destDir, it.mediaFile));
      }
      writeFileSync(
        join(videosOutDir, `${slug}.json`),
        JSON.stringify(entry, null, 2) + '\n',
        'utf8',
      );
    }
  }

  existingShortcodes.add(shortcode);
  written++;
}

console.log();
console.log('--- summary ---');
console.log(`NEW:             ${written}`);
console.log(`SKIP-EXISTING:   ${skippedExisting}`);
console.log(`SKIP-NO-MEDIA:   ${skippedNoMedia}`);
console.log(`POSTS TOTAL:     ${groups.size}`);
if (!write) {
  console.log();
  console.log('dry-run; re-run with --write to commit changes.');
}
