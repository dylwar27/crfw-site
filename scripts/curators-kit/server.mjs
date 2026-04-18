#!/usr/bin/env node
// Curator's Kit — local-first CMS server for archival content.
//
// Boots a small HTTP server on localhost:4322 that serves a
// frontend SPA and exposes read/write APIs over src/content/**.
// Each save writes the frontmatter / JSON back to disk AND commits
// the change to git with a descriptive message.
//
// Usage:
//   npm run cms       — boots on localhost, opens browser
//   npm run cms:lan   — binds 0.0.0.0 for phone access over wifi
//
// Design philosophy (see scripts/curators-kit/README.md):
// - Content files remain source of truth; this tool edits them.
// - No raw delete button; only "mark unpublished" or "flag speculative".
// - preservedTitle and title are two distinct fields; never collapsed.
// - Fuzzy dates accepted as-is (YYYY, YYYY-MM, YYYY-MM-DD).
// - Sensitivity is a first-class field with defaults per entity kind.

import { createServer } from 'node:http';
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';

const args = process.argv.slice(2);
const PORT = 4322;
const HOST = args.includes('--lan') ? '0.0.0.0' : '127.0.0.1';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(__dirname, '..', '..');
const contentDir = join(repo, 'src', 'content');
const publicDir = join(__dirname, 'public');

// Collections we support. Order matters for UI sidebar.
const COLLECTIONS = [
  { name: 'releases',    ext: '.md',   editable: true  },
  { name: 'photos',      ext: '.json', editable: true  },
  { name: 'videos',      ext: '.json', editable: true  },
  { name: 'voice_memos', ext: '.json', editable: true  },
  { name: 'events',      ext: '.md',   editable: true  },
  { name: 'people',      ext: '.json', editable: true  },
  { name: 'lyrics',      ext: '.md',   editable: true  },
];

// Fields editable per collection. Keep this minimal for v1 — the
// frontend can add more as we refine the widgets.
const EDITABLE_FIELDS = {
  releases:    ['title','preservedTitle','project','date','format','era','summary','tags','published','archivePath','coverArt','bandcampUrl','bandcampItemId','bandcampItemType','youtubeId','soundcloudUrl'],
  photos:      ['title','date','caption','project','source','sourceUrl','tags','published','archivePath'],
  videos:      ['title','date','kind','project','youtubeId','vimeoEmbed','summary','tags','published','archivePath','transcript'],
  voice_memos: ['title','date','summary','project','tags','published','archivePath'],
  events:      ['title','date','kind','project','location','url','source','summary','tags','published'],
  people:      ['name','role','relationship','note'],
  lyrics:      ['title','project','date','relatedRelease','relatedTrack','tags','published','archivePath'],
};

// --- Frontmatter parser (shared conventions from scripts/import-csv-edits.mjs) ---
function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { frontmatter: '', body: text };
  return { frontmatter: m[1], body: m[2] };
}

function parseFrontmatter(fm) {
  const out = {};
  const lines = fm.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (!m) { i++; continue; }
    const [, key, rest] = m;
    if (rest === '' || rest === '[]') {
      let j = i + 1;
      const block = [];
      while (j < lines.length && /^\s+/.test(lines[j])) { block.push(lines[j]); j++; }
      if (block.length === 0) {
        out[key] = rest === '[]' ? [] : null;
      } else if (block.every(l => l.match(/^\s*-\s+/))) {
        const items = [];
        let k = 0;
        while (k < block.length) {
          const first = block[k].match(/^\s*-\s+(.*)$/);
          if (!first) { k++; continue; }
          items.push(unquote(first[1]));
          k++;
        }
        out[key] = items;
      }
      i = j;
    } else {
      out[key] = unquote(rest);
      i++;
    }
  }
  return out;
}

function unquote(s) {
  if (s == null) return s;
  s = s.trim();
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s === 'null') return null;
  if (/^-?\d+$/.test(s)) return parseInt(s, 10);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}

