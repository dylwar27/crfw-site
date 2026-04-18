-- CRFW database schema — v1
-- ---------------------------------------------------------------
-- Dialect: SQLite 3.40+ (primary target; bundled with the static
-- site via sql.js). Written to be Postgres-compatible where
-- possible — when we provision Neon, the same file should apply
-- with only trivial adjustments (TEXT → VARCHAR not required,
-- INTEGER PRIMARY KEY → SERIAL where autoincrement is desired).
--
-- Philosophy:
--   - Slugs are primary keys everywhere (not numeric IDs).
--     They're stable, human-readable, and already the foreign-key
--     vocabulary in the Astro content collections.
--   - Foreign keys use slug strings, not numeric IDs.
--   - Content-derived tables mirror src/content/config.ts.
--   - Empty "future entity" tables (venues, press, sources, etc.)
--     exist so cross-references can start pointing at them as
--     curator content arrives.
--   - No DELETE CASCADE anywhere — golden rule #1. Rows are
--     preserved; hidden via `published: false`.
--
-- See DATA_MODEL.md and DATABASE_BRIEF_FOR_CLAUDE_CODE.md for
-- the authoritative design discussion.
-- ---------------------------------------------------------------

-- Enable foreign key enforcement (SQLite defaults to off)
PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------
-- Core content tables (mirror src/content/config.ts collections)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS releases (
  slug              TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  preserved_title   TEXT,
  project           TEXT NOT NULL,
  date              TEXT NOT NULL,              -- fuzzy YYYY / YYYY-MM / YYYY-MM-DD
  date_sort         TEXT NOT NULL,              -- padded for ORDER BY
  era               TEXT,
  format            TEXT NOT NULL,              -- LP | EP | single | mix | compilation | b-sides | demo | other
  cover_art         TEXT,
  bandcamp_url      TEXT,
  bandcamp_item_id  TEXT,
  bandcamp_item_type TEXT,                      -- album | track
  youtube_id        TEXT,
  soundcloud_url    TEXT,
  bandcamp_embed    TEXT,                       -- legacy
  soundcloud_embed  TEXT,                       -- legacy
  vimeo_embed       TEXT,                       -- legacy
  archive_path      TEXT,
  summary           TEXT,
  body_markdown     TEXT,
  sensitivity       TEXT NOT NULL DEFAULT 'public' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  published         INTEGER NOT NULL DEFAULT 1, -- 0 | 1 (SQLite has no BOOLEAN)
  file_path         TEXT NOT NULL,
  updated_at        INTEGER NOT NULL            -- unix epoch seconds
);

