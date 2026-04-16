# Session log

Running log of Claude Code sessions on this repo. Newest first. Each entry is a handoff for the next session — what was done, what's next, any open questions.

---

## Session 05 — 2026-04-16 — three-PR sprint: adjacent + alphabets + covers

**Goal:** solo 3–4 hour sprint. Agreed scope up front (before starting): (1) killd-by-adjacent bulk pass, (2) alphabets bulk pass, (3) cover-art import with a skip-and-log policy — three independent PRs. Explicitly excluded from this sprint: Whisper, Vimeo, filter UX, AI summaries.

**Done — shipped three PRs, all merged to main:**

**PR #3 — `killd by adjacent: 7 stubs from sibling folders` (merged `2c8691d`-ish)**
- 5 generator-driven stubs from `KB/Killd By +/` (1) and `KB/M_Killd By/` (4)
- 2 hand-written stubs for file-only folders (`Other Projects/killdfilez/`, `Other Projects/unnamed_killdby_folder/`) — the bulk generator walks subfolders, so these need manual treatment
- All 7 filed under `project: "killd by"` (same umbrella, source-folder distinction visible in `archivePath`)
- Curator-flag-me items surfaced: `M_killdby15:16:17` (colon-encoded years fall outside the regex, dated from mtime); empty-shell `M_killdby` directory; `unnamed_killdby_folder` (placeholder name)

**PR #4 — `alphabets: 169 release stubs (bulk pass)` (merged)**
- 2 individual stubs (`2010[_]`, `underwaters VI`) + 1 generator hardening + 167 bulk stubs
- Generator change caught during dry-run: `2046AD` (a Wong Kar-wai title Colin used) was being read as a release year. Fix: cap year extraction at `CURRENT_YEAR`; anything later falls through to mtime. Confirmed no regressions on prior entries.
- Format breakdown across all 169: 56 LP, 48 single, 38 EP, 18 other, 7 mix, 1 compilation, 1 demo
- Carried-forward curator-flag items: ~30 folders with 2-digit year encodings (`JANFEB09`, `M_A_Y_09`, etc.) dated from mtime since the regex needs 4-digit `19xx`/`20xx`; ~15 empty-shell folders with 0 audio; multi-volume series (`underwaters` I–VI, `DDR*`, `SUNPOWER` 1/2/3) preserved as separate entries; one folder named `____` collapses to `untitled.md`; `alphabets/RECOVERY/` distinct from killd by's `Recovery`

