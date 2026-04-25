#!/usr/bin/env node
// Import Colin Ward's visual art portfolio from the Cargo Collective export
// in the CRFW Archive into the site's `photos` collection (with `visual-art` tag).
//
// Two coordinated sources:
//   1. Metadata catalog: _Documentation/portfolio/cargocollective_killdby/<project>.md
//      Each .md has `# title`, `## Page content` description prose, `## Images`
//      list of payload URLs.
//   2. Local files: _Documentation/artwork/cargo_collective/<project>/<filename>
//      Image files actually present on disk (subset of the .md "Images" lists).
//
// Filename pattern: `{cargoId}__{TITLE}_{resolution}{_2x?}.{ext}`
//   - Multiple resolution variants per piece — keep the largest pixel-count.
//   - Cargo "responsive thumbnails" matching `^\d+__prt_\d+x\d+_\d+(_2x)?\.\w+$`
//     are cross-listing previews of OTHER projects on each project's page.
//     Filter these out — they're not real artworks.
//
// Output:
//   - photos entries at src/content/photos/va-<cargoId>-<title-slug>.json
//     (slug prefix `va-` distinguishes visual art from IG photos at a glance)
//   - canonical image at public/media/visual-art/<slug>/primary.<ext>
//   - All entries `published: true` (the source is Colin's public Cargo Collective
//     portfolio — already-public art; curator can hide individual pieces if needed)
//
// Year extraction (in priority order):
//   1. Filename token like `F2014` or `Screen-Shot-(\d{4})`
//   2. Cargo Unix timestamp suffix (e.g., `_1442454741`)
//   3. Era default per subfolder
//
// Project field: alphabets-archive → "alphabets", killd-by-* → "killd by",
// otherwise no project (just tags).
//
// Dry-run by default; pass --write to apply.

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, copyFileSync, statSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const ARCHIVE_ROOT = '/Users/dward/Library/CloudStorage/Dropbox/CRFW/CRFW Archive';

const PORTFOLIO_DIR = join(ARCHIVE_ROOT, '_Documentation/portfolio/cargocollective_killdby');
const ARTWORK_DIR = join(ARCHIVE_ROOT, '_Documentation/artwork/cargo_collective');

const WRITE = process.argv.includes('--write');

// ── Subproject → project field + era default ──────────────────────────────────
const SUBPROJECT_META = {
  'alphabets-archive': { project: 'alphabets', eraDefaultYear: 2010 },
  'killd-by-music':    { project: 'killd by', eraDefaultYear: 2014 },
  'killd-by-videos':   { project: 'killd by', eraDefaultYear: 2015 },
  'Tha-Mayoreo-Show':  { project: null,        eraDefaultYear: 2016 },
  'generation-zebra-Posters-music-C-D-Release-labeL': { project: null, eraDefaultYear: 2015 },
  'art-posters-painting': { project: null,     eraDefaultYear: 2014 },
};

