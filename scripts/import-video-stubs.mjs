#!/usr/bin/env node
// Import video stub entries from the CRFW Archive into src/content/videos/.
//
// Source: ~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Videos/
// Structure: year folders (2008, 2009, ..., 2020) containing video files
//            and optional Whisper .txt transcripts.
//
// We DO NOT copy the video files into public/ (too large for git).
// Each video file becomes a JSON entry with title, date, archivePath,
// and optional transcript summary.
//
// Flags:
//   --write          (without: dry-run)
//   --limit N
//   --source <path>

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const write = args.includes('--write');
const limitIdx = args.indexOf('--limit');
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const sourceIdx = args.indexOf('--source');
const source = sourceIdx >= 0
  ? args[sourceIdx + 1]
  : join(homedir(), 'Library', 'CloudStorage', 'Dropbox', 'CRFW', 'CRFW Archive', '_Documentation', 'Videos');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, 'src', 'content', 'videos');
mkdirSync(outDir, { recursive: true });

const VIDEO_EXTS = new Set(['.mov', '.mp4', '.m4v', '.avi', '.mkv', '.webm']);

// Load existing release titles for project-matching heuristic
const releasesDir = join(repoRoot, 'src', 'content', 'releases');
const releaseIndex = new Map(); // lowercase title → project
if (existsSync(releasesDir)) {
  for (const f of readdirSync(releasesDir).filter(f => f.endsWith('.md'))) {
    const text = readFileSync(join(releasesDir, f), 'utf8');
    const title = (text.match(/^title:\s*"?([^"\n]+?)"?\s*$/m) || [])[1];
    const project = (text.match(/^project:\s*"?([^"\n]+?)"?\s*$/m) || [])[1];
    if (title && project) {
      releaseIndex.set(title.toLowerCase(), project);
    }
  }
}

function guessProject(filename) {
  const stem = filename.replace(extname(filename), '').toLowerCase();
  // Try exact match against release titles
  if (releaseIndex.has(stem)) return releaseIndex.get(stem);
  // Try substring match (e.g. "SIBERIAN CHILL" matching "siberian-chill")
  for (const [title, proj] of releaseIndex) {
    if (stem.includes(title) || title.includes(stem)) return proj;
  }
  return undefined; // will be omitted from JSON, Astro treats as optional
}

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function walkVideos(dir, yearDir, relPrefix) {
  const results = [];
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); }
  catch { return results; }

  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const fullPath = join(dir, e.name);

    if (e.isFile()) {
      const ext = extname(e.name).toLowerCase();
      if (!VIDEO_EXTS.has(ext)) continue;
      results.push({
        name: e.name,
        stem: e.name.replace(ext, ''),
        ext,
        dir,
        relPath: relPrefix + e.name,
        yearDir,
      });
    } else if (e.isDirectory()) {
      // One level of nesting (e.g. Videos_2014_CRFW/)
      results.push(...walkVideos(fullPath, yearDir, relPrefix + e.name + '/'));
    }
  }
  return results;
}

// --- Main ---
const yearFolders = readdirSync(source)
  .filter(f => /^\d{4}$/.test(f) && existsSync(join(source, f)))
  .sort();

console.log(`Source:       ${source}`);
console.log(`Year folders: ${yearFolders.join(', ')}`);
console.log(`Mode:         ${write ? 'WRITE' : 'dry-run'}`);
console.log();

const usedSlugs = new Set();
// Pre-populate with existing files
if (existsSync(outDir)) {
  for (const f of readdirSync(outDir)) {
    if (f.endsWith('.json')) usedSlugs.add(f.replace(/\.json$/, ''));
  }
}

let imported = 0;
let skipped = 0;

for (const yearDir of yearFolders) {
  if (imported >= limit) break;
  const yearPath = join(source, yearDir);
  const videos = walkVideos(yearPath, yearDir, '');

  for (const vid of videos) {
    if (imported >= limit) break;

    const title = vid.stem;
    // Check for matching transcript
    const txtPath = join(vid.dir, vid.stem + '.txt');
    const hasTranscript = existsSync(txtPath);

    // Dedupe slug
    let slug = slugify(`${yearDir}-${vid.stem}`);
    const baseSlug = slug;
    let n = 2;
    while (usedSlugs.has(slug)) {
      slug = `${baseSlug}-${n++}`;
    }
    usedSlugs.add(slug);

    const project = guessProject(vid.name);
    const archivePath = `CRFW Archive/_Documentation/Videos/${yearDir}/${vid.relPath}`;

    const entry = {
      title,
      date: yearDir,
      ...(project && { project }),
      kind: 'other',
      archivePath,
      tags: ['video'],
    };

    console.log(`  [${yearDir}] ${slug}.json  ← ${vid.relPath}${hasTranscript ? ' +txt' : ''}${project ? ` (${project})` : ''}`);

    if (write) {
      const outPath = join(outDir, `${slug}.json`);
      writeFileSync(outPath, JSON.stringify(entry, null, 2) + '\n', 'utf8');
    }
    imported++;
  }
}

console.log();
console.log(`--- summary ---`);
console.log(`IMPORTED:  ${imported}`);
console.log(`Slugs:     ${usedSlugs.size} total (including pre-existing)`);
