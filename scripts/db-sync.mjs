#!/usr/bin/env node
// db-sync.mjs — read all Astro content collections and project them
// into a SQLite database at `data/crfw.db` (local) and
// `dist/data/crfw.sqlite` (deployment).
//
// The SQLite file is the queryable artifact the /admin surface will
// load via sql.js in PR B. For Phase-1 (this PR) we just produce the
// DB and print a validation report.
//
// Flow:
//   1. Load data/schema.sql and execute it on a fresh DB
//   2. Walk src/content/**; parse frontmatter and body
//   3. INSERT into per-collection tables + child/denormalized tables
//   4. Populate entry_tags, cross_refs, tracks, carousel_extras, person_links
//   5. Populate entries_fts
//   6. Emit validation report (dead refs, missing archive_path, bad dates)
//   7. Copy the DB to dist/data/crfw.sqlite (created if missing)
//
// Usage:
//   node scripts/db-sync.mjs          → builds data/crfw.db
//   node scripts/db-sync.mjs --dist   → also copies to dist/data/crfw.sqlite
//   node scripts/db-sync.mjs --quiet  → suppress per-entry log

import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, statSync, unlinkSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const toDist = args.includes('--dist');
const quiet = args.includes('--quiet');

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const repo = join(__dirname, '..');
const contentDir = join(repo, 'src', 'content');
const dataDir = join(repo, 'data');
const dbPath = join(dataDir, 'crfw.db');
const schemaPath = join(dataDir, 'schema.sql');

// ---------------------------------------------------------------
// Open the DB (better-sqlite3 is synchronous; perfect for a build step)
// ---------------------------------------------------------------
let Database;
try {
  const mod = await import('better-sqlite3');
  Database = mod.default;
} catch (err) {
  console.error('better-sqlite3 not installed. Run: npm install -D better-sqlite3');
  process.exit(2);
}

if (existsSync(dbPath)) unlinkSync(dbPath);
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Execute schema
db.exec(readFileSync(schemaPath, 'utf8'));

// Metadata
db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('schema_version', '1');
db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run('generated_at', String(Date.now()));

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------
function log(...parts) { if (!quiet) console.log(...parts); }

function splitFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { frontmatter: '', body: text };
  return { frontmatter: m[1], body: m[2] };
}

