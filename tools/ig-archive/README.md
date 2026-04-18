# ig-archive

Small, scriptable tool to archive an Instagram account's public feed — media + metadata — into a stable local format anyone can build on top of.

Produces a directory of media files plus a single `manifest.json` that describes every post: shortcode, URL, date, caption, hashtags, location, media type (photo / video / carousel), and the filenames for primary + carousel-extra items. Whatever you're building — a static gallery, a personal archive, a research dataset, a database — read the manifest and go.

**This is personal-archival tooling.** It assumes the account is public or that you are logged into Instagram with an account that can already see it. Respect the ToS of the source platform; do not redistribute other people's content without permission.

---

## What it does

```
┌─────────────┐    fetch.sh       ┌──────────────────────────────┐
│  Instagram  │ ─────────────────▶ │  <out>/<handle>/             │
└─────────────┘                    │  ├── <shortcode>_1.jpg       │
        ▲                          │  ├── <shortcode>_1.jpg.json  │ ← gallery-dl
        │                          │  ├── <shortcode>_2.mp4       │   sidecar
    browser cookies                │  └── <shortcode>_2.mp4.json  │   (preserved)
                                   └──────────────┬───────────────┘
                                                  │
                                                  │ import.mjs
                                                  ▼
                                   ┌──────────────────────────────┐
                                   │  <out>/<handle>/manifest.json │
                                   └──────────────────────────────┘
                                   normalized, schema-versioned,
                                   grouped by post, carousel-aware
```

Two stages:

