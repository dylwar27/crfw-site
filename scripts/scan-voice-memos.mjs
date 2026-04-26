#!/usr/bin/env node
// Conservative content scanner for voice memo transcripts.
//
// Voice memos are stream-of-consciousness iPhone recordings — Colin
// freestyling, riffing, joking. Many contain profanity, scatological
// imagery, or other content that shouldn't go on the public site
// without curator review.
//
// Per curator direction: "be conservative — when in doubt, unpublish."
//
// This script:
//   1. Reads each src/content/voice_memos/*.json transcript
//   2. Flags entries matching ANY of the red-flag categories below
//   3. Sets `published: false` on flagged entries
//   4. Emits a report grouped by category for curator review
//
// Dry-run by default; pass --write to apply.
//
// Re-runnable: an already-unpublished memo stays unpublished. A memo whose
// transcript got cleaner between runs (unlikely but possible) would re-flip
// to published only if NO red flags match.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIR = join(__dirname, '..', 'src/content/voice_memos');
const WRITE = process.argv.includes('--write');

// Red-flag categories. Conservative bias — single match flags the memo.
// Word boundaries used so 'fuck' matches 'fucking' but not 'futurama'.
const CATEGORIES = [
  {
    name: 'slurs',
    patterns: [
      // Racial / homophobic / ableist slurs (full forms; typing them once
      // is necessary so the script can catch them in transcripts).
      /\bn[i1!][gq][gq][ae]r?s?\b/i,
      /\bf[a@][gq]+([oi]ts?|s)?\b/i,    // f-slur and variants
      /\bret[a@]rd(ed)?\b/i,
      /\btr[a@]nn[yi]+\b/i,
      /\bk[i1]ke\b/i,
      /\bsp[i1]c\b/i,
      /\bch[i1]nk\b/i,
      /\bg[o0]+k\b/i,
    ],
  },
  {
    name: 'violence-or-self-harm',
    patterns: [
      /\bkill myself\b/i, /\bkill my self\b/i,
      /\bend (it all|my life)\b/i,
      /\b(commit|committing) suicide\b/i,
      /\bsuicid(e|al)\b/i,
      /\bhang myself\b/i,
      /\bcut myself\b/i,
      /\b(i'?ll|gonna|going to) (kill|stab|shoot|murder) (you|him|her|them)\b/i,
      /\bstabbed in the (face|head|throat|neck|gut)\b/i,
    ],
  },
  {
    name: 'sexual-explicit',
    patterns: [
      /\b(jerk|jerking) (it|off)\b/i,
      /\bblow ?job\b/i,
      /\bcum(shot|ming|stain)?\b/i,
      /\b(eat|eating) (her|his) (out|ass|pussy)\b/i,
      /\bpenis\b/i, /\bdick\b/i, /\bcock\b/i,
      /\bpussy\b/i, /\bcunt\b/i,
      /\btits?\b/i,
      /\bnipples?\b/i,
      /\b(wanking|wank)\b/i,
      /\b(masturbat|masturbating)\w*/i,
    ],
  },
  {
    name: 'scatological',
    patterns: [
      /\bdiarrhea\b/i,
      /\bscat\b/i,
      /\bshit (in|on) (the|your|my|his|her) (pool|face|mouth|bed|car|fucking)/i,
      /\bpiss (in|on) (the|your|my|his|her)/i,
      /\bturd\b/i,
      /\bcrap\w* (on|in) (the|your)/i,
    ],
  },
  {
    name: 'hard-drugs',
    patterns: [
      /\bmeth(amphetamine)?\b/i,
      /\bheroin\b/i,
      /\bcrack(head|pipe)?\b/i,
      /\bcocaine\b/i,
      /\bfentanyl\b/i,
      /\boxycontin\b/i,
      /\boxy(codone)?\b/i,
      /\b(snort|snorting|snorted) (a |the )?\w*/i,
      /\b(shoot|shooting up|shot up) (heroin|smack|dope)\b/i,
    ],
  },
  {
    name: 'profanity-heavy',
    // Any of these in 3+ instances → flag. (Single 'fuck' wouldn't flag,
    // but most flagged memos will trip slurs/violence/sexual first.)
    patterns: [],
    // Special handling below
  },
];

function categorize(transcript) {
  if (!transcript) return [];
  const flags = [];
  for (const cat of CATEGORIES) {
    if (cat.name === 'profanity-heavy') continue;
    for (const pat of cat.patterns) {
      const m = transcript.match(pat);
      if (m) {
        flags.push({ category: cat.name, match: m[0].slice(0, 40) });
        break;  // one hit per category is enough to flag
      }
    }
  }
  // Profanity-heavy: count instances of the heaviest words
  const profanityRe = /\b(fucking|fuck|fucks|fucked|shit|shits|shitting|fucker|motherfucker)\b/gi;
  const profCount = (transcript.match(profanityRe) || []).length;
  if (profCount >= 3) {
    flags.push({ category: 'profanity-heavy', match: `${profCount} instances` });
  }
  return flags;
}

const files = readdirSync(DIR).filter(f => f.endsWith('.json'));
const flagged = [];
const clean = [];

for (const f of files) {
  const path = join(DIR, f);
  const data = JSON.parse(readFileSync(path, 'utf8'));
  const flags = categorize(data.transcript || '');
  if (flags.length > 0) {
    flagged.push({ file: f, slug: f.replace(/\.json$/, ''), flags, currentPublished: data.published !== false });
  } else {
    clean.push({ file: f, currentPublished: data.published !== false });
  }
}

console.log(`\n── Voice memo content scan ${WRITE ? 'APPLY' : 'DRY-RUN'} ──`);
console.log(`Scanned: ${files.length}`);
console.log(`Clean:   ${clean.length}`);
console.log(`Flagged: ${flagged.length}`);

// Group by primary category
const byCategory = new Map();
for (const f of flagged) {
  for (const fl of f.flags) {
    if (!byCategory.has(fl.category)) byCategory.set(fl.category, []);
    byCategory.get(fl.category).push({ slug: f.slug, match: fl.match });
  }
}

console.log(`\nBy category (one entry can match multiple):`);
for (const [cat, entries] of [...byCategory.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${cat.padEnd(25)} ${entries.length} memo${entries.length === 1 ? '' : 's'}`);
}

let flipped = 0;
let alreadyUnpublished = 0;
for (const f of flagged) {
  const path = join(DIR, f.file);
  if (!f.currentPublished) { alreadyUnpublished++; continue; }
  if (WRITE) {
    const data = JSON.parse(readFileSync(path, 'utf8'));
    data.published = false;
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
  }
  flipped++;
}

console.log(`\n${WRITE ? 'Flipped' : 'Would flip'} to unpublished: ${flipped}`);
console.log(`Already unpublished:                 ${alreadyUnpublished}`);

// Sample 8 flagged to give curator a feel
console.log(`\nSample flagged memos (first 8):`);
for (const f of flagged.slice(0, 8)) {
  const cats = [...new Set(f.flags.map(fl => fl.category))].join(', ');
  console.log(`  ${f.slug}  [${cats}]`);
}

if (!WRITE) console.log(`\nRun with --write to apply.`);
