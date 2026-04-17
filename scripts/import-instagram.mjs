#!/usr/bin/env node
// Import Instagram posts fetched by scripts/fetch-instagram.sh into the
// photos and videos collections.
//
// Input:  tmp/instagram/<handle>/*.{json,jpg,mp4}  (instaloader output)
// Output: src/content/photos/<slug>.json    (for image / carousel-image-first posts)
//         src/content/videos/<slug>.json    (for video / carousel-video-first posts)
//         public/media/photos/<slug>/*.jpg  (primary + carousel extras)
//         public/media/videos/<slug>/*.mp4  (primary) + .jpg (poster)
//
// Slug:    ig-<handle>-<shortcode>
// Draft:   every new entry is written with published: false. Curator flips
//          visibility via /admin or CSV roundtrip.
// Idempotent: skips any shortcode that already has an entry in either
//          collection (no overwrites).
//
// Flags:
//   --user <handle>         required; determines source dir and slug prefix
//   --source <path>         override tmp/instagram/<handle>
//   --tag <slug>            extra tag applied to every entry (e.g.
//                           instagram-personal, instagram-art)
//   --limit N               stop after N posts (for dry-run smoke tests)
//   --write                 actually touch disk (default: dry-run)

import {
  readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync,
  copyFileSync, statSync,
} from 'node:fs';
import { join, extname, basename } from 'node:path';
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
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const VIDEO_EXTS = new Set(['.mp4', '.mov', '.m4v']);

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function unixToDate(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

// Split caption into (body, hashtags). Only peels hashtags from a trailing
// block — hashtags mid-caption stay in the body so we don't mangle prose.
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

// Instaloader's JSON wraps the post node under either `node` (legacy) or
// `GraphImage`/`GraphVideo`/`GraphSidecar` (newer web API). Normalise.
function unwrapNode(raw) {
  if (raw && typeof raw === 'object') {
    if (raw.node) return raw.node;
    if (raw.shortcode) return raw;
  }
  return null;
}

// For one post-stem (e.g. "2023-01-15_12-30-45_UTC_CgYz3xAl2kK"), find
// every sibling file with that prefix and classify as image or video.
// Instaloader carousel convention: <stem>.jpg, <stem>_1.jpg, <stem>_2.mp4...
// For a single video: <stem>.mp4 + <stem>.jpg (poster).
function collectMedia(dir, stem) {
  const all = readdirSync(dir)
    .filter(f => f.startsWith(stem) && !f.endsWith('.json'))
    .sort();
  const mediaFiles = [];
  for (const f of all) {
    const ext = extname(f).toLowerCase();
    const isImage = IMAGE_EXTS.has(ext);
    const isVideo = VIDEO_EXTS.has(ext);
    if (!isImage && !isVideo) continue;
    mediaFiles.push({ name: f, ext, isVideo, path: join(dir, f) });
  }
  return mediaFiles;
}

// From raw instaloader metadata + collected files, produce a unified
// representation: { kind: 'photo'|'video', primary, extras: [], poster? }.
// The `__typename` on the JSON tells us the intent; files on disk confirm.
function classifyPost(node, files) {
  const typename = node.__typename || (node.is_video ? 'GraphVideo' : 'GraphImage');

  // Carousels: match children order to the disk-ordered files. We trust
  // instaloader's naming: <stem>.<ext> is index 0, <stem>_1.<ext> is
  // index 1, and so on. Sorting alphabetically above gets us that order
  // since "." sorts before "_" in ASCII.
  if (typename === 'GraphSidecar') {
    const children = node.edge_sidecar_to_children?.edges?.map(e => e.node) || [];
    const items = [];
    let i = 0;
    for (const child of children) {
      const childIsVideo = !!child.is_video;
      const wantExt = childIsVideo ? VIDEO_EXTS : IMAGE_EXTS;
      // Advance past poster thumbnails that may precede each video's mp4.
      while (i < files.length && !wantExt.has(files[i].ext)) i++;
      if (i >= files.length) break;
      items.push({ file: files[i], isVideo: childIsVideo });
      i++;
    }
    if (items.length === 0) return null;
    const primary = items[0];
    const extras = items.slice(1).map(it => it.file);
    return {
      kind: primary.isVideo ? 'video' : 'photo',
      primary: primary.file,
      extras,
      // Poster for video primary: the .jpg with no trailing _N on disk.
      poster: primary.isVideo
        ? files.find(f => !f.isVideo && !/_\d+\./.test(f.name))
        : undefined,
    };
  }

  if (typename === 'GraphVideo' || node.is_video) {
    const video = files.find(f => f.isVideo);
    const poster = files.find(f => !f.isVideo);
    if (!video) return null;
    return { kind: 'video', primary: video, extras: [], poster };
  }

  // GraphImage — single image post.
  const image = files.find(f => !f.isVideo);
  if (!image) return null;
  return { kind: 'photo', primary: image, extras: [], poster: undefined };
}

// --- Main ---
console.log(`User:     @${user}`);
console.log(`Source:   ${sourceDir}`);
console.log(`Mode:     ${write ? 'WRITE' : 'dry-run'}`);
if (extraTag) console.log(`Tag:      ${extraTag}`);
if (limit !== Infinity) console.log(`Limit:    ${limit}`);
console.log();

// Build a set of existing shortcodes across both collections so re-runs
// are idempotent. Scan for the slug prefix we would produce.
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

const jsonFiles = readdirSync(sourceDir)
  .filter(f => f.endsWith('.json') && !f.endsWith('_profile.json'))
  .sort();

let written = 0, skippedExisting = 0, skippedNoMedia = 0, skippedParseError = 0;

for (const jsonFile of jsonFiles) {
  if (written >= limit) break;
  const jsonPath = join(sourceDir, jsonFile);
  const stem = jsonFile.replace(/\.json$/, '');

  let raw;
  try { raw = JSON.parse(readFileSync(jsonPath, 'utf8')); }
  catch (e) {
    console.log(`  PARSE-FAIL  ${jsonFile}`);
    skippedParseError++;
    continue;
  }
  const node = unwrapNode(raw);
  if (!node || !node.shortcode) {
    console.log(`  NO-NODE     ${jsonFile}`);
    skippedParseError++;
    continue;
  }
  const shortcode = node.shortcode;

  if (existingShortcodes.has(shortcode)) {
    skippedExisting++;
    continue;
  }

  const files = collectMedia(sourceDir, stem);
  if (files.length === 0) {
    console.log(`  NO-MEDIA    ${shortcode}`);
    skippedNoMedia++;
    continue;
  }

  const classified = classifyPost(node, files);
  if (!classified) {
    console.log(`  NO-PRIMARY  ${shortcode}`);
    skippedNoMedia++;
    continue;
  }

  const date = unixToDate(node.taken_at_timestamp);
  const rawCaption = node.edge_media_to_caption?.edges?.[0]?.node?.text || '';
  const { body, tags: hashtagTags } = splitCaption(rawCaption);
  const locationName = node.location?.name;
  const caption = locationName && body
    ? `${body}\n\n— ${locationName}`
    : locationName || body || undefined;

  const slug = `${slugPrefix}${shortcode}`;
  const sourceUrl = `https://www.instagram.com/p/${shortcode}/`;
  const tags = [
    ...hashtagTags,
    ...(extraTag ? [extraTag] : []),
  ];

  // Copy media into public/, build entry, write JSON.
  if (classified.kind === 'photo') {
    const destDir = join(photosMediaDir, slug);
    const primaryDestName = `primary${classified.primary.ext}`;
    const publicPrimary = `/media/photos/${slug}/${primaryDestName}`;
    const extraPublic = classified.extras.map(f =>
      `/media/photos/${slug}/${f.name}`
    );

    const entry = {
      date,
      src: publicPrimary,
      ...(caption && { caption }),
      ...(tags.length > 0 && { tags }),
      source: 'instagram',
      sourceUrl,
      ...(extraPublic.length > 0 && { carouselExtras: extraPublic }),
      published: false,
    };

    console.log(`  PHOTO       ${slug}  ${date}  (${1 + classified.extras.length} item${classified.extras.length ? 's' : ''})`);
    if (write) {
      mkdirSync(destDir, { recursive: true });
      copyFileSync(classified.primary.path, join(destDir, primaryDestName));
      for (const f of classified.extras) {
        copyFileSync(f.path, join(destDir, f.name));
      }
      writeFileSync(
        join(photosOutDir, `${slug}.json`),
        JSON.stringify(entry, null, 2) + '\n',
        'utf8',
      );
    }
  } else {
    const destDir = join(videosMediaDir, slug);
    const primaryDestName = `${slug}${classified.primary.ext}`;
    const publicPrimary = `/media/videos/${slug}/${primaryDestName}`;
    const posterDestName = classified.poster ? `${slug}${classified.poster.ext}` : null;
    const publicPoster = posterDestName ? `/media/videos/${slug}/${posterDestName}` : undefined;
    const extraPublic = classified.extras.map(f =>
      `/media/videos/${slug}/${f.name}`
    );

    const entry = {
      title: `Instagram post ${shortcode}`,
      date,
      localSrc: publicPrimary,
      ...(publicPoster && { poster: publicPoster }),
      ...(caption && { summary: caption }),
      ...(tags.length > 0 && { tags }),
      kind: 'other',
      sourceUrl,
      ...(extraPublic.length > 0 && { carouselExtras: extraPublic }),
      published: false,
    };

    console.log(`  VIDEO       ${slug}  ${date}  (${1 + classified.extras.length} item${classified.extras.length ? 's' : ''})`);
    if (write) {
      mkdirSync(destDir, { recursive: true });
      copyFileSync(classified.primary.path, join(destDir, primaryDestName));
      if (classified.poster && posterDestName) {
        copyFileSync(classified.poster.path, join(destDir, posterDestName));
      }
      for (const f of classified.extras) {
        copyFileSync(f.path, join(destDir, f.name));
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
console.log(`SKIP-PARSE:      ${skippedParseError}`);
if (!write) {
  console.log();
  console.log('dry-run; re-run with --write to commit changes.');
}
