# DATA_MODEL.md — briefing for the database build

**Audience:** the next Claude Code instance, which is designing and writing a database that holds the CRFW (Colin Ward) archive. You have full context from this document — no need to re-derive it from CLAUDE.md. Read this before proposing schema, before choosing a database engine, and before writing import code.

**Attitude:** this is archival work, not a typical product database. Preservation beats cleanliness. Fuzzy data beats empty data. Curator voice beats machine voice. The data model must survive twenty years of additions without a schema migration holding you hostage.

---

## 1. What you're building and why

Colin Ward — stage names CRFW, killd by, alphabets — was a prolific experimental musician who passed away. His brother **Dyl** is the curator. The goal is a searchable, cross-linked presentation of Colin's life and work. Current shape:

- **Dropbox archive** (`~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/`, ~125 GB, ~45,000 files) — the truth. Never lossy. All provenance threads back here via `archivePath`.
- **Astro static site** (this repo) — the presentation layer. File-based content collections validated by Zod schemas in [src/content/config.ts](src/content/config.ts). Builds to ~560 static HTML pages (timeline + reader pages + /admin + /about + /projects) + Pagefind index (~19,000 words).
- **A database (your job)** — the structured query layer the site is missing. The file-based collections are great for edit-by-hand and git diffs; they are less good for ad-hoc queries, cross-collection analytics, and the kind of dashboarding the curator keeps asking for.

**The database does not replace the file-based collections.** It mirrors them, stays in sync via import scripts, and enables queries the filesystem can't. Curator edits still flow through files → CSV roundtrip → files. The database reads; the files write. If the DB disappears tomorrow, nothing is lost.

---

## 2. Where data actually lives (three layers)

```
┌──────────────────────────────────┐
│ 1. Dropbox archive (the truth)   │  CRFW Archive/... — audio, video, images,
│    ~125 GB across ~45,000 files  │  Word docs, scans, Whisper .txt sidecars,
│                                  │  Instagram scrapes, xlsx curator snapshots.
└──────────────┬───────────────────┘
               │ referenced by archivePath on every entry
               ▼
┌──────────────────────────────────┐
│ 2. src/content/ (the repo copy)  │  .md / .json files per entry, validated
│    ~1,958 entries today          │  at build time. Git-diffable. Editable
│                                  │  by hand or via CSV roundtrip.
└──────────────┬───────────────────┘
               │ ingested / indexed
               ▼
┌──────────────────────────────────┐
│ 3. DATABASE (what you're building)
│    Queryable projection of #2.   │  Search, faceting, /admin tables,
│                                  │  timeline rendering, cross-refs.
└──────────────────────────────────┘
```

**Media binaries** (cover art, IG photos, IG videos, video posters) are in `public/media/<collection>/<slug>/<file>`. They are served as static assets by Astro. Large-media strategy for the future (Git LFS, external CDN) is not your problem to solve, but keep binary paths in the DB so they can be rewritten later without a schema change.

---

## 3. The seven collections (current schemas)

From [src/content/config.ts](src/content/config.ts). Zod schemas. `fuzzyDate = /^\d{4}(-\d{2}(-\d{2})?)?$/` accepts `"2014"`, `"2014-07"`, or `"2014-07-23"` — treat it as a string in your DB, not a DATE type, or you'll lose fuzziness.

### 3.1 `releases` — music (LPs, EPs, singles, mixes, b-sides, demos, compilations, other)
`238 entries today`. The most content-dense collection.

