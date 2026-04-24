# CURATOR_GUIDE.md — how Dyl adds and edits content

Audience: Dyl (the curator). This is the "I'm sitting at my machine, what do I do" doc.

Three editing surfaces, from most visible to most technical:

1. The **admin CMS** (Curator's Kit) — web UI, edits both site content and vault.
2. The **vault** in Obsidian — markdown notes, entity research, cross-links.
3. The **CSV roundtrip** — export → edit in Google Sheets → import.

The agent edits content directly in git. You don't need to — pick the surface you prefer for the task.

---

## 1. Launching the CMS

```bash
cd ~/crfw-site
npm run cms
# open http://localhost:3030
```

LAN access (useful on a phone/tablet on the same network):
```bash
npm run cms:lan
# prints a LAN URL like http://192.168.1.X:3030
```

The CMS (Curator's Kit v3) has a source switcher in the sidebar to toggle between:
- **Site content** — git-tracked; the CMS auto-commits changes.
- **Vault** — Dropbox-tracked; Obsidian and the CMS both edit the same files.

Grid view, multi-select, bulk publish/tag/project, media preview, keyboard nav (from v2 in Session 12).

---

## 2. Editing content via the CMS

Typical tasks:

**Publish a photo.** Open `photos`, find the entry (search by date or filename), toggle `published: true`. The photo appears on the public timeline on next build.

**Add a summary to a release stub.** Open `releases`, find the stub, type the summary into the `summary` field. Save. (Agent won't write summaries per golden rule #6.)

**Bulk publish 50 photos from one day.** Grid view → filter by date → select-all → "Publish selected".

**Attach cover art.** Drop the image into `public/media/releases/<slug>/cover.jpg`, then reference it in the release's `coverArt` field (CMS will pick it up).

**Group photos/videos into an asset set** (Session 16 / PR #34). In `sets`, create a new set, attach photo/video IDs.

The CMS auto-commits on save with descriptive messages. Check `git log --oneline` afterward if you want to see what went in.

---

## 3. Editing the vault in Obsidian

The vault lives at `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Vault/`. Open it as an Obsidian vault (File → Open Vault → point at that directory).

Typical tasks:

**Add a new person.** Create `_Vault/people/firstname-lastname.md`. Use the frontmatter fields from `_Vault/SCHEMA.md#people`. Body can reference other entities with `[[coll/slug]]` wikilinks.

**Write press research.** Create `_Vault/press/YYYY-MM-DD-publication-slug.md`. Fill in `title`, `publication`, `publication_date`, `url`, `body` with wikilinks to people and projects mentioned.

**Update Colin's bio.** Edit `_Vault/people/colin-ward.md`. Add new collaborators under `refs:` and/or in body prose.

Next time someone runs `npm run build` (or `npm run vault:sync`), the new/changed vault entries project into `src/content/vault_*/` and appear on the site.

**Remember:** the site's `src/content/vault_*/` is a read-only projection. Don't edit those — edit the vault source. See `VAULT.md#authority`.

---

## 4. CSV roundtrip (bulk edits in Sheets)

Great for: filling in 50+ empty `summary` fields in one pass, cleaning up `tags` consistency, re-dating stubs with fuzzy dates.

See `CSV_ROUNDTRIP.md` for the full workflow. Short version:

```bash
# 1. Export current state (from /admin)
# 2. Edit in Google Sheets / Numbers / LibreOffice
# 3. Save as .csv
# 4. Dry-run:
node scripts/import-csv-edits.mjs path/to/edits.csv

# 5. Apply:
node scripts/import-csv-edits.mjs path/to/edits.csv --write
```

Editable columns: `title`, `preservedTitle`, `project`, `date`, `format`, `summary`, `tags`, `published`. Anything else in the CSV is ignored (safety).

---

## 5. Adding cover art

For each release folder in the archive that has a cover image:

1. Copy the image to `public/media/releases/<release-slug>/cover.jpg` (or `.png`, `.svg`).
2. In the release's `.md` frontmatter, add `coverArt: /media/releases/<slug>/cover.jpg`.
3. Or run `node scripts/import-cover-art.mjs` to bulk-import from archive folders where the file is named exactly `cover.jpg` / `cover.png` / `cover.svg`.

Policy: the importer only picks up files literally named `cover.*`. If the cover lives next to the release as `FolderName.jpg`, rename it to `cover.jpg` in the archive first.

---

## 6. When to tell the agent

The agent can do a lot autonomously. Tell it when:

- **You want summaries written by you, not by the agent.** (Golden rule #6. Agent will never write Colin-voice prose without asking.)
- **You've added a batch of new vault entries** and want them projected + reconciled into the site. "Run the vault pipeline" is enough.
- **A script emits a warning** (dead wikilinks, unmatched SLUG_MAP entries, etc.) and you want it triaged.
- **You're unsure whether a change is safe.** Agent will dry-run first by default.
- **You want a page type that doesn't exist yet** (e.g., venue pages, organization pages, track pages).
- **You want to ship work** — agent commits locally, you decide when to push.

Tell the agent about any archive reorganizations, renames, deletions, or file moves. Without that, the agent's `archivePath` values drift from reality.

---

## 7. What happens on commit / push

The CMS auto-commits locally with messages like `Edit releases/killd-by-court-clothes`. These land on the `main` branch of `~/crfw-site`.

Pushing to GitHub (`git push`) deploys via GitHub Actions to https://dylwar27.github.io/crfw-site/. Takes ~2 minutes. Check status:
```bash
gh run list --repo dylwar27/crfw-site --limit 1
```

Pull from GitHub if you've edited on another machine:
```bash
cd ~/crfw-site
git pull origin main
```

---

## 8. Common gotchas

- **Voice memo files named `Voice Memo 1234.m4a`.** Whisper produced transcripts for most; the 12 without transcripts are listed in `CLAUDE.md`/status — batch those through Whisper if you want them on the site.
- **IG carousel imports.** One post with multiple photos becomes one entry with `carouselExtras`; secondary media lands in that field. Don't split it.
- **Cover art showing SVG when JPG exists.** If both exist, the SVG takes precedence (it was a placeholder). Remove the SVG (or rename to `cover.placeholder.svg`) so the JPG picks up.
- **Dates appearing as "1914-01-01".** A script mis-parsed a 2-digit year as a 1900s year. Run `node scripts/fix-2digit-years.mjs` (one-off) to fix.
- **The CMS stopped auto-committing.** Likely the CMS's internal git check failed — check `git status` in the repo and resolve before re-starting the CMS.

---

## 9. See also

- `CONVENTIONS.md` — `preservedTitle`, `archivePath`, fuzzy dates, wikilinks, commit style.
- `VAULT.md` — vault-vs-site authority, BIN recovery.
- `CSV_ROUNDTRIP.md` — bulk editing workflow.
- `SLUG_MAP_TRIAGE.md` — what to do when reconciler flags an unmatched release.
- `_Vault/README.md` — curator overview inside the Dropbox vault.
