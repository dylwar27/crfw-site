# Curator's Kit — local-first archival CMS

A browser-based editor for the CRFW content collections that runs on the curator's laptop. Edits are written directly to `src/content/**` and committed to git, preserving the file-as-truth contract.

## Run

```bash
npm run cms        # localhost:4322
npm run cms:lan    # also accessible from phone on same wifi
```

The terminal prints the LAN URL (e.g. `http://192.168.1.42:4322/`) when `cms:lan` is used. Open it on your phone to edit in the field.

Ctrl-C to stop the server.

## Philosophy

Built specifically for archival work. Off-the-shelf CMSes (Decap, TinaCMS, Sanity) have publishing/marketing defaults; archival work needs opposite defaults:

| Marketing CMS | Curator's Kit |
|---|---|
| Delete button | No delete — only "mark unpublished" or "flag speculative" |
| One title field | `title` + `preservedTitle` (Colin's typography is sacred) |
| Date types | Fuzzy dates (YYYY, YYYY-MM, YYYY-MM-DD all valid) |
| "Publish" is binary | Published + sensitivity are orthogonal |
| AI assist encouraged | AI summaries explicitly banned (golden rule #6) |
| Copy-first | Provenance-first (archivePath required) |

## Architecture

- Node HTTP server (`server.mjs`, no framework deps — built-ins only)
- Vanilla JS SPA (no build step; `public/app.js`)
- Reads/writes content files in `src/content/**`
- Shares frontmatter parsing logic with `scripts/import-csv-edits.mjs`
- Commits each save to local git with a descriptive message
- Curator `git push` when ready to deploy

## Workflow

1. `npm run cms` → browser opens localhost:4322
2. Pick a collection from the sidebar (releases, photos, videos, …)
3. Search/scroll to find an entry, click to open the editor
4. Edit fields (preserved typography preserved; fuzzy dates accepted)
5. "Save & Commit" → writes the file + `git commit` locally
6. Once happy with a batch of edits: `git push` → CI rebuilds the site

## Editable fields per collection (v1)

Restricted to the most common; more in v2.

- **releases**: title, preservedTitle, project, date, format, era, summary, tags, published, archivePath, coverArt, bandcamp*, youtubeId, soundcloudUrl
- **photos**: title, date, caption, project, source, sourceUrl, tags, published, archivePath
- **videos**: title, date, kind, project, youtubeId, vimeoEmbed, summary, tags, published, archivePath, transcript
- **voice_memos**: title, date, summary, project, tags, published, archivePath
- **events**: title, date, kind, project, location, url, source, summary, tags, published
- **people**: name, role, relationship, note
- **lyrics**: title, project, date, relatedRelease, relatedTrack, tags, published, archivePath

## v1 limits (deferred to v2)

- No image upload widget (edit the path string directly for now)
- Cross-ref picker is a text input (v2 will have type-ahead search across collections)
- No carousel editor (edit the `carouselExtras` array in the raw JSON until v2)
- No diff preview before save
- No git log / revision history viewer
- No deployed (non-local) mode — LAN access is the current phone path

## Reuse

This tool is designed to be schema-agnostic within the Astro content-collections pattern. To use on another project:
1. Copy `scripts/curators-kit/` over
2. Adjust `COLLECTIONS` and `EDITABLE_FIELDS` at the top of `server.mjs` to match the new project's schemas
3. Add enum values for new projects' dropdowns in `public/app.js` `enumValues()`

No further changes needed — the editor reads files and commits via git using the repo it runs in.
