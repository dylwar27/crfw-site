# CSV_ROUNDTRIP.md — bulk editing via spreadsheet

Audience: Dyl (curator) for the edit pass; agent for the import step.

Use this workflow when you want to edit 20+ entries at once — filling in summaries, fixing dates across a batch, re-tagging a project, or toggling `published` on a filtered selection. For one-off edits, use the CMS (`npm run cms`) instead.

---

## 1. The flow at a glance

```
┌───────────────┐   Export   ┌──────────────────┐   Edit   ┌────────────────┐
│ /admin page   │ ─────────► │ crfw-archive-    │ ───────► │ Google Sheets  │
│ (filtered)    │            │ YYYY-MM-DD.csv   │          │ Excel / Numbers│
└───────────────┘            └──────────────────┘          └───────┬────────┘
                                                                   │ save as
                                                                   ▼
┌──────────────────────────────────┐   Dry-run   ┌──────────────────┐
│ src/content/** updated in place  │ ◄────────── │ edits.csv        │
│ (only whitelisted columns)       │   --write   │                  │
└──────────────────────────────────┘             └──────────────────┘
```

---

## 2. Export

1. Start the site locally (or use the deployed build — `/admin` works either way).
   ```bash
   cd ~/crfw-site
   npm run dev
   # → http://localhost:4321/crfw-site/admin
   ```
2. Apply the filters you want (date range, project, format, published state, etc.).
3. Click **Export CSV**. The file saves as `crfw-archive-YYYY-MM-DD.csv`.

The CSV has one row per entry with these columns:
```
id, kind, title, preservedTitle, project, date, format, embeds, tags, summary, archivePath, published, file
```

`id`, `kind`, `file`, `archivePath` are **identity columns** — they identify the entry. Do not edit them; the importer ignores edits to these.

---

## 3. Editable columns (importer will apply these)

| Column | Type | Notes |
|---|---|---|
| `title` | string | Display title. |
| `preservedTitle` | string | Colin's exact typography. Preserve underscores / caps / punctuation — see `CONVENTIONS.md#preservedtitle`. |
| `project` | string | Project slug (e.g., `killd-by`, `alphabets`). |
| `date` | fuzzy date | `2014`, `2014-07`, or `2014-07-23`. See `CONVENTIONS.md#fuzzy-dates`. |
| `format` | enum | Release format: `LP`, `EP`, `single`, `b-sides`, `mix`, `demo`, `other`. |
| `summary` | string | Curator prose. Agent will not write this — golden rule #6. |
| `tags` | list | `tag1; tag2; tag3` — **semicolons separate**, not commas (comma is the CSV delimiter). |
| `published` | boolean | `true` or `false`. |

Everything else in the CSV (id, kind, file, archivePath, embeds) is ignored on import — safe to leave untouched or even edit in the CSV for your own reference, without risk.

---

## 4. Forbidden columns (never written, ignored on import)

- `id`, `kind`, `file` — identity; changing these would break the mapping.
- `archivePath` — must stay exactly as projected from the source. If an archive folder moves, that's a deliberate vault/import operation, not a CSV edit.
- `embeds` — computed / structured. Edit via the CMS or a targeted script.

If you need to edit one of these, it's a script-level change — ask the agent to do it directly in `src/content/**`.

---

## 5. Edit in the spreadsheet

Tips:

- **Date column — format as text.** Google Sheets helpfully converts `2014-07` to a real date value which breaks the fuzzy-date format. Format column as "Plain text" before editing.
- **Summary column — newlines are OK.** Sheets will keep them; the CSV parser handles `"..."`-quoted multi-line fields.
- **Tags — use `; ` separator.** `ambient; b-sides; experimental`. No surrounding quotes unless you have a comma inside a tag (which you shouldn't).
- **published — use lowercase `true` / `false`.** Not `TRUE` or `Yes` or `1`.
- **Don't reorder columns.** The importer reads by column name, not position, so reorder is tolerated, but keep headers intact.
- **Don't delete rows you aren't editing.** The importer ignores no-op rows; deleting them doesn't delete the content, but it clutters the diff.

Save / export as `.csv` (UTF-8). Both `.csv` and `Sheets-exported .csv` work.

---

## 6. Import-back (dry-run first, always)

```bash
cd ~/crfw-site
node scripts/import-csv-edits.mjs path/to/edits.csv
```

You'll see one line per entry that would change:
```
[DRY-RUN] releases/court-clothes   summary → "updated summary text here..."
[DRY-RUN] photos/20150403-120501  published → true
[DRY-RUN] releases/recovery       tags → [ambient, b-sides]
```

Review carefully. Then apply:
```bash
node scripts/import-csv-edits.mjs path/to/edits.csv --write
```

The script:
- For `.md` entries (releases, events): updates frontmatter in place; body is preserved byte-for-byte.
- For `.json` entries (photos, videos, voice_memos): re-serializes with `JSON.stringify(…, 2)`.
- Prints a summary count of changed files.

Commit the resulting diff.

---

## 7. Common gotchas

- **Date imported as `2014-07-00`.** Sheets auto-formatted to a Date object, which rendered as an invalid fuzzy date. Fix: re-format the column as plain text, re-type the dates.
- **Tags all ended up as one tag.** The CSV used commas as tag separators. Fix: use `; ` (semicolon-space) between tags.
- **Published flipped on entries you didn't edit.** The exported CSV included the current values; if you saved without changing them, the dry-run shows no change. But if Sheets "helpfully" rewrote `true` → `TRUE`, the importer treats that as a string and may skip or error. Fix: lowercase `true`/`false`.
- **Script says "X not found: file=...".** The `file` column points at `src/content/<coll>/<slug>.md`. If you renamed a slug in the CSV (which does nothing — slug is derived from the filename), the lookup fails. Don't rename in the CSV — rename the file directly via the agent or CMS.
- **Smart quotes in `summary`.** Sheets sometimes converts `"` to `"` / `"`. The importer keeps them as-is, which renders fine, but commit diffs can look noisy. Paste-as-plain-text or disable "smart quotes" in Sheets before editing.
- **CSV newline in `summary`.** Fine — the importer's CSV parser is RFC 4180-ish and handles quoted multiline fields.

---

## 8. What happens after import

1. `src/content/**` has the edits.
2. `git status` shows the changed files.
3. Run `npm run build` to verify nothing broke (schema / validator errors would surface).
4. Commit with a descriptive message (e.g., "Batch CSV edit: fill 47 release summaries").
5. User pushes when ready.

---

## 9. When NOT to use CSV roundtrip

- **Single-entry edit.** Use the CMS (`npm run cms`) — fewer moving parts.
- **Adding new entries.** The CSV roundtrip only updates existing entries. New entries come from import scripts (`import-voice-memos.mjs`, `import-video-stubs.mjs`, etc.) or the CMS "New" button.
- **Structural changes.** `embeds`, relational links, `archivePath` — not CSV-editable by design. Edit the file directly or ask the agent.
- **Vault entities** (people, press, venues, organizations, …). The vault isn't exported to CSV. Edit those in Obsidian (see `CURATOR_GUIDE.md#editing-the-vault`).

---

## 10. See also

- `CURATOR_GUIDE.md` — when to reach for CSV vs. CMS vs. Obsidian.
- `SCRIPT_PIPELINE.md#import-csv-editsmjs` — script signature.
- `CONVENTIONS.md` — `preservedTitle`, fuzzy dates, tag syntax.
- `src/pages/admin.astro` — the `/admin` page that emits the CSV.
