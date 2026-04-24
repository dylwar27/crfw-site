# SCRIPT_PIPELINE.md — the scripts, the DAG, and what's safe to run standalone

All project scripts live in `scripts/`. Run `node scripts/status.mjs` for a current inventory. This doc covers what each one does, its inputs/outputs, idempotency, dry-run default, and how they chain.

---

## 1. The build-time DAG

`npm run build` runs these in order:

```
 sync-vault.mjs --write
        │ projects _Vault/*.md → src/content/vault_*/*.json
        ▼
 reconcile-vault-releases.mjs
        │ merges vault_releases → site releases (dry-run by default in build)
        ▼
 astro build
        │ renders HTML pages
        ▼
 pagefind --site dist …
        │ builds client-side full-text search index
        ▼
 db-sync.mjs --dist --quiet
        │ projects src/content/** → dist/data/crfw.db
```

The reconciler's dry-run in the chain was added Session 17 — it prints an `UNMATCHED` warning to stderr for slugs without a site stub. Build continues; it's advisory, not a gate.

---

## 2. Pipeline scripts (idempotent, safe)

### `scripts/sync-vault.mjs`
- **Inputs:** `_Vault/**/*.md` (Dropbox archive vault).
- **Outputs:** `src/content/vault_*/*.json`.
- **Dry-run default?** Yes. Pass `--write` to apply.
- **Idempotent?** Yes — same vault state → same projections.
- **Safe standalone?** Yes.
- **Emits:** entity counts per kind; wikilink totals; **dead wikilinks** (authoring bugs — clean up in the vault).

### `scripts/reconcile-vault-releases.mjs`
- **Inputs:** `src/content/vault_releases/*.json` + `src/content/releases/*.md` + in-file `SLUG_MAP`.
- **Outputs:** modified `src/content/releases/*.md`; displaced curator prose → `reconcile-bin/<slug>.BIN.md`.
- **Dry-run default?** Yes. Pass `--write` to apply. `--vault-slug X` to target one entry.
- **Idempotent?** Yes for "no change" cases; `--write` once then dry-run again should report no deltas.
- **Safe standalone?** Yes — but BIN files are created on first write and are NOT auto-restored if you undo. See `VAULT.md#bin-recovery`.
- **Emits:** "Updated / No change / Created / Unmatched" counts. **Unmatched triggers a `WARNING` to stderr with slugs to triage** — see `SLUG_MAP_TRIAGE.md`.

### `scripts/db-sync.mjs`
- **Inputs:** `src/content/**`; schema at `data/schema.sql`.
- **Outputs:** `data/crfw.db` (and `dist/data/crfw.db` if `--dist`).
- **Dry-run default?** No — writes the DB. But the DB is derivative; deleting it is non-destructive (just re-run).
- **Idempotent?** Yes — same content → same DB.
- **Safe standalone?** Yes. `--quiet` suppresses verbose output.
- **Flags:** `--dist` copies the DB into `dist/` so it ships with the site. `--quiet` suppresses verbose logs.

### `scripts/status.mjs` (new in Session 19)
- **Inputs:** `src/content/**`, `scripts/**/*.mjs`, `dist/` (for page count), `_Vault/` (for source counts).
- **Outputs:** markdown counts block to stdout.
- **Dry-run default?** N/A — read-only, never writes.
- **Idempotent?** Yes.
- **Safe standalone?** Yes. Safe to run any time.
- **Used by:** the `CLAUDE.md` STATUS block. Paste its output between `<!-- STATUS:BEGIN -->` and `<!-- STATUS:END -->`.

---

## 3. Import scripts (destructive, require care)

These ingest external data into site content. All default to `--dry-run`; pass `--write` to apply.

### `scripts/bulk-stub-releases.mjs`
- Creates release stubs from archive folder listings.
- `published: false` by default.
- One-time bulk runs — not for incremental adds (use the CMS instead).

