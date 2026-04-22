#!/usr/bin/env node
/**
 * reconcile-vault-releases.mjs
 *
 * Merges vault release research into site release stubs.
 *
 * Strategy per field:
 *   date        — vault release_date (precise) > release_year > existing site date
 *   format      — vault release_kind mapped to site format enum
 *   bandcampUrl — vault canonical_url if it's a Bandcamp URL and site has none
 *   tracklist   — vault tracks[] → read each track file → build site tracklist
 *                 vault wins if more complete; site existing list → BIN if replaced
 *   summary     — first prose paragraph from vault body → site summary (draft)
 *                 curator-written site summaries → BIN before replacement
 *   tags        — union (vault tags merged in)
 *   archivePath — union (vault archivePaths normalized to CRFW Archive/ prefix)
 *
 * BIN file:  reconcile-bin/YYYY-MM-DD.md  — all displaced site content with provenance
 * Dry run:   node scripts/reconcile-vault-releases.mjs
 * Apply:     node scripts/reconcile-vault-releases.mjs --write
 * One entry: node scripts/reconcile-vault-releases.mjs --vault-slug killd-by-court-clothes
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(__dirname, '..');
const SITE_RELEASES = join(REPO, 'src', 'content', 'releases');
const BIN_DIR = join(REPO, 'reconcile-bin');

const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const ONLY = (() => { const i = args.indexOf('--vault-slug'); return i !== -1 ? args[i + 1] : null; })();

const VAULT_PATH = process.env.CRFW_VAULT_PATH || join(
  homedir(), 'Library', 'CloudStorage', 'Dropbox', 'CRFW', 'CRFW Archive', '_Vault',
);
const VAULT_RELEASES = join(VAULT_PATH, 'releases');
const VAULT_TRACKS   = join(VAULT_PATH, 'tracks');

if (!existsSync(VAULT_PATH)) {
  console.error(`Vault not found: ${VAULT_PATH}`);
  console.error(`Set CRFW_VAULT_PATH env var to override.`);
  process.exit(2);
}

// ─── Slug mapping ────────────────────────────────────────────────────────────
// vault slug → site file slug (no extension). null = create new site file.
const SLUG_MAP = {
  // Killd By
  'killd-by-court-clothes':     'court-clothes',
  'killd-by-recovery':          'recovery',
  'killd-by-draw-blood':        'draw-blood',
  'killd-by-emt':               'emt',
  'killd-by-p22':               'p22',
  'killd-by-carolina-reaper':   'carolina-reaper',
  'killd-by-2014-2016-bsides':  '117-killd-by-2014-2016-bsides',
  'killd-by-ddr3-loaner-phone': 'ddr3-loaner-phone',
  'killd-by-djpoolside-vol-1':  'djpoolside-vol-1',
  'killd-by-uya-050':           'uya-050',
  'killd-by-neotropical':       null, // → create neotropical.md
  // alphabets
  'alphabets-400yen':                         '400yen',
  'alphabets-611':                            '611',
  'alphabets-air-mall-3':                     'air-mall',
  'alphabets-angry-birds-chains':             'angry-birds-chains',
  'alphabets-antpad':                         'antpad',
  'alphabets-bellpower':                      'bellpower',
  'alphabets-bieber-jerboa':                  'bieber-jerboa',
  'alphabets-cave-rave':                      'cave-rave',
  'alphabets-dancepower':                     'dancepower',
  'alphabets-ddr':                            'ddr',
  'alphabets-ddr2-haunted':                   'ddr2-haunted',
  'alphabets-jeanjets':                       'jeanjets',
  'alphabets-may2011dte':                     'may2011dte',
  'alphabets-moonpower':                      'moonpower',
  'alphabets-on-champagne-and-greyhounds-2':  'on-champagne-and-greyhounds',
  'alphabets-play-soundtrack':                'play-soundtrack',
  'alphabets-remix09':                        'remix09',
  'alphabets-remix10':                        'remix10',
  'alphabets-siberian-chill':                 'siberian-chill',
  'alphabets-stupid-hott':                    'stupid-hott',
  'alphabets-sunpower':                       'sunpower',
  'alphabets-sunpower-2':                     'sunpower2',
  'alphabets-sunpower-3':                     'sunpower3',
  'alphabets-sweat-bee-dance-mix':            'sweat-bee-dance-mix',
  'alphabets-thru-tha-rip':                   '19-alphabets-thru-tha-rip',
  'alphabets-trapped-in-tha-back-of-a-jeep':  'trapped-in-tha-back-of-a-jeep',
  'alphabets-underwaters':                    'underwaters',
  'alphabets-underwaters-ii':                 'underwaters-ii',
  'alphabets-underwaters-iii':                'underwaters-iii',
  'alphabets-underwaters-iv':                 'underwaters-iv',
  'alphabets-underwaters-v':                  'underwaters-v',
  'alphabets-underwaters-vi':                 'underwaters-vi',
  'alphabets-wetdollar-11':                   'wetdollar-11',
  // Monthly alphabets releases (unmapped until session 16)
  'alphabets-april-co-eds-2011':              'april-co-eds-2011',
  'alphabets-dec09scifi':                     'dec09scifi',
  'alphabets-feb2012':                        'feb2012',
  'alphabets-forjaniechantdance':             'forjaniechantdance',
  'alphabets-janfeb09':                       'janfeb09',
  'alphabets-janfeb11-pirate-life':           'janfeb11-pirate-life',
  'alphabets-july2010':                       'july2010',
  'alphabets-june-monsters-09':               'june-monsters-09',
  'alphabets-lifebeforetime-soundtrack':      'lifebeforetimesoundtrack',
  'alphabets-march09':                        'march09hopdanceshakebump',
  'alphabets-may10':                          'may10',
  'alphabets-nov09':                          'nov09',
  'alphabets-octobrr09':                      'octobrr09',
  'alphabets-octobrr2010':                    'octobrr2010',
  'alphabets-sep09':                          'sep09',
  'alphabets-sftwr-synths-dec09':             'sftwrsynthzdec09',
  // New releases discovered in vault session 5
  'alphabets-crab-lab-split-tape':            'alphabets-crab-lab-split-tape',
  'killd-by-b-sides-2017':                    null, // → create kb-b-sides-2017.md
  'killd-by-court-clothes-vol-1':             'court-clothes-vol-1',
  'killd-by-familie-mix':                     'familie-mix-ripcashaskew',
  'killd-by-outcasts':                        'outcasts-b-sides-2014-2016',
  'killd-by-timewave686':                     'timewave686',
  'killd-by-trappist-1':                      'trappist-1',
};

// Map vault release_kind → site format enum
const FORMAT_MAP = {
  album: 'LP', ep: 'EP', single: 'single', compilation: 'b-sides',
  mixtape: 'mix', mix: 'mix', cassette: 'LP', vinyl: 'LP',
  demo: 'demo', b_sides: 'b-sides', split: 'EP', soundtrack: 'other',
  unreleased: 'other', other: 'other',
};

// ─── YAML parsing (full version, handles vault idioms) ────────────────────────
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { frontmatter: '', body: text };
  return { frontmatter: m[1], body: m[2] };
}

function unquote(s) {
  if (s == null) return s;
  s = s.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null' || s === '~' || s === '') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if (/^-?\d+\.\d+$/.test(s)) return parseFloat(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'")))
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  const wiki = s.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  if (wiki) return wiki[1].trim();
  if (s.startsWith('[') && s.endsWith(']') && !s.startsWith('[[')) {
    const inner = s.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map(p => unquote(p.trim()));
  }
  return s;
}

function parseBlock(block) {
  const nonEmpty = block.filter(l => l.trim());
  if (nonEmpty.length === 0) return null;
  if (nonEmpty.length === 1) {
    const only = nonEmpty[0].trim();
    if (only === '[]') return [];
    if (only === 'null' || only === '~') return null;
  }
  if (nonEmpty.length > 0 && /^\s*-\s+/.test(nonEmpty[0])) {
    const items = [];
    let k = 0;
    while (k < block.length) {
      const first = block[k].match(/^\s*-\s+(.*)$/);
      if (!first) { k++; continue; }
      const firstContent = first[1];
      const kvMatch = firstContent.match(/^([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
      const hasCont = k + 1 < block.length && !block[k+1].match(/^\s*-\s+/)
        && block[k+1].trim() && /^\s+[a-zA-Z_][a-zA-Z0-9_-]*:\s*/.test(block[k+1]);
      const looksObj = kvMatch && !firstContent.startsWith('"') && !firstContent.startsWith("'")
        && !firstContent.startsWith('[[') && !/^\d/.test(firstContent.trim()) && hasCont;
      if (looksObj) {
        const obj = { [kvMatch[1]]: unquote(kvMatch[2]) };
        let l = k + 1;
        while (l < block.length && !block[l].match(/^\s*-\s+/) && block[l].trim()) {
          const cont = block[l].match(/^\s+([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
          if (cont) obj[cont[1]] = unquote(cont[2]);
          l++;
        }
        items.push(obj); k = l;
      } else { items.push(unquote(firstContent)); k++; }
    }
    return items;
  }
  const obj = {};
  for (const l of nonEmpty) {
    const kv = l.match(/^\s+([a-zA-Z_][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (kv) obj[kv[1]] = unquote(kv[2]);
  }
  return obj;
}

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
    if (rest === '' || rest === '[]') {
      let j = i + 1;
      const block = [];
      while (j < lines.length && (/^\s+/.test(lines[j]) || lines[j] === '')) {
        block.push(lines[j]); j++;
      }
      out[key] = block.length === 0 ? (rest === '[]' ? [] : null) : parseBlock(block);
      i = j;
    } else if (rest.startsWith('|')) {
      let j = i + 1; const lit = [];
      while (j < lines.length && (/^\s{2,}/.test(lines[j]) || lines[j] === '')) {
        lit.push(lines[j].replace(/^\s{2}/, '')); j++;
      }
      out[key] = lit.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
      i = j;
    } else if (rest.startsWith('>')) {
      let j = i + 1; const fold = [];
      while (j < lines.length && (/^\s{2,}/.test(lines[j]) || lines[j] === '')) {
        fold.push(lines[j].replace(/^\s{2}/, '')); j++;
      }
      out[key] = fold.join('\n').replace(/\n\n+/g, '\0').replace(/\n/g, ' ').replace(/\0/g, '\n').trim();
      i = j;
    } else {
      out[key] = unquote(rest); i++;
    }
  }
  return out;
}

// ─── YAML write helpers ───────────────────────────────────────────────────────
function yamlQ(v) {
  if (v === null || v === undefined) return '""';
  const s = String(v);
  // YAML plain scalars cannot contain: : # [ ] { } , & * ! | > ' " % @ `
  // Also quote ISO dates (YAML 1.1 parses YYYY-MM-DD as Date) and pure numbers (parsed as int/float)
  if (/[:#\[\]{},&*!|>'"\\%@`]/.test(s) || s.startsWith(' ') || s.endsWith(' ')
      || s === '' || /^\d{4}-\d{2}-\d{2}$/.test(s) || /^-?\d+(\.\d+)?$/.test(s))
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  return s;
}

function setScalar(fm, key, value) {
  const re = new RegExp(`^${key}:.*$`, 'm');
  const line = `${key}: ${yamlQ(value)}`;
  return re.test(fm) ? fm.replace(re, line) : fm.replace(/\n?$/, `\n${line}\n`);
}

function setBool(fm, key, value) {
  const re = new RegExp(`^${key}:.*$`, 'm');
  const line = `${key}: ${value ? 'true' : 'false'}`;
  return re.test(fm) ? fm.replace(re, line) : fm.replace(/\n?$/, `\n${line}\n`);
}

function setStringArray(fm, key, arr) {
  const reBlock  = new RegExp(`^${key}:\\s*\\n(?:  - .*\\n?)*`, 'm');
  const reInline = new RegExp(`^${key}:\\s*\\[.*\\]\\s*$`, 'm');
  const reScalar = new RegExp(`^${key}:.*$`, 'm');   // catches scalar: "value"
  const block = arr.length === 0
    ? `${key}: []`
    : `${key}:\n${arr.map(t => `  - ${yamlQ(t)}`).join('\n')}`;
  if (reBlock.test(fm))  return fm.replace(reBlock, block + '\n');
  if (reInline.test(fm)) return fm.replace(reInline, block);
  if (reScalar.test(fm)) return fm.replace(reScalar, block);  // scalar → array
  return fm.replace(/\n?$/, `\n${block}\n`);
}

function setTracklist(fm, tracklist) {
  // Remove existing tracklist block by scanning lines
  const fmLines = fm.split('\n');
  const kept = [];
  let inTracklist = false;
  for (const line of fmLines) {
    if (/^tracklist:/.test(line)) { inTracklist = true; continue; }
    if (inTracklist) {
      // Tracklist block ends when we hit a non-indented, non-empty line
      if (line !== '' && !/^\s/.test(line)) { inTracklist = false; kept.push(line); }
      // else: skip indented tracklist lines
    } else {
      kept.push(line);
    }
  }
  if (!tracklist || tracklist.length === 0) return kept.join('\n');

  const block = ['tracklist:'];
  for (const t of tracklist) {
    block.push(`  - n: ${t.n ?? ''}`);
    block.push(`    title: ${yamlQ(t.title)}`);
    if (t.preservedTitle && t.preservedTitle !== t.title)
      block.push(`    preservedTitle: ${yamlQ(t.preservedTitle)}`);
    if (t.duration) block.push(`    duration: ${yamlQ(t.duration)}`);
    if (t.audio)    block.push(`    audio: ${yamlQ(t.audio)}`);
  }
  return kept.join('\n').replace(/\n?$/, `\n${block.join('\n')}\n`);
}

// ─── Vault track loader ───────────────────────────────────────────────────────
function buildTracklist(trackRefs) {
  const tracklist = [];
  for (let i = 0; i < trackRefs.length; i++) {
    // Strip wikilink brackets if present: "[[tracks/slug]]" → "tracks/slug"
    const ref = String(trackRefs[i]).replace(/^\[\[/, '').replace(/\]\]$/, '');
    const slug = ref.replace(/^tracks\//, '');
    const trackFile = join(VAULT_TRACKS, `${slug}.md`);
    if (!existsSync(trackFile)) {
      // Infer title from slug: skip release prefix and track number
      const parts = slug.split('-');
      const titleParts = parts.slice(parts.findIndex(p => /^\d{2}$/.test(p)) + 1);
      tracklist.push({ n: i + 1, title: titleParts.join(' ') || slug });
      continue;
    }
    const raw = readFileSync(trackFile, 'utf8');
    const { frontmatter } = splitFrontmatter(raw);
    const fm = parseFrontmatter(frontmatter);
    const entry = { n: fm.position ?? (i + 1), title: fm.title || slug };
    if (fm.preservedTitle && fm.preservedTitle !== fm.title)
      entry.preservedTitle = fm.preservedTitle;
    if (fm.duration_seconds != null) {
      const secs = parseInt(fm.duration_seconds);
      if (!isNaN(secs) && secs > 0)
        entry.duration = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    }
    if (fm.audio_path) entry.audio = fm.audio_path;
    tracklist.push(entry);
  }
  return tracklist;
}

// ─── Summary extractor ────────────────────────────────────────────────────────
// Pull the first prose paragraph from vault body (skip metadata headers,
// Bandcamp tracklist blockquotes, wikilink metadata lines).
function extractSummary(body) {
  if (!body || !body.trim()) return '';
  const lines = body.split('\n');
  const proseParts = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) { if (proseParts.length > 0) break; continue; } // blank line ends para
    if (t.startsWith('#')) continue;                          // headings
    if (t.startsWith('>')) continue;                          // blockquotes (BC copy)
    if (t.startsWith('**')) continue;                          // **Field:** metadata lines
    if (t.startsWith('|')) continue;                           // tables
    if (t.match(/^---+$/)) continue;                           // rules
    if (t.match(/^- \[/) || t.match(/^\[.*\]\(http/)) continue; // link lists
    if (t.match(/^##/)) break;                                  // sub-heading stops prose
    proseParts.push(t);
    if (proseParts.join(' ').length > 400) break;
  }
  const text = proseParts.join(' ').trim();
  return text.length > 40 ? text.slice(0, 600) : '';
}

// ─── Core merge function ──────────────────────────────────────────────────────
function mergeVaultIntoSite(vaultFm, vaultBody, siteFm) {
  const changes = [];
  const bin     = [];
  let fm = '';   // we'll mutate the raw frontmatter string instead

  // We return a diff spec; caller applies it with setScalar etc.
  const diff = {};

  // 1. date
  const vaultDate = vaultFm.release_date
    ? String(vaultFm.release_date)
    : (vaultFm.release_year ? String(vaultFm.release_year) : null);
  const siteDate  = siteFm.date ? String(siteFm.date) : '';
  if (vaultDate && vaultDate !== siteDate) {
    if (siteDate && !siteDate.startsWith(String(vaultFm.release_year || '').slice(0, 4))) {
      bin.push({ field: 'date', site: siteDate, vault: vaultDate, reason: 'vault has more precise date' });
    }
    diff.date = vaultDate;
    changes.push('date');
  }

  // 2. format
  const vaultFormat = vaultFm.release_kind ? (FORMAT_MAP[vaultFm.release_kind] ?? 'other') : null;
  if (vaultFormat && vaultFormat !== siteFm.format) {
    if (siteFm.format) bin.push({ field: 'format', site: siteFm.format, vault: vaultFormat, reason: 'vault release_kind maps to site format' });
    diff.format = vaultFormat;
    changes.push('format');
  }

  // 3. bandcampUrl (only add if site lacks it)
  const vaultUrl = typeof vaultFm.canonical_url === 'string' ? vaultFm.canonical_url : null;
  if (vaultUrl && vaultUrl.includes('bandcamp.com') && !siteFm.bandcampUrl) {
    diff.bandcampUrl      = vaultUrl;
    diff.bandcampItemType = 'album';
    changes.push('bandcampUrl');
  }

  // 4. tracklist
  const trackRefs = Array.isArray(vaultFm.tracks) ? vaultFm.tracks : [];
  if (trackRefs.length > 0) {
    const newList = buildTracklist(trackRefs);
    const oldList = Array.isArray(siteFm.tracklist) ? siteFm.tracklist : [];
    if (newList.length > oldList.length) {
      if (oldList.length > 0)
        bin.push({ field: 'tracklist', site: JSON.stringify(oldList, null, 2), vault: `${newList.length} tracks from vault`, reason: 'vault has more complete tracklist' });
      diff.tracklist = newList;
      changes.push('tracklist');
    }
  }

  // 5. summary / body (vault body → site summary draft + body)
  const prose = extractSummary(vaultBody);
  const siteSummary = typeof siteFm.summary === 'string' ? siteFm.summary.trim() : '';
  const isStub = !siteSummary || /stub entry|intentionally empty|no ai-generated/i.test(siteSummary);
  if (prose && prose !== siteSummary) {
    if (!isStub && siteSummary)
      bin.push({ field: 'summary', site: siteSummary, vault: prose, reason: 'vault prose replaced curator text — review bin' });
    diff.summary  = prose;
    diff.newBody  = vaultBody.trim() + '\n';
    changes.push('summary');
  }

  // 6. tags (union)
  const vTags  = Array.isArray(vaultFm.tags) ? vaultFm.tags.filter(Boolean) : [];
  const sTags  = Array.isArray(siteFm.tags)  ? siteFm.tags  : [];
  // add 'posthumous' if vault flags it
  const extraTags = vaultFm.is_posthumous && !sTags.includes('posthumous') ? ['posthumous'] : [];
  const merged = [...new Set([...sTags, ...vTags, ...extraTags])];
  if (merged.length > sTags.length) {
    diff.tags = merged;
    changes.push('tags');
  }

  // 7. archivePath (union, prefix vault paths with "CRFW Archive/")
  const siteAP = Array.isArray(siteFm.archivePath)
    ? siteFm.archivePath
    : (siteFm.archivePath ? [siteFm.archivePath] : []);
  const vaultAP = (Array.isArray(vaultFm.archivePath) ? vaultFm.archivePath : [])
    .filter(Boolean)
    .map(p => p.startsWith('CRFW Archive/') ? p : `CRFW Archive/${p}`);
  const mergedAP = [...new Set([...siteAP, ...vaultAP])];
  if (mergedAP.length > siteAP.length) {
    diff.archivePath = mergedAP.length === 1 ? mergedAP[0] : mergedAP;
    changes.push('archivePath');
  }

  return { diff, changes, bin };
}

// ─── Apply diff to a site MD file ─────────────────────────────────────────────
function applyDiff(filePath, diff, changes) {
  const raw = readFileSync(filePath, 'utf8');
  const { frontmatter: origFM, body: origBody } = splitFrontmatter(raw);
  let fm = origFM;

  for (const field of changes) {
    if (field === 'date')         fm = setScalar(fm, 'date', diff.date);
    if (field === 'format')       fm = setScalar(fm, 'format', diff.format);
    if (field === 'bandcampUrl') {
      fm = setScalar(fm, 'bandcampUrl', diff.bandcampUrl);
      fm = setScalar(fm, 'bandcampItemType', diff.bandcampItemType);
    }
    if (field === 'tracklist')    fm = setTracklist(fm, diff.tracklist);
    if (field === 'summary')      fm = setScalar(fm, 'summary', diff.summary);
    if (field === 'tags')         fm = setStringArray(fm, 'tags', diff.tags);
    if (field === 'archivePath') {
      if (Array.isArray(diff.archivePath))
        fm = setStringArray(fm, 'archivePath', diff.archivePath);
      else
        fm = setScalar(fm, 'archivePath', diff.archivePath);
    }
  }

  const newBody = diff.newBody !== undefined ? diff.newBody : origBody;
  writeFileSync(filePath, `---\n${fm.replace(/^\n+/, '').replace(/\n?$/, '\n')}---\n${newBody}`, 'utf8');
}

// ─── BIN file ─────────────────────────────────────────────────────────────────
function writeBin(entries) {
  if (entries.length === 0) return;
  mkdirSync(BIN_DIR, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const file = join(BIN_DIR, `${date}.md`);
  const header = existsSync(file) ? '' :
    `# CRFW Reconciliation Bin — ${date}\n\nDisplaced site content during vault reconciliation.\nTo restore: copy the "Previous value" back into the file listed.\n\n---\n\n`;
  const body = entries.map(e =>
    `### ${e.siteSlug} · ${e.field}\n\n` +
    `**Source file:** \`src/content/releases/${e.siteSlug}.md\`  \n` +
    `**Vault source:** \`${e.vaultSlug}\`  \n` +
    `**Reason:** ${e.reason}\n\n` +
    `**Previous value:**\n\`\`\`\n${e.site}\n\`\`\`\n\n---\n\n`
  ).join('');
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : '';
  writeFileSync(file, (existing || header) + body, 'utf8');
  console.log(`  → BIN: reconcile-bin/${date}.md (${entries.length} item${entries.length !== 1 ? 's' : ''})`);
}

// ─── Create new site stub from vault data ────────────────────────────────────
function createSiteStub(vaultSlug, vaultFm, vaultBody) {
  const suffix = vaultSlug.replace(/^alphabets-|^killd-by-/, '');
  const filePath = join(SITE_RELEASES, `${suffix}.md`);
  if (existsSync(filePath)) return { filePath, existed: true };

  const project = vaultSlug.startsWith('alphabets') ? 'alphabets' : 'killd by';
  const format  = vaultFm.release_kind ? (FORMAT_MAP[vaultFm.release_kind] ?? 'LP') : 'LP';
  const date    = vaultFm.release_date || String(vaultFm.release_year || '');
  const tags    = Array.isArray(vaultFm.tags) ? vaultFm.tags : [];
  const ap      = (Array.isArray(vaultFm.archivePath) ? vaultFm.archivePath : [])
    .map(p => p.startsWith('CRFW Archive/') ? p : `CRFW Archive/${p}`);

  const tracklist = Array.isArray(vaultFm.tracks) ? buildTracklist(vaultFm.tracks) : [];
  const summary   = extractSummary(vaultBody);

  const lines = [
    '---',
    `title: ${yamlQ(vaultFm.title || suffix)}`,
  ];
  if (vaultFm.preservedTitle && vaultFm.preservedTitle !== vaultFm.title)
    lines.push(`preservedTitle: ${yamlQ(vaultFm.preservedTitle)}`);
  lines.push(`project: ${yamlQ(project)}`);
  lines.push(`date: ${yamlQ(date)}`);
  lines.push(`format: ${format}`);
  if (vaultFm.canonical_url && String(vaultFm.canonical_url).includes('bandcamp.com')) {
    lines.push(`bandcampUrl: ${yamlQ(vaultFm.canonical_url)}`);
    lines.push(`bandcampItemType: "album"`);
  }
  if (summary) lines.push(`summary: ${yamlQ(summary)}`);
  if (tags.length) lines.push(`tags:\n${tags.map(t => `  - ${yamlQ(t)}`).join('\n')}`);
  else lines.push(`tags: []`);
  if (ap.length === 1) lines.push(`archivePath: ${yamlQ(ap[0])}`);
  else if (ap.length > 1) lines.push(`archivePath:\n${ap.map(p => `  - ${yamlQ(p)}`).join('\n')}`);
  lines.push(`published: false`);
  if (tracklist.length) {
    lines.push('tracklist:');
    for (const t of tracklist) {
      lines.push(`  - n: ${t.n}`);
      lines.push(`    title: ${yamlQ(t.title)}`);
      if (t.preservedTitle && t.preservedTitle !== t.title)
        lines.push(`    preservedTitle: ${yamlQ(t.preservedTitle)}`);
      if (t.duration) lines.push(`    duration: ${yamlQ(t.duration)}`);
    }
  }
  lines.push('---');
  lines.push(vaultBody ? vaultBody.trim() : '');

  writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
  return { filePath, existed: false };
}

// ─── Main ──────────────────────────────────────────────────────────────────────
const vaultFiles = readdirSync(VAULT_RELEASES).filter(f => f.endsWith('.md'));
const allBin = [];
const report = { matched: [], unmatched: [], created: [], noChange: [] };

for (const file of vaultFiles) {
  const vaultSlug = file.replace(/\.md$/, '');
  if (ONLY && vaultSlug !== ONLY) continue;
  if (!(vaultSlug in SLUG_MAP)) {
    report.unmatched.push(vaultSlug);
    continue;
  }

  const raw = readFileSync(join(VAULT_RELEASES, file), 'utf8');
  const { frontmatter, body } = splitFrontmatter(raw);
  const vaultFm   = parseFrontmatter(frontmatter);
  const vaultBody = body.trim();

  const siteSlug = SLUG_MAP[vaultSlug];

  // null → create new site file
  if (siteSlug === null) {
    if (!WRITE) {
      console.log(`  [CREATE] ${vaultSlug} → (new site stub)`);
      report.created.push({ vault: vaultSlug, site: '(new)' });
    } else {
      const { filePath, existed } = createSiteStub(vaultSlug, vaultFm, vaultBody);
      if (existed) {
        console.log(`  [SKIP]   ${vaultSlug} → file already exists`);
      } else {
        const suffix = vaultSlug.replace(/^alphabets-|^killd-by-/, '');
        console.log(`  [CREATED] ${vaultSlug} → src/content/releases/${suffix}.md`);
        report.created.push({ vault: vaultSlug, site: suffix });
      }
    }
    continue;
  }

  const siteFile = join(SITE_RELEASES, `${siteSlug}.md`);
  if (!existsSync(siteFile)) {
    console.log(`  [WARN]   ${vaultSlug} → mapped to "${siteSlug}" but file not found`);
    report.unmatched.push(vaultSlug);
    continue;
  }

  const siteRaw = readFileSync(siteFile, 'utf8');
  const { frontmatter: siteFMRaw } = splitFrontmatter(siteRaw);
  const siteFm = parseFrontmatter(siteFMRaw);

  const { diff, changes, bin } = mergeVaultIntoSite(vaultFm, vaultBody, siteFm);

  if (changes.length === 0) {
    report.noChange.push(siteSlug);
    continue;
  }

  report.matched.push({ vault: vaultSlug, site: siteSlug, changes });

  if (!WRITE) {
    console.log(`  [DRY-RUN] ${vaultSlug} → ${siteSlug}.md  (${changes.join(', ')})`);
    if (bin.length) bin.forEach(b => console.log(`            BIN: ${b.field} — "${String(b.site).slice(0, 60)}..."`));
  } else {
    applyDiff(siteFile, diff, changes);
    const binWithSlugs = bin.map(b => ({ ...b, siteSlug, vaultSlug }));
    allBin.push(...binWithSlugs);
    console.log(`  [WRITTEN] ${vaultSlug} → ${siteSlug}.md  (${changes.join(', ')})`);
  }
}

// Write BIN file
if (WRITE) writeBin(allBin);

// Report
console.log(`\n── Reconciliation ${WRITE ? 'complete' : 'dry-run'} ──────────────────────────────`);
console.log(`  Updated:   ${report.matched.length}`);
console.log(`  No change: ${report.noChange.length}`);
console.log(`  Created:   ${report.created.length}`);
console.log(`  Unmatched: ${report.unmatched.length}${report.unmatched.length ? ' (' + report.unmatched.join(', ') + ')' : ''}`);
console.log(`  BIN items: ${allBin.length}`);
if (!WRITE && report.matched.length > 0)
  console.log(`\n  Run with --write to apply.`);
if (report.unmatched.length > 0) {
  console.error(`\nWARNING: ${report.unmatched.length} vault release(s) have no SLUG_MAP entry.`);
  console.error(`  Add to SLUG_MAP in scripts/reconcile-vault-releases.mjs:`);
  report.unmatched.forEach(s => console.error(`    '${s}': null,  // → create new site stub`));
  console.error(`  Then run: node scripts/reconcile-vault-releases.mjs --write`);
}