| field | type | notes |
|---|---|---|
| title | string | readable |
| preservedTitle | string? | Colin's original typography — **never fix** |
| project | string | free-form era: `alphabets`, `killd by`, `Colin Ward`, `collaboration`, `life`, `other`, ad-hoc |
| date | fuzzyDate | required |
| era | string? | human-readable era tag |
| format | enum | `LP` `EP` `single` `mix` `compilation` `b-sides` `demo` `other` |
| coverArt | string? | `/media/releases/<slug>/cover.<ext>` |
| bandcampUrl, bandcampItemId, bandcampItemType | string? | `album` or `track`; iframes generated from itemId at render time |
| youtubeId | string? | 11-char YT video id |
| soundcloudUrl | string? | canonical SC URL |
| bandcampEmbed, soundcloudEmbed, vimeoEmbed | url? | **legacy** pre-Session 09; keep for backwards compat |
| tracklist | array | nested: `{ n?, title, preservedTitle?, duration?, audio? }` |
| collaborators | ref[] | → `people` |
| relatedPhotos | ref[] | → `photos` |
| relatedVideos | ref[] | → `videos` |
| relatedVoiceMemos | ref[] | → `voice_memos` |
| relatedLyrics | ref[] | → `lyrics` |
| tags | string[] | default `[]` |
| archivePath | string? | `CRFW Archive/...` |
| summary | string? | curator prose — **never AI-generated** |
| published | boolean | default `true`; `false` = draft |

Body content: markdown after frontmatter.

**DB notes:** tracklist is a sub-table (1:N). Five ref[] fields are many-to-many join tables. Embed priority at render time is **Bandcamp > YouTube > SoundCloud**; preserve that ordering if your query returns them together.

### 3.2 `photos` — images
`866 entries today` (all IG). Data collection (JSON, not markdown).

| field | type | notes |
|---|---|---|
| title | string? | curator-provided, usually empty on bulk imports |
| date | fuzzyDate? | |
| src | string | **required** — `/media/photos/<slug>/primary.jpg` |
| caption | string? | for IG: original post caption, verbatim |
| project | string? | often empty, awaiting curator assignment |
| people | ref[] | → `people` |
| tags | string[] | includes hashtag-derived tags + `instagram-personal`/`instagram-art` for IG imports |
| source | enum | `archive` `instagram` `press` `friend` `unknown` |
| sourceUrl | url? | IG permalink for `source: instagram` |
| carouselExtras | string[] | **IMPORTANT** — see §5 |
| archivePath | string? | `CRFW Archive/Instagram/@<handle>/<shortcode>_1.jpg` for IG |
| published | boolean | default `true`; IG imports default `false` |

### 3.3 `videos` — videos (any provenance)
`538 entries today`. See §5 for the photos-vs-videos discriminator logic.

| field | type | notes |
|---|---|---|
| title | string | required |
| date | fuzzyDate? | |
| vimeoEmbed | url? | full iframe URL |
| youtubeEmbed | url? | full iframe URL |
| youtubeId | string? | 11-char id, preferred over youtubeEmbed |
| localSrc | string? | `/media/videos/<slug>/<file>.mp4` — set for IG videos, NOT for archive videos (too big for git) |
| poster | string? | thumbnail path |
| duration | string? | |
| kind | enum | `music video` `live` `rehearsal` `interview` `home` `other` |
| project | ref? | → `people` / free-form project string |
| people | ref[] | → `people` |
| summary | string? | |
| tags | string[] | |
| transcript | string? | Whisper-generated, may be thousands of words |
| sourceUrl | url? | IG permalink for IG videos |
| carouselExtras | string[] | carousel secondary media |
| archivePath | string? | |
| published | boolean | default `true` |

**Render-time discriminator** (the site uses this and your DB queries probably should too): a video row renders via whichever embed is set, priority:
1. `youtubeId` → generated iframe
2. `youtubeEmbed` → raw iframe URL
3. `vimeoEmbed` → raw iframe URL
4. `localSrc` → HTML `<video>` tag
5. none of the above → archive-only entry, renders as a stub with `archivePath` link

**At least one of those should be set** on a published video. A video with none is a placeholder — acceptable for drafts, but flag in UI.

### 3.4 `voice_memos` — Colin's phone recordings
`305 entries today`. Sep 2015 – Dec 2016.

| field | type | notes |
|---|---|---|
| title | string? | often empty — subtitle derives from transcript preview |
| date | fuzzyDate | required |
| src | string? | `/media/voice-memos/<file>.m4a` (most not committed — too big) |
| duration | string? | |
| transcript | string? | Whisper text, sometimes long |
| summary | string? | curator prose |
| project | string? | |
| tags | string[] | |
| archivePath | string? | `CRFW Archive/_Documentation/Voice Memos/<file>.m4a` |
| published | boolean | default `true` |

