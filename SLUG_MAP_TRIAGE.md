# SLUG_MAP_TRIAGE.md — what to do when the reconciler flags an unmatched vault release

Audience: agent (primary), curator (secondary). Triggered when `scripts/reconcile-vault-releases.mjs` emits a `WARNING: N vault release(s) have no SLUG_MAP entry`.

This is not a bug. It's a decision — the vault has a release entry for which there is no site release stub yet. Four possible answers. This doc walks through them.

---

## 1. When an unmatched warning appears

The reconciler's stderr will look like:

```
WARNING: 15 vault release(s) have no SLUG_MAP entry.
  Add to SLUG_MAP in scripts/reconcile-vault-releases.mjs:
    'alphabets-07_08': null,  // → create new site stub
    'alphabets-cat-mouths-spring-08': null,  // → create new site stub
    ...
  Then run: node scripts/reconcile-vault-releases.mjs --write
```

The reconciler's suggested fix is "create new site stub" (value `null`) — but that is one of four possible decisions and it may not be the right one. Don't just paste the snippet. Triage each entry.

---

## 2. The decision tree

For each unmatched vault slug, pick exactly one of:

### A. **Add to SLUG_MAP as an alias** → `'vault-slug': 'existing-site-slug'`
**Use when:** the vault entry describes the same release as an existing site stub, but the two slugs diverged (vault is prefixed with the project, or uses a different shortform). This is the most common case.

Example (already in SLUG_MAP):
```js
'alphabets-400yen': '400yen',
'killd-by-court-clothes': 'court-clothes',
```

**Check first:** `ls src/content/releases/ | grep <partial-slug>` — does an unmapped site stub match?

### B. **Rename the site stub, then alias** → rename `src/content/releases/oldname.md` to match the vault's shortform first, then add `'vault-slug': 'new-shortform'` to SLUG_MAP.

**Use when:** the site stub has an awkward slug that predates the vault, and the vault's shortform is better. Rare — only do this if the site slug change is worth the URL break.

### C. **Create new site stub** → `'vault-slug': null`
**Use when:** there is genuinely no site stub for this release, and there should be. The reconciler will create the stub on `--write`, populating fields from the vault.

The new stub gets:
- `title`, `preservedTitle`, `date` (from `release_date_approx`), `format`, `tags`, `archivePath` from the vault entry
- `summary: ""` (golden rule #6 — agent does not write Colin-voice prose)
- `published: true` (the default; reconciler does not toggle this)
- `project:` derived from the vault slug prefix (`alphabets-`, `killd-by-`, etc.)

After creation, the stub appears on the public timeline. If that's not desired (e.g., you want curator review first), the curator should set `published: false` on the new stub before the next build.

### D. **Mark vault-only** → leave OUT of SLUG_MAP entirely, or add an explicit `// vault-only` comment.
**Use when:** the vault entry is research metadata that should NOT surface as a site page. Example: a speculative release you're tracking internally but haven't confirmed existed. Rare — the default is to surface everything.

Caveat: leaving it out means the warning repeats every build. If you're deferring the decision (not deciding it's vault-only), note why in `SESSIONS.md` and triage next session.

### E. **Delete / merge in the vault**
**Use when:** the vault entry is a duplicate of another vault entry, or a stale draft. Edit/delete in the vault (Obsidian), re-run `sync-vault.mjs --write`, then re-run the reconciler.

The agent does NOT edit the vault per `VAULT.md#may-not`. Flag these to the curator.

---

## 3. Quick checklist

For each unmatched slug:

1. **Is there a site stub with a similar name?** → Option A (alias).
2. **Does the vault entry have an `archivePath` pointing to a real folder?** → likely Option C (create).
3. **Is this a research/speculative entry?** → Option D (vault-only).
4. **Does another vault entry already cover this?** → Option E (curator deletes in Obsidian).

If in doubt, prefer C (create a stub). Nothing is deleted; the curator can set `published: false` later.

---

## 4. The 15 known unmatched (as of Session 19 dry-run)

All 15 are early alphabets archival folders (2007–2009 era), tagged `earliest-recordings` / `archive-only` / `m4a-era`. Each has a real `archivePath` under `_Documentation/Music/alphabets/`. None has a matching site stub. Triage: **all → Option C (create new site stub).**

