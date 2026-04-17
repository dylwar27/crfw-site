#!/usr/bin/env node
// Bulk-stub release entries by walking a project folder in the CRFW Archive.
//
// Rules (see CLAUDE.md golden rules + HANDOFF_PROMPT.md second-session spec):
//   - One .md file in src/content/releases/ per subfolder.
//   - preservedTitle = folder name verbatim (Colin's typography).
//   - title         = folder name with leading "\d+\s+" stripped (his
//                     chronology prefix). No other "cleanup" — that would
//                     violate golden rule #2.
//   - slug          = lowercased, non-alphanumerics → "-", deduped with
//                     "-2", "-3" suffixes.
//   - date          = earliest year token in folder name if any, else
//                     oldest-file mtime year inside the folder. YYYY only.
//   - format        = inferred from folder name keywords first, then audio
//                     file count. Falls back to "other".
//   - archivePath   = archive-relative ("CRFW Archive/...") with trailing /.
//   - summary       = empty (golden rule #6: no AI-generated summaries).
//   - tags          = [project, ...any heuristic tags].
//
// Flags:
//   --project "killd by" | "alphabets" | ...   (required)
//   --source <absolute-dir>                     (required; the folder to walk)
//   --archive-relative <path>                   (required; prefix for archivePath,
//                                                e.g. "CRFW Archive/_Documentation/Music/KB/killd by")
//   --skip <folder-name>                        (repeatable; folders with an
//                                                existing canonical entry)
//   --limit N                                   (optional; first N only)
//   --only <folder-name>                        (optional; only this folder)
//   --write                                     (without: dry-run, prints plan)
//
// Exits non-zero on schema validation concerns (e.g. unparseable date for a
// folder with no year and no audio file with a readable mtime).

import { readdirSync, statSync, existsSync, writeFileSync, readFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- CLI ---
const args = process.argv.slice(2);
const getFlag = (name, { repeat = false, boolean = false } = {}) => {
  const values = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === `--${name}`) {
      if (boolean) { values.push(true); continue; }
      values.push(args[++i]);
    }
  }
  if (boolean) return values.length > 0;
  if (repeat) return values;
  return values[0];
};

const project = getFlag('project');
const source = getFlag('source');
const archiveRelative = getFlag('archive-relative');
const skips = new Set(getFlag('skip', { repeat: true }));
const limit = getFlag('limit') ? parseInt(getFlag('limit'), 10) : Infinity;
const only = getFlag('only');
const write = getFlag('write', { boolean: true });

if (!project || !source || !archiveRelative) {
  console.error('Missing required flag. See script header for usage.');
  process.exit(2);
}
if (!existsSync(source)) {
  console.error(`Source does not exist: ${source}`);
  process.exit(2);
}

// --- Repo paths ---
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, 'src', 'content', 'releases');
mkdirSync(outDir, { recursive: true });

// --- Helpers ---
const AUDIO_EXTS = new Set(['.wav', '.aif', '.aiff', '.mp3', '.m4a', '.flac', '.ogg', '.aac']);
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.tif', '.tiff', '.webp', '.bmp']);

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'untitled';
}

function stripLeadingNumber(s) {
  return s.replace(/^\d+\s+/, '');
}

const CURRENT_YEAR = new Date().getUTCFullYear();

function earliestYear(folderName) {
  // Non-digit context rather than \b, since Colin's folder names mash letters
  // and digits together ("B-SIDES2017", "Recovery4Burn") — \b fails there.
  // Cap at the current year — Colin sometimes used future-sounding numbers
  // as titles ("2046AD" is a Wong Kar-wai reference, not a release year).
  const years = [...folderName.matchAll(/(?<!\d)(?:19|20)\d{2}(?!\d)/g)]
    .map(m => parseInt(m[0], 10))
    .filter(y => y <= CURRENT_YEAR);
  if (years.length === 0) return null;
  return Math.min(...years);
}

function walkFiles(dir, depth = 0) {
  if (depth > 6) return [];
  let out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      out = out.concat(walkFiles(p, depth + 1));
    } else if (e.isFile()) {
      out.push(p);
    }
  }
  return out;
}

function guessFormat(folderName, audioCount) {
  const n = folderName.toLowerCase();
  // Word boundaries are dropped — Colin's naming doesn't honor them
  // ("Recovery4Burn", "RcvryDrafts", "B-SIDES2017").
  // Order matters: check stage/variant markers before generic audio-count heuristic.
  if (/(draft|rough|premaster|pre-master|4burn|wavs?\b|final)/i.test(folderName)) return 'demo';
  if (/(b-?sides|outcasts)/i.test(folderName)) return 'b-sides';
  if (/(fullmix|full-mix|continuous|[^a-z]mix[^a-z]|^mix|mix$)/i.test(folderName) && !/remix/i.test(folderName)) return 'mix';
  if (/compilation|\bcomp\b/i.test(folderName)) return 'compilation';
  if (audioCount >= 8) return 'LP';
  if (audioCount >= 3) return 'EP';
  if (audioCount >= 1) return 'single';
  return 'other';
}

