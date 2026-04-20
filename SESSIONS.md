# Session log

Running log of Claude Code sessions on this repo. Newest first. Each entry is a handoff for the next session — what was done, what's next, any open questions.

---

## Session 14 — 2026-04-20 — QA pass (0 PRs, 2 direct commits)

**Goal:** QA the Session 13 vault integration work, fix build issues, repush clean.

**Findings and fixes:**

**Build infrastructure**
- `better-sqlite3` needed a rebuild for Node v25 (`NODE_MODULE_VERSION 141`). Fixed via `npm rebuild better-sqlite3`.
- Astro build with 1,958 entries takes ~3.5 minutes for "Collecting build info" — not a hang, just slow. Two background build runs from the investigation were killed; direct foreground run confirmed the pipeline.

**Dropbox/iCloud dupe files**
- `src/pages/project/[slug] 2.astro` appeared — Dropbox/iCloud sync conflict of the new project route template from Session 13. Was generating 15 bogus `/project/X 2/` pages in the build. Deleted locally (was untracked/gitignored).
- Vault sync had been run multiple times during QA; iCloud Drive (Desktop sync) created ` 3.json`, ` 4.json`, ` 5.json` conflict copies of ALL 366 projected vault files — 721 conflict files total. gitignore only covered ` 2.*`. Updated to `* [2-9].*` / `** [2-9].*` to catch all digit suffixes; deleted all 721 dupe files.

**YAML parser: folded block scalar (`>`) fix**
- The vault `notes:` field on `killd-by-neotropical.md` uses `>` (folded block scalar, which joins continuation lines into a space-separated paragraph). The parser handled `|` (literal) but not `>` — was storing the literal string `">"`. Fixed with a proper fold implementation (join lines with `\n`, replace non-blank-line newlines with spaces, collapse blank lines to `\n`).

**Vault content updated (Dyl adding entries in Obsidian)**
- 12 new entries projected: `janice-schindler` (videographer, "No Energy Vamp"), `josh-gondrez` (co-director), `discogs`, `nts-radio`, three press items (Tiny Mix Tapes "No Energy Vamp" 2015, Denver Month of Video "Buildings Are Heavy" 2025 screening — **priority research item, Kim Shively film with likely Colin footage**, Westword "Another 100 Creatives"), `alphabets-remix09`, `alphabets-wetdollar-11`, `killd-by-neotropical` (2020 posthumous compilation, Noumenal Loom), `leisure-gallery`, `squirm-gallery`.
- 4 modified projections: `colin-ward` (new aliases `legalizedmischief` + `Tokyo Drift`, secondary IG handle `@legalizedmischief`, new "Online monikers" section in body, new quote "alien safari rainforest style"), `kim-shively`, `travis-egedy`, `rhinoceropolis`.

**Final build state:** 574 pages (was 573; +1 net from Session 13 QA), 366 vault entities (was 354), 0 dead cross-refs.

**Commits (direct to main, no PR):**
- `5be7353` — QA pass: vault sync updates + folded-block-scalar parser fix
- `36e55f1` — gitignore: cover all sync-conflict digit suffixes ( 2 through  9)

**Known not-done (carries forward from Session 13):**
- `db-sync.mjs` not yet populating rich entity tables (projects/venues/orgs) from vault content.
- Wikilink rendering as click-through chips in body/popups (v1 = plain text).
- Per-track reader pages (`/track/[slug]`) for 214 vault tracks — deferred.
- Photo-sets across multiple IG posts — deferred until curator ships IG backlog.

---

## Session 13 — 2026-04-20 — Vault integration (1 PR)

**Goal (restarted mid-session):** originally plan was a new `sets` collection for release-series / photo-sets. Mid-planning, Dyl pointed at the CRFW vault at `CRFW Archive/_Vault/` — a 357-entry Obsidian-style parallel data model. Plan pivoted: instead of building a site-local grouping concept, adopt the vault as a second authoritative source for structural entities. Curator's Kit becomes a coordinator (editing BOTH site content and vault).

**Done — PR #30 (merged):**

**Schema + sync**
- 10 new Astro collections (`vault_people`, `vault_projects`, `vault_venues`, `vault_organizations`, `vault_tracks`, `vault_releases`, `vault_events`, `vault_press`, `vault_funds`, `vault_grants`, `vault_series`). Permissive schemas (`.passthrough()`) so vault evolves upstream without migrations.
- `scripts/sync-vault.mjs` — parses vault .md files with a narrow-but-thorough YAML dialect handler (inline arrays `[a, b]`, block literals `|`, Obsidian wikilinks `[[path/slug]]`, empty-array-on-continuation-line, URL-with-colon scalars distinguished from `- key: value` objects). Normalizes wikilinks to path strings; drops nulls (Zod-compat).
- First sync: **354 entries projected** (34 people, 15 projects, 7 venues, 20 orgs, 214 tracks, 26 releases, 12 events, 18 press, 1 fund, 6 grants, 1 series). 1,180 wikilinks, 298 unique targets, 0 dead refs.

