# CRFW site

A timeline site for the work of Colin Ward (CRFW / killd by / alphabets).

**Live:** [https://dylwar27.github.io/crfw-site/](https://dylwar27.github.io/crfw-site/) — work in progress. The site is public but `robots.txt` asks search engines not to index it yet; share the URL directly while the archive is being curated. When it's ready to be surfaced, flip [`public/robots.txt`](./public/robots.txt).

> **If you're a coding agent (Claude Code, Cursor, etc.):** start with [`CLAUDE.md`](./CLAUDE.md) before touching anything. It contains the ground rules for this archive and the preservation conventions that must not be violated. Then read [`CONTENT.md`](./CONTENT.md) before adding content. For first-time git/GitHub setup, see [`HANDOFF_PROMPT.md`](./HANDOFF_PROMPT.md). [`SESSIONS.md`](./SESSIONS.md) has the running session log.


The idea:
- **Default view** — dense, layered, maximalist. Everything visible at once, organized by year. Different sized cards. Colin's typography preserved.
- **Filter tabs** — act as mercy. Pick a project (alphabets / killd by / life), pick a medium (release / photo / video / voice memo). The grid collapses to what you filtered for.
- **Popups** — every card opens a detail view with tracklist, cover, notes, archive path, related media.

## Stack

- [Astro 4](https://astro.build) — static site generator, content collections
- Plain CSS (no framework)
- Vanilla JS for popups + filter tabs (no React/Vue)
- [Pagefind](https://pagefind.app/) (planned) — client-side search
- Deployed via GitHub Pages (see [`.github/workflows/deploy.yml`](./.github/workflows/deploy.yml)); pushes to `main` ship.

No database. No backend. The output is a folder of static HTML/CSS/JS — Pages is just the current host; it can go anywhere.

## Quick preview (no install required)

Open `_preview/index.html` — but you need a local web server because the HTML uses absolute paths for assets. From this folder:

```bash
cd _preview
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000) in your browser. (Or just visit the [live URL](https://dylwar27.github.io/crfw-site/).)

## Developing

Install Node 18+ (the repo pins `24` via [`.nvmrc`](./.nvmrc)) and then, from this folder:

```bash
nvm use            # picks up .nvmrc → 24
npm install
npm run dev
```

Visit [http://localhost:4321](http://localhost:4321). The dev server watches for file changes — every time you edit or add content in `src/content/`, the page reloads.

To rebuild the static preview:

```bash
npm run build
# output goes to dist/ — copy to _preview/ if you want the in-folder preview updated
```

## Adding content

See [`CONTENT.md`](./CONTENT.md) for the full guide. TL;DR: every entry is a markdown or JSON file in `src/content/<collection>/`. The schema is enforced — Astro will refuse to build if you miss a required field.

## Project layout

```
site/
├── src/
│   ├── content/
│   │   ├── config.ts         # schemas for all collections
│   │   ├── releases/         # markdown — LPs, EPs, singles, mixes
│   │   ├── photos/           # JSON — captioned photos
│   │   ├── videos/           # JSON — Vimeo embeds + metadata
│   │   ├── voice_memos/      # JSON — Whisper transcripts + audio
│   │   ├── lyrics/           # markdown — lyrics sheets
│   │   ├── people/           # JSON — collaborators, family, friends
│   │   └── events/           # markdown — life milestones, shows
│   ├── layouts/Base.astro    # HTML shell
│   ├── pages/index.astro     # the timeline + filter tabs + popup logic
│   └── styles/global.css     # all the visual language
├── public/media/             # images, audio, video for local-hosted content
├── _preview/                 # built site — open this with a local server
└── CONTENT.md                # curator guide
```

## What's seeded right now

- **234 release entries** across Colin's working discography:
  - **Court Clothes** (killd by, 2014) — fully populated with tracklist, summary, archive path.
  - **Recovery** (killd by, 2017) — stub; tracklist reconstruction pending from 4 variant folders.
  - **2010 [_]** (alphabets, 2010) — placeholder for the start of the alphabets era.
  - **55 killd by stubs** (Session 04 bulk pass).
  - **7 killd-by-adjacent stubs** (Session 05) — `Killd By +`, `M_Killd By`, `killdfilez`, `unnamed_killdby_folder`.
  - **169 alphabets stubs** (Session 05 bulk pass).
  - All bulk stubs have empty `summary` fields — curator (Dyl) fills those in.
- 1 **event** entry — archive stewardship begins (2026-04).
- 3 **cover images** landed so far (OUTCASTS b-sides, THRU THA RIP, Court Clothes placeholder).
- **Photos / videos / voice_memos / lyrics / people** — schemas validate, no entries yet.

Re-running [`scripts/import-cover-art.mjs`](./scripts/import-cover-art.mjs) will pick up additional covers as source folders are tidied (image renamed to `cover.*`, or dropped into an `art/` subdirectory). The script is idempotent and will never overwrite existing `coverArt:` fields.