function heuristicTags(folderName, project) {
  const tags = new Set();
  tags.add(project.replace(/\s+/g, '-'));
  // Substring matching (see guessFormat note re: word boundaries).
  if (/(draft|rough)/i.test(folderName)) tags.add('drafts');
  if (/(premaster|pre-master)/i.test(folderName)) tags.add('pre-master');
  if (/4burn|4-burn/i.test(folderName)) tags.add('burn-stage');
  if (/wavs?\b/i.test(folderName)) tags.add('wav-dump');
  if (/(b-?sides|outcasts)/i.test(folderName)) tags.add('b-sides');
  if (/(fullmix|full-mix|[^a-z]mix[^a-z]|^mix|mix$)/i.test(folderName) && !/remix/i.test(folderName)) tags.add('mix');
  if (/(noiz|atmo)/i.test(folderName)) tags.add('noiz-atmo');
  if (/live/i.test(folderName)) tags.add('live');
  if (/demo/i.test(folderName)) tags.add('demo');
  return [...tags];
}

function yamlScalar(s) {
  // Always quote: safest. Escape embedded double quotes.
  return `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function renderStub({ title, preservedTitle, project, date, format, archivePath, tags }) {
  const tagBlock = tags.map(t => `  - ${t}`).join('\n');
  return `---
title: ${yamlScalar(title)}
preservedTitle: ${yamlScalar(preservedTitle)}
project: ${yamlScalar(project)}
date: ${yamlScalar(date)}
format: ${format}
archivePath: ${yamlScalar(archivePath)}
tags:
${tagBlock}
summary: ""
published: false
---

Stub entry — folder preserved from the archive. Summary intentionally empty
(per CLAUDE.md golden rule #6: no AI-generated summaries of Colin's work).
`;
}

// --- Main ---
const folders = readdirSync(source, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith('.'))
  .map(e => e.name)
  .sort();

console.log(`Source:    ${source}`);
console.log(`Project:   ${project}`);
console.log(`Total:     ${folders.length} subfolders`);
console.log(`Skip:      ${[...skips].join(', ') || '(none)'}`);
console.log(`Mode:      ${write ? 'WRITE' : 'dry-run'}`);
console.log();

const usedSlugs = new Set();
// Pre-populate with existing file basenames so we don't collide with them.
for (const f of readdirSync(outDir)) {
  if (f.endsWith('.md')) usedSlugs.add(f.replace(/\.md$/, ''));
}

let written = 0;
let planned = 0;
const plan = [];

for (const folderName of folders) {
  if (only && folderName !== only) continue;
  if (skips.has(folderName)) {
    plan.push({ folderName, status: 'SKIP (existing canonical entry)' });
    continue;
  }
  if (planned >= limit) break;

  const folderPath = join(source, folderName);
  const files = walkFiles(folderPath);
  const audioCount = files.filter(f => AUDIO_EXTS.has(f.slice(f.lastIndexOf('.')).toLowerCase())).length;

  // Date: folder-name year first, else oldest file mtime year
  let year = earliestYear(folderName);
  let dateSource = year != null ? 'folder-name' : null;
  if (year == null) {
    const mtimes = files.map(f => {
      try { return statSync(f).mtimeMs; } catch { return null; }
    }).filter(m => m != null);
    if (mtimes.length > 0) {
      year = new Date(Math.min(...mtimes)).getUTCFullYear();
      dateSource = 'oldest-file-mtime';
    }
  }
  if (year == null) {
    // Fallback: use folder mtime
    try {
      year = new Date(statSync(folderPath).mtimeMs).getUTCFullYear();
      dateSource = 'folder-mtime';
    } catch {
      plan.push({ folderName, status: 'ERROR: no date signal available' });
      continue;
    }
  }
  const date = String(year);

  const title = stripLeadingNumber(folderName);
  const preservedTitle = folderName;
  const format = guessFormat(folderName, audioCount);
  const tags = heuristicTags(folderName, project);
  const archivePath = `${archiveRelative.replace(/\/$/, '')}/${folderName}/`;

  // Dedupe slug
  let slug = slugify(folderName);
  let n = 2;
  const baseSlug = slug;
  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${n++}`;
  }
  usedSlugs.add(slug);

  const outPath = join(outDir, `${slug}.md`);
  const stub = renderStub({ title, preservedTitle, project, date, format, archivePath, tags });

  plan.push({
    folderName,
    slug,
    date,
    dateSource,
    format,
    audioCount,
    outPath: outPath.replace(repoRoot + '/', ''),
    status: write ? 'WRITE' : 'plan',
  });
  planned++;

  if (write) {
    writeFileSync(outPath, stub, 'utf8');
    written++;
  }
}

// Report
const rows = plan.map(p =>
  p.status.startsWith('SKIP') || p.status.startsWith('ERROR')
    ? `  ${p.status.padEnd(42)} ${p.folderName}`
    : `  [${p.format.padEnd(10)}] ${p.date} (${p.dateSource}, ${p.audioCount} audio)  ${p.slug}.md   ← ${p.folderName}`
);
console.log(rows.join('\n'));
console.log();
console.log(`Summary: ${planned} planned, ${written} written, ${plan.filter(p => p.status.startsWith('SKIP')).length} skipped, ${plan.filter(p => p.status.startsWith('ERROR')).length} errors.`);
