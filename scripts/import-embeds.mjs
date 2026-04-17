#!/usr/bin/env node
// Integrate curated embed data from data/embeds-snapshot.json into
// the content collections. Matches Bandcamp/YouTube/SoundCloud entries
// against existing releases and videos by normalized title + year.
//
// Source of truth: CRFW_Media_Embeds.xlsx (in Dropbox).
// To refresh after xlsx edits: python3 scripts/snapshot-xlsx.py first.
//
// Flags:
//   (no flags)         dry-run; prints the proposed matches + unmatched
//   --write            apply matches to content files
//   --source bandcamp  limit to Bandcamp rows (default: all three platforms)
//   --source youtube   limit to YouTube
//   --source soundcloud limit to SoundCloud
//
// Idempotency: never overwrites an existing non-empty embed field.
// Re-run after xlsx updates; only fields that are currently empty get
// populated.
//
// Matching score:
//   10  exact normalized-title match + same year
//    8  exact normalized-title match + year ±1
//    5  exact normalized-title match + any year
//    3  partial match (substring both directions) + same year
//    0  no match (logged for manual review)
// Threshold for auto-apply: score >= 5.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const write = args.includes('--write');
const createUnmatched = args.includes('--create-unmatched');
const sourceFilterIdx = args.indexOf('--source');
const sourceFilter = sourceFilterIdx >= 0 ? args[sourceFilterIdx + 1]?.toLowerCase() : null;

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repo = join(__dirname, '..');
const releasesDir = join(repo, 'src', 'content', 'releases');
const videosDir = join(repo, 'src', 'content', 'videos');
const snapshotPath = join(repo, 'data', 'embeds-snapshot.json');

if (!existsSync(snapshotPath)) {
  console.error(`Snapshot missing: ${snapshotPath}`);
  console.error(`Run: python3 scripts/snapshot-xlsx.py`);
  process.exit(2);
}

