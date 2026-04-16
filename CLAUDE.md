# CLAUDE.md — agent briefing for the CRFW timeline site

You are a coding agent working on a memorial timeline website for **Colin Ward** (CRFW / killd by / alphabets), a musician whose work is being preserved and presented by his brother **Dyl** after Colin's death. This is not a typical product or hobby project. Treat it as archival work with a public-facing presentation layer.

Read this file at the start of every session. Read `CONTENT.md` when you are adding content. Read `README.md` when you need the human-facing overview.

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

## Current state (as of Session 06, 2026-04-16)

- **1,005 total entries** (234 releases + 305 voice memos + 465 videos + 1 event)
- Filter UX has three axes: Project, Format, Medium — with reset button + live count
- Only "photos" collection warning remains (no photo entries yet)

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
- **465 video entries** (2008–2020) — stubs from `_Documentation/Videos/` year folders. No embed URLs yet (YouTube/Vimeo sourcing is Dyl's next call).
- 1 event entry.
- Photos, lyrics, people collections exist and validate but have no entries yet.
- Filter UX: three axes (Project × Format × Medium) with "×" reset button and live "showing X of Y" count. Format axis is the workhorse (LP/EP/single/mix/demo/b-sides/other/compilation). Medium axis auto-appeared when voice memos + videos landed.
- **Live at https://dylwar27.github.io/crfw-site/** — GitHub Pages, `robots.txt` Disallow (WIP posture). `base: '/crfw-site'` + `withBase()` helper means custom-domain swap is config-only.

**Scripts:**
- [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs) — the release-stub generator. Caps year extraction at current year (Session 05 hardening).
- [scripts/import-cover-art.mjs](scripts/import-cover-art.mjs) — the cover-art importer. Strict policy after Session 05: cover-named files only, or sole image inside an art-shaped subfolder. No substring matches, no top-level sole-image fallback.

---

## Outstanding work (rough priority)

Curator work (Dyl):
1. **`summary:` fields** on the 224 empty stubs — agent won't per golden rule #6.
2. **2-digit year date fixes** — ~30 alphabets stubs (`JANFEB09`, `M_A_Y_09`, `octobrr09`, etc.) are dated from mtime rather than the year encoded in the folder name. Scriptable with an explicit 2-digit interpretation table from Dyl.
3. **Curator-flag entries** — `M_killdby15:16:17` (should be 2015?), empty-shell `M_killdby`, `unnamed_killdby_folder` (placeholder name), `untitled.md` (from `____/`), `court-clothes.md` coverArt pointing at SVG while JPG exists next to it.
4. **Manual cover art** for release folders where the image exists but isn't named `cover.*`.

Agent-doable next:
5. **Photo import** — only remaining empty collection. Needs IG archive JSON or other source from Dyl.
6. **Whisper pass** on 12 voice memos without transcripts.
7. **YouTube/Vimeo URL matching** — video entries exist as stubs but have no embed URLs. YouTube was more popular than Vimeo for Colin's work. Dyl needs to source the URLs.
8. **Pagefind search** — with 1,005 entries, full-text search is now genuinely useful.
9. **Cover-art sweeps** — re-run `node scripts/import-cover-art.mjs --write` as Dyl tidies source folders.
10. **Custom domain** — two-line astro.config.mjs swap + `public/CNAME` + drop/flip `robots.txt`.

**Done (cumulative through Session 06):** ~~killd by discography bulk pass~~ (PR #1). ~~GitHub Pages deploy~~ (PR #2). ~~killd-by-adjacent pass~~ (PR #3). ~~alphabets bulk pass~~ (PR #4). ~~Cover-art importer + first pass~~ (PR #5). ~~Filter UX overhaul~~ (PR #6). ~~Voice memo import~~ (PR #7, 305 entries). ~~Video stub import~~ (PR #8, 465 entries).

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
