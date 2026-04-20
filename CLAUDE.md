# CLAUDE.md — agent briefing for the CRFW timeline site

You are a coding agent working on a memorial timeline website for **Colin Ward** (CRFW / killd by / alphabets), a musician whose work is being preserved and presented by his brother **Dyl** after Colin's death. This is not a typical product or hobby project. Treat it as archival work with a public-facing presentation layer.

Read this file at the start of every session. Read `CONTENT.md` when you are adding content. Read `README.md` when you need the human-facing overview. Read `DATA_MODEL.md` if you're building or querying a database for the archive.

---

## What this site is

A static timeline site, dense and maximalist by default, with filter tabs that collapse the flood into simpler views. The vision, in Dyl's words: *"a timeline for his life and career with pop up examples; myriad, many many photos and examples, overwhelming just like him. Also tabs to filter to simpler views to find content."*

The archive lives at `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/` (the CRFW folder in Dropbox) — ~45,000 files across ~125 GB of Colin's original work, reference library, and documentation. This site is the presentation layer. The archive is the truth. In `archivePath` fields, use archive-relative paths that start `CRFW Archive/...` — the absolute location is machine-specific, but the archive-relative path is stable.

---

## Golden rules — non-negotiable

1. **Never delete content.** Not files, not content entries, not even entries that turn out to be wrong. Mark them speculative in `summary` or add a note. Memorial archives err on the side of preservation.
2. **Preserve Colin's typography exactly.** When a release or track is named `_e_v_i_L__a_n_g_eLz_` or `thunder__stoned_` or `COPE_`, keep that in `preservedTitle`. Put a cleaner readable version in `title`. Both render on the popup. Do not "fix" capitalization, spacing, underscores, or punctuation — they are his voice.
3. **Every entry carries an `archivePath`.** Always point back to the source folder in the Dropbox archive. If you cannot produce one, leave it out rather than inventing a path.
4. **Do not redesign without explicit direction.** The visual language ("overwhelming just like him" — heavy serif titles, dense grid, varied card sizes, preserved typography visible) is the brief. Refinement is welcome; reflexive cleanup is not.
5. **Fuzzy dates are valid.** `2014`, `2014-07`, `2014-07-23` all pass the schema. Use what you actually know. Do not guess precise dates.
6. **No AI-generated summary text for Colin's work.** If you are adding a release and have no curator-provided summary, leave the field empty or write a factually minimal one ("B-sides collection from the killd by era. Source folder: …"). Do not invent artistic descriptions, emotional framing, or biographical narrative — that is Dyl's voice to add, not yours.

---

## Stack

- **Astro 4** — static site generator with content collections (schema-validated MD/JSON)
- Plain CSS (no framework) in `src/styles/global.css`
- Vanilla JS in `src/pages/index.astro` — popups, filter tabs
- Pagefind (planned, not yet wired) for client-side search
- No backend, no database, no runtime dependencies

The output is static HTML/CSS/JS that can be hosted anywhere.

---

## Commands

```bash
npm install            # first-time only
npm run dev            # http://localhost:4321 with hot reload
npm run build          # produces dist/
npm run preview        # serves dist/ locally
```

When you change the schema (`src/content/config.ts`), a fresh dev/build is needed.

---

## Repo layout

```
site/
├── CLAUDE.md               ← you are here
├── CONTENT.md              ← how to add content (read before adding)
├── DATA_MODEL.md           ← DB briefing: schema, cross-refs, carousel rules
├── HANDOFF_PROMPT.md       ← first-session setup (git, GitHub, deploy)
├── README.md               ← human-facing overview
├── astro.config.mjs
├── package.json
├── tsconfig.json
├── .gitignore
├── public/media/           ← images / audio / video referenced by /media/... paths
├── src/
│   ├── content/
│   │   ├── config.ts       ← ALL schemas live here
│   │   ├── releases/       ← .md — LPs, EPs, singles, mixes
│   │   ├── photos/         ← .json
│   │   ├── videos/         ← .json — prefer Vimeo embeds over self-hosting
│   │   ├── voice_memos/    ← .json — transcripts from Whisper
│   │   ├── lyrics/         ← .md
│   │   ├── people/         ← .json
│   │   └── events/         ← .md — life milestones, shows, residences
│   ├── layouts/Base.astro
│   ├── pages/index.astro   ← the timeline page + filter tabs + popup logic
│   └── styles/global.css
└── _preview/               ← a built snapshot for no-install preview (optional)
```