function yamlQuote(v) {
  if (v === null || v === undefined) return '""';
  return '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// --- Read one entry ---
function readEntry(collection, slug) {
  const { ext } = COLLECTIONS.find(c => c.name === collection);
  const path = join(contentDir, collection, `${slug}${ext}`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  let data, body = '';
  if (ext === '.json') {
    data = JSON.parse(raw);
  } else {
    const { frontmatter, body: b } = splitFrontmatter(raw);
    data = parseFrontmatter(frontmatter);
    body = b;
  }
  return {
    slug,
    collection,
    data,
    body,
    path: `src/content/${collection}/${slug}${ext}`,
    mtime: Math.floor(statSync(path).mtimeMs / 1000),
  };
}

// --- List all entries in a collection (lightweight for the list view) ---
function listEntries(collection) {
  const { ext } = COLLECTIONS.find(c => c.name === collection);
  const dir = join(contentDir, collection);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(ext) && !f.includes(' 2.'))
    .map(f => {
      const slug = f.replace(new RegExp(`\\${ext}$`), '');
      const entry = readEntry(collection, slug);
      if (!entry) return null;
      // Return just what the list view needs
      const d = entry.data;
      return {
        slug, collection,
        title: d.title || d.name || slug,
        date: d.date || '',
        project: d.project || '',
        published: d.published !== false,
        format: d.format || d.kind || '',
      };
    })
    .filter(Boolean);
}

// --- Write one entry ---
function writeEntry(collection, slug, nextData, nextBody) {
  const col = COLLECTIONS.find(c => c.name === collection);
  if (!col) throw new Error(`Unknown collection: ${collection}`);
  const path = join(contentDir, collection, `${slug}${col.ext}`);
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);

  const allowed = new Set(EDITABLE_FIELDS[collection] || []);
  const raw = readFileSync(path, 'utf8');

  let finalText;
  if (col.ext === '.json') {
    const existing = JSON.parse(raw);
    // Merge: only overwrite allowed fields
    const merged = { ...existing };
    const changed = [];
    for (const [k, v] of Object.entries(nextData)) {
      if (!allowed.has(k)) continue;
      if (JSON.stringify(existing[k]) === JSON.stringify(v)) continue;
      // Drop field if value is empty string / null
      if (v === '' || v === null || v === undefined) {
        delete merged[k];
      } else {
        merged[k] = v;
      }
      changed.push(k);
    }
    if (changed.length === 0) return { changed: [] };
    finalText = JSON.stringify(merged, null, 2) + '\n';
    writeFileSync(path, finalText, 'utf8');
    return { changed };
  } else {
    // Markdown: parse frontmatter, merge allowed fields, rewrite
    const { frontmatter, body } = splitFrontmatter(raw);
    let fm = frontmatter;
    const changed = [];
    for (const [k, v] of Object.entries(nextData)) {
      if (!allowed.has(k)) continue;
      const cur = getFrontmatterScalar(fm, k);
      if (JSON.stringify(cur) === JSON.stringify(v)) continue;
      if (Array.isArray(v)) {
        fm = setFrontmatterArray(fm, k, v);
      } else if (typeof v === 'boolean') {
        fm = setFrontmatterBool(fm, k, v);
      } else if (v === '' || v === null || v === undefined) {
        // Don't drop; leave value empty string to preserve key
        fm = setFrontmatterScalar(fm, k, '');
      } else {
        fm = setFrontmatterScalar(fm, k, v);
      }
      changed.push(k);
    }
    if (changed.length === 0 && (nextBody === undefined || nextBody === body)) return { changed: [] };
    const newBody = nextBody !== undefined ? nextBody : body;
    finalText = `---\n${fm.replace(/\n?$/, '\n')}---\n${newBody}`;
    writeFileSync(path, finalText, 'utf8');
    if (nextBody !== undefined && nextBody !== body) changed.push('body');
    return { changed };
  }
}

function getFrontmatterScalar(fm, key) {
  const m = fm.match(new RegExp(`^${key}:\\s*(.*)$`, 'm'));
  if (!m) return undefined;
  return unquote(m[1]);
}

function setFrontmatterScalar(fm, key, value) {
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  const line = `${key}: ${yamlQuote(value)}`;
  if (re.test(fm)) return fm.replace(re, line);
  return fm.replace(/\n?$/, `\n${line}\n`);
}

function setFrontmatterBool(fm, key, value) {
  const re = new RegExp(`^${key}:\\s*.*$`, 'm');
  const line = `${key}: ${value ? 'true' : 'false'}`;
  if (re.test(fm)) return fm.replace(re, line);
  return fm.replace(/\n?$/, `\n${line}\n`);
}

