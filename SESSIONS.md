# Session log

Running log of Claude Code sessions on this repo. Newest first. Each entry is a handoff for the next session — what was done, what's next, any open questions.

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
- Archive still at `../CRFW Archive/` (presumably still in Dropbox — that's fine; it's the source, not the repo).
- `gh` authenticated as `dylwar27`, token scopes `gist, read:org, repo`.
- Node / npm installed and working.

**Known warnings (not blockers):**
- `npm install` reports 3 vulnerabilities (2 moderate, 1 high). Did not run `npm audit fix` — leave for a dedicated upgrade session so a scaffold commit doesn't get mixed with dep bumps.
- Build warns `The collection "photos"/"videos"/"voice_memos" does not exist or is empty.` — expected; will resolve as content lands.

**What's next (rough priority, per [HANDOFF_PROMPT.md](HANDOFF_PROMPT.md) and [CLAUDE.md](CLAUDE.md)):**

1. **killd by bulk stub pass** — walk `../CRFW Archive/_Documentation/KB/killd by/` (~57 folders). One release stub per folder with `title`, `preservedTitle` (folder name verbatim), `project: "killd by"`, `date` (from folder name if it has a year, else oldest file mtime), `format` (LP ≥8 tracks, EP 3–7, single 1–2, mix if continuous, b-sides if named so, else "other"), `archivePath`. **Leave `summary` empty** — per golden rule #6, no AI-generated summaries of Colin's work. Branch `bulk/killd-by-stubs`, first few as individual commits to establish pattern, then bulk commit, PR to main. Exact prompt at [HANDOFF_PROMPT.md:37](HANDOFF_PROMPT.md:37).

2. **alphabets bulk stub pass** — same pattern, `../CRFW Archive/_Documentation/alphabets/` (~169 folders). Branch `bulk/alphabets-stubs`.

3. **Voice memo Whisper transcription** — script over ~780 files in `../CRFW Archive/_Documentation/Voice Memos/`. One JSON per memo with full transcript (no summary), filename as date. `whisper.cpp` with `small` or `medium` on Apple Silicon. Commit script first, then batches of ~50 entries. Prompt at [HANDOFF_PROMPT.md:57](HANDOFF_PROMPT.md:57).

4. **Cover art import** — for each stubbed release, if source folder has an image, copy to `public/media/releases/<slug>/` and update `coverArt:`. Do as a pass after the stub passes, or inline during the stub pass if it doesn't slow it down.

5. **Vimeo embed wiring** — `../CRFW Archive/_Documentation/_Creative Assets/Videos/_UPLOADED TO VIMEO/` has URLs already. Create `videos/` entries by year.

6. **GitHub Pages deploy** — revisit when there's enough content to want a live URL.

**Open questions for Dyl (don't guess — ask next session):**
- Custom domain for the eventual Pages deploy, or `dylwar27.github.io/crfw-site/`?
- For the bulk stub passes: any folders in the archive that should be **skipped** (drafts, personal, sensitive)? Default per [CLAUDE.md](CLAUDE.md) golden rule #1 is *preserve everything*, but worth confirming before 200+ stubs land.
- `_preview/` is committed to the repo. Keep committing rebuilt snapshots, or treat it as build output and gitignore it? Currently the only way a non-developer can look at the site without `npm`, so probably keep — but worth an explicit call.

**Files touched this session:**
- [.gitignore](.gitignore) — added `.claude/`
- [SESSIONS.md](SESSIONS.md) — new; this file
