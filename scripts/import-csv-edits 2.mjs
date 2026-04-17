#!/usr/bin/env node
// CSV import-back script — reads a CSV exported from /admin,
// diffs against current content files, and applies the changes.
//
// Intended workflow:
//   1. Visit /admin, export CSV
//   2. Edit in Google Sheets or Excel (fix dates, add summaries,
//      toggle published, re-tag projects, etc.)
//   3. Save/export back to CSV
//   4. Run: node scripts/import-csv-edits.mjs <path-to-csv>         (dry-run)
//            node scripts/import-csv-edits.mjs <path-to-csv> --write (apply)
//
// Editable columns (anything else is ignored for safety):
//   title, preservedTitle, project, date, format, tags, summary, published
//
// Identity columns (never written): id, kind, file, archivePath
//
// Markdown files (releases, events): frontmatter is updated in place;
// body is preserved byte-for-byte.
// JSON files (videos, photos, voice_memos, people, lyrics): full
// re-serialization with JSON.stringify(…, 2).

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const write = args.includes('--write');
const csvPath = args.find(a => !a.startsWith('--'));

if (!csvPath) {
  console.error('Usage: node scripts/import-csv-edits.mjs <path-to-csv> [--write]');
  process.exit(2);
}

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(__dirname, '..');

// --- CSV parser (RFC 4180-ish: handles quoted fields with commas and "" escapes) ---
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

// --- Frontmatter helpers for Markdown files ---
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) throw new Error('File has no frontmatter');
  return { frontmatter: m[1], body: m[2] };
}

