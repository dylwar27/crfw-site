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
import { networkInterfaces, homedir } from 'node:os';

const args = process.argv.slice(2);
const PORT = 4322;
const HOST = args.includes('--lan') ? '0.0.0.0' : '127.0.0.1';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(__dirname, '..', '..');
const publicDir = join(__dirname, 'public');

const VAULT_PATH = process.env.CRFW_VAULT_PATH || join(
  homedir(),
  'Library', 'CloudStorage', 'Dropbox', 'CRFW', 'CRFW Archive', '_Vault'
);

// Two content sources (Session 13). The CMS coordinates edits against
// both. `site` content is git-tracked and commits on save. `vault`
// content lives in Dropbox and writes directly without git commits
// (that's the curator's existing Obsidian workflow).
const SOURCES = {
  site: {
    label: 'Site',
    root: join(repo, 'src', 'content'),
    commits: true,
    // Per-collection config
    collections: [
      { name: 'releases',    ext: '.md',   editable: true },
      { name: 'photos',      ext: '.json', editable: true },
      { name: 'videos',      ext: '.json', editable: true },
      { name: 'voice_memos', ext: '.json', editable: true },
      { name: 'events',      ext: '.md',   editable: true },
      { name: 'people',      ext: '.json', editable: true },
      { name: 'lyrics',      ext: '.md',   editable: true },
    ],
  },
  vault: {
    label: 'Vault',
    root: VAULT_PATH,
    commits: false, // vault is in Dropbox, not our git repo
    collections: [
      { name: 'people',        ext: '.md', editable: true },
      { name: 'projects',      ext: '.md', editable: true },
      { name: 'releases',      ext: '.md', editable: true },
      { name: 'tracks',        ext: '.md', editable: true },
      { name: 'venues',        ext: '.md', editable: true },
      { name: 'organizations', ext: '.md', editable: true },
      { name: 'events',        ext: '.md', editable: true },
      { name: 'press',         ext: '.md', editable: true },
      { name: 'funds',         ext: '.md', editable: true },
      { name: 'grants',        ext: '.md', editable: true },
      { name: 'series',        ext: '.md', editable: true },
    ],
  },
};

// Fields editable per (source, collection). Keep minimal; the frontend
// can grow the list as widgets mature. Vault schemas are permissive by
// design — the field list here is just what the editor UI surfaces;
// saves preserve unknown fields untouched.
const EDITABLE_FIELDS = {
  'site:releases':    ['title','preservedTitle','project','date','format','era','summary','tags','published','archivePath','coverArt','bandcampUrl','bandcampItemId','bandcampItemType','youtubeId','soundcloudUrl'],
  'site:photos':      ['title','date','caption','project','source','sourceUrl','tags','published','archivePath'],
  'site:videos':      ['title','date','kind','project','youtubeId','vimeoEmbed','summary','tags','published','archivePath','transcript'],
  'site:voice_memos': ['title','date','summary','project','tags','published','archivePath'],
  'site:events':      ['title','date','kind','project','location','url','source','summary','tags','published'],
  'site:people':      ['name','role','relationship','note'],
  'site:lyrics':      ['title','project','date','relatedRelease','relatedTrack','tags','published','archivePath'],
  // Vault shares a common header + kind-specific fields; we surface both.
  'vault:people':        ['title','display_name','legal_name','aliases','born','died','hometown','role_summary','sensitivity','public_display','confidence','tags'],
  'vault:projects':      ['title','name','aliases','project_kind','primary_medium','formed_year','dissolved_year','summary','sensitivity','public_display','tags'],
  'vault:releases':      ['title','preservedTitle','project','release_kind','release_date','release_year','canonical_url','cover_path','is_posthumous','sensitivity','tags'],
  'vault:tracks':        ['title','preservedTitle','release','position','duration_seconds','audio_path','sensitivity','tags'],
  'vault:venues':        ['title','name','venue_kind','address','city','region','country','status','opened_year','closed_year','sensitivity','tags'],
  'vault:organizations': ['title','name','org_kind','website','address','status','sensitivity','tags'],
  'vault:events':        ['title','event_kind','date','venue','description','sensitivity','tags'],
  'vault:press':         ['title','publication','author','published_date','press_kind','canonical_url','wayback_url','colin_specific','colin_mention_count','sensitivity','tags'],
  'vault:funds':         ['title','name','host_organization','founded_year','dissolved_year','mission','workflow','sensitivity','tags'],
  'vault:grants':        ['title','fund','grantee','year','amount','purpose','announcement_date','sensitivity','tags'],
  'vault:series':        ['title','name','project','date_start','date_end','members','summary','sensitivity','tags'],
};