// Minimal YAML-ish parser for our flat frontmatter. Keys we care about
// are all scalar strings, arrays of strings, booleans, or arrays of
// objects (tracklist). This is intentionally narrow — same approach as
// the other import scripts. For full robustness swap in js-yaml later.
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
      // Block — could be array of scalars, array of objects, or empty
      // Look ahead
      let j = i + 1;
      const block = [];
      while (j < lines.length && /^\s+/.test(lines[j])) {
        block.push(lines[j]);
        j++;
      }
      if (block.length === 0) {
        out[key] = rest === '[]' ? [] : null;
      } else if (block.every(l => l.match(/^\s*-\s+/))) {
        // Array of scalars OR array of objects
        const items = [];
        let k = 0;
        while (k < block.length) {
          const first = block[k].match(/^\s*-\s+(.*)$/);
          if (!first) { k++; continue; }
          // Is this an object (key: ...) or a scalar?
          const obj = {};
          const kvMatch = first[1].match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
          if (kvMatch && !/^".*"$/.test(first[1]) && !/^\d/.test(first[1].trim())) {
            // First line is "- key: val" → treat as object
            obj[kvMatch[1]] = unquote(kvMatch[2]);
            // Continuation lines for this object
            let l = k + 1;
            while (l < block.length && !block[l].match(/^\s*-\s+/)) {
              const contMatch = block[l].match(/^\s+([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
              if (contMatch) obj[contMatch[1]] = unquote(contMatch[2]);
              l++;
            }
            items.push(obj);
            k = l;
          } else {
            // Scalar
            items.push(unquote(first[1]));
            k++;
          }
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

function padDate(d) {
  if (!d) return null;
  const s = String(d);
  if (/^\d{4}$/.test(s)) return `${s}-01-01`;
  if (/^\d{4}-\d{2}$/.test(s)) return `${s}-01`;
  return s;
}

// ---------------------------------------------------------------
// Prepared statements
// ---------------------------------------------------------------
const stmts = {
  release: db.prepare(`INSERT INTO releases
    (slug, title, preserved_title, project, date, date_sort, era, format,
     cover_art, bandcamp_url, bandcamp_item_id, bandcamp_item_type,
     youtube_id, soundcloud_url, bandcamp_embed, soundcloud_embed, vimeo_embed,
     archive_path, summary, body_markdown, sensitivity, published, file_path, updated_at)
    VALUES (@slug, @title, @preserved_title, @project, @date, @date_sort, @era, @format,
     @cover_art, @bandcamp_url, @bandcamp_item_id, @bandcamp_item_type,
     @youtube_id, @soundcloud_url, @bandcamp_embed, @soundcloud_embed, @vimeo_embed,
     @archive_path, @summary, @body_markdown, @sensitivity, @published, @file_path, @updated_at)`),

  photo: db.prepare(`INSERT INTO photos
    (slug, title, date, date_sort, src, caption, project, source, source_url,
     archive_path, sensitivity, published, file_path, updated_at)
    VALUES (@slug, @title, @date, @date_sort, @src, @caption, @project, @source, @source_url,
     @archive_path, @sensitivity, @published, @file_path, @updated_at)`),

  video: db.prepare(`INSERT INTO videos
    (slug, title, date, date_sort, kind, project, vimeo_embed, youtube_embed, youtube_id,
     local_src, poster, duration, transcript, source_url, archive_path, summary,
     sensitivity, published, file_path, updated_at)
    VALUES (@slug, @title, @date, @date_sort, @kind, @project, @vimeo_embed, @youtube_embed, @youtube_id,
     @local_src, @poster, @duration, @transcript, @source_url, @archive_path, @summary,
     @sensitivity, @published, @file_path, @updated_at)`),

  voice_memo: db.prepare(`INSERT INTO voice_memos
    (slug, title, date, date_sort, src, duration, transcript, summary, project,
     archive_path, sensitivity, published, file_path, updated_at)
    VALUES (@slug, @title, @date, @date_sort, @src, @duration, @transcript, @summary, @project,
     @archive_path, @sensitivity, @published, @file_path, @updated_at)`),

  event: db.prepare(`INSERT INTO events
    (slug, title, date, date_sort, kind, project, location, venue_slug, url, source,
     summary, body_markdown, sensitivity, published, file_path, updated_at)
    VALUES (@slug, @title, @date, @date_sort, @kind, @project, @location, @venue_slug, @url, @source,
     @summary, @body_markdown, @sensitivity, @published, @file_path, @updated_at)`),

  person: db.prepare(`INSERT INTO people
    (slug, name, role, relationship, note, sensitivity, published, file_path, updated_at)
    VALUES (@slug, @name, @role, @relationship, @note, @sensitivity, @published, @file_path, @updated_at)`),

  lyric: db.prepare(`INSERT INTO lyrics
    (slug, title, project, date, related_release, related_track, archive_path,
     body_markdown, sensitivity, published, file_path, updated_at)
    VALUES (@slug, @title, @project, @date, @related_release, @related_track, @archive_path,
     @body_markdown, @sensitivity, @published, @file_path, @updated_at)`),

  track: db.prepare(`INSERT INTO tracks (release_slug, position, title, preserved_title, duration, audio)
                     VALUES (?, ?, ?, ?, ?, ?)`),
  carousel: db.prepare(`INSERT INTO carousel_extras (parent_slug, parent_collection, position, media_path, media_type)
                        VALUES (?, ?, ?, ?, ?)`),
  personLink: db.prepare(`INSERT INTO person_links (person_slug, position, label, url)
                          VALUES (?, ?, ?, ?)`),
  tag: db.prepare(`INSERT OR IGNORE INTO entry_tags (collection, slug, tag) VALUES (?, ?, ?)`),
  xref: db.prepare(`INSERT OR IGNORE INTO cross_refs (from_collection, from_slug, to_collection, to_slug, kind, position)
                    VALUES (?, ?, ?, ?, ?, ?)`),
  fts: db.prepare(`INSERT INTO entries_fts (slug, collection, title, preserved_title, body, transcript)
                   VALUES (?, ?, ?, ?, ?, ?)`),

  // Vault entity tables
  vaultPerson: db.prepare(`INSERT OR REPLACE INTO people
    (slug, name, role, relationship, note, sensitivity, published, file_path, updated_at)
    VALUES (@slug, @name, @role, @relationship, @note, @sensitivity, @published, @file_path, @updated_at)`),

  vaultProject: db.prepare(`INSERT OR REPLACE INTO projects
    (slug, name, kind, primary_medium, formed_year, dissolved_year, summary, aliases_json, sensitivity, updated_at)
    VALUES (@slug, @name, @kind, @primary_medium, @formed_year, @dissolved_year, @summary, @aliases_json, @sensitivity, @updated_at)`),

  vaultVenue: db.prepare(`INSERT OR REPLACE INTO venues
    (slug, name, kind, city, status, description, updated_at)
    VALUES (@slug, @name, @kind, @city, @status, @description, @updated_at)`),

  vaultOrg: db.prepare(`INSERT OR REPLACE INTO organizations
    (slug, name, kind, description, website, status, updated_at)
    VALUES (@slug, @name, @kind, @description, @website, @status, @updated_at)`),

  vaultPress: db.prepare(`INSERT OR REPLACE INTO press
    (slug, title, kind, publication, published_date, canonical_url, summary, colin_specific, sensitivity, updated_at)
    VALUES (@slug, @title, @kind, @publication, @published_date, @canonical_url, @summary, @colin_specific, @sensitivity, @updated_at)`),

  vaultPressMention: db.prepare(`INSERT OR REPLACE INTO press_mentions
    (press_slug, target_kind, target_slug, mention_count)
    VALUES (?, ?, ?, ?)`),

  vaultFund: db.prepare(`INSERT OR REPLACE INTO funds
    (slug, name, host_org_slug, founded_year, mission, updated_at)
    VALUES (@slug, @name, @host_org_slug, @founded_year, @mission, @updated_at)`),

  vaultGrant: db.prepare(`INSERT OR REPLACE INTO grants
    (slug, fund_slug, grantee_person_slug, year, amount, purpose, notes, updated_at)
    VALUES (@slug, @fund_slug, @grantee_person_slug, @year, @amount, @purpose, @notes, @updated_at)`),
};

// ---------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------
const stats = { releases: 0, photos: 0, videos: 0, voice_memos: 0, events: 0, people: 0, lyrics: 0 };

function loadFile(collection, filename) {
  const path = join(contentDir, collection, filename);
  const raw = readFileSync(path, 'utf8');
  const slug = filename.replace(/\.(md|json)$/, '');
  const filePath = `src/content/${collection}/${filename}`;
  const updatedAt = Math.floor(statSync(path).mtimeMs / 1000);

  let data, body = '';
  if (filename.endsWith('.json')) {
    data = JSON.parse(raw);
  } else {
    const { frontmatter, body: b } = splitFrontmatter(raw);
    data = parseFrontmatter(frontmatter);
    body = b;
  }

  return { slug, data, body, filePath, updatedAt };
}

function loadRelease(filename) {
  const { slug, data, body, filePath, updatedAt } = loadFile('releases', filename);
  stmts.release.run({
    slug,
    title: data.title,
    preserved_title: data.preservedTitle ?? null,
    project: data.project,
    date: data.date,
    date_sort: padDate(data.date),
    era: data.era ?? null,
    format: data.format,
    cover_art: data.coverArt ?? null,
    bandcamp_url: data.bandcampUrl ?? null,
    bandcamp_item_id: data.bandcampItemId ?? null,
    bandcamp_item_type: data.bandcampItemType ?? null,
    youtube_id: data.youtubeId ?? null,
    soundcloud_url: data.soundcloudUrl ?? null,
    bandcamp_embed: data.bandcampEmbed ?? null,
    soundcloud_embed: data.soundcloudEmbed ?? null,
    vimeo_embed: data.vimeoEmbed ?? null,
    archive_path: data.archivePath ?? null,
    summary: data.summary ?? null,
    body_markdown: body || null,
    sensitivity: 'public',
    published: data.published === false ? 0 : 1,
    file_path: filePath,
    updated_at: updatedAt,
  });
  stats.releases++;

  // Tracks
  if (Array.isArray(data.tracklist)) {
    data.tracklist.forEach((t, idx) => {
      stmts.track.run(slug, t.n ?? idx + 1, t.title ?? '', t.preservedTitle ?? null, t.duration ?? null, t.audio ?? null);
    });
  }

  // Tags
  for (const tag of data.tags ?? []) stmts.tag.run('releases', slug, tag);

  // Cross-refs
  for (const [field, kind] of [['relatedPhotos','photos'],['relatedVideos','videos'],['relatedVoiceMemos','voice_memos'],['relatedLyrics','lyrics']]) {
    const arr = data[field] ?? [];
    arr.forEach((ref, i) => stmts.xref.run('releases', slug, kind, String(ref), 'related', i));
  }
  if (Array.isArray(data.collaborators)) {
    data.collaborators.forEach((p, i) => stmts.xref.run('releases', slug, 'people', String(p), 'collaborator', i));
  }

  // FTS
  stmts.fts.run(slug, 'releases', data.title || '', data.preservedTitle || '', [data.summary || '', body].filter(Boolean).join(' '), '');
}

function loadPhoto(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('photos', filename);
  stmts.photo.run({
    slug,
    title: data.title ?? null,
    date: data.date ?? null,
    date_sort: padDate(data.date),
    src: data.src,
    caption: data.caption ?? null,
    project: data.project ?? null,
    source: data.source ?? 'archive',
    source_url: data.sourceUrl ?? null,
    archive_path: data.archivePath ?? null,
    sensitivity: 'public',
    published: data.published === false ? 0 : 1,
    file_path: filePath,
    updated_at: updatedAt,
  });
  stats.photos++;
  for (const tag of data.tags ?? []) stmts.tag.run('photos', slug, tag);
  if (Array.isArray(data.carouselExtras)) {
    data.carouselExtras.forEach((path, i) => {
      const isVideo = /\.(mp4|mov|m4v|webm)$/i.test(path);
      stmts.carousel.run(slug, 'photos', i, path, isVideo ? 'video' : 'image');
    });
  }
  stmts.fts.run(slug, 'photos', data.title || '', '', data.caption || '', '');
}

function loadVideo(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('videos', filename);
  stmts.video.run({
    slug,
    title: data.title,
    date: data.date ?? null,
    date_sort: padDate(data.date),
    kind: data.kind ?? 'other',
    project: data.project ?? null,
    vimeo_embed: data.vimeoEmbed ?? null,
    youtube_embed: data.youtubeEmbed ?? null,
    youtube_id: data.youtubeId ?? null,
    local_src: data.localSrc ?? null,
    poster: data.poster ?? null,
    duration: data.duration ?? null,
    transcript: data.transcript ?? null,
    source_url: data.sourceUrl ?? null,
    archive_path: data.archivePath ?? null,
    summary: data.summary ?? null,
    sensitivity: 'public',
    published: data.published === false ? 0 : 1,
    file_path: filePath,
    updated_at: updatedAt,
  });
  stats.videos++;
  for (const tag of data.tags ?? []) stmts.tag.run('videos', slug, tag);
  if (Array.isArray(data.carouselExtras)) {
    data.carouselExtras.forEach((path, i) => {
      const isVideo = /\.(mp4|mov|m4v|webm)$/i.test(path);
      stmts.carousel.run(slug, 'videos', i, path, isVideo ? 'video' : 'image');
    });
  }
  stmts.fts.run(slug, 'videos', data.title || '', '', data.summary || '', data.transcript || '');
}

function loadVoiceMemo(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('voice_memos', filename);
  stmts.voice_memo.run({
    slug,
    title: data.title ?? null,
    date: data.date,
    date_sort: padDate(data.date),
    src: data.src ?? null,
    duration: data.duration ?? null,
    transcript: data.transcript ?? null,
    summary: data.summary ?? null,
    project: data.project ?? null,
    archive_path: data.archivePath ?? null,
    sensitivity: 'restricted',
    published: data.published === false ? 0 : 1,
    file_path: filePath,
    updated_at: updatedAt,
  });
  stats.voice_memos++;
  for (const tag of data.tags ?? []) stmts.tag.run('voice_memos', slug, tag);
  stmts.fts.run(slug, 'voice_memos', data.title || '', '', data.summary || '', data.transcript || '');
}

function loadEvent(filename) {
  const { slug, data, body, filePath, updatedAt } = loadFile('events', filename);
  stmts.event.run({
    slug,
    title: data.title,
    date: data.date,
    date_sort: padDate(data.date),
    kind: data.kind ?? 'life',
    project: data.project ?? null,
    location: data.location ?? null,
    venue_slug: null,
    url: data.url ?? null,
    source: data.source ?? null,
    summary: data.summary ?? null,
    body_markdown: body || null,
    sensitivity: 'public',
    published: data.published === false ? 0 : 1,
    file_path: filePath,
    updated_at: updatedAt,
  });
  stats.events++;
  for (const tag of data.tags ?? []) stmts.tag.run('events', slug, tag);
  stmts.fts.run(slug, 'events', data.title || '', '', [data.summary || '', body].filter(Boolean).join(' '), '');
}

function loadPerson(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('people', filename);
  stmts.person.run({
    slug,
    name: data.name,
    role: data.role ?? null,
    relationship: data.relationship ?? null,
    note: data.note ?? null,
    sensitivity: 'restricted',
    published: 1,
    file_path: filePath,
    updated_at: updatedAt,
  });
  stats.people++;
  if (Array.isArray(data.links)) {
    data.links.forEach((l, i) => stmts.personLink.run(slug, i, l.label, l.url));
  }
  stmts.fts.run(slug, 'people', data.name, '', data.note || '', '');
}

function loadLyric(filename) {
  const { slug, data, body, filePath, updatedAt } = loadFile('lyrics', filename);
  stmts.lyric.run({
    slug,
    title: data.title,
    project: data.project ?? null,
    date: data.date ?? null,
    related_release: data.relatedRelease ?? null,
    related_track: data.relatedTrack ?? null,
    archive_path: data.archivePath ?? null,
    body_markdown: body || null,
    sensitivity: 'restricted',
    published: data.published === false ? 0 : 1,
    file_path: filePath,
    updated_at: updatedAt,
  });
  stats.lyrics++;
  for (const tag of data.tags ?? []) stmts.tag.run('lyrics', slug, tag);
  stmts.fts.run(slug, 'lyrics', data.title || '', '', body || '', '');
}

// ---------------------------------------------------------------
// Vault entity loaders
// ---------------------------------------------------------------
function refSlug(ref) {
  if (!ref) return null;
  return String(ref).split('/').at(-1) || null;
}

const vaultStats = { people: 0, projects: 0, venues: 0, organizations: 0, press: 0, funds: 0, grants: 0 };

function loadVaultPerson(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('vault_people', filename);
  stmts.vaultPerson.run({
    slug,
    name: data.display_name || data.title || slug,
    role: data.role_summary ?? null,
    relationship: data.relationship_to_subject ?? null,
    note: typeof data.body === 'string' ? data.body.slice(0, 500) : null,
    sensitivity: data.sensitivity || 'public',
    published: data.public_display === false ? 0 : 1,
    file_path: filePath,
    updated_at: updatedAt,
  });
  for (const tag of data.tags ?? []) stmts.tag.run('vault_people', slug, tag);
  stmts.fts.run(slug, 'vault_people', data.display_name || data.title || slug, '', data.role_summary || '', '');
  vaultStats.people++;
}

function loadVaultProject(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('vault_projects', filename);
  stmts.vaultProject.run({
    slug,
    name: data.name || data.title || slug,
    kind: data.project_kind ?? null,
    primary_medium: data.primary_medium ?? null,
    formed_year: data.formed_year ?? null,
    dissolved_year: data.dissolved_year ?? null,
    summary: data.summary ?? null,
    aliases_json: data.aliases?.length ? JSON.stringify(data.aliases) : null,
    sensitivity: data.sensitivity || 'public',
    updated_at: updatedAt,
  });
  for (const tag of data.tags ?? []) stmts.tag.run('vault_projects', slug, tag);
  stmts.fts.run(slug, 'vault_projects', data.name || data.title || slug, '', data.summary || '', '');
  vaultStats.projects++;
}

function loadVaultVenue(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('vault_venues', filename);
  stmts.vaultVenue.run({
    slug,
    name: data.name || data.title || slug,
    kind: data.venue_kind ?? null,
    city: data.city ?? null,
    status: data.operational_status ?? null,
    description: data.summary ?? data.role_summary ?? null,
    updated_at: updatedAt,
  });
  for (const tag of data.tags ?? []) stmts.tag.run('vault_venues', slug, tag);
  stmts.fts.run(slug, 'vault_venues', data.name || data.title || slug, '', data.summary || '', '');
  vaultStats.venues++;
}

function loadVaultOrganization(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('vault_organizations', filename);
  const website = data.contact_public?.website
    || data.canonical_urls?.[0]
    || null;
  stmts.vaultOrg.run({
    slug,
    name: data.name || data.title || slug,
    kind: data.org_kind ?? null,
    description: data.summary ?? data.mission ?? null,
    website,
    status: data.status ?? null,
    updated_at: updatedAt,
  });
  for (const tag of data.tags ?? []) stmts.tag.run('vault_organizations', slug, tag);
  stmts.fts.run(slug, 'vault_organizations', data.name || data.title || slug, '', data.summary || data.mission || '', '');
  vaultStats.organizations++;
}

function loadVaultPress(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('vault_press', filename);
  const pubName = data.publication_name
    || (data.publication ? String(data.publication).split('/').at(-1)?.replace(/-/g, ' ') : null)
    || null;
  stmts.vaultPress.run({
    slug,
    title: data.title || slug,
    kind: data.press_kind ?? null,
    publication: pubName,
    published_date: String(data.published_date || data.date || ''),
    canonical_url: data.canonical_url ?? null,
    summary: typeof data.body === 'string' ? data.body.slice(0, 400) : null,
    colin_specific: data.colin_specific ? 1 : 0,
    sensitivity: data.sensitivity || 'public',
    updated_at: updatedAt,
  });
  // Mentions
  for (const mention of data.mentions ?? []) {
    const mSlug = refSlug(mention);
    const mKind = mention.startsWith('people/') ? 'person'
      : mention.startsWith('projects/') ? 'project'
      : mention.startsWith('venues/') ? 'venue'
      : 'other';
    if (mSlug) stmts.vaultPressMention.run(slug, mKind, mSlug, 1);
  }
  for (const tag of data.tags ?? []) stmts.tag.run('vault_press', slug, tag);
  stmts.fts.run(slug, 'vault_press', data.title || slug, '', typeof data.body === 'string' ? data.body : '', '');
  vaultStats.press++;
}

function loadVaultFund(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('vault_funds', filename);
  stmts.vaultFund.run({
    slug,
    name: data.name || data.title || slug,
    host_org_slug: refSlug(data.host_org) ?? null,
    founded_year: data.founded_year ?? null,
    mission: data.mission ?? null,
    updated_at: updatedAt,
  });
  vaultStats.funds++;
}

function loadVaultGrant(filename) {
  const { slug, data, filePath, updatedAt } = loadFile('vault_grants', filename);
  stmts.vaultGrant.run({
    slug,
    fund_slug: refSlug(data.fund) ?? null,
    grantee_person_slug: refSlug(data.grantee) ?? null,
    year: data.year ?? null,
    amount: data.amount_cents ?? null,
    purpose: data.purpose ?? null,
    notes: data.notes ?? null,
    updated_at: updatedAt,
  });
  vaultStats.grants++;
}

// ---------------------------------------------------------------
// Walk and load
// ---------------------------------------------------------------
// Filter out iCloud/Dropbox sync-conflict copies (space + digit suffix)
const DUPE_RE = / [2-9]\./;
function walk(collection, ext, loader) {
  const dir = join(contentDir, collection);
  if (!existsSync(dir)) return;
  const files = readdirSync(dir).filter(f => f.endsWith(ext) && !DUPE_RE.test(f));
  const batch = db.transaction(() => files.forEach(loader));
  batch();
  log(`  ${collection}: ${files.length}`);
}

log('Syncing content → SQLite…');
walk('releases',   '.md',   loadRelease);
walk('photos',     '.json', loadPhoto);
walk('videos',     '.json', loadVideo);
walk('voice_memos','.json', loadVoiceMemo);
walk('events',     '.md',   loadEvent);
walk('people',     '.json', loadPerson);
walk('lyrics',     '.md',   loadLyric);

log('Syncing vault entities → SQLite…');
walk('vault_people',        '.json', loadVaultPerson);
walk('vault_projects',      '.json', loadVaultProject);
walk('vault_venues',        '.json', loadVaultVenue);
walk('vault_organizations', '.json', loadVaultOrganization);
walk('vault_press',         '.json', loadVaultPress);
walk('vault_funds',         '.json', loadVaultFund);
walk('vault_grants',        '.json', loadVaultGrant);

db.exec('ANALYZE');

// ---------------------------------------------------------------
// Validation report
// ---------------------------------------------------------------
const deadRefs = db.prepare('SELECT COUNT(*) AS n FROM stats_dead_refs').get().n;
const missingAP = db.prepare('SELECT COUNT(*) AS n FROM stats_missing_archive_paths').get().n;
const totalEntries = db.prepare('SELECT COUNT(*) AS n FROM entries').get().n;
const tagCount = db.prepare('SELECT COUNT(DISTINCT tag) AS n FROM entry_tags').get().n;

log();
log('--- summary ---');
log(`Total entries:       ${totalEntries}`);
log(`  releases:           ${stats.releases}`);
log(`  photos:             ${stats.photos}`);
log(`  videos:             ${stats.videos}`);
log(`  voice_memos:        ${stats.voice_memos}`);
log(`  events:             ${stats.events}`);
log(`  people:             ${stats.people}`);
log(`  lyrics:             ${stats.lyrics}`);
log(`Vault entities:`);
log(`  people:             ${vaultStats.people}`);
log(`  projects:           ${vaultStats.projects}`);
log(`  venues:             ${vaultStats.venues}`);
log(`  organizations:      ${vaultStats.organizations}`);
log(`  press:              ${vaultStats.press}`);
log(`  funds:              ${vaultStats.funds}`);
log(`  grants:             ${vaultStats.grants}`);
log(`Unique tags:         ${tagCount}`);
log(`Dead cross-refs:     ${deadRefs}`);
log(`Missing archivePath: ${missingAP}`);

// Dead-ref detail (first 10)
if (deadRefs > 0 && !quiet) {
  const sample = db.prepare('SELECT * FROM stats_dead_refs LIMIT 10').all();
  log('\nFirst dead refs:');
  for (const r of sample) log(`  ${r.from_collection}:${r.from_slug} → ${r.to_collection}:${r.to_slug} (${r.kind})`);
}

const sizeKB = Math.round(statSync(dbPath).size / 1024);
log(`\nWrote ${dbPath} (${sizeKB} KB)`);

db.close();

// ---------------------------------------------------------------
// Optional: copy to dist for deployment
// ---------------------------------------------------------------
if (toDist) {
  const distDir = join(repo, 'dist', 'data');
  mkdirSync(distDir, { recursive: true });
  const out = join(distDir, 'crfw.sqlite');
  copyFileSync(dbPath, out);
  log(`Copied → ${out}`);
}
