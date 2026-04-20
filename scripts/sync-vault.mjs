#!/usr/bin/env node
// sync-vault.mjs — project the CRFW vault into `src/content/vault_*/`
// as Astro-readable entries. Build-time read-only projection; the
// vault itself remains the edit target (via Obsidian or Curator's
// Kit vault mode).
//
// Usage:
//   node scripts/sync-vault.mjs           # dry-run, prints stats
//   node scripts/sync-vault.mjs --write   # apply
//
// Wikilink handling:
//   [[people/colin-ward]]   → kept as the string "people/colin-ward"
//                             (frontmatter sees a plain string list)
//   [[tracks/slug]]         → "tracks/slug"
//   Body text with wikilinks → preserved as-is (v1 renders as text)

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const args = process.argv.slice(2);
const write = args.includes('--write');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(__dirname, '..');
const contentDir = join(repo, 'src', 'content');

const VAULT_PATH = process.env.CRFW_VAULT_PATH || join(
  homedir(),
  'Library', 'CloudStorage', 'Dropbox', 'CRFW', 'CRFW Archive', '_Vault'
);

if (!existsSync(VAULT_PATH)) {
  console.error(`Vault not found: ${VAULT_PATH}`);
  console.error(`Set CRFW_VAULT_PATH env var to override.`);
  process.exit(2);
}

// Vault folder → our collection name.
// Vault uses folder-qualified slugs so we map verbatim with a prefix.
const KIND_MAP = {
  people:        'vault_people',
  projects:      'vault_projects',
  venues:        'vault_venues',
  organizations: 'vault_organizations',
  tracks:        'vault_tracks',
  releases:      'vault_releases',
  events:        'vault_events',
  press:         'vault_press',
  funds:         'vault_funds',
  grants:        'vault_grants',
  series:        'vault_series',
  // Placeholders in the vault — skip until populated:
  // works, sources, tags
};

// Minimal frontmatter splitter (same pattern as import-csv-edits.mjs)
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { frontmatter: '', body: text };
  return { frontmatter: m[1], body: m[2] };
}

// YAML-ish parser, narrowed to what the vault uses. Handles:
//   - Scalars (strings, numbers, booleans, nulls, quoted)
//   - Arrays of scalars (- foo)
//   - Arrays of objects (- key: val\n  key: val)
//   - Wikilinks [[path/slug]] passed through as strings
//   - Nested object (contact_public, etc.) via | literal blocks or
//     a single level of indented keys
function parseFrontmatter(fm) {
  const out = {};
  const lines = fm.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (!m) { i++; continue; }
    const [, key, rest] = m;
    if (rest === '') {
      // Block — array or nested object
      let j = i + 1;
      const block = [];
      while (j < lines.length && (/^\s+/.test(lines[j]) || lines[j] === '')) {
        block.push(lines[j]);
        j++;
      }
      if (block.length === 0) {
        out[key] = null;
      } else {
        out[key] = parseBlock(block);
      }
      i = j;
    } else if (rest === '[]') {
      out[key] = [];
      i++;
    } else if (rest.startsWith('|')) {
      // Literal block scalar — preserve newlines as-is
      let j = i + 1;
      const lit = [];
      while (j < lines.length && (/^\s{2,}/.test(lines[j]) || lines[j] === '')) {
        lit.push(lines[j].replace(/^\s{2}/, ''));
        j++;
      }
      out[key] = lit.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
      i = j;
    } else if (rest.startsWith('>')) {
      // Folded block scalar — fold newlines into spaces, blank lines into \n
      let j = i + 1;
      const foldLines = [];
      while (j < lines.length && (/^\s{2,}/.test(lines[j]) || lines[j] === '')) {
        foldLines.push(lines[j].replace(/^\s{2}/, ''));
        j++;
      }
      // Fold: blank lines become \n; other newlines become spaces
      out[key] = foldLines.join('\n')
        .replace(/\n\n+/g, '\0')
        .replace(/\n/g, ' ')
        .replace(/\0/g, '\n')
        .trim();
      i = j;
    } else {
      out[key] = unquote(rest);
      i++;
    }
  }
  return out;
}