function findCollectionConfig(sourceId, collectionName) {
  const src = SOURCES[sourceId];
  if (!src) return null;
  const coll = src.collections.find(c => c.name === collectionName);
  if (!coll) return null;
  return { source: src, coll, key: `${sourceId}:${collectionName}` };
}

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

// --- Read one entry (source-aware) ---
function readEntry(sourceId, collection, slug) {
  const cfg = findCollectionConfig(sourceId, collection);
  if (!cfg) return null;
  const path = join(cfg.source.root, collection, `${slug}${cfg.coll.ext}`);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  let data, body = '';
  if (cfg.coll.ext === '.json') {
    data = JSON.parse(raw);
  } else {
    const { frontmatter, body: b } = splitFrontmatter(raw);
    data = parseFrontmatter(frontmatter);
    body = b;
  }
  return {
    slug,
    source: sourceId,
    collection,
    data,
    body,
    path, // absolute path — UI shows a prettified version
    mtime: Math.floor(statSync(path).mtimeMs / 1000),
  };
}

// --- List all entries in a collection (lightweight for the list view) ---
// Enriched with thumbnail info so the grid view can render preview images.
function listEntries(sourceId, collection) {
  const cfg = findCollectionConfig(sourceId, collection);
  if (!cfg) return [];
  const dir = join(cfg.source.root, collection);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => f.endsWith(cfg.coll.ext) && !f.includes(' 2.'))
    .map(f => {
      const slug = f.replace(new RegExp(`\\${cfg.coll.ext}$`), '');
      const entry = readEntry(sourceId, collection, slug);
      if (!entry) return null;
      const d = entry.data;
      // Thumbnail: prefer cover art / src / poster / first carousel extra
      let thumb = d.coverArt || d.src || d.poster || null;
      if (!thumb && Array.isArray(d.carouselExtras) && d.carouselExtras.length > 0) {
        thumb = d.carouselExtras[0];
      }
      // Caption preview: caption → summary → role_summary → description →
      // first line of body → transcript
      const captionPreview = d.caption
        ? String(d.caption).slice(0, 140)
        : (d.summary
          ? String(d.summary).slice(0, 140)
          : (d.role_summary
            ? String(d.role_summary).slice(0, 140)
            : (d.description
              ? String(d.description).slice(0, 140)
              : (entry.body
                ? String(entry.body).slice(0, 140).replace(/\s+/g, ' ').trim()
                : (d.transcript
                  ? String(d.transcript).slice(0, 140).replace(/\s+/g, ' ').trim()
                  : '')))));
      return {
        slug,
        source: sourceId,
        collection,
        title: d.title || d.name || d.display_name || slug,
        date: d.date || d.release_date || d.published_date || d.born || d.date_start || '',
        project: typeof d.project === 'string' ? d.project : (d.project?.id || ''),
        published: d.public_display !== false && d.published !== false,
        format: d.format || d.release_kind || d.event_kind || d.kind || '',
        thumb,
        captionPreview,
        tags: Array.isArray(d.tags) ? d.tags : [],
      };
    })
    .filter(Boolean);
}