function setFrontmatterArray(fm, key, arr) {
  const reBlock = new RegExp(`^${key}:\\s*\\n((?:\\s{2}-\\s.*\\n?)*)`, 'm');
  const reInline = new RegExp(`^${key}:\\s*\\[.*\\]\\s*$`, 'm');
  const reEmpty = new RegExp(`^${key}:\\s*\\[\\s*\\]\\s*$`, 'm');
  const block = arr.length === 0
    ? `${key}: []`
    : `${key}:\n${arr.map(t => `  - ${t}`).join('\n')}\n`;
  if (reBlock.test(fm)) return fm.replace(reBlock, block.endsWith('\n') ? block : block + '\n');
  if (reInline.test(fm) || reEmpty.test(fm)) return fm.replace(reInline.test(fm) ? reInline : reEmpty, block.trimEnd());
  return fm.replace(/\n?$/, `\n${block.trimEnd()}\n`);
}

// --- Git commit ---
function commitChange(collection, slug, changed) {
  const relPath = `src/content/${collection}/${slug}.${collection === 'photos' || collection === 'videos' || collection === 'voice_memos' || collection === 'people' ? 'json' : 'md'}`;
  try {
    execSync(`git add ${JSON.stringify(relPath)}`, { cwd: repo });
    const msg = `CMS: edit ${collection}/${slug} (${changed.join(', ')})`;
    execSync(`git commit -m ${JSON.stringify(msg)}`, { cwd: repo });
    return { committed: true, message: msg };
  } catch (err) {
    return { committed: false, error: err.message };
  }
}

// --- MIME types for static files ---
const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.svg':  'image/svg+xml',
};

// --- Server ---
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const p = url.pathname;

  // --- API routes ---
  if (p === '/api/collections') {
    return json(res, 200, COLLECTIONS.map(c => ({ name: c.name, editable: c.editable })));
  }

  if (p.startsWith('/api/entries/')) {
    // /api/entries/<collection>           → list
    // /api/entries/<collection>/<slug>    → one entry
    const parts = p.split('/').filter(Boolean); // ['api','entries',collection,slug?]
    const collection = parts[2];
    const slug = parts[3];
    if (!COLLECTIONS.find(c => c.name === collection)) return json(res, 404, { error: 'unknown collection' });

    if (req.method === 'GET') {
      if (slug) {
        const entry = readEntry(collection, slug);
        if (!entry) return json(res, 404, { error: 'not found' });
        return json(res, 200, { ...entry, editableFields: EDITABLE_FIELDS[collection] });
      }
      return json(res, 200, listEntries(collection));
    }

    if (req.method === 'PATCH' && slug) {
      const body = await readBody(req);
      const { data, body: nextBody, commit } = JSON.parse(body);
      try {
        const result = writeEntry(collection, slug, data, nextBody);
        if (result.changed.length === 0) return json(res, 200, { changed: [] });
        let commitRes = null;
        if (commit) commitRes = commitChange(collection, slug, result.changed);
        return json(res, 200, { changed: result.changed, commit: commitRes });
      } catch (err) {
        return json(res, 500, { error: err.message });
      }
    }
  }

  // --- Static files ---
  let reqPath = p === '/' ? '/index.html' : p;
  const filePath = join(publicDir, reqPath);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    res.writeHead(404); return res.end('Not found');
  }
  const ext = extname(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
  res.end(readFileSync(filePath));
});

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(resolve => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => resolve(data));
  });
}

// --- Boot ---
server.listen(PORT, HOST, () => {
  console.log(`\n┌─ Curator's Kit ─────────────────────────────────┐`);
  console.log(`│ Archive editor for ${repo.split('/').pop().padEnd(24)}     │`);
  console.log(`│                                                 │`);
  console.log(`│  Local:  http://localhost:${PORT}/                │`);
  if (HOST === '0.0.0.0') {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
      for (const iface of nets[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const ip = `http://${iface.address}:${PORT}/`.padEnd(35);
          console.log(`│  LAN:    ${ip}    │`);
        }
      }
    }
  }
  console.log(`│                                                 │`);
  console.log(`│  Ctrl-C to quit.                                │`);
  console.log(`└─────────────────────────────────────────────────┘\n`);
});
