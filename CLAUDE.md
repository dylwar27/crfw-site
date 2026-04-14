# CLAUDE.md — agent briefing for the CRFW timeline site

You are a coding agent working on a memorial timeline website for **Colin Ward** (CRFW / killd by / alphabets), a musician whose work is being preserved and presented by his brother **Dyl** after Colin's death. This is not a typical product or hobby project. Treat it as archival work with a public-facing presentation layer.

Read this file at the start of every session. Read `CONTENT.md` when you are adding content. Read `README.md` when you need the human-facing overview.

---

## What this site is

A static timeline site, dense and maximalist by default, with filter tabs that collapse the flood into simpler views. The vision, in Dyl's words: *"a timeline for his life and career with pop up examples; myriad, many many photos and examples, overwhelming just like him. Also tabs to filter to simpler views to find content."*

The archive it draws from lives in `../CRFW Archive/` — ~45,000 files across ~125 GB of Colin's original work, reference library, and documentation. This site is the presentation layer. The archive is the truth.

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

## Current state (as of initial scaffold)

- 3 release entries (Court Clothes fully populated, Recovery + alphabets-2010 stubs) + 1 event entry
- Cover art is a generated SVG placeholder. The real `CCcoverXX.jpg` from the archive needs to be dropped into `public/media/releases/court-clothes/cover.jpg` and the `coverArt:` field updated.
- Photos, videos, voice_memos, lyrics, people collections exist and validate but have no entries yet.
- Filter tabs work on two axes (project × medium). Year slider, tag chips, free-text search not yet implemented.

---

## Outstanding work (rough priority)

1. **Discography bulk pass** — walk every folder in `../CRFW Archive/_Documentation/alphabets/` (~169 folders) and `../CRFW Archive/_Documentation/KB/killd by/` (~57 folders). For each, create a release stub with `title`, `preservedTitle` (folder name), `project`, `date` (from folder name or file mtime), `format` (best guess), `archivePath`. Leave `summary` empty. This is volume work — volume is the point.
2. **Cover art import** — for every release folder that contains an image file, copy it into `public/media/releases/<slug>/` and reference it in frontmatter.
3. **Voice memo transcription** — run Whisper on `../CRFW Archive/_Documentation/Voice Memos/` (~780 files). Emit one JSON entry per memo into `src/content/voice_memos/`. Script it; do not hand-author.
4. **Vimeo embed wiring** — the archive's `../CRFW Archive/_Documentation/_Creative Assets/Videos/_UPLOADED TO VIMEO/` has already been uploaded. Pull the embed URLs and create video entries.
5. **IG archive import** — if/when Dyl pulls the IG archive JSON, batch-create photo entries with captions and dates.
6. **Filter axes — year slider, tag chips, Pagefind search** — once there's enough content to warrant them.
7. **Deploy** — GitHub Pages via Actions is the default plan. See HANDOFF_PROMPT.md.

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