// ── Parse a Cargo .md file for project metadata ───────────────────────────────
function parseProjectMd(mdPath) {
  if (!existsSync(mdPath)) return null;
  const text = readFileSync(mdPath, 'utf8');
  const titleMatch = text.match(/^#\s+(.+)$/m);
  const sourceMatch = text.match(/^Source:\s+(\S+)/m);
  // Split sections on H2 headings; pull just the "Page content" section.
  const sections = text.split(/^##\s+/m);
  let pageContent = '';
  for (const s of sections) {
    if (s.startsWith('Page content')) {
      pageContent = s.replace(/^Page content\s*\n/, '').trim();
      break;
    }
  }
  return {
    title: titleMatch ? titleMatch[1].trim() : null,
    sourceUrl: sourceMatch ? sourceMatch[1].trim() : null,
    pageContent,
  };
}

// ── Parse on-disk filename ────────────────────────────────────────────────────
const RE_THUMB = /^\d+__prt_\d+x\d+_\d+(_2x)?\.(jpg|png|jpeg)$/i;
const RE_FILE = /^(\d+)__(.+?)(?:_(\d+)(?:_(c|2x))?)?\.(jpg|png|jpeg)$/i;

// We need to handle multiple suffix patterns:
//   AIRPORT_1000.jpg            → base=AIRPORT, res=1000
//   AIRPORT_1600_c.jpg          → base=AIRPORT, res=1600, variant=c
//   AIRPORT_1600_c_2x.jpg       → base=AIRPORT, res=1600_c, variant=2x  (rare)
//   prt_275x275_1442454741.jpg  → THUMB (skipped)
//   Screen-Shot-2015-08-16-at-7.25.23-AM_764.png → base="Screen-Shot-...AM", res=764
function parseArtworkFilename(filename) {
  if (RE_THUMB.test(filename)) return null;  // Cargo responsive thumb — skip

  // Pull cargoId, the rest, extension
  const m = filename.match(/^(\d+)__(.+?)\.(jpg|png|jpeg)$/i);
  if (!m) return null;
  const cargoId = m[1];
  const stem = m[2];
  const ext = m[3].toLowerCase();

  // Strip a trailing "_2x" suffix if present (alternate density)
  let trimmed = stem;
  let isHiDpi = false;
  if (/_2x$/i.test(trimmed)) { trimmed = trimmed.replace(/_2x$/i, ''); isHiDpi = true; }
  // Strip a trailing "_c" suffix (cropped variant)
  let isCropped = false;
  if (/_c$/i.test(trimmed)) { trimmed = trimmed.replace(/_c$/i, ''); isCropped = true; }

  // Final segment is usually a resolution (3-5 digit pixel width)
  const resMatch = trimmed.match(/^(.+?)_(\d{2,5})$/);
  const base = resMatch ? resMatch[1] : trimmed;
  const resolution = resMatch ? parseInt(resMatch[2], 10) : 0;

  return { cargoId, base, resolution, isHiDpi, isCropped, ext, filename };
}

// ── Year extraction ───────────────────────────────────────────────────────────
function extractYear(parsed, subprojectMeta) {
  const base = parsed.base;
  // 1. Look for F2014, F2015 etc. in title
  const fYear = base.match(/F(20\d\d)/);
  if (fYear) return fYear[1];
  // 2. Screen-Shot-YYYY pattern
  const ssYear = base.match(/Screen-Shot-(20\d\d)/i);
  if (ssYear) return ssYear[1];
  // 3. Cargo Unix timestamp (10-digit number with leading 1)
  const tsMatch = base.match(/_?(1[3-7]\d{8})_?/);  // 2011–2024 range
  if (tsMatch) {
    const ts = parseInt(tsMatch[1], 10);
    const year = new Date(ts * 1000).getFullYear();
    if (year >= 2008 && year <= 2025) return String(year);
  }
  // 4. Era default per subfolder
  return String(subprojectMeta.eraDefaultYear);
}

// ── Slugify ───────────────────────────────────────────────────────────────────
function slugify(s) {
  return String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function cleanTitle(base) {
  return String(base)
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Walk one subproject ───────────────────────────────────────────────────────
function processSubproject(subfolder) {
  const meta = SUBPROJECT_META[subfolder];
  if (!meta) {
    console.warn(`[WARN] No SUBPROJECT_META for ${subfolder}; skipping.`);
    return [];
  }
  const projectMd = parseProjectMd(join(PORTFOLIO_DIR, `${subfolder}.md`));

  const folder = join(ARTWORK_DIR, subfolder);
  if (!existsSync(folder)) {
    console.warn(`[WARN] No on-disk folder for ${subfolder}`);
    return [];
  }
  const files = readdirSync(folder).filter(f => !f.startsWith('.'));
  const parsed = files.map(f => parseArtworkFilename(f)).filter(Boolean);

  // Group by (cargoId, base) and pick the largest resolution
  const groups = new Map();
  for (const p of parsed) {
    const key = `${p.cargoId}::${p.base}`;
    const existing = groups.get(key);
    if (!existing || p.resolution > existing.resolution || (p.resolution === existing.resolution && p.isHiDpi)) {
      groups.set(key, p);
    }
  }

  const entries = [];
  for (const [, parsed] of groups) {
    const title = cleanTitle(parsed.base);
    if (!title) continue;
    const year = extractYear(parsed, meta);
    const titleSlug = slugify(title);
    const slug = `va-${parsed.cargoId}-${titleSlug}`;

    const subfolderTag = slugify(subfolder);
    const tags = ['visual-art', subfolderTag];

    const entry = {
      slug,
      data: {
        title,
        date: year,
        src: `/media/visual-art/${slug}/primary.${parsed.ext}`,
        ...(meta.project ? { project: meta.project } : {}),
        ...(projectMd?.pageContent ? { caption: projectMd.pageContent.slice(0, 200).trim() } : {}),
        tags,
        source: 'archive',
        ...(projectMd?.sourceUrl ? { sourceUrl: projectMd.sourceUrl } : {}),
        archivePath: `CRFW Archive/_Documentation/artwork/cargo_collective/${subfolder}/${parsed.filename}`,
        published: true,
      },
      sourcePath: join(folder, parsed.filename),
      ext: parsed.ext,
    };
    entries.push(entry);
  }
  return entries;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const subprojects = readdirSync(ARTWORK_DIR).filter(s => {
  const p = join(ARTWORK_DIR, s);
  return statSync(p).isDirectory();
});

const allEntries = [];
const perSubproject = {};
for (const sp of subprojects) {
  const entries = processSubproject(sp);
  perSubproject[sp] = entries.length;
  allEntries.push(...entries);
}

console.log(`\n── Visual art import ${WRITE ? 'APPLY' : 'DRY-RUN'} ──`);
for (const [sp, n] of Object.entries(perSubproject)) {
  console.log(`  ${sp.padEnd(60)} ${n} entries`);
}
console.log(`  ─────────────────────────────────────────────────────────────`);
console.log(`  TOTAL${' '.repeat(56)}${allEntries.length} entries`);

if (allEntries.length === 0) {
  console.log(`\nNo entries to write. Check ARTWORK_DIR / PORTFOLIO_DIR paths.`);
  process.exit(1);
}

// Show 5 sample entries
console.log(`\n  Sample entries:`);
for (const e of allEntries.slice(0, 5)) {
  console.log(`    ${e.slug}: "${e.data.title}" (${e.data.date}) [${(e.data.tags || []).join(', ')}]`);
}

if (!WRITE) {
  console.log(`\nRun with --write to apply.`);
  process.exit(0);
}

// Apply: write JSON entries + copy media files
let writtenJson = 0;
let copiedMedia = 0;
let skippedExisting = 0;

const photosDir = join(REPO_ROOT, 'src/content/photos');
const mediaDir = join(REPO_ROOT, 'public/media/visual-art');

for (const e of allEntries) {
  const jsonPath = join(photosDir, `${e.slug}.json`);
  if (existsSync(jsonPath)) {
    skippedExisting++;
    continue;
  }
  writeFileSync(jsonPath, JSON.stringify(e.data, null, 2) + '\n');
  writtenJson++;

  // Copy media file
  const mediaTarget = join(mediaDir, e.slug, `primary.${e.ext}`);
  mkdirSync(dirname(mediaTarget), { recursive: true });
  if (!existsSync(mediaTarget)) {
    copyFileSync(e.sourcePath, mediaTarget);
    copiedMedia++;
  }
}

console.log(`\n  Wrote: ${writtenJson} new photo entries`);
console.log(`  Copied: ${copiedMedia} media files`);
console.log(`  Skipped (already existed): ${skippedExisting}`);
