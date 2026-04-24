# CRFW site

A timeline site for the work of Colin Ward (CRFW / killd by / alphabets). Memorial archive curated by his brother Dyl.

**Live:** https://dylwar27.github.io/crfw-site/ — work in progress. The site is public but `robots.txt` asks search engines not to index it yet; share the URL directly while curation is underway.

---

## The idea

- **Default view** — dense, layered, maximalist. Everything visible at once, grouped by year into buckets (releases, press, life events, photo carousels, voice memo months, video chunks). Colin's typography preserved.
- **Filter tabs** — four axes (Project / Format / Medium / Tag) collapse the grid to what you're looking for.
- **Popups** — every card opens a detail view with tracklist, cover, notes, archive path, related media, transcripts.

---

## For humans

You don't need to install anything. Just visit the [live URL](https://dylwar27.github.io/crfw-site/).

---

## For developers

Requires Node 18+ (repo pins `24` via `.nvmrc`).

```bash
nvm use            # → 24
npm install
npm run dev        # http://localhost:4321 with hot reload
npm run build      # → dist/
npm run preview    # serves dist/
npm run cms        # curator CMS at http://localhost:3030
```

Stack: **Astro 4** · content collections · plain CSS · vanilla JS · Pagefind · SQLite projection · GitHub Pages.

---

## For coding agents

Start with [`CLAUDE.md`](./CLAUDE.md) — it's the entry point, the golden rules, and a pointer map to everything else. Key docs:

- [`SESSION_WORKFLOW.md`](./SESSION_WORKFLOW.md) — start/commit/end-of-session checklists
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — system design, data flow, pipeline DAG
- [`CONVENTIONS.md`](./CONVENTIONS.md) — `preservedTitle`, `archivePath`, wikilinks, fuzzy dates, slug rules
- [`VAULT.md`](./VAULT.md) — Obsidian vault authority rules, reconciler behavior
- [`CURATOR_GUIDE.md`](./CURATOR_GUIDE.md) — curator workflows (CMS, CSV, Obsidian)
- [`SCRIPT_PIPELINE.md`](./SCRIPT_PIPELINE.md) — what each script does, safety rules
- [`SESSIONS.md`](./SESSIONS.md) — running session log + current-state block

---

## License / usage

The content in this archive (audio, photos, videos, transcripts, prose) is Colin Ward's work, stewarded by his family. It is not licensed for reuse. Contact Dyl before reproducing or redistributing.

The site code is internal and unreleased.