**PR #5 — `Cover-art import: script + first pass + seeded-data fix` (merged)**
- [scripts/import-cover-art.mjs](scripts/import-cover-art.mjs) — walks `src/content/releases/`, inspects each entry's `archivePath`, copies cover-shaped images to `public/media/releases/<slug>/`, updates frontmatter. Default dry-run; `--write` commits. Idempotent. Never overwrites existing `coverArt:` fields.
- Fixed a seeded-data bug surfaced by the dry-run: `recovery.md` and `alphabets-2010.md` both pointed at `court-clothes/cover.svg` (copy-paste artifact). Removed the bogus fields.
- First import pass (against main's 58 release entries) landed 1 cover: `OUTCASTS (2014-2016 b-sides) ← cover.jpg (2.5MB)`.

**Done — post-merge sweep on main (this commit):**
- Re-ran the importer against all 234 merged releases. Initial run imported 3 covers; **2 were curator-wrong** and caught before commit:
  - ✗ `18-alphabets/` is a dumping-ground folder containing art for *multiple* releases; substring-matching `"...front.png"` grabbed the wrong one.
  - ✗ `trappedinthebackofajeep-2013-alphabets/` had a single screenshot (DAW session, not cover art) that the sole-image fallback grabbed.
  - ✓ Kept: `19-alphabets-thru-tha-rip/cover.jpg` (score 10, unambiguous).
- **Tightened the script** in response:
  - Substring matches (score 3 "contains front", score 5 "contains cover") REMOVED. Requires cover-named filename only (`/^(cover|front|albumart|album[_-]?art|artwork)\b/i` at word-start).
  - Sole-image-at-top-level fallback REMOVED. Now only falls back to "sole image inside an art-shaped subfolder" (`art/`, `artwork/`, `scans/`, `covers/`, `images/`), where the subfolder name itself is the signal.
  - Philosophy: prefer empty covers over wrong ones.

**State at end of session (as of this commit):**
- `main`: 234 release entries (58 + 7 adjacent + 169 alphabets). 2 covers imported total (`court-clothes/cover.svg`, `117-killd-by-2014-2016-bsides/cover.jpg`, `19-alphabets-thru-tha-rip/cover.jpg` — actually 3, plus the Court Clothes placeholder).
- All three sprint PRs merged. No open PRs.
- Live at https://dylwar27.github.io/crfw-site/ still up; this sprint's merges all auto-deployed via the Pages workflow.
- `scripts/bulk-stub-releases.mjs` has the year-cap fix; `scripts/import-cover-art.mjs` has the tightened heuristic.

**Next work — clean handoff list, roughly in priority order:**

Content / data work Dyl (curator) can do against the existing stubs:
1. **Fill in `summary:` fields** on any of the 224 stubs with empty summaries — agent won't per golden rule #6.
2. **Fix 2-digit-year dates** — ~30 alphabets stubs (`JANFEB09`, `M_A_Y_09`, `octobrr09`, etc.) are dated from mtime, not the year encoded in the name. Scriptable if you want a second pass with a 2-digit interpretation table (I'd need explicit date conventions from you: does `09` mean `2009`? Always?).
3. **Resolve curator-flag entries:** `M_killdby15:16:17`, `M_killdby` (empty), `unnamed_killdby_folder`, `untitled.md` (the `____` folder), `court-clothes.md` `coverArt` pointing at .svg while a .jpg exists next to it.
4. **Manual cover art** for any release whose source folder has the art but not named `cover.*` — see the curator-flag list below.

Agent-doable work queued for next sessions:
5. **Voice memo Whisper transcription** — ~780 files in `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Voice Memos/`. Dedicated session (needs whisper.cpp setup + ~2h compute). HANDOFF_PROMPT.md §3 prompt still applies.
6. **Vimeo embed wiring** — `~/.../CRFW Archive/_Quarantine/_UPLOADED TO VIMEO/` has URLs. Need Dyl's input: are URLs in filenames, sidecar files, or only in Dyl's Vimeo account?
7. **IG photo import** — if/when Dyl pulls the IG archive JSON, batch-create photo entries.
8. **Filter UX** — year slider, tag chips, Pagefind search. Now worth doing (234 entries makes filtering useful). Brief-level decision, ask before starting.
9. **Cover-art sweeps** — as more source folders get tidied by Dyl (image renamed to `cover.*`, or dropped into an `art/` subdir), re-run `node scripts/import-cover-art.mjs --write`. It's idempotent.
10. **Custom domain** — when Dyl is ready: `public/CNAME`, two-line swap in `astro.config.mjs`, drop/flip `public/robots.txt`. `withBase()` means no content edits.

**Curator-flag items to look at (consolidated from all three PRs):**
- 2-digit-year alphabets stubs (~30 files) — dates wrong by 1–4 years
- Empty-shell alphabets folders (~15 files) — format `other`, date from folder mtime
- `M_killdby15:16:17` — dated 2012 from mtime; should probably be `"2015"`
- `M_killdby` (no version) — empty directory, delete/merge?
- `unnamed_killdby_folder` — needs a real name
- `untitled.md` — from alphabets/`____`/, folder name is 4 underscores
- `court-clothes.md` — `coverArt` still points at `cover.svg` despite `cover.jpg` sitting in the same folder
- `loose-working-files-2010-2013` — 12 screenshots, no single obvious cover
- `m-killdby15-16-17` — 4 images at top level, top one (`kbyBsides.jpg`) could be a cover but isn't named like one
- Multi-volume series — may want to group via tags later (`underwaters` I–VI, `DDR*`, `SUNPOWER*`)

**Files touched this session:**
- [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs) — year-cap fix (PR #4)
- [scripts/import-cover-art.mjs](scripts/import-cover-art.mjs) — new (PR #5) + tightened this commit (post-merge)
- [src/content/releases/](src/content/releases/) — +176 new stubs (7 adjacent + 169 alphabets); seeded-data fix on `recovery.md` / `alphabets-2010.md`
- [public/media/releases/](public/media/releases/) — +2 cover images (OUTCASTS b-sides, THRU THA RIP)
- [.gitignore](.gitignore) — ignore `cover-art-import-report.txt`
- [SESSIONS.md](SESSIONS.md) — this entry

---

## Session 04 — 2026-04-15 — bulk pass landed, site is live

**Goal:** unblock the build (per Session 03's prescription), finish the killd by bulk pass, and get the site deployed.

**Done — killd by bulk pass shipped (PR #1, merged as `374da9c`):**
- Disk freed to ~90% full; `astro --help` dropped from ~60 s to 0.244 s. Session 03's diagnosis held: the "hang" was machine I/O load, not code.
- Added three more individual stubs on `bulk/killd-by-stubs` to cover the remaining representative patterns:
  - `3f3e889` — *Stub: 170 Recovery4Burn* — variant-marker case; `format: demo`, `tags: [killd-by, burn-stage]`.
  - `695d7b2` — *Stub: DjpOoLsiDe.1* — mashed-typography / no numeric prefix; `format: LP` (20 audio files).
  - `f90c5b1` — *Stub: OUTCASTS (b-sides 2014-2016)* — paren-style year range, exercises the non-word-boundary year regex; `format: b-sides`, `date: "2014"`.
- Ran the generator for the rest: `0f6d5d6` — *Bulk stubs: 51 remaining killd by folders* — all 51 emitted, 0 schema errors, `npm run build` clean in 611 ms.
- PR #1 *killd by: 55 release stubs (bulk pass)* opened, reviewed, merged. Flagged the 2015-mtime flatness in the PR body for curator follow-up (many folders without a year in the name defaulted to a Dropbox-sync-touched mtime).
- **`src/content/releases/` now has 58 entries** (3 seeded + 55 new stubs).

**Done — repo flipped public, site deployed to GitHub Pages (PR #2, merged as `0aa421d`):**
- Decision flow: Dyl confirmed (a) custom domain will eventually land, (b) initial preview audience is friends/family, (c) public repo on GitHub is fine. Given (b)+(c), went straight to GitHub Pages rather than Cloudflare / Netlify / Vercel. Used a `robots.txt` Disallow as the "unlisted WIP" posture — URL is shareable but search engines are asked not to index while content is still being curated.
- `gh repo edit --visibility public` — repo flipped, description + homepage URL set.
- `15b9bff` — *Wire GitHub Pages deploy + base-path handling:*
  - [.github/workflows/deploy.yml](.github/workflows/deploy.yml) — standard `withastro/action@v3` + `actions/deploy-pages@v4` pipeline; triggers on push to main and `workflow_dispatch`.
  - [astro.config.mjs](astro.config.mjs) — `site: 'https://dylwar27.github.io'`, `base: '/crfw-site'`, `build: { assets: 'assets' }`. Comment in-file notes the two-line swap for when a custom domain lands.
  - [src/pages/index.astro](src/pages/index.astro) — added `withBase()` helper that prefixes root-relative asset paths with `import.meta.env.BASE_URL`. Applied to cover art (releases), src (photos, voice_memos), poster + localSrc (videos). Idempotent: when base is `/`, becomes a no-op. Means the custom-domain migration is config-only, zero content edits.
  - [public/robots.txt](public/robots.txt) — `User-agent: *` / `Disallow: /` with an in-file note explaining the WIP rationale and how to flip it.
  - [.nvmrc](.nvmrc) — pinned to `24` (Node v24.14.1 on this machine; Session 02's suspected Node-25 incompat turned out to be unrelated — load-induced — but pinning avoids future confusion).
- Along the way: `gh auth refresh -h github.com -s workflow` was needed (the token didn't have `workflow` scope, so the first push of `deploy.yml` bounced). Preflight check to `gh api repos/dylwar27/crfw-site/pages` showed Pages config was already `build_type: "workflow"` — no Settings-UI step needed.
- PR #2 *Deploy site to GitHub Pages (base path + robots disallow)* merged. Deploy run `24481551331` succeeded. **Live URL: https://dylwar27.github.io/crfw-site/** returns 200; `/crfw-site/robots.txt` serves the Disallow; cover art resolves under the `/crfw-site/` base.

**State at end of session:**
- Repo: `dylwar27/crfw-site` — **public**, description + homepage set, Pages on, robots Disallow active.
- `main` has: scaffold + path fix + session logs 01–03 + PR #1 merge + PR #2 merge. 58 release entries. No open PRs.
- Node pinned to 24 via `.nvmrc`.

**Next work (deferred, unchanged priorities):**
1. **killd-by-adjacent folders** outside `KB/killd by/` (`KB/Killd By +`, `KB/M_Killd By`, `Other Projects/killdfilez`, `Other Projects/unnamed_killdby_folder`). Same generator, short branch.
2. **alphabets bulk pass** — 169 folders in `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/alphabets/`. Same script, `--project alphabets`, `--source …/alphabets`, `--archive-relative "CRFW Archive/_Documentation/Music/alphabets"`.
3. **Voice memo Whisper transcription** — ~780 files; script-first, then batches of ~50 per commit. HANDOFF_PROMPT.md §3 has the prompt.
4. **Cover art import** — for every stubbed release whose source folder has an image, copy to `public/media/releases/<slug>/` and update `coverArt:`. Can be done as its own pass or rolled into each bulk pass.
5. **Vimeo embed wiring** — `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Quarantine/_UPLOADED TO VIMEO/` already has URLs.
6. **Filter axes** — year slider, tag chips, Pagefind search — once there's more content.
7. **Custom domain** — when Dyl is ready: add `public/CNAME`, swap `site` / `base` in astro.config.mjs (two lines), drop robots.txt (or flip to Allow).

**Open curator questions (inherited, not actioned):**
- 2015-mtime flatness across many killd by stubs — dates where the folder name has no year were back-filled from file mtimes, which Dropbox sync touched. Curator-verify-me.
- `summary` is empty on all 55 new stubs (per golden rule #6). Dyl's voice to add.

**Files touched this session:**
- [src/content/releases/170-recovery4burn.md](src/content/releases/170-recovery4burn.md), [djpoolside-1.md](src/content/releases/djpoolside-1.md), [outcasts-b-sides-2014-2016.md](src/content/releases/outcasts-b-sides-2014-2016.md) — individual stubs.
- 51 more stubs in [src/content/releases/](src/content/releases/) from the bulk commit.
- [astro.config.mjs](astro.config.mjs), [src/pages/index.astro](src/pages/index.astro) — base-path handling.
- [.github/workflows/deploy.yml](.github/workflows/deploy.yml), [public/robots.txt](public/robots.txt), [.nvmrc](.nvmrc) — new.
- [SESSIONS.md](SESSIONS.md), [CLAUDE.md](CLAUDE.md), [README.md](README.md), [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md) — this log + doc sweep.

---

## Session 03 — 2026-04-14 — root-caused the "build hang" (machine, not code)

**Goal:** pick up from Session 02's blocker — Astro CLI hanging on `--help` and `build` — and get to a place where the `bulk/killd-by-stubs` branch can be verified.

**Done (no repo changes — investigation + docs only):**
- Reproduced the Session-02 hang: `./node_modules/.bin/astro --help` took ~60s on first try; `astro sync` took **18m41s wall / 2.6s CPU (0% CPU)**; the process sits in `kqueue` waiting on module-load I/O, not looping or spinning.
- Narrowed where time is spent: probing `core/messages.js` → `install-package.js` → its deps, the slowness moves around (prompts took 10.5s on one run, sub-10ms on the next). It is not deterministic — it is I/O queue depth.
- Confirmed **root cause is machine state, not Astro / Node / the repo**:
  - Disk: **98% full** (`/System/Volumes/Data`: 13 Gi free of 460 Gi). APFS copy-on-write gets expensive near full.
  - CPU: Ableton Live 12 Suite pegged at **~52% CPU** (PID 80592) throughout.
  - Memory: ~150 MB free pages, high inactive/wired — system was pushing to swap.
  - Load avg: 2.79 / 3.06 / 2.87.
  - Node version was **not** the issue. Session 02 suspected Node 25; switching `nvm use 24` (v24.14.1) produced the same slow-but-eventually-correct behavior. `astro --version` → `v4.16.19` and `astro --help` → full help output, both succeeded, just slowly.
- `astro sync` **did complete successfully** when left alone: `Generated [types] 10.84s`. No schema errors across existing content (court-clothes, recovery, alphabets-2010). So the `Music/` path-fix commit did not regress anything.
- Inspected [117-killd-by-2014-2016-bsides.md](src/content/releases/117-killd-by-2014-2016-bsides.md) on `bulk/killd-by-stubs` against [config.ts](src/content/config.ts) schema by hand. All required fields present and valid (`title`, `project: "killd by"`, `date: "2014"`, `format: b-sides`). Optional fields (`preservedTitle`, `archivePath`, `tags`, `summary`) are all well-formed. Stub is schema-valid.
- Did not run `astro build` to completion — not worth the ~20 min cost at current machine load when `astro sync` already confirms content collections parse.

**Diagnosis in plain language:** Astro is fine. Node is fine. The repo is fine. The machine is loaded (Ableton + near-full disk + memory pressure), so Node module loading — which is I/O-bound — crawls. Any long-feeling "hang" during a session where Ableton is running or disk is tight will be this.

**Next session — do one of these *before* touching code:**
1. **Free disk.** Get `/System/Volumes/Data` under 90% full. Empty trash, clear `~/Library/Caches`, remove any stale Xcode simulators, etc.
2. **Close Ableton / other heavy native apps** while building.
3. Then `export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 24 && npm run build`. Expect it to complete in 30–60 s on an unloaded machine. If it still takes >3 min: check `ps aux | sort -rnk 3 | head` and `df -h` before assuming the code broke.

**Continuing the bulk pass (unchanged from Session 02's plan, just unblocked):**
- Branch `bulk/killd-by-stubs` is pushed and has the generator script + first stub.
- Once a full `npm run build` succeeds on that branch, add 2–3 more individual commits to cover representative patterns:
  - A folder *without* a numeric prefix (e.g. `Court Clothes` → `court-clothes-2.md`)
  - A folder with variant markers (e.g. `170 Recovery4Burn` → `170-recovery4burn.md` format `demo`)
  - A folder with mashed letters+digits (e.g. `DjpOoLsiDe.1` → exercise the year/format regex edge cases)
- Then run `node scripts/bulk-stub-releases.mjs --project "killd by" --source "/Users/dward/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/KB/killd by" --archive-relative "CRFW Archive/_Documentation/Music/KB/killd by" --skip "41 CCFinaLsWAVs" --skip "171 RecoveryFinaL" --skip "117 killd by - 2014-2016 -Bsides" [--skip the other individually-committed folders] --write` for the rest.
- `npm run build` after bulk generation.
- Open PR to main. Flag the 2015-mtime flatness in the PR body (Dropbox sync touched file mtimes, so folders without a year in the name defaulted to a fake date — curator-verify-me).

**Files touched this session:**
- [SESSIONS.md](SESSIONS.md) — this entry; revised the Session-02 diagnosis (`Blocker` section preserved intact below for historical truth, but the real cause is what's written here).

---

## Session 02 — 2026-04-14 — path fix + killd by bulk pass (partial, blocked)

**Goals:**
- (A) Fix stale archive paths in docs + existing content (groundwork).
- (B) Begin killd by discography bulk stub pass. Decisions agreed on up front: **preserve everything** (no skip-list beyond entries that already exist as canonical); slug scheme = slugified folder name with Colin's numeric chronology prefix retained; one commit per stub (max modulatability); branch `bulk/killd-by-stubs`, PR to main when complete.

**Done — on `main`:**
- Audited all `../CRFW Archive/...` references in docs + content. Found real structure is `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/{alphabets,KB/killd by}/` — the `Music/` segment was missing everywhere, and the `../` relative prefix is stale since the repo moved to `~/Desktop/site/` (outside the Dropbox tree).
- Verified counts match [CLAUDE.md](CLAUDE.md) estimates: killd by = 57 folders, alphabets = 169. Identified two other stale paths: Vimeo source is actually at `_Quarantine/_UPLOADED TO VIMEO/` not `_Creative Assets/Videos/_UPLOADED TO VIMEO/`; voice memos and `Images and Video Assets` paths confirmed correct.
- Commit **`2e56644`** — *Fix stale archive paths in docs and existing content.* Updated 7 files; `archivePath` convention documented in CLAUDE.md (archive-relative `CRFW Archive/...`; narrative in docs uses absolute `~/Library/CloudStorage/...` location).

**Done — on branch `bulk/killd-by-stubs` (not yet merged):**
- Commit **`54fe61d`** — *Add bulk-stub-releases.mjs — generator for release stubs.* Node script at [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs). Walks a project folder, emits one Astro release stub per subfolder. Word-boundary regexes deliberately avoided in format/year detection because Colin's naming mashes letters and digits together (`B-SIDES2017`, `Recovery4Burn`, `RcvryDrafts`) — `\b` fails there. Default dry-run; `--write` to emit.
- Dry-run output verified: 57 subfolders, 2 skipped (`41 CCFinaLsWAVs` → existing `court-clothes.md`; `171 RecoveryFinaL` → existing `recovery.md`), 55 new stubs planned, 0 errors. Format heuristics confirmed sane (stage/variant markers → `demo`, b-sides collections → `b-sides`, fullmix folders → `mix`, audio count → LP/EP/single). Slug collisions auto-suffixed (`2014-2016-bsides-2.md`, `court-clothes-2.md`).
- Commit **`8ffecb7`** (or similar — see branch) — first stub: [src/content/releases/117-killd-by-2014-2016-bsides.md](src/content/releases/117-killd-by-2014-2016-bsides.md). Schema-valid by inspection.

**⚠️ Blocker — build verification not possible end-of-session:**

Astro CLI (`node_modules/.bin/astro`) started hanging with zero output mid-session, even on `astro --help`. Not just `build` — the CLI itself hangs. Confirmed:
- `astro` bin shim invokes node semver check then `import('./dist/cli/index.js')`. Loading the CLI module directly via `import(...)` completes in ~14ms. Running the shim hangs indefinitely. Suggests the hang is *after* CLI import, possibly in config loading, project detection, or a dep (vite, rollup).
- `.astro/` cache cleared, `dist/` cleared — no help.
- Node v25.9.0. Astro 4.16.19 declares `engines.node: ^18.17.1 || ^20.3.0 || >=21.0.0` (so v25 is "supported" on paper), but Node 25 is new and dep chain may have silent incompat.
- Earlier in this same session, `npm run build` succeeded (see Session 01 + the path-fix commit verification). So something changed between those runs and now. Nothing obvious in the diff — just doc text edits, `archivePath` string changes, and the script + first stub (both removed in isolation, hang persisted).
- Possible culprits (untested, in likelihood order): Node 25 incompat surfacing intermittently; a stray file watcher from an earlier background task holding a lock; Dropbox CloudStorage filesystem weirdness; corrupted `node_modules` from the session.

**Suggested debug order for next session (before continuing the bulk pass):**
1. `nvm install 22 && nvm use 22` (or 20), then `npm run build` — most likely fix. If that works, pin `.nvmrc` to the working version.
2. If Node 22 doesn't fix it: `rm -rf node_modules package-lock.json && npm install && npm run build`.
3. If still broken: run `node --trace-warnings node_modules/.bin/astro --help` with a pipeline to `tee` so you can see partial output. Also check `lsof -p <pid>` on the hung process to see what it's waiting on.
4. Once the build works again, run `npm run build` on the current `bulk/killd-by-stubs` branch — if the first stub (`117-killd-by-2014-2016-bsides.md`) validates, proceed with the rest.

**Continuing the bulk pass after build is unblocked:**
- The generator is already on the branch. Agreed plan was: first 3–5 stubs as individual commits (to establish pattern), then one bulk commit for the remaining ~50.
- After the first stub is verified, suggested next two individual commits: one folder *without* a numeric prefix (e.g. `Court Clothes` → `court-clothes-2.md`) and one with variant markers (e.g. `170 Recovery4Burn` → `170-recovery4burn.md` format `demo`). That covers the three representative cases.
- Then: `node scripts/bulk-stub-releases.mjs --project "killd by" --source "…" --archive-relative "CRFW Archive/_Documentation/Music/KB/killd by" --skip "41 CCFinaLsWAVs" --skip "171 RecoveryFinaL" --write` for the rest. **Before running**, skip the 4 folders already stubbed individually (add more `--skip` flags), or just let the generator silently overwrite them (currently it does — a safety improvement for next session could be refusing to overwrite without `--force`).
- Open PR against main when complete. Flag the 2015-mtime flatness in the PR body — many folders got `2015` as their date because Dropbox sync touched mtimes; dates for anything without a year in the folder name should be considered curator-verify-me.

**Deferred from this session (unchanged from Session 01):**
- killd-by-adjacent folders outside `KB/killd by/` (`KB/Killd By +`, `KB/M_Killd By`, `Other Projects/killdfilez`, `Other Projects/unnamed_killdby_folder`). Treat as a separate pass after the main 57 land.
- alphabets bulk pass (169 folders). Same script, just different `--project`, `--source`, `--archive-relative` flags.
- Voice memo Whisper transcription.
- GitHub Pages deploy.
- Open questions from Session 01: custom domain, `_preview/` commit policy.

**Files touched this session:**
- [CLAUDE.md](CLAUDE.md), [CONTENT.md](CONTENT.md), [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md) — path fixes.
- [SESSIONS.md](SESSIONS.md) — Session 01 paths + this entry.
- [src/content/releases/court-clothes.md](src/content/releases/court-clothes.md), [recovery.md](src/content/releases/recovery.md), [alphabets-2010.md](src/content/releases/alphabets-2010.md) — `archivePath` added `Music/` segment.
- (branch) [scripts/bulk-stub-releases.mjs](scripts/bulk-stub-releases.mjs) — new.
- (branch) [src/content/releases/117-killd-by-2014-2016-bsides.md](src/content/releases/117-killd-by-2014-2016-bsides.md) — new.

---

## Session 01 — 2026-04-14 — scaffold into GitHub

**Goal (from [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md)):** get the initial scaffold into a private GitHub repo cleanly. No content work.

**Done:**
- `npm install` — 330 packages, no blocking errors (3 audit warnings, deferred).
- `npm run build` — clean. Empty-collection warnings for `photos` / `videos` / `voice_memos` are expected (no entries yet).
- `git init -b main`, added `.claude/` to [.gitignore](.gitignore) (agent-local tool-approval config, shouldn't be tracked).
- Initial commit **`b0cc6b4`** — *Initial scaffold: CRFW memorial timeline site* — 46 files: scaffold, all four docs (CLAUDE, CONTENT, HANDOFF_PROMPT, README), seeded content (Court Clothes + Recovery + alphabets-2010 stubs + archive-begins event), and the `_preview/` snapshot.
- Created private repo **https://github.com/dylwar27/crfw-site** via `gh repo create --private --source=. --remote=origin --push`. `origin/main` tracks.

**Deferred (by explicit decision):**
- GitHub Pages deploy via Actions. Skipped this session — will add when there's enough content to justify a live URL and after a call on custom domain vs. `*.github.io`.

**Environment notes for next session:**
- Working dir: `/Users/dward/Desktop/site` — **not** in Dropbox (good; git + Dropbox fight over `node_modules/`).
- Archive lives at `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/` (the CRFW folder in Dropbox). Stale `../CRFW Archive/` refs in earlier drafts of the docs have been fixed — see path-fix commit below.
- `gh` authenticated as `dylwar27`, token scopes `gist, read:org, repo`.
- Node / npm installed and working.

**Known warnings (not blockers):**
- `npm install` reports 3 vulnerabilities (2 moderate, 1 high). Did not run `npm audit fix` — leave for a dedicated upgrade session so a scaffold commit doesn't get mixed with dep bumps.
- Build warns `The collection "photos"/"videos"/"voice_memos" does not exist or is empty.` — expected; will resolve as content lands.

**What's next (rough priority, per [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md) and [CLAUDE.md](CLAUDE.md)):**

1. **killd by bulk stub pass** — walk `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/KB/killd by/` (~57 folders). One release stub per folder with `title`, `preservedTitle` (folder name verbatim), `project: "killd by"`, `date` (from folder name if it has a year, else oldest file mtime), `format` (LP ≥8 tracks, EP 3–7, single 1–2, mix if continuous, b-sides if named so, else "other"), `archivePath`. **Leave `summary` empty** — per golden rule #6, no AI-generated summaries of Colin's work. Branch `bulk/killd-by-stubs`, first few as individual commits to establish pattern, then bulk commit, PR to main. Exact prompt at [HANDOFF_PROMPT.md:37](HANDOFF_PROMPT.md:37).

2. **alphabets bulk stub pass** — same pattern, `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/alphabets/` (~169 folders). Branch `bulk/alphabets-stubs`.

3. **Voice memo Whisper transcription** — script over ~780 files in `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Voice Memos/`. One JSON per memo with full transcript (no summary), filename as date. `whisper.cpp` with `small` or `medium` on Apple Silicon. Commit script first, then batches of ~50 entries. Prompt at [HANDOFF_PROMPT.md:57](HANDOFF_PROMPT.md:57).

4. **Cover art import** — for each stubbed release, if source folder has an image, copy to `public/media/releases/<slug>/` and update `coverArt:`. Do as a pass after the stub passes, or inline during the stub pass if it doesn't slow it down.

5. **Vimeo embed wiring** — `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Quarantine/_UPLOADED TO VIMEO/` has URLs already. Create `videos/` entries by year.

6. **GitHub Pages deploy** — revisit when there's enough content to want a live URL.

**Open questions for Dyl (don't guess — ask next session):**
- Custom domain for the eventual Pages deploy, or `dylwar27.github.io/crfw-site/`?
- For the bulk stub passes: any folders in the archive that should be **skipped** (drafts, personal, sensitive)? Default per [CLAUDE.md](CLAUDE.md) golden rule #1 is *preserve everything*, but worth confirming before 200+ stubs land.
- `_preview/` is committed to the repo. Keep committing rebuilt snapshots, or treat it as build output and gitignore it? Currently the only way a non-developer can look at the site without `npm`, so probably keep — but worth an explicit call.

**Files touched this session:**
- [.gitignore](.gitignore) — added `.claude/`
- [SESSIONS.md](SESSIONS.md) — new; this file
