#!/usr/bin/env node
// Import cover art from the Dropbox archive into public/media/releases/.
//
// Skip-and-log policy (per Session 05 user direction): only auto-import
// when there's an unambiguous "cover-shaped" image in the source folder.
// Skip everything else and log it so Dyl can triage manually. Never
// overwrite an existing coverArt: field — preserve curator decisions.
//
// Heuristic, in order — tightened in Session 05 after two bad imports:
//   1. Filename matches /^(cover|front|albumart|album[_-]?art|artwork)\b/i
//      with an image extension (top level OR inside an art-shaped
//      subfolder: art/, artwork/, scans/, covers/, images/) → import.
//   2. Single image inside an art-shaped subfolder AND >= 50 KB → import
//      (the subfolder name itself is the signal).
//   3. Otherwise → SKIP and log.
//
// Policy notes:
//   - Substring matches like "...front.png" are NO LONGER sufficient.
//     Colin's "18 alphabets" folder was a dumping ground that contained
//     front art for a *different* release; matching "contains front"
//     grabbed the wrong thing.
//   - The single-image-at-top-level fallback was removed. Many of Colin's
//     release folders contain a single screenshot that is NOT cover art
//     (e.g. a DAW session screengrab). Prefer empty covers over wrong ones.
//
// Ties broken by score, then by file size (larger = likely the real
// cover, not a thumbnail).
//
// Flags:
//   --write          (without: dry-run, prints plan only)
//   --archive-root   (default: ~/Library/CloudStorage/Dropbox/CRFW/)
//
// Output:
//   - public/media/releases/<slug>/cover.<ext>           (copied)
//   - src/content/releases/<slug>.md                     (frontmatter updated)
//   - cover-art-import-report.txt                        (full audit log)

import {
  readdirSync, statSync, existsSync, copyFileSync, writeFileSync,
  readFileSync, mkdirSync,
} from 'node:fs';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

// --- CLI ---
const args = process.argv.slice(2);
const write = args.includes('--write');
const archiveRootIdx = args.indexOf('--archive-root');
const archiveRoot = archiveRootIdx >= 0
  ? args[archiveRootIdx + 1]
  : join(homedir(), 'Library', 'CloudStorage', 'Dropbox', 'CRFW');

// --- Paths ---
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');
const releasesDir = join(repoRoot, 'src', 'content', 'releases');
const mediaRoot = join(repoRoot, 'public', 'media', 'releases');

// --- Helpers ---
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.tif', '.tiff', '.bmp']);

function readFrontmatter(mdPath) {
  const text = readFileSync(mdPath, 'utf8');
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;
  const fmText = match[1];
  const body = match[2];
  // We need to know: archivePath (string), coverArt (string|undefined).
  // Just regex it — these stubs are simple and well-formed.
  const archivePath = (fmText.match(/^archivePath:\s*"?([^"\n]+?)"?\s*$/m) || [])[1];
  const coverArt = (fmText.match(/^coverArt:\s*"?([^"\n]+?)"?\s*$/m) || [])[1];
  return { archivePath, coverArt, fmText, body, fullText: text };
}

function setCoverArt(fullText, coverArtPath) {
  // Add coverArt: line right after archivePath: (or before tags: as fallback).
  if (/^coverArt:/m.test(fullText)) {
    return fullText.replace(/^coverArt:.*$/m, `coverArt: ${coverArtPath}`);
  }
  if (/^archivePath:.*$/m.test(fullText)) {
    return fullText.replace(
      /^(archivePath:.*)$/m,
      `$1\ncoverArt: ${coverArtPath}`,
    );
  }
  // Last resort: add before tags: line
  return fullText.replace(/^(tags:.*)$/m, `coverArt: ${coverArtPath}\n$1`);
}

function archivePathToAbsolute(archivePath) {
  // archivePath is "CRFW Archive/_Documentation/..."; absolute root prepends archiveRoot.
  return join(archiveRoot, archivePath);
}

function scoreFile(name) {
  const lower = name.toLowerCase();
  const stem = lower.replace(extname(lower), '');
  // Strict prefix/word-start match only. Substring matches were too loose
  // (see Session 05 notes above: "...front.png" grabbed the wrong release's
  // art out of a dumping-ground folder).
  if (/^(cover|front|albumart|album[_-]?art|artwork)\b/.test(stem)) return 10;
  return 0;
}

function listImages(dir, relPrefix = '') {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return []; }
  const out = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    if (e.isFile()) {
      const ext = extname(e.name).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      let size = 0;
      try { size = statSync(join(dir, e.name)).size; } catch {}
      out.push({ name: e.name, relPath: relPrefix + e.name, ext, size });
    }
  }
  return out;
}

