# CONVENTIONS.md — shared rules for agent and curator

Data shape, naming, linking, and commit-message conventions. Read this before you touch any content file.

---

## 1. Golden rules

1. **Never delete content.** Not files, not entries, not entries that turn out wrong. Mark them speculative in `summary` or add a note. Memorial archive; preservation wins.
2. **Preserve Colin's typography exactly.** `preservedTitle` holds `_e_v_i_L__a_n_g_eLz_`, `thunder__stoned_`, `COPE_` — whatever was in the source folder name. `title` holds a readable variant. Both render in popups. Do not "fix" caps/spacing/underscores/punctuation — they're his voice.
3. **Every entry carries an `archivePath`.** Always point back to the source in the Dropbox archive. If you don't know one, leave the field out — never invent.
4. **Fuzzy dates are valid.** `2014`, `2014-07`, `2014-07-23` all pass. Use what you actually know; don't guess precision.
5. **No AI-generated summaries of Colin's work.** If you're adding a release and there's no curator prose, leave `summary` empty or write a factual minimum ("B-sides collection from the killd by era. Source folder: …"). Do not invent artistic descriptions, emotional framing, or biographical narrative — that's Dyl's voice to add, not the agent's.
6. **Do not redesign without explicit direction.** The "overwhelming just like him" visual language is the brief. Refinement welcome; reflexive cleanup isn't.

---

## 2. `preservedTitle`

When a folder is named `_e_v_i_L__a_n_g_eLz_`, the entry gets:
```yaml
title: "e.v.i.L. a.n.g.eLz"            # readable
preservedTitle: "_e_v_i_L__a_n_g_eLz_" # Colin's exact typography
```

Both fields render on the popup: `title` as the big display heading, `preservedTitle` in smaller secondary text. Never drop `preservedTitle` because it "looks ugly" — that's exactly the point.

Tracklist entries have their own `preservedTitle`:
```yaml
tracklist:
  - n: 1
    title: "kiss over glass"
    preservedTitle: "KiSS oVER gLaSS"
```

---

## 3. `archivePath`

Every entry that has a source file in the archive should carry an `archivePath` pointing at it. The path is archive-relative and starts `CRFW Archive/…`:
```yaml
archivePath: "CRFW Archive/_Documentation/Music/KB/killd by/117 killd by - 2014-2016 -Bsides/"
```

Why archive-relative instead of absolute:
- The absolute location is machine-specific (`~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/` locally; different on another machine).
- `CRFW Archive/…` is stable across machines and Dropbox renames.

Releases may accept an array of archive paths (multiple source folders merged into one entry). Other collections accept a single string.

If there's no archive source (e.g., an online-only press mention), omit the field.

---

## 4. Fuzzy dates

The `fuzzyDate` validator is `/^\d{4}(-\d{2}(-\d{2})?)?$/`. Acceptable:
- `"2014"` — year only
- `"2014-07"` — year + month
- `"2014-07-23"` — full ISO date

Do **not**:
- Use a JS Date — the fuzziness is lost.
- Use `"2014-07-00"` or other invalid padding — won't validate.
- Guess a day of the month you don't know. The whole point is to preserve "I only know the year."

---

## 5. Slug rules

Slugs are the filename (minus extension) of a content entry. They must be URL-safe (lowercase, hyphens, no spaces or special chars).

Convention for auto-generated slugs:
- Release: `<project>-<folder-name-slugified>` — e.g., `killd-by-court-clothes`.
- Vault track: `<release-slug>-<NN>-<track-slug>` — e.g., `killd-by-court-clothes-01-butterfly-effect`.
- Person: `<first-last>` — e.g., `colin-ward`, `eriko-tsogo`.
- Voice memo: `<YYYYMMDD>-<HHMMSS>` — from the iPhone filename.
- Video: varies (YouTube ID, archive folder, etc.) — be consistent per source.

When in doubt, mirror what's already in the collection.

---

## 6. Wikilinks

Wikilinks are Obsidian-style `[[coll/slug]]` references inside vault body text and curator prose. The renderer lives in `src/lib/renderBody.ts`.

Syntax:
```
[[people/colin-ward]]                       → /person/colin-ward
[[people/colin-ward|Colin]]                 → /person/colin-ward, link text "Colin"
[[projects/killd-by]]                       → /project/killd-by
[[press/2020-04-10-bandcampdaily]]          → /press/2020-04-10-bandcampdaily
[[venues/rhinoceropolis]]                   → .wiki-chip badge (no page yet)
[[organizations/meow-wolf]]                 → .wiki-chip badge (no page yet)
[[funds/crfw-fund]]                         → .wiki-chip badge
[[grants/redline-2021]]                     → .wiki-chip badge
[[tracks/...]]                              → .wiki-chip badge
[[releases/...]]                            → .wiki-chip badge (use site slug, not vault slug)
[[events/...]]                              → .wiki-chip badge
[[series/...]]                              → .wiki-chip badge
```

Reserved: the collection part must be one of the routes in `WIKILINK_ROUTES` in `renderBody.ts`. Unknown collections render as plain text with a warning.

Also supported in curator prose: `[label](url)`, `**bold**`, `*italic*`, `# heading`, `> quote`, `- list`, `---` rule.

---

## 7. Commit-message style

One-line summary; imperative mood. Session-scoped commits include a `Session NN:` prefix. Examples:
```
Session 18: timeline bucket system + venue/org pages + photo sample
Session 19: infra reset — move repo off iCloud, update env defaults
Vault sync: projections from Session 18→19 curator work
Fix preservedTitle rendering in voice-memo cards
```

Body paragraph for commits with non-trivial scope. Bullet list acceptable for multi-change commits. Always include the `Co-Authored-By:` footer on agent-authored commits:
```
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

Do not `git commit --amend` unless explicitly requested — new commits are safer under hook failures. See `SESSION_WORKFLOW.md` for push-hang policy.

---

## 8. Sensitivity register

Colin passed away. Summaries, commit messages, UI copy, and code comments should be factual and restrained. Avoid eulogistic tone in code and data — that register belongs to Dyl's voice in the content itself.

In agent-authored text, prefer "Colin's work" / "Colin's archive" over language that projects meaning onto him or his death.

Schema field called `sensitivity` on some vault entries — values `public` (default), `restricted`, `private`. Respect it on any page-level rendering.

---

## 9. Published / draft semantics

`published: true` (default for most collections) → entry appears on the public timeline.
`published: false` → entry is drafted; stays in the repo and DB but doesn't render publicly.

Special cases:
- `photos` default to `published: false` — all photos are draft until Dyl explicitly publishes.
- Import scripts default new entries to `published: false`.
- `/admin` exposes a bulk publish toggle.
- CSV roundtrip supports the `published` column.

---

## 10. Where to put what (pointer map)

| you want to … | see |
|---|---|
| Add a release / photo / video / voice memo | `CURATOR_GUIDE.md` |
| Edit the vault | `VAULT.md`, `_Vault/README.md` |
| Run a script | `SCRIPT_PIPELINE.md` |
| Do a bulk edit | `CSV_ROUNDTRIP.md` |
| Triage a SLUG_MAP warning | `SLUG_MAP_TRIAGE.md` |
| Start / end a session | `SESSION_WORKFLOW.md` |
| Understand the system | `ARCHITECTURE.md` |