function parseBlock(block) {
  const nonEmpty = block.filter(l => l.trim());
  if (nonEmpty.length === 0) return null;
  // Edge case: single line with "[]" or "null" — treat as the literal
  if (nonEmpty.length === 1) {
    const only = nonEmpty[0].trim();
    if (only === '[]') return [];
    if (only === 'null' || only === '~') return null;
    if (only === '{}') return {};
  }
  // Array if every non-empty line starts with "- "
  if (nonEmpty.every(l => /^\s*-\s+/.test(l))) {
    const items = [];
    let k = 0;
    while (k < block.length) {
      const first = block[k].match(/^\s*-\s+(.*)$/);
      if (!first) { k++; continue; }
      const firstContent = first[1];
      // Is this an object (key: val)?
      // Only treat as object if followed by indented continuation lines.
      // Rejects things like "- https://foo" (no continuation → scalar URL).
      const kvMatch = firstContent.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
      const hasContinuation = k + 1 < block.length
        && !block[k + 1].match(/^\s*-\s+/)
        && block[k + 1].trim()
        && /^\s+[a-zA-Z_][a-zA-Z0-9_-]*:\s*/.test(block[k + 1]);
      const looksLikeObjectKey = kvMatch
        && !firstContent.startsWith('"')
        && !firstContent.startsWith("'")
        && !firstContent.startsWith('[[')
        && !/^\d/.test(firstContent.trim())
        && hasContinuation;
      if (looksLikeObjectKey) {
        const obj = {};
        obj[kvMatch[1]] = unquote(kvMatch[2]);
        let l = k + 1;
        while (l < block.length && !block[l].match(/^\s*-\s+/) && block[l].trim()) {
          const cont = block[l].match(/^\s+([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
          if (cont) obj[cont[1]] = unquote(cont[2]);
          l++;
        }
        items.push(obj);
        k = l;
      } else {
        items.push(unquote(firstContent));
        k++;
      }
    }
    return items;
  }
  // Otherwise a nested object (all lines are "  key: val")
  const obj = {};
  for (const l of nonEmpty) {
    const kv = l.match(/^\s+([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (kv) obj[kv[1]] = unquote(kv[2]);
  }
  return obj;
}

function unquote(s) {
  if (s == null) return s;
  s = s.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~' || s === '') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  // Quoted strings
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  // Wikilink MUST be checked before inline-array, since [[x]] also
  // satisfies startsWith('[') && endsWith(']').
  const wikiMatchEarly = s.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  if (wikiMatchEarly) return wikiMatchEarly[1].trim();
  // Inline array: [foo, bar, baz] or ["a", "b"]
  if (s.startsWith('[') && s.endsWith(']') && !s.startsWith('[[')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    // Split on commas NOT inside [[…]] wikilinks
    const parts = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < inner.length; i++) {
      const c = inner[i];
      if (c === '[' && inner[i+1] === '[') { depth++; current += c; continue; }
      if (c === ']' && inner[i+1] === ']') { depth--; current += c; continue; }
      if (c === ',' && depth === 0) {
        parts.push(current.trim());
        current = '';
      } else {
        current += c;
      }
    }
    if (current.trim()) parts.push(current.trim());
    return parts.map(unquote);
  }
  // Wikilink — strip [[ ]] to get "coll/slug"
  const wikiMatch = s.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  if (wikiMatch) return wikiMatch[1].trim();
  return s;
}

// Find every wikilink [[path/slug|label]] in a string; return array
// of { raw, target, label }.
function findWikilinks(text) {
  const links = [];
  const re = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    links.push({ raw: m[0], target: m[1].trim(), label: (m[2] || '').trim() });
  }
  return links;
}

// Normalize a wikilink-or-plain string to just the target path.
// Array values like `projects:` get each element normalized.
function normalizeWikilinkValue(v) {
  if (v == null) return v;
  if (typeof v === 'string') {
    const m = v.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
    return m ? m[1].trim() : v;
  }
  if (Array.isArray(v)) return v.map(normalizeWikilinkValue);
  if (typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v)) out[k] = normalizeWikilinkValue(v[k]);
    return out;
  }
  return v;
}

// ---------------- Main ----------------
const stats = {};
const wikilinksAll = [];
const deadRefs = [];
const knownEntries = new Map(); // "coll/slug" → true, for dead-ref check

// Pass 1: enumerate vault entries to build the "known" set
for (const folder of Object.keys(KIND_MAP)) {
  const dir = join(VAULT_PATH, folder);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md') || f.includes(' 2.')) continue;
    const slug = f.replace(/\.md$/, '');
    knownEntries.set(`${folder}/${slug}`, true);
  }
}

// Pass 2: parse + project
for (const [folder, collName] of Object.entries(KIND_MAP)) {
  const srcDir = join(VAULT_PATH, folder);
  const dstDir = join(contentDir, collName);
  if (!existsSync(srcDir)) continue;

  const files = readdirSync(srcDir).filter(f => f.endsWith('.md') && !f.includes(' 2.'));
  stats[collName] = { count: 0, files: [] };

  if (write) {
    if (existsSync(dstDir)) rmSync(dstDir, { recursive: true });
    mkdirSync(dstDir, { recursive: true });
  }

  for (const f of files) {
    const srcPath = join(srcDir, f);
    const raw = readFileSync(srcPath, 'utf8');
    const { frontmatter, body } = splitFrontmatter(raw);
    const parsed = parseFrontmatter(frontmatter);

    // Track wikilinks seen in this file for reporting + dead-ref check
    for (const l of findWikilinks(frontmatter + '\n' + body)) {
      wikilinksAll.push({ fromFile: `${folder}/${f}`, target: l.target });
      // Only enforce dead-ref for targets that LOOK like vault paths (coll/slug)
      if (/^[a-z_]+\/[a-z0-9][a-z0-9\-]*$/i.test(l.target)) {
        const [tcoll] = l.target.split('/');
        if (tcoll in KIND_MAP || ['works','sources','tags','assets'].includes(tcoll)) {
          if (!knownEntries.has(l.target)) {
            deadRefs.push({ from: `${folder}/${f}`, to: l.target });
          }
        }
      }
    }

    // Normalize frontmatter values: strip wikilink brackets from scalars/arrays.
    // Also drop nulls — Zod's .optional() accepts undefined but not null;
    // treating "known-absent" and "omitted" as the same is fine for our UI.
    const normalized = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (v === null) continue;
      normalized[k] = normalizeWikilinkValue(v);
    }
    // Ensure archivePath is always an array (vault convention)
    if (typeof normalized.archivePath === 'string') {
      normalized.archivePath = [normalized.archivePath];
    }
    // Ensure id matches filename
    const slug = f.replace(/\.md$/, '');
    normalized.id = slug;
    // Preserve body as a string field (opt-in; Astro data collections
    // don't process markdown bodies, so we carry it ourselves)
    if (body && body.trim()) normalized.body = body.trim();

    stats[collName].count++;
    stats[collName].files.push(slug);

    if (write) {
      const outPath = join(dstDir, `${slug}.json`);
      writeFileSync(outPath, JSON.stringify(normalized, null, 2) + '\n', 'utf8');
    }
  }
}

// ---------------- Report ----------------
console.log(`Vault: ${VAULT_PATH}`);
console.log(`Mode:  ${write ? 'WRITE' : 'dry-run'}`);
console.log('');
console.log('Projected:');
let total = 0;
for (const [coll, info] of Object.entries(stats)) {
  console.log(`  ${coll.padEnd(30)} ${info.count}`);
  total += info.count;
}
console.log(`  ${'TOTAL'.padEnd(30)} ${total}`);
console.log('');

console.log(`Wikilinks found: ${wikilinksAll.length}`);
const uniqueTargets = new Set(wikilinksAll.map(w => w.target));
console.log(`Unique link targets: ${uniqueTargets.size}`);
console.log('');

if (deadRefs.length > 0) {
  console.log(`!! Dead wikilinks: ${deadRefs.length}`);
  for (const d of deadRefs.slice(0, 10)) {
    console.log(`   ${d.from}  →  ${d.to}  (MISSING)`);
  }
  if (deadRefs.length > 10) console.log(`   … and ${deadRefs.length - 10} more`);
  console.log('');
}

console.log(write ? 'WRITE mode — projected files updated.' : 'DRY-RUN — pass --write to apply.');