const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
const bandcampRows = snapshot.sheets['Bandcamp Releases'] || [];
const youtubeRows = snapshot.sheets['YouTube Videos'] || [];
const soundcloudRows = snapshot.sheets['SoundCloud Tracks'] || [];

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function normalize(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function parseYear(date) {
  if (!date) return null;
  const m = String(date).match(/(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}

// --- Frontmatter helpers (MD files) ---
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('No frontmatter');
  return { frontmatter: m[1], body: m[2] };
}

function getScalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return undefined;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return v;
}

function setScalar(fm, key, value) {
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  const quoted = `"${String(value).replace(/"/g, '\\"')}"`;
  const newLine = `${key}: ${quoted}`;
  if (re.test(fm)) return fm.replace(re, newLine);
  return fm.replace(/\n?$/, `\n${newLine}\n`);
}

// ---------------------------------------------------------------
// Load existing releases
// ---------------------------------------------------------------
const releases = [];
for (const f of readdirSync(releasesDir)) {
  if (!f.endsWith('.md')) continue;
  const path = join(releasesDir, f);
  const text = readFileSync(path, 'utf8');
  const { frontmatter, body } = splitFrontmatter(text);
  const title = getScalar(frontmatter, 'title') || '';
  const preservedTitle = getScalar(frontmatter, 'preservedTitle') || title;
  const date = getScalar(frontmatter, 'date') || '';
  const project = getScalar(frontmatter, 'project') || '';
  const bandcampUrl = getScalar(frontmatter, 'bandcampUrl');
  const bandcampItemId = getScalar(frontmatter, 'bandcampItemId');
  const year = parseYear(date);
  releases.push({
    slug: f.replace(/\.md$/, ''),
    path,
    title,
    preservedTitle,
    titleNorm: normalize(title),
    preservedNorm: normalize(preservedTitle),
    year,
    project,
    frontmatter,
    body,
    hasBandcampUrl: !!bandcampUrl,
    hasBandcampItemId: !!bandcampItemId,
  });
}

// ---------------------------------------------------------------
// Matching
// ---------------------------------------------------------------
function scoreCandidate(needle, year, candidate) {
  const n = normalize(needle);
  const titleMatch = n === candidate.titleNorm || n === candidate.preservedNorm;
  const substringMatch = !titleMatch && (
    (n.length >= 4 && (candidate.titleNorm.includes(n) || candidate.preservedNorm.includes(n))) ||
    (candidate.titleNorm.length >= 4 && (n.includes(candidate.titleNorm) || n.includes(candidate.preservedNorm)))
  );
  // For an exact title match, the candidate is structurally a match
  // regardless of year — years often differ between archive folder
  // (recording completion) and Bandcamp release date (upload). So
  // title match gives the base 5 points, year is a small boost, and
  // canonical-slug preference dominates year disagreements.
  const sameYear = year && candidate.year && year === candidate.year;
  const nearYear = year && candidate.year && Math.abs(year - candidate.year) === 1;
  // Bias STRONGLY toward canonical (non-suffixed) slugs.
  // court-clothes.md wins over court-clothes-2.md even when the
  // -2 variant's year matches exactly.
  const isCanonical = !/-\d+$/.test(candidate.slug);
  const canonicalBonus = isCanonical ? 3 : 0;
  // A richer content signal: canonical entries usually have a tracklist
  // or populated summary. Prefer them lightly (handled via canonicalBonus
  // approximately; we don't parse tracklists here).

  if (titleMatch) {
    // base 5 for title + small year contribution + canonical preference
    const yearBonus = sameYear ? 1.5 : nearYear ? 0.8 : 0;
    return 5 + yearBonus + canonicalBonus;
  }
  if (substringMatch && sameYear) return 3 + canonicalBonus;
  return 0;
}

function findBestMatch(needle, year) {
  let best = null;
  let bestScore = 0;
  let runnerUp = null;
  for (const c of releases) {
    const s = scoreCandidate(needle, year, c);
    if (s > bestScore) {
      runnerUp = best;
      best = c;
      bestScore = s;
    } else if (s === bestScore && s > 0) {
      runnerUp = c;
    }
  }
  return { match: best, score: bestScore, runnerUp };
}

// ---------------------------------------------------------------
// Apply Bandcamp embeds
// ---------------------------------------------------------------
const results = { applied: [], unmatched: [], ambiguous: [], skippedExisting: [] };

function applyBandcampToRelease(release, row) {
  let fm = release.frontmatter;
  const changes = [];

  const url = row.URL;
  const itemId = row['Bandcamp item_id'];
  const itemType = row.Type;

  if (url && !getScalar(fm, 'bandcampUrl')) {
    fm = setScalar(fm, 'bandcampUrl', url);
    changes.push(`bandcampUrl`);
  }
  if (itemId && !getScalar(fm, 'bandcampItemId')) {
    fm = setScalar(fm, 'bandcampItemId', String(itemId));
    changes.push(`bandcampItemId`);
  }
  if (itemType && !getScalar(fm, 'bandcampItemType')) {
    fm = setScalar(fm, 'bandcampItemType', itemType);
    changes.push(`bandcampItemType`);
  }

  if (!changes.length) return null;

  const updated = `---\n${fm.replace(/\n?$/, '\n')}---\n${release.body}`;
  return { updated, changes };
}

if (!sourceFilter || sourceFilter === 'bandcamp') {
  console.log(`--- Bandcamp matching (${bandcampRows.length} rows) ---\n`);
  for (const row of bandcampRows) {
    const title = row.Title;
    const year = parseYear(row['Release Date']);
    const { match, score, runnerUp } = findBestMatch(title, year);

    if (!match || score < 5) {
      results.unmatched.push({ platform: 'Bandcamp', title, year, row });
      console.log(`  UNMATCHED  ${title}  (${year ?? '?'})`);
      continue;
    }

    // If item_id already present, skip (don't rewrite)
    if (match.hasBandcampItemId) {
      results.skippedExisting.push({ title, slug: match.slug });
      continue;
    }

    const applied = applyBandcampToRelease(match, row);
    if (!applied) {
      results.skippedExisting.push({ title, slug: match.slug });
      continue;
    }

    const marker = score >= 8 ? '✓' : '~';
    console.log(`  ${marker} [score ${score}]  ${title} (${year}) → ${match.slug}.md  (${applied.changes.join(', ')})`);
    if (runnerUp && score < 10) {
      console.log(`      runner-up: ${runnerUp.slug}.md`);
    }
    results.applied.push({ platform: 'Bandcamp', slug: match.slug, score, changes: applied.changes });

    if (write) {
      writeFileSync(match.path, applied.updated, 'utf8');
    }
  }
}

// ---------------------------------------------------------------
// Create new release entries for unmatched Bandcamp rows
// ---------------------------------------------------------------
function slugify(s) {
  return String(s || '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}

function detectProject(row) {
  const url = String(row.URL || '').toLowerCase();
  if (url.includes('alphabets.bandcamp.com')) return 'alphabets';
  if (url.includes('killdby.bandcamp.com')) return 'killd by';
  return 'other';
}

function renderNewReleaseStub(row) {
  const title = row.Title;
  const year = parseYear(row['Release Date']);
  const fullDate = row['Release Date'] || String(year);
  const project = detectProject(row);
  const itemType = row.Type === 'track' ? 'single' : 'LP'; // tracks → "single"; albums default to LP
  const tracklist = row.Tracklist;

  // Parse tracklist like "1. Title\n2. Title\n..."
  const tracks = [];
  if (tracklist && typeof tracklist === 'string') {
    for (const line of tracklist.split('\n')) {
      const m = line.match(/^(\d+)\.\s+(.+)$/);
      if (m) tracks.push({ n: parseInt(m[1], 10), title: m[2].trim() });
    }
  }

  let fm = `---
title: "${title.replace(/"/g, '\\"')}"
preservedTitle: "${title.replace(/"/g, '\\"')}"
project: "${project}"
date: "${fullDate}"
format: ${itemType === 'single' ? 'single' : 'LP'}
bandcampUrl: "${row.URL}"
bandcampItemId: "${row['Bandcamp item_id']}"
bandcampItemType: "${row.Type}"
tags:
  - ${project.replace(/\s+/g, '-')}
  - bandcamp
  - needs-review
summary: ""
published: false
`;
  if (tracks.length) {
    fm += `tracklist:\n`;
    for (const t of tracks) {
      fm += `  - n: ${t.n}\n    title: "${t.title.replace(/"/g, '\\"')}"\n`;
    }
  }
  fm += `---\n\nStub entry — created from Bandcamp embed catalog\n(CRFW_Media_Embeds.xlsx). Matches no existing archive folder.\n\nReview: confirm this is a real canonical release, update project\nif needed, fill in summary, then flip published to true.\n`;
  return fm;
}

if (createUnmatched && !sourceFilter || sourceFilter === 'bandcamp') {
  const unmatchedBC = results.unmatched.filter(u => u.platform === 'Bandcamp');
  if (unmatchedBC.length && createUnmatched) {
    console.log(`\n--- Creating ${unmatchedBC.length} new release entries from unmatched Bandcamp rows ---`);
    for (const u of unmatchedBC) {
      const slug = slugify(u.title);
      const outPath = join(releasesDir, `${slug}.md`);
      if (existsSync(outPath)) {
        console.log(`  ! slug collision ${slug}.md — skipping`);
        continue;
      }
      const content = renderNewReleaseStub(u.row);
      console.log(`  + NEW  ${slug}.md  ← ${u.title} (${u.year})`);
      if (write) writeFileSync(outPath, content, 'utf8');
    }
  }
}

// ---------------------------------------------------------------
// Summary
// ---------------------------------------------------------------
console.log(`\n--- summary ---`);
console.log(`Applied:           ${results.applied.length}`);
console.log(`Skipped (existing):${results.skippedExisting.length}`);
console.log(`Unmatched:         ${results.unmatched.length}`);
if (results.unmatched.length > 0) {
  console.log(`\nUnmatched rows (review):`);
  for (const u of results.unmatched) {
    console.log(`  - [${u.platform}] "${u.title}" ${u.year ?? '(no year)'}  → ${u.row.URL || ''}`);
  }
}

console.log();
console.log(write ? 'WRITE mode — files updated.' : 'DRY-RUN — pass --write to apply.');