---

## Current state (as of Session 15, 2026-04-20)

- **~1,958 total entries** (238 releases + 866 photos + 538 videos + 305 voice memos + 11 events)
- **33 PRs merged** across 15 sessions
- Live at https://dylwar27.github.io/crfw-site/ + /about + /projects + /tags + /admin + /people + /press
- **631 static pages**: timeline + admin + about + projects + tags + 305 voice memo readers + 249 video readers + 15 project pages + 34 person pages + 1 people index + 21 press pages + 1 press index
- **Filter UX (Session 11): four dropdowns** (Project, Format, Medium, Tag) with live counts, reset button, URL-param pre-selection (`?project=X&tag=Y`)
- **Tag scaling (Session 11)**: tag dropdown recomputes scoped to other-axis selections; /tags page groups all tags by source (curator / script / hashtag)
- **Database v1 (Session 11, extended Session 15)**: SQLite schema at `data/schema.sql`. `scripts/db-sync.mjs` projects 1,958 site entries + 110 vault entities into `data/crfw.db`. Vault entity tables now populated: 36 people, 15 projects, 9 venues, 22 orgs, 21 press, 1 fund, 6 grants. FTS5 indexed. 0 dead cross-refs.
- **Curator's Kit v3 (Session 13)**: two-source CMS coordinator. Edit BOTH site content (git-tracked, auto-commits) and the Obsidian-style vault at `CRFW Archive/_Vault/` (Dropbox-tracked). Source switcher in sidebar. 11 vault collections: people (36), projects (15), venues (9), organizations (22), tracks (214), releases (26), events (12), press (21), funds (1), grants (6), series (new kind). Same grid/bulk/keyboard UX from v2.
- **Vault integration (Session 13–14)**: `scripts/sync-vault.mjs` projects vault entries into `src/content/vault_*/` for Astro rendering. 366 entries projected, 1,180+ wikilinks parsed, 0 dead refs.
- **Vault entity pages (Session 15)**: `/person/[slug]` (34 pages), `/people` index, `/press/[slug]` (21 pages), `/press` index. Shared `src/lib/renderBody.ts` renderer with stash/restore tokenizer for wikilink + markdown rendering. Wikilinks to people/projects/press resolve to real page links; venues/orgs render as `.wiki-chip` badges (no pages yet).
- **Mobile-ready (Session 11)**: responsive CSS targeting 320/375/414/600/900/1024 px. 44×44 tap targets. Full-screen popups on phones. Safe-area insets for notch devices.
- **Full-text search** via Pagefind (631 pages, 19,446 words indexed)
- **CSV roundtrip** via `scripts/import-csv-edits.mjs` still works for bulk operations
- **Embed integration**: Bandcamp/YouTube/SoundCloud iframes render in popups (priority BC > YT > SC); 22 releases have Bandcamp embeds; 32 videos have YouTube IDs
- **Draft system**: `published: false` hides entries from public timeline; import scripts default to draft

### Breakdown:

- **234 release entries** —
  - 3 original seeded: Court Clothes (fully populated), Recovery (stub), alphabets-2010 (placeholder)
  - 55 killd by stubs (Session 04, PR #1)
  - 7 killd-by-adjacent stubs (Session 05, PR #3) — `KB/Killd By +/`, `KB/M_Killd By/`, `Other Projects/killdfilez/`, `Other Projects/unnamed_killdby_folder/`
  - 169 alphabets stubs (Session 05, PR #4)
  - All bulk-stub `summary` fields empty per golden rule #6 — Dyl's voice to add.
- 1 event entry.
- **3 covers imported**: `court-clothes/cover.svg` (placeholder), `117-killd-by-2014-2016-bsides/cover.jpg`, `19-alphabets-thru-tha-rip/cover.jpg`. Plus `court-clothes/cover.jpg` sitting next to the SVG but not referenced by frontmatter (known curator-flag item).
- **305 voice memo entries** (Sep 2015 – Dec 2016) — Whisper transcripts from the archive. 12 m4a files without transcripts were skipped.
- **538 video entries** (2008–2020 + 47 IG videos from 2013–2018) — 465 stubs from `_Documentation/Videos/` year folders (266 with Whisper transcripts + permalinked `/video/<slug>` reader pages; 199 still need Whisper), 26 new YouTube drafts from Session 09, 47 IG videos from @chi_swoo_ (Session 10).
- **866 photo entries** — all from @chi_swoo_ (Colin's personal IG), 2013-07-10 through 2018-01-31, ingested in Session 10. All `published: false` awaiting curation. Second IG account (art/project handle) still TBD.
- 11 event entries (1 life + 10 press from Session 09).
- Lyrics, people collections exist and validate but have no entries yet.
- Filter UX: three axes (Project × Format × Medium) with "×" reset button and live "showing X of Y" count. Format axis is the workhorse (LP/EP/single/mix/demo/b-sides/other/compilation). Medium axis auto-appeared when voice memos + videos landed.
- **Live at https://dylwar27.github.io/crfw-site/** — GitHub Pages, `robots.txt` Disallow (WIP posture). `base: '/crfw-site'` + `withBase()` helper means custom-domain swap is config-only.

**Scripts:**
- [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs) — release stub generator (draft-default since Session 08)
- [scripts/import-cover-art.mjs](scripts/import-cover-art.mjs) — cover-art importer (strict policy)
- [scripts/import-voice-memos.mjs](scripts/import-voice-memos.mjs) — voice memo transcript importer (draft-default)
- [scripts/import-video-stubs.mjs](scripts/import-video-stubs.mjs) — video stub importer (draft-default)
- [scripts/import-video-transcripts.mjs](scripts/import-video-transcripts.mjs) — backfills Whisper .txt files into video entries (Session 08)
- [scripts/fetch-instagram.sh](scripts/fetch-instagram.sh) — gallery-dl wrapper, pulls public IG posts using browser session cookies (Session 10)
- [scripts/import-instagram.mjs](scripts/import-instagram.mjs) — groups gallery-dl sidecars by shortcode, writes photo/video entries with `archivePath` pointing to `CRFW Archive/Instagram/@<handle>/` (Session 10)
- [scripts/ingest-instagram.sh](scripts/ingest-instagram.sh) — interactive wizard wrapping the above (Session 10)
- [scripts/retag-dimcp.mjs](scripts/retag-dimcp.mjs) — one-off DIMCP project reassignment (Session 07)
- [scripts/fix-2digit-years.mjs](scripts/fix-2digit-years.mjs) — one-off 2-digit-year fix pass (Session 08)
- [scripts/import-csv-edits.mjs](scripts/import-csv-edits.mjs) — **CSV import-back** — diffs a CSV against content files, applies changes. Editable cols: title, preservedTitle, project, date, format, summary, tags, published. Dry-run by default; `--write` to apply.

---

## Outstanding work (rough priority)

Curator work (Dyl):
1. **`summary:` fields** on the 224 empty stubs — agent won't per golden rule #6. Easiest workflow now: export CSV from /admin, fill in summaries in Sheets, run `node scripts/import-csv-edits.mjs <file> --write`.
2. **2-digit year date fixes** — ~30 alphabets stubs dated from mtime. Scriptable once you confirm the convention ("all 2-digit years → 2000s"?).
3. **Curator-flag entries** — `M_killdby15:16:17`, empty `M_killdby`, `unnamed_killdby_folder`, `untitled.md`, court-clothes SVG/JPG mix-up.
4. **Manual cover art** for release folders where the image exists but isn't named `cover.*`.
5. **Voice memo titles** (if desired — currently show 80-char transcript preview as subtitle; option to hand-title memorable ones via CSV).

Agent-doable next:
6. **Photo import** — IG scraper shipped (`scripts/ingest-instagram.sh` wizard using gallery-dl). First account ingested: @chi_swoo_ (Colin's personal) → 866 photos + 47 videos, 2013–2018, all `published: false` awaiting curation. Second account (art/project handle) still TBD. Non-IG photo sources (EXIF-dated archive images) still TBD.
7. **Video transcripts** — 275 Whisper .txt files exist next to video files but weren't imported in Session 06. Extend `scripts/import-video-stubs.mjs` to pick them up + generate `/video/[slug]` reader pages mirroring voice memos.
8. **Whisper pass** on 12 voice memos without transcripts.
9. **YouTube/Vimeo URL matching** — video entries exist as stubs but have no embed URLs. YouTube more common than Vimeo for Colin's work. Dyl needs to source.
10. **Cover-art sweeps** — re-run `node scripts/import-cover-art.mjs --write` as Dyl tidies source folders.
11. **Project pages** (`/project/killd-by`, etc.) — curated landing pages per era.
12. **External embeds** — render Bandcamp / SoundCloud / YouTube / Vimeo iframes in popups when URLs land.
13. **Custom domain** — two-line astro.config.mjs swap + `public/CNAME` + drop/flip `robots.txt`. Consider basic HTTP auth for /admin at public launch.

**Done (cumulative through Session 11):**
- **Session 04–09:** killd by + killd-by-adjacent + alphabets bulk passes; GH Pages deploy; cover art; filter UX; voice memos + videos + video transcripts; bug pass; /admin + CSV roundtrip; DIMCP retag; tag filter axis; related entries; voice-memo reader; Pagefind; 2-digit year fix; draft-by-default; Bandcamp/YouTube/SoundCloud embeds + tracklist xref; 10 press events; /about + /projects.
- **Session 10:** Instagram scraper pipeline + 866 IG photos + 47 IG videos (PR #24).
- **Session 11:** ~~Database v1~~ (PR #25, SQLite + full schema + ships to dist). ~~Filter dropdowns + mobile pass~~ (PR #26). ~~Tag scaling + /tags page~~ (PR #27). ~~Curator's Kit~~ (PR #28, custom archival CMS at `npm run cms`).
- **Session 12:** QA cleanup (Dropbox dupe route template). ~~Curator's Kit v2~~ (PR #29, grid view + multi-select + bulk publish/tag/project + media preview + keyboard nav). Built for IG backlog burndown.
- **Session 13:** ~~Vault integration~~ (PR #30). 354 structural entities projected from the Obsidian-style vault. Curator's Kit v3 = two-source coordinator. 15 new `/project/[slug]` pages. `series` kind seeded (DDR cross-project series).
- **Session 14:** QA pass. Fixed better-sqlite3 Node version mismatch; fixed YAML `>` folded block scalar parser; cleared 721 iCloud sync-conflict dupe files; updated gitignore to cover ` [2-9].*` (not just ` 2.*`); picked up 12 new vault entries + 4 modified entries that Dyl had added in Obsidian since Session 13. Build: 574 pages, 366 vault entities, 0 dead refs.
- **Session 15:** ~~Person pages~~ (PR #31 — `/person/[slug]` × 34, `/people` index, shared `renderBody.ts` renderer with stash/restore tokenizer). ~~Press pages~~ (PR #32 — `/press/[slug]` × 21, `/press` index, mention chips). ~~DB vault sync~~ (PR #33 — vault entities in SQLite: 36 people, 15 projects, 9 venues, 22 orgs, 21 press, 1 fund, 6 grants, 0 dead refs). Build: 631 pages, 19,446 words.

---

## Working approach for this repo

- **Small commits, descriptive messages.** Dyl will want to see the history. "Add 12 killd by release stubs" is better than "content."
- **Bulk content work goes on its own branch.** Don't mix schema changes with content additions.
- **When schemas change, update CONTENT.md the same commit.** The schema and its docs should never drift.
- **Ask before refactoring visual style, adding frameworks, or changing the filter-tab UX.** These are brief-level decisions, not agent-level decisions.
- **Ask before deleting or renaming a content entry.** Per golden rule #1, default is preserve.
- **Flag anything unusual in the archive rather than silently handling it.** A folder named `-` or a duplicate with a hash mismatch is a curator question, not an agent decision.

---

## Sensitivity

Colin passed away. Summaries, commit messages, and UI copy should be factual and restrained. Avoid eulogistic tone in code and data; save that register for Dyl's voice in the content itself. In agent-authored text, prefer "Colin's work" or "Colin's archive" over language that projects meaning onto him or his death.
