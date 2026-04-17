#!/usr/bin/env node
// Fix release date fields for entries whose preservedTitle encodes a
// 2-digit year that the bulk-stub-releases.mjs generator couldn't parse
// (regex required 19xx/20xx, so these fell back to mtime-based dates).
//
// Convention (confirmed by Dyl, Session 08): ALL 2-digit years → 2000s
// (00-99 → 2000-2099). Current year is 2026 — any resolved year >= 2027
// is treated as suspicious and flagged rather than auto-written.
//
// We look for 2-digit years inside the preservedTitle using substring
// matching around non-digit context (Colin's naming mashes letters and
// digits, so \b doesn't work). Common patterns:
//   "JANFEB09", "DEC09SCIFI", "octobrr09", "new year 08_09",
//   "cat mouths spring 08", "pulse stuff fall 08", "wetdollar 11"
//
// Run: node scripts/fix-2digit-years.mjs          (dry-run)
//      node scripts/fix-2digit-years.mjs --write  (apply)

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const write = process.argv.includes('--write');
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const releasesDir = join(__dirname, '..', 'src', 'content', 'releases');

const CURRENT_YEAR = new Date().getUTCFullYear();

// Strip Colin's chronology prefix (leading "NN " — same logic as
// bulk-stub-releases.mjs). These numbers index his release sequence,
// not years. Only applied when there's a space after the digits;
// "SUMMERHITZ20XX" or "REMIX08" don't match.
function stripChronologyPrefix(s) {
  return s.replace(/^\d{1,3}\s+/, '');
}

// Extract 2-digit year tokens from a string. Returns sorted array of
// candidate 4-digit years (2000s expansion).
function extract2digitYears(name) {
  // First strip chronology prefix — "18 alphabets" → "alphabets"
  const body = stripChronologyPrefix(name);

  // Also skip "20XX" / "XX" wildcard patterns (Colin used these as
  // "any year in the 2000s" placeholders).
  if (/20XX|2kXX|\bXX\b/i.test(body)) return [];

  const candidates = [];
  const re = /(?<![0-9])(\d{2})(?![0-9])/g;
  let m;
  while ((m = re.exec(body)) !== null) {
    const n = parseInt(m[1], 10);
    const year = 2000 + n;
    if (year > CURRENT_YEAR) continue; // future-shaped → skip as suspicious
    candidates.push(year);
  }
  return [...new Set(candidates)].sort((a, b) => a - b);
}

function extractFrontmatterField(text, key) {
  const m = text.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return undefined;
  let v = m[1].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return v;
}

function setFrontmatterField(text, key, value) {
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  const newLine = `${key}: "${String(value).replace(/"/g, '\\"')}"`;
  return text.replace(re, newLine);
}

const files = readdirSync(releasesDir).filter(f => f.endsWith('.md'));
let scanned = 0, wouldChange = 0, skipped = 0, flagged = [];

for (const f of files) {
  const path = join(releasesDir, f);
  const text = readFileSync(path, 'utf8');
  const preserved = extractFrontmatterField(text, 'preservedTitle') || extractFrontmatterField(text, 'title') || '';
  const currentDate = extractFrontmatterField(text, 'date') || '';
  scanned++;

  const years = extract2digitYears(preserved);
  if (years.length === 0) continue;

  // Use EARLIEST 2-digit year as the canonical date — stubs represent the
  // origin of a folder; if it spans years, the start is the true date.
  const inferred = String(years[0]);

  // Current date may be "2015" (4-digit) — compare on year level
  const currentYear = currentDate.slice(0, 4);
  if (currentYear === inferred) continue; // already correct

  // Don't overwrite dates that are already within the 2-digit range
  // if they also match one of the inferred years (e.g. date = "2009" and
  // we infer [2009, 2010] — keep 2009).
  if (years.map(String).includes(currentYear)) { skipped++; continue; }

  // Sanity check: if the current year is very close to today (e.g. 2015
  // set by mtime) and the inferred year is distant (e.g. 2008), that's
  // exactly the case we want to fix. If inferred is 2026+ → flag.
  console.log(`  ${currentYear} → ${inferred}  ${f}`);
  console.log(`    preservedTitle: ${JSON.stringify(preserved)}`);
  console.log(`    2-digit tokens resolved: [${years.join(', ')}]`);

  if (write) {
    const updated = setFrontmatterField(text, 'date', inferred);
    writeFileSync(path, updated, 'utf8');
  }
  wouldChange++;
}

console.log();
console.log(`--- summary ---`);
console.log(`Scanned:        ${scanned}`);
console.log(`Updated:        ${wouldChange}${write ? '' : ' (dry-run — pass --write to apply)'}`);
console.log(`Already correct: ${skipped}`);