### `scripts/import-cover-art.mjs`
- Scans archive folders for `cover.jpg` / `cover.png` / `cover.svg`.
- Copies to `public/media/releases/<slug>/cover.*` and updates release frontmatter.
- Strict naming: only picks up files literally named `cover.*`. Rename in archive first if needed.

### `scripts/import-voice-memos.mjs`
- Ingests Whisper transcripts + m4a audio into `voice_memos` collection.
- `published: false` by default.

### `scripts/import-video-stubs.mjs`
- Creates video stubs from archive `_Documentation/Videos/<year>/` folders.
- `published: false` by default.

### `scripts/import-video-transcripts.mjs`
- Backfills Whisper `.txt` sidecars into existing video entries.
- Added in Session 08.

### `scripts/import-instagram.mjs`
- Reads gallery-dl JSON sidecars in `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/Instagram/@<handle>/`.
- Groups carousels by shortcode. Writes `photos` or `videos` entries.
- All new entries `published: false`. Curator publishes via CMS.

### `scripts/import-csv-edits.mjs`
- Applies CSV edits to site content (summaries, dates, tags, published flag, etc.).
- Editable columns locked to: `title`, `preservedTitle`, `project`, `date`, `format`, `summary`, `tags`, `published`.
- See `CSV_ROUNDTRIP.md` for the workflow.

### `scripts/import-articles.mjs` / `scripts/import-embeds.mjs`
- Older one-offs; check the script header before running.

---

## 4. One-off fix scripts (ran once, kept for reference)

### `scripts/retag-dimcp.mjs` (Session 07)
- One-time DIMCP project reassignment.
- Don't re-run unless you know the current tagging state.

### `scripts/fix-2digit-years.mjs` (Session 08)
- Fixes `1914-01-01` (mis-parsed 2-digit year) → `2014`.
- Safe to re-run — idempotent on already-fixed entries.

### `scripts/publish-photo-sample.mjs` (Session 18)
- Publishes up to 6 captioned photos per year 2013–2018.
- Dry-run by default; `--write` applies.
- Useful for a "make the site look populated" pass ahead of a demo.

---

## 5. CMS

### `scripts/curators-kit/server.mjs`
- `npm run cms` — launches at `http://localhost:3030`.
- `npm run cms:lan` — LAN-accessible, prints the IP.
- Edits both site content (git-tracked, auto-commits) and the vault (Dropbox-tracked).
- See `CURATOR_GUIDE.md` for usage.

---

## 6. Running scripts in the right order

If the vault changed (Dyl edited in Obsidian):
```bash
node scripts/sync-vault.mjs --write
node scripts/reconcile-vault-releases.mjs   # dry-run first
# review unmatched, triage per SLUG_MAP_TRIAGE.md, then:
node scripts/reconcile-vault-releases.mjs --write
npm run build
```

If site content changed (CSV roundtrip, CMS, manual edits):
```bash
npm run build
```
(build chain picks up sync-vault + reconcile + db-sync automatically)

If you only need the DB refreshed:
```bash
node scripts/db-sync.mjs
```

If you just want to see where things stand:
```bash
node scripts/status.mjs
```

---

## 7. Safety rules

- **Dry-run first.** Every import/reconcile script defaults to dry-run. Read the output before `--write`.
- **Commit before `--write`.** A clean tree means you can `git diff` / `git checkout` to undo if a script goes wrong.
- **Never `--write` through a hang.** If any script pauses at 0% CPU, stop and diagnose. See `SESSION_WORKFLOW.md#push-hang-policy`.
- **Never re-run a one-off fix script casually.** Check the script header for a description of what it does before running.
- **Never `--write` a reconciler without reading the unmatched list.** Creating site stubs silently for 15 unmatched vault releases is a decision, not a default.

---

## 8. See also

- `ARCHITECTURE.md` — the three-layer data model.
- `VAULT.md` — authority rules between vault and site.
- `SLUG_MAP_TRIAGE.md` — reconciler unmatched decision tree.
- `CSV_ROUNDTRIP.md` — CSV edit workflow.
- `SESSION_WORKFLOW.md` — commit cadence and push-hang policy.