// --- Write one entry (source-aware) ---
function writeEntry(sourceId, collection, slug, nextData, nextBody) {
  const cfg = findCollectionConfig(sourceId, collection);
  if (!cfg) throw new Error(`Unknown ${sourceId}/${collection}`);
  const path = join(cfg.source.root, collection, `${slug}${cfg.coll.ext}`);
  if (!existsSync(path)) throw new Error(`File not found: ${path}`);

  const allowed = new Set(EDITABLE_FIELDS[cfg.key] || []);
  const raw = readFileSync(path, 'utf8');

  let finalText;
  if (cfg.coll.ext === '.json') {
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

// --- Git commit (site-only; vault edits skip this) ---
function commitChange(sourceId, collection, slug, changed) {
  if (!SOURCES[sourceId]?.commits) return { committed: false, skipped: 'not-a-git-source' };
  const cfg = findCollectionConfig(sourceId, collection);
  const relPath = `src/content/${collection}/${slug}${cfg.coll.ext}`;
  try {
    execSync(`git add ${JSON.stringify(relPath)}`, { cwd: repo });
    const msg = `CMS: edit ${collection}/${slug} (${changed.join(', ')})`;
    execSync(`git commit -m ${JSON.stringify(msg)}`, { cwd: repo });
    return { committed: true, message: msg };
  } catch (err) {
    return { committed: false, error: err.message };
  }
}

function commitBulk(sourceId, collection, slugs, summary) {
  if (!SOURCES[sourceId]?.commits) return { committed: false, skipped: 'not-a-git-source' };
  const cfg = findCollectionConfig(sourceId, collection);
  try {
    for (const slug of slugs) {
      const relPath = `src/content/${collection}/${slug}${cfg.coll.ext}`;
      execSync(`git add ${JSON.stringify(relPath)}`, { cwd: repo });
    }
    const msg = `CMS: bulk ${summary} — ${slugs.length} ${collection}`;
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
  // New (Session 13): /api/sources — lists available content roots
  if (p === '/api/sources') {
    return json(res, 200, Object.entries(SOURCES).map(([id, s]) => ({
      id,
      label: s.label,
      commits: s.commits,
      collections: s.collections.map(c => ({ name: c.name, editable: c.editable })),
    })));
  }

  // Back-compat: /api/collections defaults to site source
  if (p === '/api/collections') {
    return json(res, 200, SOURCES.site.collections.map(c => ({ name: c.name, editable: c.editable })));
  }

  // --- Bulk write: one patch to many slugs, one commit ---
  // /api/bulk — body includes `source` (defaults to 'site')
  if (p === '/api/bulk' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const { source = 'site', collection, slugs, patch, summary } = JSON.parse(body);
      if (!Array.isArray(slugs) || slugs.length === 0) {
        return json(res, 400, { error: 'slugs required' });
      }
      if (!findCollectionConfig(source, collection)) {
        return json(res, 404, { error: `unknown ${source}/${collection}` });
      }
      const results = { updated: [], unchanged: [], errors: [] };
      for (const slug of slugs) {
        try {
          const r = writeEntry(source, collection, slug, patch || {}, undefined);
          if (r.changed.length === 0) results.unchanged.push(slug);
          else results.updated.push({ slug, changed: r.changed });
        } catch (err) {
          results.errors.push({ slug, error: err.message });
        }
      }
      let commitRes = null;
      if (results.updated.length > 0) {
        const summ = summary || `patch ${Object.keys(patch || {}).join(',') || 'noop'}`;
        commitRes = commitBulk(source, collection, results.updated.map(u => u.slug), summ);
      }
      return json(res, 200, { ...results, commit: commitRes });
    } catch (err) {
      return json(res, 500, { error: err.message });
    }
  }

  // --- Media proxy: serve files from public/media/ to the CMS UI ---
  if (p.startsWith('/media/')) {
    const relPath = p.slice('/media/'.length);
    const mediaFile = join(repo, 'public', 'media', relPath);
    const normalized = resolve(mediaFile);
    if (!normalized.startsWith(join(repo, 'public'))) {
      res.writeHead(403); return res.end('Forbidden');
    }
    if (!existsSync(normalized) || statSync(normalized).isDirectory()) {
      res.writeHead(404); return res.end('Not found');
    }
    const ext = extname(normalized).toLowerCase();
    const mime = {
      '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
      '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
      '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm',
    }[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'max-age=3600' });
    return res.end(readFileSync(normalized));
  }

  if (p.startsWith('/api/entries/')) {
    // New form:   /api/entries/<source>/<collection>[/<slug>]
    // Legacy:     /api/entries/<collection>[/<slug>]  (defaults to site)
    const parts = p.split('/').filter(Boolean); // ['api','entries',…]
    let source, collection, slug;
    if (parts[2] in SOURCES) {
      source = parts[2]; collection = parts[3]; slug = parts[4];
    } else {
      source = 'site'; collection = parts[2]; slug = parts[3];
    }
    if (!findCollectionConfig(source, collection)) {
      return json(res, 404, { error: `unknown ${source}/${collection}` });
    }

    if (req.method === 'GET') {
      if (slug) {
        const entry = readEntry(source, collection, slug);
        if (!entry) return json(res, 404, { error: 'not found' });
        const key = `${source}:${collection}`;
        return json(res, 200, {
          ...entry,
          editableFields: EDITABLE_FIELDS[key],
          commits: !!SOURCES[source].commits,
        });
      }
      return json(res, 200, listEntries(source, collection));
    }

    if (req.method === 'PATCH' && slug) {
      const body = await readBody(req);
      const { data, body: nextBody, commit } = JSON.parse(body);
      try {
        const result = writeEntry(source, collection, slug, data, nextBody);
        if (result.changed.length === 0) return json(res, 200, { changed: [] });
        let commitRes = null;
        if (commit) commitRes = commitChange(source, collection, slug, result.changed);
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
