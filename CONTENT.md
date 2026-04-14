# CONTENT guide — how to add things to the timeline

Every content item is a file in `src/content/<collection>/`. Astro reads them at build time, validates them against the schema in `src/content/config.ts`, and turns them into timeline entries and popups.

## Golden rules

1. **Preserve Colin's typography.** If the original name is `_e_v_i_L__a_n_g_eLz_`, put that in `preservedTitle`. Put a cleaner readable version in `title` for the big display. Both render on the popup.
2. **Dates can be fuzzy.** Valid dates: `2014`, `2014-07`, `2014-07-23`. Use what you actually know. Don't guess a full date if you only know the year.
3. **Archive path always.** Every entry should carry an `archivePath` field pointing back to where the source lives in Dropbox. The site is a presentation layer; the archive is the truth.
4. **Nothing gets deleted.** This is a memorial site. If an entry is speculative, mark it as such in the summary — don't remove it.

## Adding a release (LP / EP / single / mix)

Create `src/content/releases/<slug>.md`. Example:

```markdown
---
title: B-Sides 2014–2016
preservedTitle: "2014-2016 [Bsides]"
project: "killd by"
date: "2016"
era: "killd by — B-sides era"
format: "b-sides"
coverArt: /media/releases/b-sides/cover.jpg
tracklist:
  - n: 1
    title: "track name readable"
    preservedTitle: "track_NAME_readable__"
  - n: 2
    title: "another track"
tags: [killd-by, b-sides]
archivePath: "CRFW Archive/_Documentation/KB/killd by/117 killd by - 2014-2016 -Bsides/"
summary: >
  A short paragraph for the popup. Context, what the folder contains,
  how it relates to the main releases.
---

## Optional sections

Anything below the frontmatter is markdown — renders in the popup under "Notes".
```

Required: `title`, `project`, `date`, `format`. Everything else optional.

## Adding a photo

Create `src/content/photos/<slug>.json`:

```json
{
  "title": "Colin at DDR demo session",
  "date": "2015-11",
  "src": "/media/photos/2015-ddr-session.jpg",
  "caption": "One of the DDR demo nights.",
  "project": "killd by",
  "source": "archive",
  "tags": ["live", "ddr"],
  "archivePath": "CRFW Archive/_Documentation/_Creative Assets/Images and Video Assets/..."
}
```

The image file goes in `public/media/photos/`.

## Adding a video

Create `src/content/videos/<slug>.json`:

```json
{
  "title": "generation-zebra (music video)",
  "date": "2014",
  "vimeoEmbed": "https://player.vimeo.com/video/XXXXXXXX",
  "project": "killd by",
  "kind": "music video",
  "tags": ["court-clothes"],
  "archivePath": "CRFW Archive/_Documentation/_Creative Assets/Videos/_UPLOADED TO VIMEO/..."
}
```

For music videos / uploaded videos, prefer `vimeoEmbed` over self-hosting — Dyl has already uploaded most of Colin's videos to Vimeo and the pipeline is intact.

## Adding a voice memo

Create `src/content/voice_memos/<slug>.json`:

```json
{
  "title": "Tune hum — pelican melody",
  "date": "2017-03-14",
  "src": "/media/voice-memos/2017-03-14-pelican.m4a",
  "duration": "0:42",
  "transcript": "uh — so this is the thing I was thinking for the pelican song —",
  "summary": "Early hum of the melody that becomes 'LiKe a PeLiCaN' on Recovery.",
  "project": "killd by",
  "tags": ["recovery", "humming"],
  "archivePath": "CRFW Archive/_Documentation/Voice Memos/20170314 0842.m4a"
}
```

The `title` and `transcript` are what make voice memos searchable and meaningful on the timeline. Once Whisper transcripts exist for the ~780 voice memo files, batch-generating these JSON entries is straightforward.

## Adding a person

Create `src/content/people/<slug>.json`:

```json
{
  "name": "Drew Reininger",
  "role": "collaborator",
  "relationship": "frequent collaborator, co-credit on multiple projects",
  "links": [],
  "note": "Credited on Colin Ward & Drew Reininger releases."
}
```

## Adding a life event

Create `src/content/events/<slug>.md`:

```markdown
---
title: Move to Denver
date: "2012"
project: life
kind: residence
location: "Denver, CO"
summary: >
  Timeframe where the alphabets era ramps up.
tags: [denver, residence]
---
```

## The filter axes

There are two filter axes currently:

- **Project** — alphabets, killd by, Colin Ward, collaboration, life, other
- **Medium** — release, event, photo, video, voice_memo, lyrics

They AND together: clicking `killd by` + `photo` shows only killd-by-tagged photos. A future pass will add:

- Year range slider
- Tag chips
- "People" filter (show everything touching person X)
- Free-text search (Pagefind)

## Tips for the first big pass

The fastest way to populate the site:

1. **Discography first.** Walk through every folder in `_Documentation/alphabets/` and `_Documentation/KB/killd by/`, make a release entry for each. Even stubs with just title + date + archivePath are valuable — they put things on the timeline.
2. **Cover art in batch.** For each release folder, if there's an image file, drop it in `public/media/releases/<slug>/cover.jpg` and reference it.
3. **Voice memos via Whisper.** One script runs through all the voice memo files, outputs JSON entries with transcripts. That one pass turns hundreds of opaque filenames into hundreds of searchable popups.
4. **Photos after.** Bulk-import photos from `_Creative Assets/Images and Video Assets/` and the IG archive. Dates come from EXIF or filenames.
5. **Vimeo links by year.** Paste the Vimeo embed URLs into `videos/` entries. Organize by year since that's how `_Documentation/Videos/` already is.