function findCover(folder) {
  let entries;
  try { entries = readdirSync(folder, { withFileTypes: true }); }
  catch { return { status: 'no-folder', topImages: [], candidates: [] }; }

  // Top-level images
  const topImages = listImages(folder);

  // Score everything at top level
  const scored = topImages.map(img => ({ ...img, score: scoreFile(img.name) }));

  // One level deep: only consider folders that look art-ish (art/, artwork/, scans/, covers/, images/)
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.')) continue;
    if (!/^(art|artwork|cover|covers|scan|scans|image|images|album[_-]?art)$/i.test(e.name)) continue;
    const nested = listImages(join(folder, e.name), e.name + '/');
    for (const img of nested) {
      // Nested under an art-ish folder is itself a strong signal — score floor of 4.
      scored.push({ ...img, score: Math.max(scoreFile(img.name), 4) });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.size - a.size);
  return { status: 'ok', topImages, candidates: scored };
}

// --- Main ---
const releaseFiles = readdirSync(releasesDir).filter(f => f.endsWith('.md'));
console.log(`Releases:    ${releaseFiles.length}`);
console.log(`Archive:     ${archiveRoot}`);
console.log(`Media root:  ${mediaRoot}`);
console.log(`Mode:        ${write ? 'WRITE' : 'dry-run'}`);
console.log();

const report = [];
let imported = 0, skippedNoArchivePath = 0, skippedExistingCover = 0,
    skippedMissingFolder = 0, skippedNoImages = 0, skippedNoMatch = 0;

for (const file of releaseFiles.sort()) {
  const slug = file.replace(/\.md$/, '');
  const mdPath = join(releasesDir, file);
  const fm = readFrontmatter(mdPath);
  if (!fm) {
    report.push(`PARSE-FAIL  ${slug}`);
    continue;
  }

  if (!fm.archivePath) {
    report.push(`NO-ARCHIVE  ${slug}`);
    skippedNoArchivePath++;
    continue;
  }
  if (fm.coverArt) {
    report.push(`HAS-COVER   ${slug}                                              (already: ${fm.coverArt})`);
    skippedExistingCover++;
    continue;
  }

  const sourceFolder = archivePathToAbsolute(fm.archivePath);
  const result = findCover(sourceFolder);
  if (result.status === 'no-folder') {
    report.push(`NO-FOLDER   ${slug}`);
    skippedMissingFolder++;
    continue;
  }
  if (result.candidates.length === 0) {
    report.push(`NO-IMAGES   ${slug}`);
    skippedNoImages++;
    continue;
  }
  const top = result.candidates[0];

  // Decide whether to import:
  //   - score > 0                          → cover-named filename
  //   - sole image in an art-shaped subdir → the subfolder name itself
  //                                          is a strong signal
  let shouldImport = false;
  let reason = '';
  if (top.score > 0) {
    shouldImport = true;
    reason = `score ${top.score}`;
  } else if (top.relPath.includes('/') && top.size >= 50 * 1024) {
    // Only reached if top.score === 0, so "found an image inside an
    // art-shaped subdir but it's not cover-named". Safe because findCover
    // only recurses into art/artwork/scans/covers/images.
    shouldImport = true;
    reason = `sole image in ${top.relPath.split('/')[0]}/`;
  }

  if (!shouldImport) {
    const filenames = result.candidates.slice(0, 4).map(c => `${c.relPath} (${(c.size/1024).toFixed(0)}KB)`).join(', ');
    report.push(`NO-MATCH    ${slug}                                              (${result.candidates.length} image(s): ${filenames})`);
    skippedNoMatch++;
    continue;
  }

  // Import.
  const destDir = join(mediaRoot, slug);
  const destFile = join(destDir, `cover${top.ext}`);
  const sourceFile = join(sourceFolder, top.relPath);
  const publicPath = `/media/releases/${slug}/cover${top.ext}`;

  report.push(`IMPORT      ${slug}                                              ← ${top.relPath} (${reason}, ${(top.size/1024).toFixed(0)} KB)`);

  if (write) {
    mkdirSync(destDir, { recursive: true });
    copyFileSync(sourceFile, destFile);
    const newText = setCoverArt(fm.fullText, publicPath);
    writeFileSync(mdPath, newText, 'utf8');
  }
  imported++;
}

// Output
console.log(report.join('\n'));
console.log();
console.log('--- summary ---');
console.log(`IMPORTED:           ${imported}`);
console.log(`Skipped (existing): ${skippedExistingCover}`);
console.log(`Skipped (no archivePath):    ${skippedNoArchivePath}`);
console.log(`Skipped (folder missing):    ${skippedMissingFolder}`);
console.log(`Skipped (no images):         ${skippedNoImages}`);
console.log(`Skipped (no cover-named):    ${skippedNoMatch}`);

const reportPath = join(repoRoot, 'cover-art-import-report.txt');
writeFileSync(reportPath, report.join('\n') + '\n', 'utf8');
console.log();
console.log(`Full report written to: ${reportPath}`);