function yamlQuote(s) {
  if (s === null || s === undefined) return '""';
  const str = String(s);
  // If it's a safe unquoted scalar (no special chars), we still quote for consistency
  return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// Update (or insert) a single top-level scalar key in a YAML frontmatter block.
// Uses naive line-based parsing — sufficient for our flat schema.
function updateScalarField(fm, key, value) {
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  const newLine = `${key}: ${yamlQuote(value)}`;
  if (re.test(fm)) return fm.replace(re, newLine);
  // Append at the end of frontmatter
  return fm.replace(/\n?$/, `\n${newLine}\n`);
}

function updateBooleanField(fm, key, value) {
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  const newLine = `${key}: ${value ? 'true' : 'false'}`;
  if (re.test(fm)) return fm.replace(re, newLine);
  return fm.replace(/\n?$/, `\n${newLine}\n`);
}

// Update a tag list (replaces the whole block)
function updateTagsField(fm, tags) {
  const reBlock = /^tags:\s*\n((?:\s{2}-\s.*\n)+)/m;
  const reInline = /^tags:\s*\[.*\]\s*$/m;
  const reEmpty = /^tags:\s*\[\s*\]\s*$/m;
  const block = tags.length === 0
    ? 'tags: []'
    : `tags:\n${tags.map(t => `  - ${t}`).join('\n')}\n`;

  if (reBlock.test(fm)) return fm.replace(reBlock, block.endsWith('\n') ? block : block + '\n');
  if (reInline.test(fm) || reEmpty.test(fm)) return fm.replace(reInline.test(fm) ? reInline : reEmpty, block.trimEnd());
  return fm.replace(/\n?$/, `\n${block.trimEnd()}\n`);
}

// Read the current value of a scalar field from a frontmatter block
function getScalarField(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return undefined;
  let v = m[1].trim();
  // Strip surrounding quotes
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return v;
}

function getBooleanField(fm, key) {
  const v = getScalarField(fm, key);
  if (v === undefined) return undefined;
  return v === 'true';
}

function getTagsField(fm) {
  const blockM = fm.match(/^tags:\s*\n((?:\s{2}-\s.*\n)+)/m);
  if (blockM) {
    return blockM[1].split('\n').map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
  }
  const inlineM = fm.match(/^tags:\s*\[(.*)\]\s*$/m);
  if (inlineM) {
    return inlineM[1].split(',').map(t => t.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return undefined;
}

// --- Apply edits to a file ---
function applyToMarkdown(filePath, edits) {
  const text = readFileSync(filePath, 'utf8');
  const { frontmatter, body } = splitFrontmatter(text);
  let fm = frontmatter;
  const changes = [];

  for (const [key, value] of Object.entries(edits)) {
    if (key === 'tags') {
      const cur = getTagsField(fm);
      if (cur && JSON.stringify(cur) === JSON.stringify(value)) continue;
      fm = updateTagsField(fm, value);
      changes.push(`tags → [${value.join(', ')}]`);
    } else if (key === 'published') {
      const cur = getBooleanField(fm, key);
      // Published defaults to true when absent; treat missing === true
      const curEffective = cur === undefined ? true : cur;
      if (curEffective === value) continue;
      fm = updateBooleanField(fm, key, value);
      changes.push(`${key} → ${value}`);
    } else {
      const cur = getScalarField(fm, key);
      if (cur === value) continue;
      fm = updateScalarField(fm, key, value);
      changes.push(`${key} → ${JSON.stringify(value)}  (was ${JSON.stringify(cur ?? null)})`);
    }
  }

  if (!changes.length) return null;
  const updated = `---\n${fm.replace(/\n?$/, '\n')}---\n${body}`;
  return { updated, changes };
}

function applyToJson(filePath, edits) {
  const text = readFileSync(filePath, 'utf8');
  const data = JSON.parse(text);
  const changes = [];
  for (const [key, value] of Object.entries(edits)) {
    // Schema default: `published` is `true` when absent — don't write it
    // back just to add the explicit field
    if (key === 'published' && data[key] === undefined && value === true) continue;
    if (JSON.stringify(data[key]) === JSON.stringify(value)) continue;
    data[key] = value;
    const prev = data[key] === value ? undefined : text.match(new RegExp(`"${key}":\\s*([^,\\n}]+)`))?.[1];
    changes.push(`${key} → ${Array.isArray(value) ? `[${value.join(', ')}]` : JSON.stringify(value)}${prev ? `  (was ${prev})` : ''}`);
  }
  if (!changes.length) return null;
  return { updated: JSON.stringify(data, null, 2) + '\n', changes };
}

// --- Main ---
const csvText = readFileSync(resolve(csvPath), 'utf8');
const rows = parseCsv(csvText);
if (rows.length < 2) { console.error('CSV has no data rows'); process.exit(1); }

const header = rows[0];
const colIdx = Object.fromEntries(header.map((h, i) => [h, i]));
const required = ['id', 'kind', 'file'];
for (const col of required) {
  if (!(col in colIdx)) { console.error(`Missing required column: ${col}`); process.exit(2); }
}

const editableCols = ['title', 'preservedTitle', 'project', 'date', 'format', 'summary', 'tags', 'published'];
console.log(`Mode: ${write ? 'WRITE' : 'dry-run'}`);
console.log(`Editable columns present: ${editableCols.filter(c => c in colIdx).join(', ') || '(none)'}`);
console.log();

let changed = 0, skipped = 0, errors = 0;

for (let r = 1; r < rows.length; r++) {
  const row = rows[r];
  const id = row[colIdx.id];
  const kind = row[colIdx.kind];
  const relFile = row[colIdx.file];
  if (!id || !kind || !relFile) { skipped++; continue; }

  const absFile = join(repoRoot, relFile);
  if (!existsSync(absFile)) {
    console.log(`  MISSING FILE: ${relFile}`);
    errors++;
    continue;
  }

  // Build edits object from present editable columns
  const edits = {};
  for (const col of editableCols) {
    if (!(col in colIdx)) continue;
    let v = row[colIdx[col]];
    if (v == null) continue;
    if (col === 'tags') {
      const arr = v.split(';').map(t => t.trim()).filter(Boolean);
      edits.tags = arr;
    } else if (col === 'published') {
      edits.published = v.toLowerCase().trim() === 'true';
    } else if (col === 'preservedTitle' && !v.trim()) {
      // Leave blank preservedTitles alone — never write an empty one in
      continue;
    } else {
      // For title/project/date/format/summary: trim whitespace, empty = no edit
      const trimmed = v.trim();
      if (trimmed === '') continue;
      edits[col] = trimmed;
    }
  }

  if (Object.keys(edits).length === 0) { skipped++; continue; }

  try {
    const result = relFile.endsWith('.md')
      ? applyToMarkdown(absFile, edits)
      : applyToJson(absFile, edits);
    if (!result) { skipped++; continue; }
    console.log(`  ${id}  (${result.changes.length} change${result.changes.length === 1 ? '' : 's'})`);
    for (const c of result.changes) console.log(`    · ${c}`);
    if (write) writeFileSync(absFile, result.updated, 'utf8');
    changed++;
  } catch (err) {
    console.log(`  ERROR on ${id}: ${err.message}`);
    errors++;
  }
}

console.log();
console.log(`--- summary ---`);
console.log(`Changed:  ${changed}`);
console.log(`Skipped:  ${skipped}`);
console.log(`Errors:   ${errors}`);
console.log(write ? '' : '\n(dry-run — pass --write to apply)');