1. **fetch.sh** — wraps [gallery-dl](https://github.com/mikf/gallery-dl). Pulls the account's public posts using your browser's IG session cookies. Writes media files + gallery-dl JSON sidecars to `<out>/<handle>/`.
2. **import.mjs** — reads the gallery-dl dump, groups sidecars by post shortcode, writes a normalized `manifest.json` alongside the media.

The wizard **ig-archive.sh** chains both with confirmation prompts.

Why gallery-dl and not [instaloader](https://instaloader.github.io/): instaloader's session-health-check endpoint returns 401 on current Instagram backends and falls through to an interactive password prompt that breaks in scripted shells. gallery-dl uses your browser's real cookies directly.

---

## Prereqs

**One-time install:**

```bash
brew install gallery-dl      # macOS — recommended
# or
pipx install gallery-dl      # any OS
```

**Be logged into instagram.com** in Chrome (or Safari / Firefox) — that's where gallery-dl will read the session cookie.

Node 18+ (any modern version) for `import.mjs`. Bash for the shell scripts.

---

## Usage

Interactive — the easy path:

```bash
./ig-archive.sh
```

Or non-interactively:

```bash
./fetch.sh chi_swoo_ --browser chrome --out ./my-archive
node ./import.mjs --handle chi_swoo_ --out ./my-archive
```

Output will land at `./my-archive/chi_swoo_/` with `manifest.json` + all media.

### fetch.sh flags

| flag | default | |
|---|---|---|
| `--browser <name>` | `chrome` | `chrome`, `safari`, `firefox` — whichever has an active IG login |
| `--out <dir>` | `./ig-archive` | root directory (handle becomes a subdir) |

### import.mjs flags

| flag | default | |
|---|---|---|
| `--handle <name>` | required | account handle (no `@`) |
| `--out <dir>` | `./ig-archive` | same as fetch.sh |
| `--verbose` | off | print each post as normalized |
| `--dry-run` | off | print counts only; don't write manifest.json |

---

## The manifest format

```json
{
  "schema_version": 1,
  "handle": "chi_swoo_",
  "fullname": "colin_ward",
  "source": "instagram.com",
  "scraper": "gallery-dl",
  "scraped_at": "2026-04-18T00:15:00Z",
  "post_count": 913,
  "posts": [
    {
      "shortcode": "BemAJfdlzwd",
      "url": "https://www.instagram.com/p/BemAJfdlzwd/",
      "date": "2018-01-31T00:30:30Z",
      "kind": "photo",
      "caption": "Midwife // DjPopCtrl // Glissline // ilind / tonight at animal shelter! pm for address",
      "caption_body": "Midwife // DjPopCtrl // Glissline // ilind / tonight at animal shelter! pm for address",
      "caption_hashtags": [],
      "location": null,
      "media_count": 1,
      "primary": { "file": "BemAJfdlzwd_1.jpg", "type": "image" },
      "extras": []
    }
  ]
}
```

### Field reference

| field | type | notes |
|---|---|---|
| `schema_version` | int | `1` today. Bumps on breaking changes. |
| `handle` | string | account handle (no `@`) |
| `fullname` | string \| null | display name as captured from IG |
| `source` | string | always `"instagram.com"` today |
| `scraper` | string | tool used to produce this dump (for debugging posterity) |
| `scraped_at` | ISO UTC string | when the fetch ran |
| `post_count` | int | `posts.length` |
| `posts` | array | newest first, sorted by `date` descending |

Each post:

| field | type | notes |
|---|---|---|
| `shortcode` | string | globally unique on IG |
| `url` | string | canonical `instagram.com/p/<shortcode>/` URL |
| `date` | ISO UTC string \| null | post timestamp |
| `kind` | enum | `photo`, `video`, `carousel-photo`, `carousel-video` — see below |
| `caption` | string \| null | raw IG caption, verbatim |
| `caption_body` | string \| null | caption with trailing-hashtag block peeled off |
| `caption_hashtags` | string[] | lowercased, `#` stripped, de-duplicated |
| `location` | string \| null | IG location name if set |
| `media_count` | int | total items in the post (1 for singles, 2–10 for carousels) |
| `primary` | object | the first media item: `{ file, type }` |
| `extras` | array | ordered secondary items (empty for singles): `[{ file, type }]` |

Both `primary.file` and `extras[].file` are **filenames relative to the manifest's directory**. Resolve them as `<manifest_dir>/<file>`.

`type` on primary/extras is either `"image"` or `"video"`.

### kind semantics

| kind | meaning |
|---|---|
| `photo` | single-item post, primary is an image |
| `video` | single-item post, primary is a video |
| `carousel-photo` | multi-item post, primary is an image (extras may include videos) |
| `carousel-video` | multi-item post, primary is a video (extras may include images) |

Rationale: a carousel is one authored post. One manifest entry per carousel preserves that authorship. First-item type chooses the `kind` suffix so a consumer that only cares about the lead media can ignore the rest, while a consumer that wants the whole carousel reads `media_count > 1` and iterates `[primary, ...extras]`.

---

## Resumability

Both stages are incremental:

- **fetch.sh** — re-runs skip posts gallery-dl already downloaded. Useful for periodic archival top-ups.
- **import.mjs** — always rewrites `manifest.json` from whatever is currently on disk. Run it again after each fetch top-up.

The gallery-dl sidecars are kept on disk alongside the media — if you need fields the manifest doesn't expose (like per-media CDN URLs or engagement counts), read those directly.

---

## Legal / ethical notes

- Instagram's ToS prohibits automated access. This tool exists for personal-archive use cases: you backing up your own account, a family member backing up a deceased relative's account, a researcher pulling a small dataset they have consent for.
- **Do not** republish scraped content without the subject's permission.
- **Do not** use this to mass-scrape accounts you don't have a legitimate archival interest in.
- IG actively rate-limits. Scrape conservatively — don't chain runs, give the account a break if you get 429s.

This tool doesn't check any of the above; that's on you.

---

## Troubleshooting

**`401 Unauthorized` on `/web/search/topsearch/`**  
You aren't logged into instagram.com in the browser you told gallery-dl to read. Log in in a tab, close the tab, rerun.

**`Keychain prompt denied`** (macOS Chrome)  
macOS asks permission once to read Chrome's cookie-encryption key. If you denied, re-run and approve — or clear the Keychain entry via `security list-keychains`.

**`Profile does not exist`**  
Either a typo in the handle, or the account is private and your logged-in account doesn't follow it. Verify by visiting `https://instagram.com/<handle>/` in the browser.

**`429 Too Many Requests`**  
IG rate-limit. Wait ~1 hour before retrying. Don't hammer — you'll just deepen the cooldown.

**Carousel items in wrong order**  
Open an issue with the post URL. gallery-dl's `num` field should produce the right ordering, but IG occasionally sends oddities.

---

## Who wrote this

Extracted from the scripts used to archive the Instagram presence of [Colin Ward (CRFW)](https://github.com/dylwar27/crfw-site), a musician whose work his brother is preserving. That use case is personal-archival, the generalized tool was pulled out so other people doing similar work can save the implementation time.

MIT licensed in spirit; no formal license attached yet. Treat as: do whatever, don't blame anyone.