Voice memos with non-trivial transcripts get a permalinked reader page at `/voice-memo/<slug>` (see `src/pages/voice-memo/[slug].astro`).

### 3.5 `events` — non-release moments on the timeline
`11 entries today`. 1 life event + 10 press articles.

| field | type | notes |
|---|---|---|
| title | string | required |
| date | fuzzyDate | required |
| project | string? | |
| kind | enum | `life` `show` `release` `milestone` `residence` `collaboration` `press` |
| location | string? | |
| url | url? | external link (press article, tribute) |
| source | string? | e.g. `westword.com` |
| people | ref[] | → `people` |
| relatedPhotos | ref[] | → `photos` |
| tags | string[] | |
| summary | string? | |
| published | boolean | default `true` |

Body: markdown.

### 3.6 `people` — humans (collaborators, credited musicians, etc.)
Currently unseeded but validates. Referenced from releases, photos, videos, events.

| field | type | notes |
|---|---|---|
| name | string | required |
| role | string? | |
| relationship | string? | |
| links | array | `{ label, url }[]` |
| note | string? | |

### 3.7 `lyrics` — lyric sheets tied to tracks
Currently unseeded.

| field | type | notes |
|---|---|---|
| title | string | required |
| project | string? | |
| date | fuzzyDate? | |
| relatedRelease | ref? | → `releases` |
| relatedTrack | string? | a title string within that release's tracklist |
| archivePath | string? | |
| tags | string[] | |
| published | boolean | default `true` |

Body: markdown.

---

## 4. The cross-reference web (model these as many-to-many join tables)

```
releases ─┬─ collaborators ──→ people
          ├─ relatedPhotos ──→ photos
          ├─ relatedVideos ──→ videos
          ├─ relatedVoiceMemos → voice_memos
          └─ relatedLyrics ──→ lyrics

events ──┬─ people ────────→ people
         └─ relatedPhotos ─→ photos

photos ──── people ────────→ people
videos ──── people ────────→ people
lyrics ──── relatedRelease → releases (single, not array)
```

**Slugs are the primary keys**, not numeric IDs. Slugs are filename stems (e.g. `court-clothes.md` → slug `court-clothes`). Astro's `reference('collection')` field validates that a slug exists at build time; your DB should enforce the same with foreign-key constraints to `<collection>.slug`.

**Slugs are stable.** Once assigned, they don't change. If a re-import wants a new slug that collides, existing scripts append `-2`, `-3`, etc. (see [scripts/import-video-stubs.mjs:106](scripts/import-video-stubs.mjs)). Honor that — a merge should never change a slug that is referenced elsewhere.

---

## 5. Photos vs videos vs carousels — get this right

This is the structural distinction the curator most wants correct.

### Photos and videos are separate collections, not `media_type` flavors.
A row either has `photos.src` (image) or `videos.localSrc`/`videos.*Embed`. One row, one collection, one render pattern. **Do not merge them into a unified `media` table** — the query patterns and filter UX both depend on the split (the Medium filter axis on the timeline treats `photo` and `video` as distinct facets).

### Archive videos ≠ Instagram videos ≠ YouTube videos, but they share a schema.
Discriminate by which field is populated:

- `youtubeId` set → YouTube embed, rendered as iframe, no local file
- `vimeoEmbed` set → Vimeo embed, rendered as iframe
- `localSrc` set → self-hosted MP4 (only IG videos today — archive videos are too big to commit)
- `archivePath` set but none of the above → archive stub, points at the Dropbox file, no playback in-browser

