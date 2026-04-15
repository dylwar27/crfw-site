# HANDOFF — first Claude Code session

This file is for **Dyl** (human) and **Claude Code** (agent). Dyl opens a terminal in this folder, starts `claude`, and pastes the "First message" below.

> **Status as of Session 04 (2026-04-15):**
> - **Session 1 — scaffold into GitHub:** done. Repo lives at [dylwar27/crfw-site](https://github.com/dylwar27/crfw-site) (public).
> - **Session 2 — killd by bulk stub pass:** done for the main `KB/killd by/` folder (55 stubs, PR #1). The alphabets pass (~169 folders) and the killd-by-adjacent folders (`KB/Killd By +`, `KB/M_Killd By`, `Other Projects/killdfilez`, `Other Projects/unnamed_killdby_folder`) are still pending — the prompt below still applies, just point it at the next `--source`.
> - **GitHub Pages deploy:** done. Live at [dylwar27.github.io/crfw-site](https://dylwar27.github.io/crfw-site/).
> - **Session 3 — voice memo transcription:** not started.
>
> Running log: [`SESSIONS.md`](./SESSIONS.md). New agents should read that first for the current state.

---

## Before you start

You need:
- **Node 18+** (`node -v`). If missing: `brew install node`.
- **GitHub CLI** (`gh --version`). If missing: `brew install gh`, then `gh auth login`.
- **Git** (`git --version`). Comes with Xcode Command Line Tools.

Optional but recommended:
- This folder should probably live **outside Dropbox** eventually — git repos and Dropbox don't love each other (Dropbox tries to sync `node_modules/`, which has ~30,000 files). For the first session, in-Dropbox is fine because `.gitignore` excludes `node_modules/` and `dist/`. If Dropbox complains, move the folder to `~/code/crfw-site/` or similar.

---

## First message to paste into Claude Code

Start `claude` in this folder (`cd /path/to/site && claude`), then paste:

> Read CLAUDE.md, then CONTENT.md, then README.md. These are the ground rules for this repo — a memorial timeline site for Colin Ward.
>
> Then do the following setup, one step at a time, pausing for me to confirm:
>
> 1. Run `npm install` and confirm the site builds clean with `npm run build`.
> 2. Initialize a git repo, commit everything currently in the folder as the initial scaffold. Include `CLAUDE.md`, `CONTENT.md`, `README.md`, `HANDOFF_PROMPT.md`, and all `src/` and `public/` content.
> 3. Create a **private** GitHub repo named `crfw-site` under my account using `gh repo create`. Push the initial commit.
> 4. Ask me whether I want to set up GitHub Pages deployment via Actions now, or wait until there's more content. If I say yes, add `.github/workflows/deploy.yml` using the standard Astro-on-Pages workflow and push it.
> 5. Report back: the repo URL, the initial commit hash, and (if deploy was configured) the Pages URL and workflow status.
>
> Do not start on content work (discography pass, voice memos, etc.) in this first session — that's separate work. Today's goal is getting the scaffold into GitHub cleanly.

---

## Second session — when you're ready to add content in bulk

> Read CLAUDE.md and CONTENT.md.
>
> I want to do a bulk stub pass through the killd by discography. The source folder is `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/KB/killd by/` — walk every subfolder, and for each one create an entry in `src/content/releases/<slug>.md` with:
>
> - `title` — cleaned-up readable version of the folder name
> - `preservedTitle` — folder name exactly as Colin named it
> - `project: "killd by"`
> - `date` — from the folder name if it contains a year, otherwise from the oldest file's mtime inside the folder
> - `format` — best guess from the folder contents (LP if ≥8 tracks, EP if 3–7, single if 1–2, mix if it's a full continuous mix, b-sides if the name says so, otherwise "other")
> - `archivePath` — the actual path
> - Leave `summary` empty. I'll write those myself.
>
> Put this on a branch named `bulk/killd-by-stubs`, commit one entry per commit for the first few so I can see the pattern, then bulk-commit the rest. Open a PR against main when done. Do not skip any folders, even ones that look like duplicates or variants — CLAUDE.md explains why.
>
> Then do the same for `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Music/alphabets/`.

---

## Third session — voice memo transcription

> Read CLAUDE.md.
>
> Set up a local Whisper transcription script that reads from `~/Library/CloudStorage/Dropbox/CRFW/CRFW Archive/_Documentation/Voice Memos/`, transcribes each memo, and emits one JSON entry per memo into `src/content/voice_memos/`. Use filename (usually a timestamp) for the date. Include the transcript text in full — do not summarize. Model: `whisper.cpp` with `small` or `medium`, whichever runs at reasonable speed on Apple Silicon. Do this on a branch. Commit the script first, then the generated entries in batches of ~50 per commit.

---

## Notes for Claude Code

- When a folder is named literally `-` or has unicode-collision twins, surface it rather than deciding on its name. `CLAUDE.md` explains the preservation rules.
- When creating stubs with unknown fields, leave them unset rather than guessing. Schema is strict; stubs must still validate.
- After any commit that changes the schema (`src/content/config.ts`), rebuild and confirm existing content still validates before pushing.