CREATE TABLE IF NOT EXISTS photos (
  slug              TEXT PRIMARY KEY,
  title             TEXT,
  date              TEXT,
  date_sort         TEXT,
  src               TEXT NOT NULL,
  caption           TEXT,
  project           TEXT,
  source            TEXT NOT NULL DEFAULT 'archive'
                       CHECK (source IN ('archive','instagram','press','friend','unknown')),
  source_url        TEXT,
  archive_path      TEXT,
  sensitivity       TEXT NOT NULL DEFAULT 'public' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  published         INTEGER NOT NULL DEFAULT 1,
  file_path         TEXT NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS videos (
  slug              TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  date              TEXT,
  date_sort         TEXT,
  kind              TEXT NOT NULL DEFAULT 'other'
                       CHECK (kind IN ('music video','live','rehearsal','interview','home','other')),
  project           TEXT,
  vimeo_embed       TEXT,
  youtube_embed     TEXT,
  youtube_id        TEXT,
  local_src         TEXT,
  poster            TEXT,
  duration          TEXT,
  transcript        TEXT,
  source_url        TEXT,
  archive_path      TEXT,
  summary           TEXT,
  sensitivity       TEXT NOT NULL DEFAULT 'public' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  published         INTEGER NOT NULL DEFAULT 1,
  file_path         TEXT NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS voice_memos (
  slug              TEXT PRIMARY KEY,
  title             TEXT,
  date              TEXT NOT NULL,
  date_sort         TEXT NOT NULL,
  src               TEXT,
  duration          TEXT,
  transcript        TEXT,
  summary           TEXT,
  project           TEXT,
  archive_path      TEXT,
  sensitivity       TEXT NOT NULL DEFAULT 'restricted' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  published         INTEGER NOT NULL DEFAULT 1,
  file_path         TEXT NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  slug              TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  date              TEXT NOT NULL,
  date_sort         TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'life'
                       CHECK (kind IN ('life','show','release','milestone','residence','collaboration','press')),
  project           TEXT,
  location          TEXT,
  venue_slug        TEXT,                       -- FK to venues, once populated
  url               TEXT,
  source            TEXT,
  summary           TEXT,
  body_markdown     TEXT,
  sensitivity       TEXT NOT NULL DEFAULT 'public' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  published         INTEGER NOT NULL DEFAULT 1,
  file_path         TEXT NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
  slug              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  role              TEXT,
  relationship      TEXT,
  note              TEXT,
  sensitivity       TEXT NOT NULL DEFAULT 'restricted' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  published         INTEGER NOT NULL DEFAULT 1,
  file_path         TEXT NOT NULL,
  updated_at        INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lyrics (
  slug              TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  project           TEXT,
  date              TEXT,
  related_release   TEXT,                       -- FK to releases(slug)
  related_track     TEXT,
  archive_path      TEXT,
  body_markdown     TEXT,
  sensitivity       TEXT NOT NULL DEFAULT 'restricted' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  published         INTEGER NOT NULL DEFAULT 1,
  file_path         TEXT NOT NULL,
  updated_at        INTEGER NOT NULL
);

-- ---------------------------------------------------------------
-- Child / associated tables
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS tracks (
  release_slug      TEXT NOT NULL REFERENCES releases(slug),
  position          INTEGER NOT NULL,
  title             TEXT NOT NULL,
  preserved_title   TEXT,
  duration          TEXT,
  audio             TEXT,
  PRIMARY KEY (release_slug, position)
);

CREATE TABLE IF NOT EXISTS carousel_extras (
  parent_slug       TEXT NOT NULL,
  parent_collection TEXT NOT NULL CHECK (parent_collection IN ('photos','videos')),
  position          INTEGER NOT NULL,
  media_path        TEXT NOT NULL,
  media_type        TEXT NOT NULL CHECK (media_type IN ('image','video')),
  PRIMARY KEY (parent_slug, parent_collection, position)
);

CREATE TABLE IF NOT EXISTS person_links (
  person_slug       TEXT NOT NULL REFERENCES people(slug),
  position          INTEGER NOT NULL,
  label             TEXT NOT NULL,
  url               TEXT NOT NULL,
  PRIMARY KEY (person_slug, position)
);

-- Denormalized tag table — all tag arrays flattened here so tag
-- queries are fast and the UI's "top 20 by frequency" is a one-
-- liner instead of a 7-collection walk.
CREATE TABLE IF NOT EXISTS entry_tags (
  collection        TEXT NOT NULL,
  slug              TEXT NOT NULL,
  tag               TEXT NOT NULL,
  PRIMARY KEY (collection, slug, tag)
);
CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags (tag);

-- Cross-collection references. Every `relatedPhotos`, `relatedVideos`,
-- etc., field in the frontmatter becomes a row here. `kind` is the
-- relationship type so the same table can model multiple association
-- semantics (e.g. "music-video-for-track" vs generic "related").
CREATE TABLE IF NOT EXISTS cross_refs (
  from_collection   TEXT NOT NULL,
  from_slug         TEXT NOT NULL,
  to_collection     TEXT NOT NULL,
  to_slug           TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'related',
  position          INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (from_collection, from_slug, to_collection, to_slug, kind)
);
CREATE INDEX IF NOT EXISTS idx_xref_to ON cross_refs (to_collection, to_slug, kind);
CREATE INDEX IF NOT EXISTS idx_xref_from ON cross_refs (from_collection, from_slug);

-- ---------------------------------------------------------------
-- Future-entity tables (empty in v1; populated when curator
-- content lands — projects with memberships, venues, press,
-- sources, grants, relationships, assets, captures).
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS projects (
  slug              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  kind              TEXT,  -- band | solo_project | label | dj_persona | art_installation | ...
  primary_medium    TEXT,
  formed_year       INTEGER,
  dissolved_year    INTEGER,
  summary           TEXT,
  aliases_json      TEXT,  -- JSON array of aliases
  sensitivity       TEXT NOT NULL DEFAULT 'public' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  primary_cover_asset_slug TEXT,
  updated_at        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS project_memberships (
  person_slug       TEXT NOT NULL REFERENCES people(slug),
  project_slug      TEXT NOT NULL REFERENCES projects(slug),
  role              TEXT,
  start_year        INTEGER,
  end_year          INTEGER,
  is_primary        INTEGER NOT NULL DEFAULT 0,
  source_slug       TEXT,
  PRIMARY KEY (person_slug, project_slug, role)
);

CREATE TABLE IF NOT EXISTS venues (
  slug              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  kind              TEXT,  -- diy_space | gallery | museum | venue | office | other
  address           TEXT,
  city              TEXT,
  region            TEXT,
  country           TEXT,
  lat               REAL,
  lon               REAL,
  status            TEXT,  -- active | closed | demolished | transformed
  description       TEXT,
  updated_at        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS organizations (
  slug              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  kind              TEXT,  -- nonprofit | arts_center | museum | record_label | venue | media_publisher | city_government
  description       TEXT,
  website           TEXT,
  address           TEXT,
  status            TEXT,
  updated_at        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS press (
  slug              TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  kind              TEXT,  -- article | obituary | podcast_episode | video | blog_post | wiki_page | photo_caption | liner_notes
  publication       TEXT,
  author_person_slug TEXT,
  published_date    TEXT,
  canonical_url     TEXT,
  local_asset_slug  TEXT,
  pdf_asset_slug    TEXT,
  summary           TEXT,
  colin_specific    INTEGER NOT NULL DEFAULT 0,
  sensitivity       TEXT NOT NULL DEFAULT 'public' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  updated_at        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS press_mentions (
  press_slug        TEXT NOT NULL REFERENCES press(slug),
  target_kind       TEXT NOT NULL,  -- person | project | event | venue | release
  target_slug       TEXT NOT NULL,
  mention_count     INTEGER NOT NULL DEFAULT 1,
  quote             TEXT,
  PRIMARY KEY (press_slug, target_kind, target_slug)
);

CREATE TABLE IF NOT EXISTS funds (
  slug              TEXT PRIMARY KEY,
  name              TEXT NOT NULL,
  host_org_slug     TEXT,
  founded_year      INTEGER,
  dissolved_year    INTEGER,
  mission           TEXT,
  workflow          TEXT,
  updated_at        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS grants (
  slug              TEXT PRIMARY KEY,
  fund_slug         TEXT REFERENCES funds(slug),
  grantee_person_slug TEXT,
  year              INTEGER,
  amount            INTEGER,  -- cents, or NULL if undisclosed
  purpose           TEXT,     -- basic_needs | crisis | project | unspecified
  announcement_date TEXT,
  notes             TEXT,
  updated_at        INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS relationships (
  a_slug            TEXT NOT NULL REFERENCES people(slug),
  b_slug            TEXT NOT NULL REFERENCES people(slug),
  kind              TEXT NOT NULL,  -- family | romantic_partner | bandmate | collaborator | friend | mentor | journalist_subject
  is_current        INTEGER NOT NULL DEFAULT 1,
  start_year        INTEGER,
  end_year          INTEGER,
  source_slug       TEXT,
  sensitivity       TEXT NOT NULL DEFAULT 'restricted' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  notes             TEXT,
  PRIMARY KEY (a_slug, b_slug, kind)
);

CREATE TABLE IF NOT EXISTS sources (
  slug              TEXT PRIMARY KEY,
  kind              TEXT,  -- press | wiki | bandcamp_page | youtube_description | podcast_episode | liner_notes | family_recollection | user_dyl_note | wayback_capture | primary_interview | social_media_post | public_records
  canonical_url     TEXT,
  local_asset_slug  TEXT,
  retrieved_at      INTEGER,
  summary           TEXT,
  confidence        TEXT NOT NULL DEFAULT 'medium' CHECK (confidence IN ('high','medium','low','speculative')),
  sensitivity       TEXT NOT NULL DEFAULT 'public' CHECK (sensitivity IN ('public','restricted','private','redacted'))
);

CREATE TABLE IF NOT EXISTS assets (
  slug              TEXT PRIMARY KEY,
  kind              TEXT NOT NULL CHECK (kind IN ('audio','video','image','html','pdf','markdown','doc','excel','json','other')),
  path_relative     TEXT NOT NULL,
  original_url      TEXT,
  sha256            TEXT,
  size_bytes        INTEGER,
  mime_type         TEXT,
  captured_at       INTEGER,
  duration_seconds  INTEGER,
  dimensions_json   TEXT,  -- JSON {w: N, h: N}
  title             TEXT,
  description       TEXT,
  source_slug       TEXT,
  sensitivity       TEXT NOT NULL DEFAULT 'public' CHECK (sensitivity IN ('public','restricted','private','redacted')),
  public_display    INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS captures (
  slug              TEXT PRIMARY KEY,
  original_url      TEXT,
  wayback_url       TEXT,
  captured_at       INTEGER,
  http_status       INTEGER,
  asset_slug        TEXT,
  notes             TEXT
);

-- ---------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_releases_date    ON releases (date_sort DESC);
CREATE INDEX IF NOT EXISTS idx_releases_project ON releases (project);
CREATE INDEX IF NOT EXISTS idx_releases_published ON releases (published);

CREATE INDEX IF NOT EXISTS idx_photos_date      ON photos (date_sort DESC);
CREATE INDEX IF NOT EXISTS idx_photos_project   ON photos (project);
CREATE INDEX IF NOT EXISTS idx_photos_source    ON photos (source);
CREATE INDEX IF NOT EXISTS idx_photos_published ON photos (published);

CREATE INDEX IF NOT EXISTS idx_videos_date      ON videos (date_sort DESC);
CREATE INDEX IF NOT EXISTS idx_videos_project   ON videos (project);
CREATE INDEX IF NOT EXISTS idx_videos_kind      ON videos (kind);
CREATE INDEX IF NOT EXISTS idx_videos_published ON videos (published);

CREATE INDEX IF NOT EXISTS idx_vm_date      ON voice_memos (date_sort DESC);
CREATE INDEX IF NOT EXISTS idx_vm_project   ON voice_memos (project);

CREATE INDEX IF NOT EXISTS idx_events_date      ON events (date_sort DESC);
CREATE INDEX IF NOT EXISTS idx_events_kind      ON events (kind);

-- ---------------------------------------------------------------
-- Unified view: all published content in one shape for /admin
-- list view and for cross-collection queries.
-- ---------------------------------------------------------------

CREATE VIEW IF NOT EXISTS entries AS
  SELECT 'releases' AS collection, slug, title, preserved_title,
         project, date, date_sort, published, sensitivity,
         summary AS body, archive_path, file_path, updated_at
    FROM releases
  UNION ALL
  SELECT 'photos', slug, title, NULL, project, date, date_sort,
         published, sensitivity, caption AS body, archive_path,
         file_path, updated_at
    FROM photos
  UNION ALL
  SELECT 'videos', slug, title, NULL, project, date, date_sort,
         published, sensitivity, summary AS body, archive_path,
         file_path, updated_at
    FROM videos
  UNION ALL
  SELECT 'voice_memos', slug, title, NULL, project, date, date_sort,
         published, sensitivity, summary AS body, archive_path,
         file_path, updated_at
    FROM voice_memos
  UNION ALL
  SELECT 'events', slug, title, NULL, project, date, date_sort,
         published, sensitivity, summary AS body, NULL AS archive_path,
         file_path, updated_at
    FROM events
  UNION ALL
  SELECT 'people', slug, name AS title, NULL, NULL AS project,
         NULL AS date, NULL AS date_sort,
         published, sensitivity, note AS body, NULL AS archive_path,
         file_path, updated_at
    FROM people
  UNION ALL
  SELECT 'lyrics', slug, title, NULL, project, date, date AS date_sort,
         published, sensitivity, body_markdown AS body, archive_path,
         file_path, updated_at
    FROM lyrics;

-- ---------------------------------------------------------------
-- FTS (full-text search) on entries — powers /admin search and
-- future in-browser cross-collection lookup.
-- ---------------------------------------------------------------

CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
  slug UNINDEXED,
  collection UNINDEXED,
  title,
  preserved_title,
  body,
  transcript,
  tokenize = 'porter unicode61'
);

-- ---------------------------------------------------------------
-- Dashboard views (pre-baked for /admin/stats)
-- ---------------------------------------------------------------

CREATE VIEW IF NOT EXISTS stats_counts AS
  SELECT 'releases' AS collection, COUNT(*) AS total,
         SUM(published) AS published,
         SUM(CASE WHEN published = 0 THEN 1 ELSE 0 END) AS drafts
    FROM releases
  UNION ALL
  SELECT 'photos', COUNT(*), SUM(published), SUM(CASE WHEN published=0 THEN 1 ELSE 0 END) FROM photos
  UNION ALL
  SELECT 'videos', COUNT(*), SUM(published), SUM(CASE WHEN published=0 THEN 1 ELSE 0 END) FROM videos
  UNION ALL
  SELECT 'voice_memos', COUNT(*), SUM(published), SUM(CASE WHEN published=0 THEN 1 ELSE 0 END) FROM voice_memos
  UNION ALL
  SELECT 'events', COUNT(*), SUM(published), SUM(CASE WHEN published=0 THEN 1 ELSE 0 END) FROM events
  UNION ALL
  SELECT 'people', COUNT(*), SUM(published), SUM(CASE WHEN published=0 THEN 1 ELSE 0 END) FROM people
  UNION ALL
  SELECT 'lyrics', COUNT(*), SUM(published), SUM(CASE WHEN published=0 THEN 1 ELSE 0 END) FROM lyrics;

CREATE VIEW IF NOT EXISTS stats_release_coverage AS
  SELECT COUNT(*) AS total,
         SUM(CASE WHEN cover_art      IS NOT NULL THEN 1 ELSE 0 END) AS with_cover,
         SUM(CASE WHEN summary        IS NOT NULL AND summary != '' THEN 1 ELSE 0 END) AS with_summary,
         SUM(CASE WHEN bandcamp_item_id IS NOT NULL THEN 1 ELSE 0 END) AS with_bandcamp,
         SUM(CASE WHEN youtube_id     IS NOT NULL THEN 1 ELSE 0 END) AS with_youtube,
         SUM(CASE WHEN soundcloud_url IS NOT NULL THEN 1 ELSE 0 END) AS with_soundcloud
    FROM releases;

CREATE VIEW IF NOT EXISTS stats_video_coverage AS
  SELECT COUNT(*) AS total,
         SUM(CASE WHEN youtube_id IS NOT NULL THEN 1 ELSE 0 END) AS with_youtube_id,
         SUM(CASE WHEN transcript IS NOT NULL AND transcript != '' THEN 1 ELSE 0 END) AS with_transcript,
         SUM(CASE WHEN local_src IS NOT NULL THEN 1 ELSE 0 END) AS with_local_src
    FROM videos;

CREATE VIEW IF NOT EXISTS stats_voice_memo_coverage AS
  SELECT COUNT(*) AS total,
         SUM(CASE WHEN transcript IS NOT NULL AND transcript != '' THEN 1 ELSE 0 END) AS with_transcript,
         SUM(CASE WHEN src IS NOT NULL THEN 1 ELSE 0 END) AS with_audio_src
    FROM voice_memos;

CREATE VIEW IF NOT EXISTS stats_tag_frequency AS
  SELECT tag, COUNT(*) AS uses
    FROM entry_tags
   GROUP BY tag
   ORDER BY uses DESC;

CREATE VIEW IF NOT EXISTS stats_dead_refs AS
  SELECT cr.from_collection, cr.from_slug, cr.to_collection, cr.to_slug, cr.kind
    FROM cross_refs cr
    LEFT JOIN entries e ON e.collection = cr.to_collection AND e.slug = cr.to_slug
   WHERE e.slug IS NULL;

CREATE VIEW IF NOT EXISTS stats_missing_archive_paths AS
  SELECT collection, slug, title FROM entries
  WHERE (archive_path IS NULL OR archive_path = '')
    AND collection IN ('releases','photos','videos','voice_memos');

-- ---------------------------------------------------------------
-- Meta table for schema versioning
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- (the sync script will INSERT schema_version and generated_at rows)