**CMS two-source mode (Curator's Kit v3)**
- `/api/sources` returns both content roots with commit semantics (`site` commits, `vault` doesn't)
- All entry endpoints accept `/api/entries/:source/:collection[/:slug]`; legacy paths still work and default to site
- `/api/bulk` routes to the right fs root
- Frontend sidebar gets a Source switcher above the collection list; active source determines which collections are shown
- Save button label adapts: **"Save & Commit"** (site) vs **"Save (vault)"** (vault)
- Git commits only fire for site edits; vault edits write directly to Dropbox (curator's existing Obsidian workflow)

**Series as the "children" model**
- New vault kind `series` — seeded with `ddr.md` spanning alphabets (DDR 2011, DDR2/HAUNTED 2012) + killd by (DDR3:Loaner phone 2016). Cross-project series is a real shape in Colin's archive.
- Tracks (already vault-first-class, 214 entries) and project memberships cover most "children" needs naturally via wikilinks.

**Public surface: project pages**
- New dynamic route `/project/[slug]` renders 15 project pages (alphabets, killd-by, aquakota, pocket-dove, tudaloos, bangplay, sex-therapy, snake-feathers, phonebooks, chamber-joy, bodymeat, clubtrek-tumblr, tha-mayoreo-show, 4-gypsy-dance-theatre). Each shows: kind + years + aliases + summary + members + releases + series + canonical URLs.
- Build clean at **573 pages / 19,198 words** (up from 558 / 19,140).

**State at end of session:**
- **30 PRs merged across 13 sessions.**
- Two content sources coordinated: site (git-tracked, curator-voice) + vault (Obsidian-tracked, structural).
- Public site richer: project pages link to releases, members, series, external links.
- Curator can now edit people/projects/venues/orgs/tracks/etc. from the CMS at `npm run cms`.

**Known not-done (follow-up sessions):**
- `db-sync.mjs` doesn't yet populate the rich entity tables (projects/venues/orgs/etc. from Session 11 schema) from vault content. Site content still in DB; vault content renders direct from Astro collections.
- Wikilink rendering as click-through chips in content body/popups (v1 = plain text).
- Per-track reader pages (`/track/[slug]`) for the 214 vault tracks — defer until there's a reason to surface them individually.
- Photo-sets across multiple IG posts — revisited after curator ships IG backlog review.
- Reverse sync (site → vault) — intentionally not done; each source owns its entries.

**Files touched:**
- `src/content/config.ts` — 10 new collection schemas (+vault_series)
- `scripts/sync-vault.mjs` — new
- `scripts/curators-kit/server.mjs` — two-source refactor + SOURCES config
- `scripts/curators-kit/public/{app.js,styles.css}` — source switcher, save-label adaptation
- `src/pages/project/[slug].astro` — new
- `package.json` — `vault:sync` + build chain includes it
- `src/content/vault_*/*.json` — 354 projected entries
- `<vault>/series/ddr.md` — new kind seed
- `SESSIONS.md`, `CLAUDE.md` — this log + current-state refresh

---

## Session 12 — 2026-04-19/20 — QA + Curator's Kit v2 (1 PR)

**Goal:** QA the Session 11 work; then burn the IG photo backlog down via a curator-leverage sprint (per Dyl's focus pick).

**QA findings (Apr 19):**
- `npm run db:sync` clean; 1,958 entries, 0 dead refs.
- Initial build produced 863 pages instead of 558 — traced to a Dropbox sync-conflict duplicate `src/pages/voice-memo/[slug] 2.astro` that had appeared locally. Removed + clean rebuild restored 558 pages. Also removed 2 dupe scripts (`fix-2digit-years 2.mjs`, `import-csv-edits 2.mjs`). None of the three were tracked in git — gitignore `* 2.*` patterns still holding.
- A 4-day-old hung `git commit` process (PID 81995 from last Friday's carousel-popup session) was holding git locks and stalling every subsequent git op. Killed it; pushes unblocked.
- Ongoing class-of-bug: Dropbox will keep making these dupes. Gitignore prevents commits, but not local build pollution. Accepted risk; clean when noticed.

**Done — PR #29 Curator's Kit v2 (merged):**

The 866 unpublished IG photos (plus 30 YT drafts and 4 Bandcamp stubs) are the current curator bottleneck. v1 was a single-entry editor — at ~30 seconds per photo that's 7+ hours of review. v2 aims for 10-20× speedup via grid + bulk ops.

**Server additions** (`scripts/curators-kit/server.mjs`):
- `GET /api/entries/<coll>` now returns `thumb`, `captionPreview`, `tags` per entry — enables grid rendering without per-card round-trips
- `POST /api/bulk` — one patch applied to N slugs in a single git commit. Returns `{updated, unchanged, errors, commit}`.
- `GET /media/*` — static proxy to `public/media/` so the CMS UI can render image/video thumbnails (confined to `public/` subtree for safety)

**UI additions** (`scripts/curators-kit/public/`):
- **View toggle** (☰ list / ▦ grid). Default grid for photos + videos; default list for text-heavy collections.
- **Status filter**: all / published / unpublished.
- **Multi-select checkboxes** on every entry (list + grid).
- **Bulk action bar** (sticky) — Publish / Unpublish / Set project / Add tag / Clear. Each operation = one git commit covering all selected entries.
- **Contact-sheet grid**: thumbnail + title + date+project meta + caption preview; published badge (● green / ○ gray); selection highlight.
- **Media preview in editor**: inline image/video for photos, videos (covers, src, poster, localSrc).
- **Keyboard shortcuts**:
  - `j` / `k` — next / prev entry in current filter
  - `p` / `d` — publish / draft (selected or current)
  - `/` — focus search
  - `esc` — clear multi-select

**Deferred to v3:**
- Cross-ref picker with type-ahead (plumbing exists; widget uses text input for now)
- Carousel editor UI (carouselExtras still editable as JSON for now)
- Image upload widget (paste file paths)
- Diff viewer before commit
- Revision history browser

**State at end of Session 12:**
- **29 PRs merged across 12 sessions.**
- Curator tooling now supports bulk review at useful speed for the 866-photo backlog.
- Server + UI smoke-tested locally; `/api/bulk` correctly commits a single entry when selected; `/media/` serves images with right MIME + cache; grid view renders thumbs.
- **No public-site changes this session.** The Astro static site is unchanged; Curator's Kit is a local-only tool.

**Next:**
- **Curator work:** Dyl to spend a session burning through the IG backlog with the new grid view. Target: dramatic drop in unpublished count.
- **Session 13 candidates:** (1) wire `/admin` dashboard to query `dist/data/crfw.sqlite` via sql.js (from Session 11 carry-over); (2) Curator's Kit v3 — cross-ref picker + carousel editor + image upload; (3) /discography share view + OG images. Pick one based on what emerges from curator session.

**Files touched:**
- `scripts/curators-kit/server.mjs` — bulk + media endpoints
- `scripts/curators-kit/public/app.js` — grid view, selection, bulk, keyboard, preview
- `scripts/curators-kit/public/styles.css` — grid / bulk / preview CSS
- `scripts/curators-kit/public/index.html` — toolbar + bulk-bar containers
- `SESSIONS.md` — this log
- `CLAUDE.md` — current-state refresh

---

## Session 11 — 2026-04-17 — DB + dropdowns/mobile + tag scaling + Curator's Kit (4 PRs)

**Goal:** the big architectural sprint — bring in a proper database, fix the clunky filter bar, make the site mobile-ready, scale tags to handle 866+ IG photos, and stand up a custom browser-editable CMS. Planning pass committed to §10 of DATA_MODEL.md and to the DATABASE_BRIEF_FOR_CLAUDE_CODE.md vision, with the caveat that content files stay source of truth for Phase 1. Product-owner reframe on the CMS pivoted from Decap (off-the-shelf) to a purpose-built archival tool ("Curator's Kit") that can be reused on Dyl's other future archival project.

**Done — 4 PRs, all merged:**

**PR #25 — Database v1 (SQLite + full schema)**
- `data/schema.sql` — 529-line SQLite schema covering all 7 current collections PLUS the richer future-entity tables from DATABASE_BRIEF (projects, venues, organizations, press, press_mentions, funds, grants, relationships, sources, assets, captures). Slugs as PKs, FKs by slug string (matches Astro's `reference()` pattern). Sensitivity enum (`public`/`restricted`/`private`/`redacted`) on every table per the brief's §7. Unified `entries` view UNIONs all 7 collections. FTS5 virtual table indexes title + preserved_title + body + transcript. Pre-baked stats views (coverage, drafts, dead_refs, tag_frequency, missing_archive_paths).
- `scripts/db-sync.mjs` — Node + better-sqlite3, reads every frontmatter/JSON file and projects it into the DB. Idempotent; wipes and rebuilds on every run. First sync: 1,958 entries, **0 dead cross-refs**, 30 missing archivePaths (all expected — press events + carousel-parent photos). SQLite file: 7.5 MB.
- Build chain: `npm run build` now does `astro build → pagefind → db-sync --dist`. SQLite ships at `dist/data/crfw.sqlite` for future client-side admin queries.
- **Postgres deferred.** The brief recommended Postgres; for Phase 1, SQLite + sql.js gives us full SQL in the browser without any server. Schema is Postgres-portable — when Neon is provisioned, same schema.sql applies with trivial adjustments.

**PR #26 — Filter dropdowns + mobile responsive pass**
- Replaced the chunky 4-row chip filter bar with 4 compact `<select>` dropdowns (Project, Format, Medium, Tag). Wins ~600-1000 px horizontal space and adds live value counts ("alphabets (171)").
- Projects sorted by frequency, not alphabetical. Format uses curator-preferred order.
- Mobile CSS: targeted 320 / 375 / 414 / 600 / 900 / 1024 px. Masthead scales. Filter dropdowns flex-wrap then grow full-width on phones with 44×44 tap targets. Popup goes full-screen (100dvh) on phones. Admin table first column sticky on narrow viewports. Related chips stack. Safe-area insets for notch devices. Accessibility-minded focus outlines maintained.
- `viewport-fit=cover` meta added.

**PR #27 — Tag scaling + /tags index page**
- Tag dropdown now **recomputes on every filter change**, scoped to entries matching the other axes. Prevents it from listing tags irrelevant to the current view. Cap raised 20 → 30 because scoping keeps relevance high.
- New `/tags` page: every unique tag grouped by source (curator-assigned, script-assigned, hashtag-derived), color-coded per group, with usage counts. Click a tag → timeline pre-filtered.
- **URL param pre-selection** on timeline: `/?project=X&tag=Y&format=Z&kind=W` pre-selects the dropdowns. Enables deep links from /tags, future project pages, and external references.
- Footer nav gains `/tags` link.

**PR #28 — Curator's Kit v1 (custom archival CMS)**
- The product-owner-lens decision: built custom instead of layering Decap/Tina/Sanity. Archival work needs opposite defaults to publishing CMSes — no delete button, `preservedTitle` as first-class, fuzzy dates, sensitivity slider, "curator voice only" hint on summary fields. Off-the-shelf CMSes would require clunky custom widgets for every one of those.
- Node HTTP server (built-ins only, no deps) at `scripts/curators-kit/server.mjs`. Vanilla-JS SPA frontend at `scripts/curators-kit/public/` (no build step).
- `npm run cms` boots localhost:4322. `npm run cms:lan` binds 0.0.0.0 and prints LAN URL for phone access over same wifi.
- Every save writes the file AND `git commit -m "CMS: edit <coll>/<slug> (<fields>)"`. Curator `git push` when ready to deploy.
- v1 supports: collection list, searchable entry list, scalar fields, textarea fields (summary/transcript/caption), enum dropdowns (format/kind/source), tag input with add/remove pills, published toggle. Field-level hints call out golden rules (preservedTitle typography, date fuzziness, no AI summaries, archivePath provenance).
- v2 deferred: cross-ref picker, carousel editor, image upload, diff viewer, revision history, deployed mode (GH OAuth + CF Worker).
- **Reusable.** Schema-agnostic within Astro content-collections pattern. README documents how to port to Dyl's next archival project.

**State at end of session:**
- **28 PRs merged across 11 sessions.**
- **Live at https://dylwar27.github.io/crfw-site/** + /about + /projects + /tags + /admin.
- **558 static pages**, 19,140 words indexed.
- **1,958 entries** in the DB (238 releases + 866 photos + 538 videos + 305 voice_memos + 11 events + 0 people + 0 lyrics).
- Full query layer now exists. DB ships at `dist/data/crfw.sqlite` (7.5 MB) ready for sql.js client-side queries.
- `/admin` still unchanged (still uses inline JSON). Next step: wire it to query the SQLite — small PR.
- Curator's Kit runs locally; supersedes the CSV roundtrip for most edits (CSV still works for bulk changes).

**Open (carry-forward):**
1. Wire `/admin` dashboard to query `dist/data/crfw.sqlite` via sql.js (replaces the inline JSON). Unlocks live stats dashboards.
2. Curator's Kit v2: cross-ref picker, carousel editor, image upload.
3. Postgres / Neon provisioning — only when multi-user editing arrives.
4. Mobile QA from actual phone (Dyl test).
5. Custom domain + robots lift when ready for public launch.
6. Second IG account scrape (art/project handle) still TBD from Dyl.

**Files touched this session:**
- `data/schema.sql` — new (PR A)
- `scripts/db-sync.mjs` — new (PR A)
- `scripts/curators-kit/**` — new 6 files (PR D)
- `src/pages/index.astro` — filter dropdowns, URL params, scoped tag recompute, footer /tags link
- `src/pages/tags.astro` — new (PR C)
- `src/styles/global.css` — dropdown styles, full mobile media queries
- `src/layouts/Base.astro` — viewport-fit=cover
- `package.json` — `db:sync`, `cms`, `cms:lan` scripts; better-sqlite3 devDep
- `.gitignore` — data/crfw.db*
- `SESSIONS.md`, `CLAUDE.md` — this log + current-state refresh

---

## Session 10 — 2026-04-17 — Instagram scraper pipeline v.1 (1 PR)

**Goal:** stand up an outside-access Instagram ingest pipeline so the empty `photos` collection can start filling in from Colin's two public IG accounts (personal + art). No login/ownership access — has to work against public accounts only. Keep it archival-grade: full captions, post dates, carousels, video posts, permalinks back to source.

**Design — two-stage, mirrors voice memos / video-stubs / embeds pipelines:**

1. **Stage 1 fetch:** [scripts/fetch-instagram.sh](scripts/fetch-instagram.sh) wraps [instaloader](https://instaloader.github.io/) (Python, one-time `pipx install`). Writes to `tmp/instagram/<handle>/` (gitignored). One `.json` sidecar per post with the full GraphQL node, plus the `.jpg`/`.mp4` files, plus thumbnails for videos.
2. **Stage 2 import:** [scripts/import-instagram.mjs](scripts/import-instagram.mjs) walks the scrape, classifies each post (GraphImage / GraphVideo / GraphSidecar), copies media into `public/media/{photos,videos}/<slug>/`, writes JSON entries to `src/content/`.

**Decisions locked in during plan mode:**
- IG video posts go to the `videos` collection via `localSrc` (not photos with mp4 `src`). Cleaner fit; filter-by-Medium keeps working.
- Carousels: one entry per post, first item primary (`src`/`localSrc`), remaining media listed in new `carouselExtras: string[]`. Keeps the timeline clean; future popup upgrade can render a swipable gallery.
- Feed posts only; stories are login-gated on public scrapes and will 404 — fetch script doesn't attempt them.
- One account at a time via `--user`; each handle is its own run.
- `archivePath` intentionally omitted for IG entries — they don't live in the Dropbox archive proper, and golden rule #3 says omit over invent. Provenance lives in `sourceUrl` (permalink to the IG post) instead.
- Per golden rule #6: importer leaves `title`, `project`, `summary` empty. Curator fills via `/admin` CSV roundtrip, the same workflow used for the 224 existing stubs.

**Schema additions** ([src/content/config.ts](src/content/config.ts)) — two optional fields added to both `photos` and `videos`:
- `sourceUrl: z.string().url().optional()` — IG post permalink.
- `carouselExtras: z.array(z.string()).default([])` — secondary media paths for multi-item posts.

No new collection, no enum changes, no existing entry broken.

**Importer behavior:**
- Slug: `ig-<handle>-<shortcode>` (IG shortcodes are globally unique).
- Every new entry `published: false` — matches Sessions 08–09 draft-default convention.
- Caption parsing: trailing-hashtag block peeled into `tags`; mid-caption hashtags preserved in body.
- Location name appended to caption (`"\n\n— Denver, CO"`).
- Idempotent: scans both `photos/` and `videos/` for existing `ig-<handle>-*` slugs before writing; re-runs report `NEW: 0, SKIP-EXISTING: N`.
- CLI: `--user <handle>` (required) · `--source <path>` · `--tag <slug>` · `--limit N` · `--write` (dry-run default).

**Smoke test (committed with PR):** fixture covers single-image, single-video, and 3-item carousel (2 images + 1 video). All three classify and write correctly; re-run reports 0 new / 3 skip-existing; `npm run build` green (no Zod errors against the updated schemas). Fixture cleaned up before commit.

**State at end of session:**
- **24 PRs merged total across 10 sessions** — this session landed as [PR #24](https://github.com/dylwar27/crfw-site/pull/24), merged 2026-04-17.
- Empty `photos` collection warning unresolved at build — intentional; clears as soon as Dyl runs the pipeline against a real account.
- Pipeline is fixture-verified but has NOT been run against a live IG account yet. Dyl has one handle ready; second handle TBD.

**Open items for next session:**
- Dyl runs `pipx install instaloader` + `./scripts/fetch-instagram.sh <handle>` against the personal handle, then `node scripts/import-instagram.mjs --user <handle>` (dry-run first). Real-world validation will surface any instaloader JSON-shape surprises the fixture didn't cover.
- Second handle (art account) when that handle is confirmed.
- Carousel gallery UI in popups — data is captured (`carouselExtras`), rendering is still timeline-card-only. Separate visual decision.
- Login-gated fetches (stories, highlights) — out of scope for v.1. If a burner login appears later, `--login` is a small extension.
- Auto-assign `project` from the `--tag` value (e.g. `instagram-art` → `alphabets`) — held as a curator decision.

**Files touched:**
- [scripts/fetch-instagram.sh](scripts/fetch-instagram.sh) — new
- [scripts/import-instagram.mjs](scripts/import-instagram.mjs) — new
- [scripts/ingest-instagram.sh](scripts/ingest-instagram.sh) — new (interactive wizard; second commit in session)
- [src/content/config.ts](src/content/config.ts) — `sourceUrl` + `carouselExtras` on photos and videos
- [CONTENT.md](CONTENT.md) — "Bulk Instagram import" subsection under photos, leads with the wizard
- [CLAUDE.md:137](CLAUDE.md) — outstanding-work #6 updated (IG path available; non-IG photo sources still TBD)
- [.gitignore](.gitignore) — `tmp/` added for the raw scrape dumps

**Addendum — interactive wizard:**
[scripts/ingest-instagram.sh](scripts/ingest-instagram.sh) chains the two stages with prompts and a confirmation gate: preflight-checks `instaloader`, asks for handle + tag (defaulting to `instagram-personal`), runs fetch, runs dry-run import, prompts before writing, runs `npm run build` to verify schemas, then prints counts and next-step hints. Does NOT auto-git-commit the ingested content — curator reviews `/admin` first. Usage: `./scripts/ingest-instagram.sh` (fully interactive) or `./scripts/ingest-instagram.sh <handle> [<tag>]` (preset args, still prompts for confirm).

**Addendum — pivot to gallery-dl + first real ingest (913 posts):**

First live-account run surfaced that **instaloader is effectively broken for scripted use**. Its session-health-check endpoint (`graphql/query?query_hash=d6f4427fb…&variables=%7B%7D`) returns 401 on current IG backends — and instaloader interprets that as "session expired" and falls through to an interactive password prompt, which EOFs immediately in a non-TTY shell. Tried anonymous (403 across the board), fresh `instaloader --login sleepnod` (loaded fine but hit the same 401 health-check), and waiting ~20 min for the "please wait" throttle to clear (same failure). The issue is deterministic, not rate-limit-driven.

**Rewrote the pipeline to use [gallery-dl](https://github.com/mikf/gallery-dl) instead.** gallery-dl authenticates by reading the browser's existing IG session cookies (`--cookies-from-browser chrome`) and hits the web endpoints that IG actually keeps alive. First authenticated query succeeded; 913 posts fetched end-to-end in one run with zero throttles. Installation: `brew install gallery-dl` — no Python session dance, no burner account needed (gallery-dl piggybacks on the user's already-logged-in browser tab).

- [scripts/fetch-instagram.sh](scripts/fetch-instagram.sh) rewritten: wraps gallery-dl instead of instaloader. New flag `--browser chrome|safari|firefox` (default chrome). Filename pattern `{post_shortcode}_{num}.{extension}` gives predictable groupings for carousels.
- [scripts/import-instagram.mjs](scripts/import-instagram.mjs) rewritten for gallery-dl's flat metadata shape. Groups `.json` sidecars by `post_shortcode` (gallery-dl emits one sidecar per media file, not per post), sorts by `num`, uses `video_url` on the primary item to route to `photos` vs `videos` collection.
- [scripts/ingest-instagram.sh](scripts/ingest-instagram.sh) wizard: prompts for browser name instead of burner login.
- [.gitignore](.gitignore): `tmp/` already gitignored; no change.

**archivePath decision reversed.** Original plan had `archivePath` omitted for IG entries ("live outside the Dropbox archive"). Curator direction this session: raw scrape gets copied into `CRFW Archive/Instagram/@<handle>/` so the archive stays the truth. `archivePath` now set on every IG entry: `CRFW Archive/Instagram/@<handle>/<shortcode>_<num>.<ext>`.

**First live ingest — @chi_swoo_ (Colin's personal account):**
- 913 posts fetched — 866 images, 47 videos, 22 carousel extras
- Date range: **2013-07-10 → 2018-01-31** (~4.5 years of Colin's posts on this account)
- Scrape copied to Dropbox: `CRFW Archive/Instagram/@chi_swoo_/` (471 MB, 1870 files = media + sidecars)
- Repo: 913 new entries (866 in `src/content/photos/`, 47 in `src/content/videos/`); 510 MB of media under `public/media/photos/ig-chi-swoo-*/` + `public/media/videos/ig-chi-swoo-*/`; largest video 15 MB, under GitHub's 100 MB file limit.
- Every entry `published: false` + tagged `instagram-personal`; curator fills title/project/summary/published via `/admin` CSV roundtrip when ready.

**State at end of session:**
- **~1,958 total entries** (jump of +913 from Session 09's ~1,045). Empty `photos` collection warning: gone.
- Repo is now ~520 MB with the committed media. Under GitHub's 1 GB soft limit; Git LFS migration deferrable but worth considering before the art account lands.
- Pipeline proven end-to-end against a real account with real volume.

**Open items for next session:**
- Second account (the art / project handle) — same command: `./scripts/ingest-instagram.sh <handle>` with `instagram-art` tag.
- Curator review: 913 new drafts at `/admin` — title/project/summary curation, then flip `published: true`.
- Git LFS migration decision before the next big-media ingest (second IG account, or archive video files).
- Carousel gallery UI in popups (data captured, rendering pending).
- Project inference from tags (`instagram-personal` → no project, `instagram-art` → `alphabets` or similar).

**Addendum — generalized `ig-archive` tool + data-model briefing (post-merge commits on main):**

1. **`tools/ig-archive/` — generalized, public-use extraction of the IG pipeline.** Anyone running personal-archival IG work can clone just this directory. Three files:
   - [tools/ig-archive/fetch.sh](tools/ig-archive/fetch.sh) — gallery-dl wrapper, configurable output dir, `--browser` flag.
   - [tools/ig-archive/import.mjs](tools/ig-archive/import.mjs) — reads gallery-dl sidecars, emits a normalized, schema-versioned `manifest.json` describing every post (shortcode, URL, date, caption, hashtags, location, kind, primary + extras). Kind enum: `photo`, `video`, `carousel-photo`, `carousel-video`. Paths relative to the manifest directory for portability. Dry-run supported.
   - [tools/ig-archive/ig-archive.sh](tools/ig-archive/ig-archive.sh) — interactive wizard chaining fetch + import with a confirmation gate.
   - [tools/ig-archive/README.md](tools/ig-archive/README.md) — self-contained usage docs, manifest-field reference, legal/ethical notes, troubleshooting.
   Debug pass: ran `import.mjs` against the chi_swoo_ fixture (913 posts) — 935 media references, 0 missing paths; 859 photos / 47 videos / 7 carousel-photos / 0 carousel-videos classified correctly; hashtag peeling verified on a post with a trailing `#nice`. No coupling to CRFW content schema — anyone can build on top of the manifest (static gallery, database, research dataset, etc.). Lives alongside the CRFW-specific `scripts/import-instagram.mjs`, which stays because it speaks Astro content collections directly.
2. **[DATA_MODEL.md](DATA_MODEL.md) — briefing for the next agent that builds a database of the archive.** 12 sections covering the three-layer data flow (Dropbox → content files → DB), all seven collections with their Zod schemas and quirks, the cross-reference web, photos-vs-videos-vs-carousels distinctions, golden rules as schema constraints, import-script catalogue, recommended integration approach (read-only projection, slugs as primary keys, carousel sub-table), landmines and curator-flag items from Sessions 04–10, and a §10 list of questions to ask Dyl before committing to an engine. CLAUDE.md updated to reference it from the repo layout + opening instructions.

These two additions landed on main as separate commits after PR #24 merged. No PR; direct-to-main since they're docs + a sibling tools dir, not changes to the Astro site itself.

## Session 09 — 2026-04-17 — xlsx embed + articles + bio integration (3 PRs)

**Goal:** integrate two curated Dyl spreadsheets into the CMS — `CRFW_Media_Embeds.xlsx` (60 Bandcamp/YouTube/SoundCloud rows) and `CRFW_Documentation_Articles.xlsx` (articles, biographical summary, associated projects). Prioritize BC > YT > SC embeds. Match to existing entries by title + year; create new entries where needed. Keep future-merge-friendly.

**Done — 3 PRs, all merged:**

**PR #21 — PR-A: Bandcamp embeds + schema + popup rendering**
- xlsx → snapshot pipeline: `scripts/snapshot-xlsx.py` (Python/openpyxl) writes `data/embeds-snapshot.json` and `data/articles-snapshot.json`. Commits those JSONs so git diffs show meaningful content changes.
- Schema extended (`src/content/config.ts`): `bandcampUrl`, `bandcampItemId`, `bandcampItemType`, `youtubeId`, `soundcloudUrl` on releases; `youtubeId` on videos; `url` / `source` on events.
- `scripts/import-embeds.mjs` — reads snapshot, matches Bandcamp rows to releases with canonical-slug preference (court-clothes.md wins over court-clothes-2.md; recovery.md over recovery-2.md; thru-tha-rip.md over 19-alphabets-thru-tha-rip.md; emt.md over emt-2.md). Idempotent; only fills missing fields.
- **22 Bandcamp rows matched** to existing releases; **4 unmatched** (draw-blood, p22, carolina-reaper, ddr3-loaner-phone — all killd by 2016) created as NEW release stubs with `published: false` + `needs-review` tag; tracklists from xlsx included.
- Popup rendering: highest-priority embed (BC > YT > SC) renders as iframe; extra platforms as link chips. Iframes generated from IDs at render time — survives platform UI changes.
- Admin table: new "Embeds" column with BC/YT/SC badges. Included in CSV export.

**PR #22 — PR-B: YouTube matching + new video entries + tracklist cross-reference**
- Extended `import-embeds.mjs` with YouTube phase. Loosened year matching (YouTube "Published" = upload year, not recording year — "piano marsh" from 2012 rightly matches `2008-3-cats-and-gazelle-in-piano-marsh-mov`).
- **6 existing videos matched** with their YouTube IDs (2 high-confidence, 4 substring).
- **26 unmatched YouTube rows → new video entries** as drafts (CAKE, CAKE2, bushwicks finest barber shop, pictureplane/alphabets budget rental truck, + 22 others). Tagged `video`, `youtube`, `needs-review`.
- **Tracklist → video cross-reference phase**: for each Bandcamp album with a tracklist, match track titles against existing video entries. When confident (score ≥ 6), add the video to the release's `relatedVideos` field.
  - 10 cross-references added: `recovery.md` gained 8 relatedVideos (Like a PeLiCaN, Zentai, on FLy, No Energy Vamp, afterlife, Tekno Cheetah, cameras, issues); `siberian-chill.md` + `thru-tha-rip.md` each gained 1.
- Feeds the popup's "Related in the archive" section for these releases.

**PR #23 — PR-C: Articles + Bio + Projects pages**
- `scripts/import-articles.mjs` — reads articles snapshot, emits event entries with `kind: "press"`. URL-keyed for idempotency.
- **10 new press events**: 9 articles from Westword, Bandcamp Daily, cyphersessions.co, EverybodyWiki (2012–2025) + 1 SoundCloud tribute (Thug Entrancer "Dedication — For Colin Ward").
- New `/about` page renders Biographical Summary (19 fields) as a formatted profile, grouped into Identity / Life / Scene / Work / Presence / In memoriam sections. Reads from the JSON snapshot directly — no schema layer.
- New `/projects` page lists all 10 Associated Projects (alphabets, killd by, Pocket Dove, Tudaloos, Phonebooks, Snake Feathers, Bangplay, Sex Therapy, Chamber Joy, Bodymeat). Linkable projects (alphabets, killd by, DIMCP) have `?project=` query links back to the timeline.
- Main timeline footer gains discreet `About · Associated projects` nav row.

**State at end of session:**
- **23 PRs merged total across 9 sessions.**
- **557 static pages** (timeline + admin + /about + /projects + 305 voice memo readers + 249 video readers).
- **19,100 words indexed** by Pagefind (up slightly from 19,007 — bio/projects pages added).
- **Events collection: 11 entries** (1 original + 10 press). Collection warning gone.
- Four releases (recovery, siberian-chill, thru-tha-rip, others) now have populated `relatedVideos` linking cross-media pieces of the same work.
- Main page ~970KB; public-facing surfaces now include About + Projects + Admin discovery.
- xlsx → snapshot → import pipeline in place. Dyl edits xlsx in Dropbox → runs `python3 scripts/snapshot-xlsx.py` + `node scripts/import-embeds.mjs --write` (or `import-articles.mjs`) to flow changes in.

**Open items surfaced this session:**
- Match accuracy: 2 tentative YouTube matches (score 4) may be wrong — `DTTD.mov (2012) → 2020-dttd1.json` is probably a mismatch. Worth a spot-check during curator review.
- 4 new Bandcamp release stubs (draw-blood, p22, carolina-reaper, ddr3-loaner-phone) marked `published: false, needs-review` — curator needs to confirm + flip published.
- 26 new YouTube video entries marked the same — curator review.
- 2 ambiguous Bandcamp album matches flagged in log (THRU THA RIP, Court Clothes's runner-ups) — decision made per canonical-slug preference but worth validating.

**Files touched this session:**
- [scripts/snapshot-xlsx.py](scripts/snapshot-xlsx.py) — new (PR-A)
- [scripts/import-embeds.mjs](scripts/import-embeds.mjs) — new (PR-A), extended (PR-B)
- [scripts/import-articles.mjs](scripts/import-articles.mjs) — new (PR-C)
- [data/embeds-snapshot.json](data/embeds-snapshot.json), [data/articles-snapshot.json](data/articles-snapshot.json) — new snapshots
- [src/content/config.ts](src/content/config.ts) — embed fields on releases/videos/events
- [src/pages/index.astro](src/pages/index.astro) — embed popup rendering + footer nav
- [src/pages/admin.astro](src/pages/admin.astro) — embeds column
- [src/pages/about.astro](src/pages/about.astro) — new
- [src/pages/projects.astro](src/pages/projects.astro) — new
- [src/styles/global.css](src/styles/global.css) — embed CSS + footer nav
- 22 release entries got Bandcamp embed fields
- 4 new release stubs (draw-blood, p22, carolina-reaper, ddr3-loaner-phone)
- 6 video entries got youtubeIds; 26 new video entries created
- 10 new press event entries

---

## Session 08 — 2026-04-17 — answers + data cleanup + video transcripts

**Goal:** work through the open questions from Session 07 and the follow-ups they enabled. Dyl's answers gave us concrete work: 2-digit years → 2000s, drafts-by-default for new imports, video transcripts + reader pages, tighten related-matching.

**Done — 4 PRs merged:**

**PR #17 — Fix 17 2-digit year dates (all → 2000s)**
- `scripts/fix-2digit-years.mjs` walks release files, extracts year tokens from preservedTitle, updates date when they disagree with the current mtime-derived value.
- Convention: 00-99 → 2000-2099. Future-year expansions skipped.
- Strips Colin's chronology prefix ("18 alphabets" is release #18, NOT 2018); skips wildcard patterns ("SUMMERHITZ20XX").
- Notable fixes: `M_killdby15:16:17` (2012 → 2015, long-standing curator-flag item), `REMIX08/09`, `pulse stuff fall 08` (2013 → 2008), 14 others.
- Ranges use earliest year.

**PR #18 — Dropbox dupe cleanup + gitignore guard**
- PR #17 accidentally committed two `" 2.*"` Dropbox sync artifacts (`scripts/import-csv-edits 2.mjs`, `src/pages/voice-memo/[slug] 2.astro`). Same class of artifact as the 409 we cleaned locally in Session 06.
- Removed + added gitignore patterns (`* 2.*`, `* 2`, `** 2.*`, `** 2`) to prevent recurrence.

**PR #19 — Draft-by-default + tighten related matching**
- Import scripts now emit `published: false` on new entries — matches Session 08 decision. Existing 1,005 entries are unaffected (they use the schema default `true` via absence of the field).
- Updated: `bulk-stub-releases.mjs`, `import-voice-memos.mjs`, `import-video-stubs.mjs`.
- Related-entries title-match threshold raised 4→6 chars; shorter title also required ≥6; exclusion list for generic placeholders (`untitled`, `recovery`, `alphabets`, `remix`, `demo`, `mix`, `video`). Prevents "REMIX08" from matching every remix in the archive.

**PR #20 — Video transcripts: 266 imports + reader pages**
- Closes the Session 07 open item. Schema: added `transcript: z.string().optional()` to the videos collection.
- `scripts/import-video-transcripts.mjs` backfills transcripts from sibling .txt files in the archive. 266 of 465 videos now have transcripts (~741 KB of text). 199 still need Whisper processing.
- New dynamic route `/video/[slug]` — reader page for each video with a non-trivial transcript. Mirrors the voice-memo reader page.
- Popup now renders 200-char transcript preview + "Read full transcript →" pill link for videos that have one.
- **Pagefind index: 8,321 → 19,007 words** (2.3× more searchable content).

**State at end of session:**
- **20 PRs merged total across 8 sessions.**
- Live at https://dylwar27.github.io/crfw-site/
- **555 static pages** (timeline + admin + 305 voice memo readers + 249 video readers).
- Main page: 966 KB (tight but under 1 MB target).
- Pagefind index: 555 pages, 19,007 words.
- 1,005 published entries on the public timeline.

**Remaining items (most from Session 07, updated):**

Curator work:
1. **Summary fields** on 224 empty stubs — export CSV from /admin → Sheets → `import-csv-edits.mjs`.
2. **Curator-flag entries** — `M_killdby` (empty shell), `unnamed_killdby_folder`, `untitled.md`, `court-clothes.md` SVG/JPG mix-up. (M_killdby15:16:17 date is now fixed!)
3. **Manual cover art** for release folders where image exists but isn't named `cover.*`.
4. **Voice memo titles** (if desired, per Session 08 decision to keep as-is — this is optional).

Agent-doable next:
5. **Photo import** — only remaining empty collection. Still needs a source from Dyl.
6. **Whisper pass on the 199 videos** without transcripts, plus the 12 voice memos.
7. **YouTube/Vimeo URL matching** — Dyl's sourcing task.
8. **Cover-art sweep** as Dyl tidies source folders.
9. **Project pages** (`/project/killd-by`, etc.) — curated per-era landing pages.
10. **External embeds** — Bandcamp / SoundCloud / YouTube / Vimeo iframes in popups.
11. **Bundle-size watch** — 966 KB main page. Photos or more transcripts could push past 1 MB. If that happens, fetch transcripts on demand instead of inlining the previews.
12. **Custom domain** — two-line astro.config.mjs swap + CNAME + drop robots.

**Files touched this session:**
- [scripts/fix-2digit-years.mjs](scripts/fix-2digit-years.mjs) — new (PR #17)
- [scripts/import-video-transcripts.mjs](scripts/import-video-transcripts.mjs) — new (PR #20)
- [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs), [import-voice-memos.mjs](scripts/import-voice-memos.mjs), [import-video-stubs.mjs](scripts/import-video-stubs.mjs) — draft-by-default (PR #19)
- [src/content/config.ts](src/content/config.ts) — added `transcript` to videos schema
- [src/pages/index.astro](src/pages/index.astro) — video popup wiring, related matching tightened
- [src/pages/video/[slug].astro](src/pages/video/[slug].astro) — new (PR #20)
- [.gitignore](.gitignore) — Dropbox dupe guard
- 17 release entries re-dated
- 266 video entries got transcripts
- [SESSIONS.md](SESSIONS.md) — this entry

---

## Session 07 — 2026-04-16 — autonomous sprint: DIMCP + UX depth + search + editing loop

**Goal:** autonomous push after a planning pass. User said "move forward with everything you can; push as you go; save open questions." Worked through six PRs in priority order from the revised roadmap.

**Done — 6 PRs, all merged:**

**PR #11 — DIMCP retag (130 videos)**
- `scripts/retag-dimcp.mjs` — reassigns videos under `_Documentation/Videos/2018/Dog is my Copilot/` from `project: "alphabets"` (auto-assigned by the import-video-stubs filename heuristic) to `project: "DIMCP"`. Also appends `dimcp` to the tags array.
- Added DIMCP project-tag color (light blue `#64b5f6`) in global.css — renders distinctly on timeline cards and in the new project filter button.
- 130 entries updated (Session 06 log estimated 192 by filename-substring; 130 is the folder-scoped truth).

**PR #12 — Tag filter axis (top 20 by frequency)**
- Fourth filter axis added: Tag, AND-combined with Project × Format × Medium.
- `data-tags` attribute (pipe-separated) on each entry card; `state.tag` in filter state.
- **Curation:** tags that normalize to any project/kind/format value are filtered out of the chip row (e.g. `alphabets`, `killd-by`, `dimcp`, `voice-memo`, `video` — they'd just echo other axes).
- Sorted by frequency, capped at 20 for UI sanity. Surviving high-value tags: `mix`, `b-sides`, `live`, `drafts`, `noiz-atmo`, `wav-dump`, `burn-stage`, `loose-files`, `pre-master`, `early-era`, `late-era`, `recovery`, `curator-flag`.

**PR #13 — Related entries in popups (auto-derived)**
- Popup now renders a "Related in the archive" section with up to 8 clickable chips. Clicks re-render the popup in place (navigation without closing the overlay).
- Three sources, priority order:
  1. Explicit schema refs (`relatedPhotos/Videos/VoiceMemos/Lyrics`) — plumbed for when they're populated
  2. Cross-medium title matches (normalized alphanum, substring both directions) — e.g. release `SIBERIAN CHILL` ↔ video `SIBERIAN CHILL.mov`
  3. Same project + same year (sibling context)

**PR #14 — Voice memo full-transcript reader**
- New dynamic route `/voice-memo/[slug]` — 305 permalinked pages generated at build time via `getStaticPaths`, each rendering the full transcript as readable serif paragraphs.
- Popup UX: preview bumped 80 → 200 chars; "Read full transcript →" pill link routes to the permalink page when full text exists.
- Why pages vs. inline JSON: full transcripts total 1.3 MB. Inlining would undo Session 06's page-size fix. Per-page (~5-6 KB each) is cheaper overall, gives permalinks, and Pagefind can crawl them — which set up PR #16.

**PR #15 — CSV import-back script (closes the admin loop)**
- `scripts/import-csv-edits.mjs` — reads a CSV exported from /admin, diffs against current files, applies changes. Dry-run by default; `--write` to apply.
- Editable columns: `title, preservedTitle, project, date, format, summary, tags, published`. Identity columns (`id, kind, file, archivePath`) are never written.
- Smart diffing: reads current frontmatter values (for MD) or JSON keys (for JSON), compares to incoming, only rewrites genuine diffs. Reports old→new for auditability.
- MD files: frontmatter updated in place; body preserved byte-for-byte.
- JSON files: full re-serialize with JSON.stringify(…,2). Schema-default `published: true` not written explicitly when absent.
- RFC 4180-ish CSV parser handles quoted fields with commas and `""` escapes.
- Smoke-tested on both MD and JSON entries; no-op rows correctly report 0 changes.
- Admin page export-csv button now has a tooltip pointing at the script for discoverability.

**PR #16 — Pagefind full-text search**
- Client-side full-text search across the archive. 306 pages indexed (timeline + 305 voice memo pages), 8,320 words.
- `npm install -D pagefind` + build script chains `pagefind --site dist --exclude-selectors "[data-pagefind-ignore]"` after `astro build`.
- Search bar pinned at top of timeline page, above filter tabs (which shifted to `top: 59px`).
- 200 ms debounce, 2-char min, top 10 results with `<mark>`-highlighted excerpts. Graceful fallback message in dev mode (pagefind.js is only generated by `npm run build`, not `astro dev`).
- `data-pagefind-ignore` on the admin root (curator table excluded) and on the inline `entry-data` JSON (the 786 KB payload wasn't going to make useful search hits).

**State at end of session:**
- **16 PRs merged total across 7 sessions.**
- Live at https://dylwar27.github.io/crfw-site/ (1,005 entries, 786 KB main page, four filter axes + search).
- 307 static pages (timeline + admin + 305 voice memo readers).
- Pagefind index artifacts in `/dist/pagefind/` deploy alongside the site.
- All curator tooling in place: /admin master list, CSV export, CSV import-back script.

**Open questions saved for tomorrow (you):**

1. **DIMCP canonical name.** I picked short-form `DIMCP` for filter button readability. If you prefer `Dog is my Copilot` as the display value, one find-and-replace across the 130 files flips it (or we add a display-alias map in CSS/page code).

2. **2-digit year convention.** Confirmed scriptable once you give the rule. Proposal: `09` → `2009` always (most of Colin's work). Anything that'd resolve to a future year stays as-is. Does that match your intent?

3. **Voice memo titles.** Most still have none (subtitle shows first 80 chars of transcript). Three options:
   - Leave as-is permanently (transcript-preview-as-identity)
   - You hand-title the memorable ones via /admin + CSV import
   - Auto-title using filename timestamp ("Sep 14, 2015 11:24 PM")

4. **Draft workflow default.** New content currently defaults `published: true`. For content you're still curating, should we flip the default to `false` so anything new stays hidden until you explicitly publish?

5. **Public launch timing / target.** Is there a date (anniversary, memorial, a specific moment) pacing this? Shapes whether Phase D polish is urgent or can be paced over months.

**Open technical items to flag (not blockers, just notes):**

6. **Video transcripts** — 275 Whisper `.txt` files exist next to video files in `_Documentation/Videos/` but the Session 06 video-stub importer didn't read them in. Easy follow-up: extend `import-video-stubs.mjs` to include transcript text (and maybe generate `/video/[slug]` reader pages mirroring voice memos).

7. **Pagefind + base path** — index.astro's search code derives the base from `window.location.pathname`. On GH Pages at `/crfw-site/` it should resolve to `/crfw-site/pagefind/pagefind.js`. If search is broken on the live site, this is the first place to look. (Should work; tested locally; worth a visual check post-deploy.)

8. **Admin auth is still cosmetic.** Client-side hash. If/when you lift `robots.txt` disallow for public launch, /admin should either be excluded from the sitemap, moved to a separate hosting platform with basic HTTP auth (Cloudflare Pages Functions), or have the password rotation formalized.

9. **Related entries can be over-eager.** If two releases share a word like "REMIX" in the title, they'll link. Worth watching; if noise emerges we can tighten the substring-match threshold to e.g. `len(titleNorm) >= 6`.

10. **Bundle growth** — main page is 889 KB after Pagefind UI + search bar CSS. Still under 1 MB target. Headroom is tightening; if photos land en masse, audit again.

**Files touched this session:**
- [scripts/retag-dimcp.mjs](scripts/retag-dimcp.mjs) — new (PR #11)
- [scripts/import-csv-edits.mjs](scripts/import-csv-edits.mjs) — new (PR #15)
- [src/pages/index.astro](src/pages/index.astro) — tag filter, related entries, voice memo popup link, search bar + pagefind wiring
- [src/pages/admin.astro](src/pages/admin.astro) — data-pagefind-ignore, export tooltip
- [src/pages/voice-memo/[slug].astro](src/pages/voice-memo/[slug].astro) — new (PR #14)
- [src/styles/global.css](src/styles/global.css) — search bar, related chips, permalink pill, DIMCP color
- [src/content/videos/2018-dimcp-*.json](src/content/videos/) — 130 files retagged
- [package.json](package.json) / package-lock.json — pagefind devDep + build chain
- [SESSIONS.md](SESSIONS.md) — this entry

---

## Session 06 (cont. 2) — 2026-04-16 — /admin page + published field

**Goal:** build a curator's master-list view for seeing and working with the full archive data, including entries that may be logged but not published on the public timeline.

**Done — PR #10 (merged `f0d45d3`):**

- **`published` field** added to all 7 collection schemas. Default `true` so all 1,005 existing entries stay visible. Set `published: false` to hide an entry from the public timeline while keeping it in the archive and visible on /admin.
- **`/admin` page** at https://dylwar27.github.io/crfw-site/admin/ — password-gated (`crfw`, hashed client-side). Features:
  - Sortable table of ALL entries (published and unpublished): title, type, project, date, format, tags, summary, archive path, file path
  - Free-text search across all fields
  - Filter dropdowns: type, project, published status
  - Live row count
  - Unpublished rows dimmed; summary column green if filled / dim dash if empty
  - **CSV export** button — dumps current filtered view to timestamped .csv for Sheets/Excel editing
  - Session-persisted login (no re-entering password on refresh)
  - Capped at 500 DOM rows for performance

**State at end of session:**
- 10 PRs merged total. 1,005 entries. Page size 786KB.
- Public timeline filters out `published: false` entries
- /admin shows everything — the curator's master list
- Phase 2 (CSV import back, inline editing) deferred to a future session

---

## Session 06 (cont.) — 2026-04-16 — bug pass + architecture stabilization

**Goal:** 12-item audit pass addressing bugs, performance, data model brittleness, and accessibility. User-reported: year labels clipped ("only shows 20"), filter tabs need more data, wants the site editable for future content, wants to link projects like DIMCP.

**Done — PR #9 (merged `e24e1e1`):**

Critical fixes:
- **Year-label clipping**: grid column `120px` → `auto`. Four digits at 56–120px font need ~260px; the fixed column was hiding the last two digits.
- **Page size: 2.4MB → 786KB** (68% reduction). Voice memo transcripts truncated to 80-char previews in the inline JSON payload. Full transcripts were 1.3MB of the 1.9MB payload — only needed on popup open, not page load.
- **Format sort bug**: `?? 99` → proper `-1` check (`indexOf` returns `-1`, not `null`; `??` never fires for `-1`).
- **"1 entries" grammar** → "1 entry" singular.

Data model:
- **`project` enum → free string**: `z.enum([6 values])` → `z.string().min(1)`. DIMCP ("Dog is my copilot") and any future project names can now be added to content files without touching the schema. Known values documented in a comment for reference.
- **Removed dead schema code**: unused `medium` enum and `mediaRef` object (defined in Session 01 but never referenced by any collection).

Popup + UX:
- Voice memos now show transcript preview in popup (was blank).
- Events show location if present. Photos show caption. Videos show archive path.
- Voice memo cards show first ~80 chars of transcript as subtitle (was 305× identical "Voice memo").

Accessibility + polish:
- `:focus-visible` styles on all interactive elements (filter buttons, entry cards, popup close, reset button) — WCAG 2.1 AA.
- `theme-color` meta tag (#0e0e12) + Open Graph tags in Base.astro.
- CSS project-tag colors for `Colin Ward` and `collaboration`; fallback dim color for unknown/new projects.

Also cleaned 409 Dropbox sync artifact files (`" 2.json"` duplicates) from the local working directory — these were never committed to git but inflated local builds from 1,005 to 1,414 entries.

**State at end of session:**
- 1,005 entries (234 releases + 305 voice memos + 465 videos + 1 event)
- Page size 786KB (down from 2.4MB)
- `project` is now a free string — no schema change needed for DIMCP or future projects
- 9 PRs merged total across Sessions 01–06
- Live at https://dylwar27.github.io/crfw-site/

**Next work:**
1. **DIMCP project tagging** — 192 video files under `_Documentation/Videos/2018/Dog is my Copilot/` are currently tagged `alphabets`. Now that project is a free string, re-tag them `DIMCP` (or whatever Dyl prefers as the canonical name).
2. **Photo import** — only remaining empty collection.
3. **Pagefind search** — with 1,005 entries, full-text search is genuinely useful.
4. **YouTube/Vimeo URL sourcing** — video stubs exist but have no embed URLs.
5. **Custom domain** — when ready.

---

## Session 06 — 2026-04-16 — filter UX + voice memos + videos (1,005 entries)

**Goal:** filter UX overhaul, voice memo import, video stub import. Continuation of the same day as Session 05.

**Done — three PRs, all merged:**

**PR #6 — Filter UX overhaul (merged)**
- Replaced the useless Medium axis (234 releases vs 1 event) with a **Format** axis (LP/EP/single/mix/compilation/b-sides/demo/other)
- Medium axis now auto-hidden until 2+ distinct kinds exist (appears now that voice memos + videos landed)
- Added "×" reset button to clear all filter axes at once
- Added "showing X of Y" live count when filters are active
- Year row entry counts now update dynamically during filtering (were static before)
- Extended JS filter state to three axes: `{ project, kind, format }` with AND semantics

**PR #7 — Voice memos: 305 transcripts (merged)**
- Import script `scripts/import-voice-memos.mjs` — parses `YYYYMMDD HHMMSS.m4a` filenames into dates, reads `.txt` transcripts from the archive
- 305 JSON entries in `src/content/voice_memos/` (Sep 2015 – Dec 2016)
- 12 m4a files without transcripts were skipped (logged for future Whisper pass)
- No audio files copied to public/ (too large for git)

**PR #8 — Videos: 465 stubs (merged)**
- Import script `scripts/import-video-stubs.mjs` — walks `_Documentation/Videos/` year folders, matches filenames against release titles for project assignment
- 465 JSON entries in `src/content/videos/` (2008–2020)
- Project auto-matched where possible (e.g. `SIBERIAN CHILL.mov` → `alphabets`)
- No video files copied to public/ (too large)

**State at end of session:**
- **1,005 total entries**: 234 releases + 305 voice memos + 465 videos + 1 event
- Only "photos" collection warning remains (no photo entries yet)
- Filter UX has three axes: Project (alphabets / killd by / life), Format (LP/EP/single/...), Medium (release / event / voice memo / video) — all with reset + live count
- Live at https://dylwar27.github.io/crfw-site/

**Next work:**
1. **Photo import** (IG archive or other source) — only remaining empty collection
2. **Whisper pass** on the 12 voice memos without transcripts
3. **YouTube/Vimeo URL matching** — video entries exist but have no embed URLs; Dyl needs to source these (YouTube was more popular than Vimeo for Colin's work)
4. **Curator work** — summaries, 2-digit year fixes, flagged entries (see Session 05 log)
5. **Pagefind search** — with 1,005 entries, full-text search is now genuinely useful
6. **Custom domain** — when ready

**Files touched this session:**
- [src/pages/index.astro](src/pages/index.astro) — format field, data-format attr, filter overhaul
- [src/styles/global.css](src/styles/global.css) — reset button + filter count styles
- [scripts/import-voice-memos.mjs](scripts/import-voice-memos.mjs) — new
- [scripts/import-video-stubs.mjs](scripts/import-video-stubs.mjs) — new
- [src/content/voice_memos/](src/content/voice_memos/) — 305 new entries
- [src/content/videos/](src/content/videos/) — 465 new entries
- [SESSIONS.md](SESSIONS.md) — this entry
- [CLAUDE.md](CLAUDE.md) — state update

---

## Session 05 — 2026-04-16 — three-PR sprint: adjacent + alphabets + covers

**Goal:** solo 3–4 hour sprint. Agreed scope up front (before starting): (1) killd-by-adjacent bulk pass, (2) alphabets bulk pass, (3) cover-art import with a skip-and-log policy — three independent PRs. Explicitly excluded from this sprint: Whisper, Vimeo, filter UX, AI summaries.

**Done — shipped three PRs, all merged to main:**

**PR #3 — `killd by adjacent: 7 stubs from sibling folders` (merged `2c8691d`-ish)**
- 5 generator-driven stubs from `KB/Killd By +/` (1) and `KB/M_Killd By/` (4)
- 2 hand-written stubs for file-only folders (`Other Projects/killdfilez/`, `Other Projects/unnamed_killdby_folder/`) — the bulk generator walks subfolders, so these need manual treatment
- All 7 filed under `project: "killd by"` (same umbrella, source-folder distinction visible in `archivePath`)
- Curator-flag-me items surfaced: `M_killdby15:16:17` (colon-encoded years fall outside the regex, dated from mtime); empty-shell `M_killdby` directory; `unnamed_killdby_folder` (placeholder name)

**PR #4 — `alphabets: 169 release stubs (bulk pass)` (merged)**
- 2 individual stubs (`2010[_]`, `underwaters VI`) + 1 generator hardening + 167 bulk stubs
- Generator change caught during dry-run: `2046AD` (a Wong Kar-wai title Colin used) was being read as a release year. Fix: cap year extraction at `CURRENT_YEAR`; anything later falls through to mtime. Confirmed no regressions on prior entries.
- Format breakdown across all 169: 56 LP, 48 single, 38 EP, 18 other, 7 mix, 1 compilation, 1 demo
- Carried-forward curator-flag items: ~30 folders with 2-digit year encodings (`JANFEB09`, `M_A_Y_09`, etc.) dated from mtime since the regex needs 4-digit `19xx`/`20xx`; ~15 empty-shell folders with 0 audio; multi-volume series (`underwaters` I–VI, `DDR*`, `SUNPOWER` 1/2/3) preserved as separate entries; one folder named `____` collapses to `untitled.md`; `alphabets/RECOVERY/` distinct from killd by's `Recovery`

**PR #5 — `Cover-art import: script + first pass + seeded-data fix` (merged)**
- [scripts/import-cover-art.mjs](scripts/import-cover-art.mjs) — walks `src/content/releases/`, inspects each entry's `archivePath`, copies cover-shaped images to `public/media/releases/<slug>/`, updates frontmatter. Default dry-run; `--write` commits. Idempotent. Never overwrites existing `coverArt:` fields.
- Fixed a seeded-data bug surfaced by the dry-run: `recovery.md` and `alphabets-2010.md` both pointed at `court-clothes/cover.svg` (copy-paste artifact). Removed the bogus fields.
- First import pass (against main's 58 release entries) landed 1 cover: `OUTCASTS (2014-2016 b-sides) ← cover.jpg (2.5MB)`.

**Done — post-merge sweep on main (this commit):**
- Re-ran the importer against all 234 merged releases. Initial run imported 3 covers; **2 were curator-wrong** and caught before commit:
  - ✗ `18-alphabets/` is a dumping-ground folder containing art for *multiple* releases; substring-matching `"...front.png"` grabbed the wrong one.
  - ✗ `trappedinthebackofajeep-2013-alphabets/` had a single screenshot (DAW session, not cover art) that the sole-image fallback grabbed.
  - ✓ Kept: `19-alphabets-thru-tha-rip/cover.jpg` (score 10, unambiguous).
- **Tightened the script** in response:
  - Substring matches (score 3 "contains front", score 5 "contains cover") REMOVED. Requires cover-named filename only (`/^(cover|front|albumart|album[_-]?art|artwork)\b/i` at word-start).
  - Sole-image-at-top-level fallback REMOVED. Now only falls back to "sole image inside an art-shaped subfolder" (`art/`, `artwork/`, `scans/`, `covers/`, `images/`), where the subfolder name itself is the signal.
  - Philosophy: prefer empty covers over wrong ones.

**State at end of session (as of this commit):**
- `main`: 234 release entries (58 + 7 adjacent + 169 alphabets). 2 covers imported total (`court-clothes/cover.svg`, `117-killd-by-2014-2016-bsides/cover.jpg`, `19-alphabets-thru-tha-rip/cover.jpg` — actually 3, plus the Court Clothes placeholder).
- All three sprint PRs merged. No open PRs.
- Live at https://dylwar27.github.io/crfw-site/ still up; this sprint's merges all auto-deployed via the Pages workflow.
- `scripts/bulk-stub-releases.mjs` has the year-cap fix; `scripts/import-cover-art.mjs` has the tightened heuristic.

**Next work — clean handoff list, roughly in priority order:**

Content / data work Dyl (curator) can do against the existing stubs:
1. **Fill in `summary:` fields** on any of the 224 stubs with empty summaries — agent won't per golden rule #6.
2. **Fix 2-digit-year dates** — ~30 alphabets stubs (`JANFEB09`, `M_A_Y_09`, `octobrr09`, etc.) are dated from mtime, not the year encoded in the name. Scriptable if you want a second pass with a 2-digit interpretation table (I'd need explicit date conventions from you: does `09` mean `2009`? Always?).
3. **Resolve curator-flag entries:** `M_killdby15:16:17`, `M_killdby` (empty), `unnamed_killdby_folder`, `untitled.md` (the `____` folder), `court-clothes.md` `coverArt` pointing at .svg while a .jpg exists next to it.
4. **Manual cover art** for any release whose source folder has the art but not named `cover.*` — see the curator-flag list below.

Agent-doable work queued for next sessions:
5. **Voice memo Whisper transcription** — ~780 files in `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Voice Memos/`. Dedicated session (needs whisper.cpp setup + ~2h compute). HANDOFF_PROMPT.md §3 prompt still applies.
6. **Vimeo embed wiring** — `~/.../CRFW Archive/_Quarantine/_UPLOADED TO VIMEO/` has URLs. Need Dyl's input: are URLs in filenames, sidecar files, or only in Dyl's Vimeo account?
7. **IG photo import** — if/when Dyl pulls the IG archive JSON, batch-create photo entries.
8. **Filter UX** — year slider, tag chips, Pagefind search. Now worth doing (234 entries makes filtering useful). Brief-level decision, ask before starting.
9. **Cover-art sweeps** — as more source folders get tidied by Dyl (image renamed to `cover.*`, or dropped into an `art/` subdir), re-run `node scripts/import-cover-art.mjs --write`. It's idempotent.
10. **Custom domain** — when Dyl is ready: `public/CNAME`, two-line swap in `astro.config.mjs`, drop/flip `public/robots.txt`. `withBase()` means no content edits.

**Curator-flag items to look at (consolidated from all three PRs):**
- 2-digit-year alphabets stubs (~30 files) — dates wrong by 1–4 years
- Empty-shell alphabets folders (~15 files) — format `other`, date from folder mtime
- `M_killdby15:16:17` — dated 2012 from mtime; should probably be `"2015"`
- `M_killdby` (no version) — empty directory, delete/merge?
- `unnamed_killdby_folder` — needs a real name
- `untitled.md` — from alphabets/`____`/, folder name is 4 underscores
- `court-clothes.md` — `coverArt` still points at `cover.svg` despite `cover.jpg` sitting in the same folder
- `loose-working-files-2010-2013` — 12 screenshots, no single obvious cover
- `m-killdby15-16-17` — 4 images at top level, top one (`kbyBsides.jpg`) could be a cover but isn't named like one
- Multi-volume series — may want to group via tags later (`underwaters` I–VI, `DDR*`, `SUNPOWER*`)

**Files touched this session:**
- [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs) — year-cap fix (PR #4)
- [scripts/import-cover-art.mjs](scripts/import-cover-art.mjs) — new (PR #5) + tightened this commit (post-merge)
- [src/content/releases/](src/content/releases/) — +176 new stubs (7 adjacent + 169 alphabets); seeded-data fix on `recovery.md` / `alphabets-2010.md`
- [public/media/releases/](public/media/releases/) — +2 cover images (OUTCASTS b-sides, THRU THA RIP)
- [.gitignore](.gitignore) — ignore `cover-art-import-report.txt`
- [SESSIONS.md](SESSIONS.md) — this entry

---

## Session 04 — 2026-04-15 — bulk pass landed, site is live

**Goal:** unblock the build (per Session 03's prescription), finish the killd by bulk pass, and get the site deployed.

**Done — killd by bulk pass shipped (PR #1, merged as `374da9c`):**
- Disk freed to ~90% full; `astro --help` dropped from ~60 s to 0.244 s. Session 03's diagnosis held: the "hang" was machine I/O load, not code.
- Added three more individual stubs on `bulk/killd-by-stubs` to cover the remaining representative patterns:
  - `3f3e889` — *Stub: 170 Recovery4Burn* — variant-marker case; `format: demo`, `tags: [killd-by, burn-stage]`.
  - `695d7b2` — *Stub: DjpOoLsiDe.1* — mashed-typography / no numeric prefix; `format: LP` (20 audio files).
  - `f90c5b1` — *Stub: OUTCASTS (b-sides 2014-2016)* — paren-style year range, exercises the non-word-boundary year regex; `format: b-sides`, `date: "2014"`.
- Ran the generator for the rest: `0f6d5d6` — *Bulk stubs: 51 remaining killd by folders* — all 51 emitted, 0 schema errors, `npm run build` clean in 611 ms.
- PR #1 *killd by: 55 release stubs (bulk pass)* opened, reviewed, merged. Flagged the 2015-mtime flatness in the PR body for curator follow-up (many folders without a year in the name defaulted to a Dropbox-sync-touched mtime).
- **`src/content/releases/` now has 58 entries** (3 seeded + 55 new stubs).

**Done — repo flipped public, site deployed to GitHub Pages (PR #2, merged as `0aa421d`):**
- Decision flow: Dyl confirmed (a) custom domain will eventually land, (b) initial preview audience is friends/family, (c) public repo on GitHub is fine. Given (b)+(c), went straight to GitHub Pages rather than Cloudflare / Netlify / Vercel. Used a `robots.txt` Disallow as the "unlisted WIP" posture — URL is shareable but search engines are asked not to index while content is still being curated.
- `gh repo edit --visibility public` — repo flipped, description + homepage URL set.
- `15b9bff` — *Wire GitHub Pages deploy + base-path handling:*
  - [.github/workflows/deploy.yml](.github/workflows/deploy.yml) — standard `withastro/action@v3` + `actions/deploy-pages@v4` pipeline; triggers on push to main and `workflow_dispatch`.
  - [astro.config.mjs](astro.config.mjs) — `site: 'https://dylwar27.github.io'`, `base: '/crfw-site'`, `build: { assets: 'assets' }`. Comment in-file notes the two-line swap for when a custom domain lands.
  - [src/pages/index.astro](src/pages/index.astro) — added `withBase()` helper that prefixes root-relative asset paths with `import.meta.env.BASE_URL`. Applied to cover art (releases), src (photos, voice_memos), poster + localSrc (videos). Idempotent: when base is `/`, becomes a no-op. Means the custom-domain migration is config-only, zero content edits.
  - [public/robots.txt](public/robots.txt) — `User-agent: *` / `Disallow: /` with an in-file note explaining the WIP rationale and how to flip it.
  - [.nvmrc](.nvmrc) — pinned to `24` (Node v24.14.1 on this machine; Session 02's suspected Node-25 incompat turned out to be unrelated — load-induced — but pinning avoids future confusion).
- Along the way: `gh auth refresh -h github.com -s workflow` was needed (the token didn't have `workflow` scope, so the first push of `deploy.yml` bounced). Preflight check to `gh api repos/dylwar27/crfw-site/pages` showed Pages config was already `build_type: "workflow"` — no Settings-UI step needed.
- PR #2 *Deploy site to GitHub Pages (base path + robots disallow)* merged. Deploy run `24481551331` succeeded. **Live URL: https://dylwar27.github.io/crfw-site/** returns 200; `/crfw-site/robots.txt` serves the Disallow; cover art resolves under the `/crfw-site/` base.

**State at end of session:**
- Repo: `dylwar27/crfw-site` — **public**, description + homepage set, Pages on, robots Disallow active.
- `main` has: scaffold + path fix + session logs 01–03 + PR #1 merge + PR #2 merge. 58 release entries. No open PRs.
- Node pinned to 24 via `.nvmrc`.

**Next work (deferred, unchanged priorities):**
1. **killd-by-adjacent folders** outside `KB/killd by/` (`KB/Killd By +`, `KB/M_Killd By`, `Other Projects/killdfilez`, `Other Projects/unnamed_killdby_folder`). Same generator, short branch.
2. **alphabets bulk pass** — 169 folders in `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/alphabets/`. Same script, `--project alphabets`, `--source …/alphabets`, `--archive-relative "CRFW Archive/_Documentation/Music/alphabets"`.
3. **Voice memo Whisper transcription** — ~780 files; script-first, then batches of ~50 per commit. HANDOFF_PROMPT.md §3 has the prompt.
4. **Cover art import** — for every stubbed release whose source folder has an image, copy to `public/media/releases/<slug>/` and update `coverArt:`. Can be done as its own pass or rolled into each bulk pass.
5. **Vimeo embed wiring** — `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Quarantine/_UPLOADED TO VIMEO/` already has URLs.
6. **Filter axes** — year slider, tag chips, Pagefind search — once there's more content.
7. **Custom domain** — when Dyl is ready: add `public/CNAME`, swap `site` / `base` in astro.config.mjs (two lines), drop robots.txt (or flip to Allow).

**Open curator questions (inherited, not actioned):**
- 2015-mtime flatness across many killd by stubs — dates where the folder name has no year were back-filled from file mtimes, which Dropbox sync touched. Curator-verify-me.
- `summary` is empty on all 55 new stubs (per golden rule #6). Dyl's voice to add.

**Files touched this session:**
- [src/content/releases/170-recovery4burn.md](src/content/releases/170-recovery4burn.md), [djpoolside-1.md](src/content/releases/djpoolside-1.md), [outcasts-b-sides-2014-2016.md](src/content/releases/outcasts-b-sides-2014-2016.md) — individual stubs.
- 51 more stubs in [src/content/releases/](src/content/releases/) from the bulk commit.
- [astro.config.mjs](astro.config.mjs), [src/pages/index.astro](src/pages/index.astro) — base-path handling.
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml), [public/robots.txt](public/robots.txt), [.nvmrc](.nvmrc) — new.
- [SESSIONS.md](SESSIONS.md), [CLAUDE.md](CLAUDE.md), [README.md](README.md), [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md) — this log + doc sweep.

---

## Session 03 — 2026-04-14 — root-caused the "build hang" (machine, not code)

**Goal:** pick up from Session 02's blocker — Astro CLI hanging on `--help` and `build` — and get to a place where the `bulk/killd-by-stubs` branch can be verified.

**Done (no repo changes — investigation + docs only):**
- Reproduced the Session-02 hang: `./node_modules/.bin/astro --help` took ~60s on first try; `astro sync` took **18m41s wall / 2.6s CPU (0% CPU)**; the process sits in `kqueue` waiting on module-load I/O, not looping or spinning.
- Narrowed where time is spent: probing `core/messages.js` → `install-package.js` → its deps, the slowness moves around (prompts took 10.5s on one run, sub-10ms on the next). It is not deterministic — it is I/O queue depth.
- Confirmed **root cause is machine state, not Astro / Node / the repo**:
  - Disk: **98% full** (`/System/Volumes/Data`: 13 Gi free of 460 Gi). APFS copy-on-write gets expensive near full.
  - CPU: Ableton Live 12 Suite pegged at **~52% CPU** (PID 80592) throughout.
  - Memory: ~150 MB free pages, high inactive/wired — system was pushing to swap.
  - Load avg: 2.79 / 3.06 / 2.87.
  - Node version was **not** the issue. Session 02 suspected Node 25; switching `nvm use 24` (v24.14.1) produced the same slow-but-eventually-correct behavior. `astro --version` → `v4.16.19` and `astro --help` → full help output, both succeeded, just slowly.
- `astro sync` **did complete successfully** when left alone: `Generated [types] 10.84s`. No schema errors across existing content (court-clothes, recovery, alphabets-2010). So the `Music/` path-fix commit did not regress anything.
- Inspected [117-killd-by-2014-2016-bsides.md](src/content/releases/117-killd-by-2014-2016-bsides.md) on `bulk/killd-by-stubs` against [config.ts](src/content/config.ts) schema by hand. All required fields present and valid (`title`, `project: "killd by"`, `date: "2014"`, `format: b-sides`). Optional fields (`preservedTitle`, `archivePath`, `tags`, `summary`) are all well-formed. Stub is schema-valid.
- Did not run `astro build` to completion — not worth the ~20 min cost at current machine load when `astro sync` already confirms content collections parse.

**Diagnosis in plain language:** Astro is fine. Node is fine. The repo is fine. The machine is loaded (Ableton + near-full disk + memory pressure), so Node module loading — which is I/O-bound — crawls. Any long-feeling "hang" during a session where Ableton is running or disk is tight will be this.

**Next session — do one of these *before* touching code:**
1. **Free disk.** Get `/System/Volumes/Data` under 90% full. Empty trash, clear `~/Library/Caches`, remove any stale Xcode simulators, etc.
2. **Close Ableton / other heavy native apps** while building.
3. Then `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 24 && npm run build`. Expect it to complete in 30–60 s on an unloaded machine. If it still takes >3 min: check `ps aux | sort -rnk 3 | head` and `df -h` before assuming the code broke.

**Continuing the bulk pass (unchanged from Session 02's plan, just unblocked):**
- Branch `bulk/killd-by-stubs` is pushed and has the generator script + first stub.
- Once a full `npm run build` succeeds on that branch, add 2–3 more individual commits to cover representative patterns:
  - A folder *without* a numeric prefix (e.g. `Court Clothes` → `court-clothes-2.md`)
  - A folder with variant markers (e.g. `170 Recovery4Burn` → `170-recovery4burn.md` format `demo`)
  - A folder with mashed letters+digits (e.g. `DjpOoLsiDe.1` → exercise the year/format regex edge cases)
- Then run `node scripts/bulk-stub-releases.mjs --project "killd by" --source "/Users/dward/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/KB/killd by" --archive-relative "CRFW Archive/_Documentation/Music/KB/killd by" --skip "41 CCFinaLsWAVs" --skip "171 RecoveryFinaL" --skip "117 killd by - 2014-2016 -Bsides" [--skip the other individually-committed folders] --write` for the rest.
- `npm run build` after bulk generation.
- Open PR to main. Flag the 2015-mtime flatness in the PR body (Dropbox sync touched file mtimes, so folders without a year in the name defaulted to a fake date — curator-verify-me).

**Files touched this session:**
- [SESSIONS.md](SESSIONS.md) — this entry; revised the Session-02 diagnosis (`Blocker` section preserved intact below for historical truth, but the real cause is what's written here).

---

## Session 02 — 2026-04-14 — path fix + killd by bulk pass (partial, blocked)

**Goals:**
- (A) Fix stale archive paths in docs + existing content (groundwork).
- (B) Begin killd by discography bulk stub pass. Decisions agreed on up front: **preserve everything** (no skip-list beyond entries that already exist as canonical); slug scheme = slugified folder name with Colin's numeric chronology prefix retained; one commit per stub (max modulatability); branch `bulk/killd-by-stubs`, PR to main when complete.

**Done — on `main`:**
- Audited all `../CRFW Archive/...` references in docs + content. Found real structure is `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/{alphabets,KB/killd by}/` — the `Music/` segment was missing everywhere, and the `../` relative prefix is stale since the repo moved to `~/Desktop/site/` (outside the Dropbox tree).
- Verified counts match [CLAUDE.md](CLAUDE.md) estimates: killd by = 57 folders, alphabets = 169. Identified two other stale paths: Vimeo source is actually at `_Quarantine/_UPLOADED TO VIMEO/` not `_Creative Assets/Videos/_UPLOADED TO VIMEO/`; voice memos and `Images and Video Assets` paths confirmed correct.
- Commit **`2e56644`** — *Fix stale archive paths in docs and existing content.* Updated 7 files; `archivePath` convention documented in CLAUDE.md (archive-relative `CRFW Archive/...`; narrative in docs uses absolute `~/Library/CloudStorage/...` location).

**Done — on branch `bulk/killd-by-stubs` (not yet merged):**
- Commit **`54fe61d`** — *Add bulk-stub-releases.mjs — generator for release stubs.* Node script at [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs). Walks a project folder, emits one Astro release stub per subfolder. Word-boundary regexes deliberately avoided in format/year detection because Colin's naming mashes letters and digits together (`B-SIDES2017`, `Recovery4Burn`, `RcvryDrafts`) — `\b` fails there. Default dry-run; `--write` to emit.
- Dry-run output verified: 57 subfolders, 2 skipped (`41 CCFinaLsWAVs` → existing `court-clothes.md`; `171 RecoveryFinaL` → existing `recovery.md`), 55 new stubs planned, 0 errors. Format heuristics confirmed sane (stage/variant markers → `demo`, b-sides collections → `b-sides`, fullmix folders → `mix`, audio count → LP/EP/single). Slug collisions auto-suffixed (`2014-2016-bsides-2.md`, `court-clothes-2.md`).
- Commit **`8ffecb7`** (or similar — see branch) — first stub: [src/content/releases/117-killd-by-2014-2016-bsides.md](src/content/releases/117-killd-by-2014-2016-bsides.md). Schema-valid by inspection.

**⚠️ Blocker — build verification not possible end-of-session:**

Astro CLI (`node_modules/.bin/astro`) started hanging with zero output mid-session, even on `astro --help`. Not just `build` — the CLI itself hangs. Confirmed:
- `astro` bin shim invokes node semver check then `import('./dist/cli/index.js')`. Loading the CLI module directly via `import(...)` completes in ~14ms. Running the shim hangs indefinitely. Suggests the hang is *after* CLI import, possibly in config loading, project detection, or a dep (vite, rollup).
- `.astro/` cache cleared, `dist/` cleared — no help.
- Node v25.9.0. Astro 4.16.19 declares `engines.node: ^18.17.1 || ^20.3.0 || >=21.0.0` (so v25 is "supported" on paper), but Node 25 is new and dep chain may have silent incompat.
- Earlier in this same session, `npm run build` succeeded (see Session 01 + the path-fix commit verification). So something changed between those runs and now. Nothing obvious in the diff — just doc text edits, `archivePath` string changes, and the script + first stub (both removed in isolation, hang persisted).
- Possible culprits (untested, in likelihood order): Node 25 incompat surfacing intermittently; a stray file watcher from an earlier background task holding a lock; Dropbox CloudStorage filesystem weirdness; corrupted `node_modules` from the session.

**Suggested debug order for next session (before continuing the bulk pass):**
1. `nvm install 22 && nvm use 22` (or 20), then `npm run build` — most likely fix. If that works, pin `.nvmrc` to the working version.
2. If Node 22 doesn't fix it: `rm -rf node_modules package-lock.json && npm install && npm run build`.
3. If still broken: run `node --trace-warnings node_modules/.bin/astro --help` with a pipeline to `tee` so you can see partial output. Also check `lsof -p <pid>` on the hung process to see what it's waiting on.
4. Once the build works again, run `npm run build` on the current `bulk/killd-by-stubs` branch — if the first stub (`117-killd-by-2014-2016-bsides.md`) validates, proceed with the rest.

**Continuing the bulk pass after build is unblocked:**
- The generator is already on the branch. Agreed plan was: first 3–5 stubs as individual commits (to establish pattern), then one bulk commit for the remaining ~50.
- After the first stub is verified, suggested next two individual commits: one folder *without* a numeric prefix (e.g. `Court Clothes` → `court-clothes-2.md`) and one with variant markers (e.g. `170 Recovery4Burn` → `170-recovery4burn.md` format `demo`). That covers the three representative cases.
- Then: `node scripts/bulk-stub-releases.mjs --project "killd by" --source "…" --archive-relative "CRFW Archive/_Documentation/Music/KB/killd by" --skip "41 CCFinaLsWAVs" --skip "171 RecoveryFinaL" --write` for the rest. **Before running**, skip the 4 folders already stubbed individually (add more `--skip` flags), or just let the generator silently overwrite them (currently it does — a safety improvement for next session could be refusing to overwrite without `--force`).
- Open PR against main when complete. Flag the 2015-mtime flatness in the PR body — many folders got `2015` as their date because Dropbox sync touched mtimes; dates for anything without a year in the folder name should be considered curator-verify-me.

**Deferred from this session (unchanged from Session 01):**
- killd-by-adjacent folders outside `KB/killd by/` (`KB/Killd By +`, `KB/M_Killd By`, `Other Projects/killdfilez`, `Other Projects/unnamed_killdby_folder`). Treat as a separate pass after the main 57 land.
- alphabets bulk pass (169 folders). Same script, just different `--project`, `--source`, `--archive-relative` flags.
- Voice memo Whisper transcription.
- GitHub Pages deploy.
- Open questions from Session 01: custom domain, `_preview/` commit policy.

**Files touched this session:**
- [CLAUDE.md](CLAUDE.md), [CONTENT.md](CONTENT.md), [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md) — path fixes.
- [SESSIONS.md](SESSIONS.md) — Session 01 paths + this entry.
- [src/content/releases/court-clothes.md](src/content/releases/court-clothes.md), [recovery.md](src/content/releases/recovery.md), [alphabets-2010.md](src/content/releases/alphabets-2010.md) — `archivePath` added `Music/` segment.
- (branch) [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs) — new.
- (branch) [src/content/releases/117-killd-by-2014-2016-bsides.md](src/content/releases/117-killd-by-2014-2016-bsides.md) — new.

---

## Session 01 — 2026-04-14 — scaffold into GitHub

**Goal (from [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md)):** get the initial scaffold into a private GitHub repo cleanly. No content work.

**Done:**
- `npm install` — 330 packages, no blocking errors (3 audit warnings, deferred).
- `npm run build` — clean. Empty-collection warnings for `photos` / `videos` / `voice_memos` are expected (no entries yet).
- `git init -b main`, added `.claude/` to [.gitignore](.gitignore) (agent-local tool-approval config, shouldn't be tracked).
- Initial commit **`b0cc6b4`** — *Initial scaffold: CRFW memorial timeline site* — 46 files: scaffold, all four docs (CLAUDE, CONTENT, HANDOFF_PROMPT, README), seeded content (Court Clothes + Recovery + alphabets-2010 stubs + archive-begins event), and the `_preview/` snapshot.
- Created private repo **https://github.com/dylwar27/crfw-site** via `gh repo create --private --source=. --remote=origin --push`. `origin/main` tracks.

**Deferred (by explicit decision):**
- GitHub Pages deploy via Actions. Skipped this session — will add when there's enough content to justify a live URL and after a call on custom domain vs. `*.github.io`.

**Environment notes for next session:**
- Working dir: `/Users/dward/Desktop/site` — **not** in Dropbox (good; git + Dropbox fight over `node_modules/`).
- Archive lives at `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/` (the CRFW folder in Dropbox). Stale `../CRFW Archive/` refs in earlier drafts of the docs have been fixed — see path-fix commit below.
- `gh` authenticated as `dylwar27`, token scopes `gist, read:org, repo`.
- Node / npm installed and working.

**Known warnings (not blockers):**
- `npm install` reports 3 vulnerabilities (2 moderate, 1 high). Did not run `npm audit fix` — leave for a dedicated upgrade session so a scaffold commit doesn't get mixed with dep bumps.
- Build warns `The collection "photos"/"videos"/"voice_memos" does not exist or is empty.` — expected; will resolve as content lands.

**What's next (rough priority, per [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md) and [CLAUDE.md](CLAUDE.md)):**

1. **killd by bulk stub pass** — walk `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/KB/killd by/` (~57 folders). One release stub per folder with `title`, `preservedTitle` (folder name verbatim), `project: "killd by"`, `date` (from folder name if it has a year, else oldest file mtime), `format` (LP ≥8 tracks, EP 3–7, single 1–2, mix if continuous, b-sides if named so, else "other"), `archivePath`. **Leave `summary` empty** — per golden rule #6, no AI-generated summaries of Colin's work. Branch `bulk/killd-by-stubs`, first few as individual commits to establish pattern, then bulk commit, PR to main. Exact prompt at [HANDOFF_PROMPT.md:37](HANDOFF_PROMPT.md:37).

2. **alphabets bulk stub pass** — same pattern, `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/alphabets/` (~169 folders). Branch `bulk/alphabets-stubs`.

3. **Voice memo Whisper transcription** — script over ~780 files in `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Voice Memos/`. One JSON per memo with full transcript (no summary), filename as date. `whisper.cpp` with `small` or `medium` on Apple Silicon. Commit script first, then batches of ~50 entries. Prompt at [HANDOFF_PROMPT.md:57](HANDOFF_PROMPT.md:57).

4. **Cover art import** — for each stubbed release, if source folder has an image, copy to `public/media/releases/<slug>/` and update `coverArt:`. Do as a pass after the stub passes, or inline during the stub pass if it doesn't slow it down.

5. **Vimeo embed wiring** — `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Quarantine/_UPLOADED TO VIMEO/` has URLs already. Create `videos/` entries by year.

6. **GitHub Pages deploy** — revisit when there's enough content to want a live URL.

**Open questions for Dyl (don't guess — ask next session):**
- Custom domain for the eventual Pages deploy, or `dylwar27.github.io/crfw-site/`?
- For the bulk stub passes: any folders in the archive that should be **skipped** (drafts, personal, sensitive)? Default per [CLAUDE.md](CLAUDE.md) golden rule #1 is *preserve everything*, but worth confirming before 200+ stubs land.
- `_preview/` is committed to the repo. Keep committing rebuilt snapshots, or treat it as build output and gitignore it? Currently the only way a non-developer can look at the site without `npm`, so probably keep — but worth an explicit call.

**Files touched this session:**
- [.gitignore](.gitignore) — added `.claude/`
- [SESSIONS.md](SESSIONS.md) — new; this file