| Vault slug | Title | Notes | Decision |
|---|---|---|---|
| `alphabets-07_08` | `07_08 [_]` | Mixed 2007–2008 M4A + MP3 folder — one of the earliest confirmed. Body has a partial track list. | C — create |
| `alphabets-cat-mouths-spring-08` | `cat mouths spring 08` | Seasonal folder. | C — create |
| `alphabets-freak-medicine-winter-07` | `freak medicine winter 07` | Earliest known M4A-era recording. | C — create |
| `alphabets-jul-aug-09` | `jul aug 09` | Monthly bucket. | C — create |
| `alphabets-may09` | `may 09` | Monthly bucket. | C — create |
| `alphabets-mid08-dumb-gull-ep` | `mid 08 dumb gull ep` | EP fragment. | C — create |
| `alphabets-naturenature-spring-summer-08` | `naturenature spring summer 08` | Seasonal folder. | C — create |
| `alphabets-new-year-08-09` | `new year 08_09` | Winter holiday bucket. | C — create |
| `alphabets-nw-wierd-summer-08` | `nw wierd summer 08` | Summer folder (note: "wierd" is the folder's own spelling; preserve it). | C — create |
| `alphabets-pulse-stuff-fall-08` | `pulse stuff fall 08` | Fall folder. | C — create |
| `alphabets-spooky-sports` | `spooky sports` | Theme folder. | C — create |
| `alphabets-timesmileniceface-spring-summer-08` | `timesmileniceface spring summer 08` | Seasonal folder. | C — create |
| `alphabets-unreleased-fall-08` | `unreleased fall 08` | Unreleased bucket. | C — create |
| `alphabets-unreleased-loose` | `unreleased (loose container)` | 2010–2013 mixed container. | C — create |
| `alphabets-young-tribes-spring-08` | `young tribes spring 08` | Seasonal folder. | C — create |

### Applied SLUG_MAP additions (Session 19)

Added a new block to `SLUG_MAP` in `scripts/reconcile-vault-releases.mjs`. Running the reconciler once with `null` values first revealed that 12 of the 15 slugs had pre-existing site stubs (created in an earlier bulk pass but never mapped); the remaining 3 (`07_08`, `may09`, `unreleased-loose`) were created fresh by the reconciler. Final SLUG_MAP values point at the actual site slug so future vault edits merge cleanly rather than re-triggering a `[CREATE]` dry-run event:

```js
'alphabets-07_08':                              '07_08',
'alphabets-cat-mouths-spring-08':               'cat-mouths-spring-08',
'alphabets-freak-medicine-winter-07':           'freak-medicine-winter-07',
'alphabets-jul-aug-09':                         'jul-aug-09',
'alphabets-may09':                              'may09',
'alphabets-mid08-dumb-gull-ep':                 'mid08-dumb-gull-ep',
'alphabets-naturenature-spring-summer-08':      'naturenature-spring-summer-08',
'alphabets-new-year-08-09':                     'new-year-08-09',
'alphabets-nw-wierd-summer-08':                 'nw-wierd-summer-08',
'alphabets-pulse-stuff-fall-08':                'pulse-stuff-fall-08',
'alphabets-spooky-sports':                      'spooky-sports',
'alphabets-timesmileniceface-spring-summer-08': 'timesmileniceface-spring-summer-08',
'alphabets-unreleased-fall-08':                 'unreleased-fall-08',
'alphabets-unreleased-loose':                   'unreleased-loose',
'alphabets-young-tribes-spring-08':             'young-tribes-spring-08',
```

Also converted two pre-existing `null` mappings (`killd-by-neotropical`, `killd-by-b-sides-2017`) to their real site slugs now that the stubs exist. Post-triage dry-run: **0 updated, 82 no-change, 0 created, 0 unmatched.**

The verification sequence:
```bash
node scripts/reconcile-vault-releases.mjs           # confirm 0 unmatched in dry-run
node scripts/reconcile-vault-releases.mjs --write   # apply
node scripts/reconcile-vault-releases.mjs           # idempotent — should show 0 updated
npm run build                                       # regenerate pages
```

### Triage reminder for future sessions

When a SLUG_MAP entry is `null`, the reconciler's dry-run always reports `[CREATE]` for it — even if the stub exists. It's a quirk of the dry-run logic (doesn't check existsSync for `null` mappings). Prefer mapping to a real site slug once the stub exists so subsequent dry-runs show the true no-op state.

### Post-triage curator tasks (optional, not in Session 19 scope)

- Review each new stub's `published` flag. Default is `true`; curator can set `false` for any still too speculative to surface.
- Write summaries if/when Dyl has something to say. Golden rule #6: no agent-authored summaries.
- Cover art — if an archive folder has a `cover.jpg`, run `scripts/import-cover-art.mjs --write` to attach.

---

## 5. Preventing silent unmatched accumulation

The reconciler's dry-run runs in every `npm run build` (Session 17 change). Warnings print to stderr but don't fail the build. Two habits keep the backlog clean:

- **Triage at session start.** Step in `SESSION_WORKFLOW.md` — if build shows unmatched, pull this doc, walk through the decision tree, commit the SLUG_MAP updates, then continue.
- **Don't add with `null` without reading the vault entry.** The reconciler suggests `null` (create) for every unmatched slug — that's a safe default but it isn't always correct. Read the vault entry's body and `archivePath` before committing to a decision.

---

## 6. See also

- `VAULT.md` — authority rules between vault and site.
- `SCRIPT_PIPELINE.md#reconcile-vault-releasesmjs` — what the script actually does.
- `CONVENTIONS.md` — `preservedTitle`, `archivePath`, slug rules for any new stub.
- `SESSIONS.md` — per-session log of triage decisions.