A single video row can have several of these (e.g. a YouTube-uploaded music video that's also in the Dropbox archive — `youtubeId` AND `archivePath`). Store them all; let the render layer pick.

### Carousels: one post → one entry, full stop.

Instagram carousel posts contain up to 10 media items (mix of images and videos). **Every carousel is represented as ONE row.** Not N rows. The fields:

- `src` (if photo-primary) or `localSrc` (if video-primary) — the first item
- `carouselExtras: string[]` — paths to the remaining 1–9 items, in post order

**Which collection does a carousel live in?** The primary item's type decides:
- First item is an image → row in `photos`
- First item is a video → row in `videos`

Yes, this means a carousel with 1 image then 4 videos lives in `photos` and has 4 `.mp4` paths in `carouselExtras`. That's intentional: it keeps 1 IG post = 1 timeline card.

**Rationale:** a carousel is a single authored unit. The user scrolled through it as one post. Splitting it into 10 rows would clutter the timeline and lose the intended grouping. The first-item rule is arbitrary but stable — the importer is [scripts/import-instagram.mjs](scripts/import-instagram.mjs) and you can read its `classifyPost` logic.

**In your DB:** `carousel_extras` is a 1:N child table keyed to the parent row's slug, with `(slug, position, media_path, media_type)` columns. Preserve order by `position`. The `media_type` column is critical for carousels because a photos-primary carousel can have video extras — downstream renderers need to know which `<img>` vs `<video>` to emit.

### Shortcodes and slugs for IG entries

- IG shortcode: `BemAJfdlzwd` (11 chars, base64-ish). Globally unique on IG.
- Slug: `ig-<handle>-<shortcode>`, e.g. `ig-chi-swoo-BemAJfdlzwd`.
  - Handle gets slugified first (`_` → `-`), so `chi_swoo_` → `chi-swoo`.
  - Store the raw shortcode as its own column — it's the natural join key if you cross-reference IG-only data.

---

## 6. Golden rules that directly shape the data model

| rule | impact on schema |
|---|---|
| Never delete content | No hard DELETE. Use `published: false` for "hide" and a `deleted_at` timestamp if you really need tombstones. Curator-flag items (wrong/speculative) live on with a `flag` tag or note. |
| Preserve Colin's typography | `preservedTitle` is **not** redundant with `title`. They are two separate strings. Never dedupe, never auto-fix. |
| archivePath on every entry | Model it as a non-nullable "where does this come from" string where possible; accept NULL for born-digital content that genuinely has no archive file (most events, some people entries). Never fabricate a path. |
| Fuzzy dates are valid | Keep dates as strings with the regex above. If you need ordering, derive a `date_sort` column: pad `2014` to `2014-01-01`, `2014-07` to `2014-07-01`. Preserve the original string. |
| No AI-generated summaries | `summary` nullable. Do not backfill. Do not suggest. Leave empty for the curator. |
| Draft-default for new bulk imports | Import scripts set `published: false`. Your import reflector should preserve that exactly — do not invert the default. |

---

## 7. Workflows the DB needs to support

### 7.1 Write paths (how data gets in — don't change these, mirror them)

| script | produces |
|---|---|
| [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs) | release stubs from archive folders |
| [scripts/import-cover-art.mjs](scripts/import-cover-art.mjs) | cover images + frontmatter update |
| [scripts/import-voice-memos.mjs](scripts/import-voice-memos.mjs) | voice memo entries with Whisper transcripts |
| [scripts/import-video-stubs.mjs](scripts/import-video-stubs.mjs) | video entries from `_Documentation/Videos/` |
| [scripts/import-video-transcripts.mjs](scripts/import-video-transcripts.mjs) | backfills transcript field on existing video entries |
| [scripts/import-embeds.mjs](scripts/import-embeds.mjs) | BC/YT/SC embeds from xlsx snapshot |
| [scripts/import-articles.mjs](scripts/import-articles.mjs) | press events from xlsx snapshot |
| [scripts/fetch-instagram.sh](scripts/fetch-instagram.sh) | Stage 1 of IG ingest (gallery-dl) |
| [scripts/import-instagram.mjs](scripts/import-instagram.mjs) | Stage 2 of IG ingest — writes photos/videos entries |
| [scripts/ingest-instagram.sh](scripts/ingest-instagram.sh) | wizard that chains fetch + import |
| [scripts/import-csv-edits.mjs](scripts/import-csv-edits.mjs) | **bulk curator edits** — reads CSV from /admin, patches frontmatter |

Every script is ESM `.mjs`, uses only Node built-ins, is idempotent (re-runs don't duplicate), and defaults to **dry-run**. `--write` commits.

**Your DB-sync job should run AFTER these scripts, reading `src/content/` as the source of truth.** Don't invert the flow.

### 7.2 Read paths (what queries matter)

- `/admin` table (see [src/pages/admin.astro](src/pages/admin.astro)) lists every entry, filterable by collection / project / published / tags. Currently renders from `getCollection()` at build time.
- Timeline page filters by Project × Format × Medium × Tag. Currently iterates the same getCollection arrays in-memory.
- CSV export from /admin → Sheets → `import-csv-edits.mjs`. Curator's main workflow.
- Pagefind index covers 557 pages. Not your problem; keeps working from static HTML.

**Queries the curator will actually ask:**
- "Show me every entry tagged `killd-by` that is unpublished" (bulk curation)
- "Which photos reference Drew Reininger?" (people-centric view)
- "Every release from 2014, with cover art status"
- "Voice memos whose transcript mentions 'pelican'" (full-text)
- "IG posts from summer 2015 with more than one media item" (carousel + date)
- "Dead cross-refs" (ref integrity check: related* fields pointing at slugs that don't exist)

Design indexes around these.

### 7.3 CSV roundtrip (critical — don't break this)

`/admin` exports a CSV. Curator edits in Sheets/Excel. `scripts/import-csv-edits.mjs` diffs the CSV against the file tree and patches the following fields: `title`, `preservedTitle`, `project`, `date`, `format`, `summary`, `tags`, `published`. Anything else is ignored.

If your DB has a web-based edit UI in the future, it needs to round-trip cleanly through the CSV format too — or replace the CSV flow entirely. Either is fine; half-and-half is not.

---

## 8. How to integrate (recommended approach)

1. **Read-only projection first.** Build an import script `scripts/db-sync.mjs` that reads all `src/content/**` at build time and upserts into the DB. Idempotent. No destructive ops. This gets you the data without risk.
2. **Preserve slugs as primary keys.** Don't introduce numeric IDs until you need them. Slugs are stable, human-readable, and already the foreign-key vocabulary everywhere.
3. **Flatten cross-refs into join tables, not JSON columns.** `release_people`, `release_photos`, `release_videos`, `release_voice_memos`, `release_lyrics`, `event_people`, `event_photos`, `photo_people`, `video_people`. Each has `(parent_slug, child_slug, position)` — preserve the array order from the source file, because curator ordering matters.
4. **Separate `carousel_extras` table.** `(parent_slug, parent_collection, position, media_path, media_type)`. `parent_collection` is `'photos'` or `'videos'`. `media_type` is `'image'` or `'video'` — necessary because photo-primary carousels can have video extras.
5. **Embed fields stay denormalized on the parent row.** Don't pull Bandcamp/YouTube/SoundCloud into a separate `embeds` table; they're 1:1 with their release and the priority logic is tightly coupled. A single `embeds` table would create query complexity for zero normalization benefit.
6. **Derive, don't store.** `published_count`, `has_transcript`, `media_count` — these belong in views or queries, not columns. The source files stay simple.
7. **Full-text index on `summary`, `caption`, `transcript`, `title`, `preservedTitle`**. The curator's queries are mostly text-driven. Pagefind handles the public-site search; your DB needs FTS for `/admin` and curator scripts.
8. **Propose but don't perform the DB choice.** Three realistic options:
   - **SQLite**: single-file, lives in the repo, checked in as `data/crfw.db`. Good for read-heavy workloads, embedded with Astro dev, no server needed. Recommended unless the curator asks for multi-user editing.
   - **DuckDB**: analytics-flavored SQLite. Better full-text and columnar for curator dashboards. Worth considering if you'll build analytics views.
   - **Postgres**: overkill today; right answer only if the DB starts accepting writes from a future web UI (not the CSV roundtrip).
   Ask the curator before you pick.

---

## 9. Specific landmines and curator-flag items

From sessions 04–10, items the curator already knows about. Preserve as-is; don't silently fix:

- Folder/entry: `M_killdby15:16:17` — date was wrong (fixed 2012→2015 in Session 08 via `scripts/fix-2digit-years.mjs`). Watch for more 2-digit-year oddities.
- Empty `M_killdby` folder — curator flag.
- `unnamed_killdby_folder` — curator flag.
- `untitled.md` — curator flag.
- `court-clothes/cover.svg` (placeholder) coexists with `court-clothes/cover.jpg` (not referenced in frontmatter) — curator triage pending.
- 4 Bandcamp release stubs added in Session 09 (`draw-blood`, `p22`, `carolina-reaper`, `ddr3-loaner-phone`) — tagged `needs-review`, unpublished, pending curator confirmation.
- 26 new YouTube video entries from Session 09 — same status.
- 913 new IG entries from Session 10 (@chi_swoo_) — all `published: false`, all awaiting title/project/summary/published curation.
- 2 tentative YouTube matches (score 4) from Session 09 may be wrong — `DTTD.mov (2012) → 2020-dttd1.json` is probably a mismatch. Flag for spot-check.
- 199 archive videos still need Whisper transcripts. No embed URLs on most.
- 12 voice memos without transcripts (Whisper skipped some `.m4a` files).
- Slugs with `-2`, `-3` suffixes exist (dedupe artifacts) — some are legitimate duplicates, some are canonical variants. Canonical preference was set in Session 09; see the import-embeds script's `canonical-slug preference` logic.

---

## 10. Clarify these with Dyl before you commit to a design

1. **Database engine** — SQLite / DuckDB / Postgres / other? (See §8.8.)
2. **Write direction** — DB is read-only from content files forever, or do you eventually want the DB to be the source of truth and content files generated from it?
3. **Cadence of sync** — every build (Astro integration), every commit (git hook), manual (`npm run db:sync`)?
4. **Location** — `data/crfw.db` committed to git, or in `.gitignore` and rebuilt on each clone?
5. **Cross-collection joins** — how important is it to have a single unified search across releases, photos, videos, etc. (a-la Pagefind, but queryable)? That changes whether you want a shared `entries` supertype table or pure per-collection tables.
6. **Metrics / dashboards** — anything the curator wants visible (e.g. "% of releases with cover art", "photos per month", "voice memo transcription coverage")? Those inform which views/materialized queries to prebuild.
7. **API surface** — does Astro read from the DB directly at build time, or via a query endpoint, or stay file-based and only `/admin` reads from the DB? Different architectures.

Once those are answered, propose a schema, get curator sign-off, then build the sync script.

---

## 11. Non-negotiable constraints before you propose anything

- **Don't introduce a new data model that the file-based collections can't round-trip through.** If your DB has a column that doesn't map back to a frontmatter field, you've broken the file-as-source-of-truth contract.
- **Don't change the JSON/MD schemas in `src/content/config.ts` to suit the DB.** Those schemas are the contract; evolve them only with explicit curator direction.
- **Don't auto-populate `summary`, `title`, or any curator-voice field.** Even a "smart default" breaks golden rule #6.
- **Don't remove `published: false` entries from query results by default.** `/admin` needs them visible.
- **Don't invent an `archivePath` you can't point at a real Dropbox file.** Better NULL than lie.
- **Don't split carousels into multiple rows**, don't merge photos and videos into a single table, don't "normalize" tracklists out of the release row without a strong reason.

---

## 12. Glossary

- **CRFW** — Colin Ward's project alias on the repo / main account handle.
- **killd by** — one of his primary project identities (Denver era, ~2014–2017).
- **alphabets** — another primary project identity (broader, spans years).
- **Dyl** — Colin's brother, the curator. Addressed in second person throughout CLAUDE.md.
- **Archive** — the Dropbox folder. Always authoritative.
- **Entry** — a single row in any content collection. Has a slug. Has a published flag.
- **Stub** — an entry with only the bare minimum (title, date, archivePath). Waiting for curator prose.
- **Curator-flag** — an entry the curator knows is weird and hasn't resolved. Don't auto-fix.
- **Carousel** — an Instagram post with multiple media items. See §5.
- **CSV roundtrip** — the `/admin` → Sheets → `import-csv-edits.mjs` curator edit loop.
- **Preserved title** — Colin's original typography, not the readable version. See golden rule #2.

---

**When in doubt, ask Dyl before schema-ing.** The worst outcome is a DB that prevents curator edits because your constraints were tighter than his intent. Be boring on the schema, be bold on the queries.
