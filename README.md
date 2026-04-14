# CRFW site

A timeline site for the work of Colin Ward (CRFW / killd by / alphabets).

> **If you're a coding agent (Claude Code, Cursor, etc.):** start with [`CLAUDE.md`](./CLAUDE.md) before touching anything. It contains the ground rules for this archive and the preservation conventions that must not be violated. Then read [`CONTENT.md`](./CONTENT.md) before adding content. For first-time git/GitHub setup, see [`HANDOFF_PROMPT.md`](./HANDOFF_PROMPT.md).


This is a proof-of-concept scaffold. The idea:
- **Default view** — dense, layered, maximalist. Everything visible at once, organized by year. Different sized cards. Colin's typography preserved.
- **Filter tabs** — act as mercy. Pick a project (alphabets / killd by / life), pick a medium (release / photo / video / voice memo). The grid collapses to what you filtered for.
- **Popups** — every card opens a detail view with tracklist, cover, notes, archive path, related media.

## Stack

- [Astro 4](https://astro.build) — static site generator, content collections
- Plain CSS (no framework)
- Vanilla JS for popups + filter tabs (no React/Vue)
- [Pagefind](https://pagefind.app/) (planned) — client-side search

No database. No backend. The output is a folder of static HTML/CSS/JS you can host anywhere — Netlify, Cloudflare Pages, Vercel, a thumb drive.

## Quick preview (no install required)

Open `_preview/index.html` — but you need a local web server because the HTML uses absolute paths for assets.

In a terminal:

```bash
cd "/Users/dward/Library/CloudStorage/Dropbox/CRFW/site/_preview"
python3 -m http.server 8000
```

Then visit [http://localhost:8000](http://localhost:8000) in your browser.

## Developing

Install Node 18+ and then:

```bash
cd "/Users/dward/Library/CloudStorage/Dropbox/CRFW/site"
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

- **Court Clothes** (killd by, 2014) — fully populated: preserved title formatting, 10-track tracklist with each track's exact original typography, summary, archive path.
- **Recovery** (killd by, 2017) — stub; tracklist needs reconstruction from 4 variant folders.
- **2010 [_]** (alphabets, 2010) — placeholder representing the start of the alphabets era.
- **Archive stewardship begins** (event, 2026-04) — meta-entry.

Cover art is an SVG placeholder. Real cover art from the archive (`CCcoverXX.jpg`) should replace `public/media/releases/court-clothes/cover.svg` with a `.jpg` of the same name (and update the release frontmatter).
