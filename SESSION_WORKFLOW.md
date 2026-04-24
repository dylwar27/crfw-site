# SESSION_WORKFLOW.md — start, mid, end checklists for a Claude session

How the agent runs a session on this repo. Read at the start of every session.

---

## Start-of-session checklist

1. **Confirm cwd.** `pwd` → `/Users/dward/crfw-site`. If not, `cd ~/crfw-site`. (Pre-Session 19 sessions ran from iCloud paths; see "Historical gotchas" below.)
2. **Pull and verify clean tree.**
   ```bash
   git pull origin main
   git status           # should be clean
   git log --oneline -3 # last few commits; sanity-check HEAD matches expectations
   ```
3. **Read `CLAUDE.md`.** Especially the golden rules and the STATUS block (auto-generated counts).
4. **Check CI green.** `gh run list --repo dylwar27/crfw-site --limit 1` — last run on main should be success.
5. **Regenerate STATUS if needed.** If `CLAUDE.md` looks stale (or it's the start of a new session): `node scripts/status.mjs > /tmp/status.md` and paste the block between the `<!-- STATUS:BEGIN -->` / `<!-- STATUS:END -->` markers in `CLAUDE.md`.

If any step fails, **diagnose before doing any work**. A dirty tree or a red CI means the previous session didn't close cleanly.

---

## Commit cadence

Commit on each of these triggers:
- A logical feature / fix is complete (even if small).
- A script run produces changes worth preserving (e.g., vault-sync projections).
- Before switching tasks (don't mix unrelated changes in one commit).
- Before the end of the session.

Don't commit:
- Half-working code (stash with `git stash -u` instead).
- `.DS_Store` or other machine-local noise (gitignored, but double-check).
- Anything that a dry-run hasn't confirmed safe.

Use `git commit -m` with HEREDOC for multi-line messages (see `CONVENTIONS.md#commit-messages`). Always include the `Co-Authored-By` footer on agent-authored commits.

**Do NOT `git commit --amend`** unless the user explicitly requests it. New commits are safer; amending on top of a hook failure can destroy previous work. If a pre-commit hook fails: fix, re-stage, new commit.

---

## Push hang policy (new as of Session 19)

**If any git operation hangs at 0% CPU for more than 30 seconds, STOP. Do not retry.**

Background: Session 18 produced 5 duplicate commits on main because a push hung in the iCloud-era environment and each retry created a fresh commit. The environment fix landed in Session 19 (repo off iCloud), but the rule still applies — a hang is a symptom, not a flake.

When a hang happens:
1. Kill the hung process (ctrl-c in the shell; if that doesn't work, `pkill -9 git`).
2. Check for stale lock files: `ls ~/crfw-site/.git/*.lock` — remove if safe.
3. Check for iCloud conflict files: `ls ~/crfw-site/.git/ | grep -c '^index '` — should be 1. Higher = sync issue.
4. Check disk / filesystem health.
5. Report the hang and diagnosis to the user. Do NOT retry the same operation until the root cause is identified.

The goal is zero dupe commits in any session.

---

## End-of-session checklist

1. **Tree clean.** `git status` → clean.
2. **All commits local are pushable.** `git log --oneline origin/main..HEAD` shows only what you intended.
3. **Build passes.** `npm run build` → no errors, page count unchanged or grew intentionally.
4. **SESSIONS.md updated.** Add a "Session NN" entry to `SESSIONS.md` with:
   - What shipped (bullet list of deliverables).
   - What's next (1–3 bullets, informs Session NN+1).
   - Any anomalies / things the user should know.
5. **Regenerate STATUS** if counts changed.
6. **User pushes.** Agent does NOT push without explicit user direction (auto-mode guideline: modifying production systems needs approval).

If anything is unresolved, write it in `SESSIONS.md` as "Session NN unfinished:" and explain.

---

## Environment expectations

As of Session 19:
- cwd: `~/crfw-site` (not `~/Library/Mobile Documents/…`, not `~/Desktop/site`).
- Env vars set globally via `~/.claude/settings.json`:
  - `CI=1` — suppresses astro telemetry/update-check hangs.
  - `ASTRO_TELEMETRY_DISABLED=1`
  - `NO_UPDATE_NOTIFIER=1`
  - `FORCE_COLOR=0` / `NO_COLOR=1`
  - `GIT_TERMINAL_PROMPT=0` — prevents git credential-prompt hangs.
- Permission allowlist at `~/crfw-site/.claude/settings.local.json` covers `npm`, `git`, `gh`, and all project scripts.

Verify in a new session:
```bash
echo "CI=$CI  ASTRO_TEL=$ASTRO_TELEMETRY_DISABLED"
# → CI=1  ASTRO_TEL=1
```

If these aren't set, Claude Code didn't pick up the settings — restart Claude Code.

---

## Historical gotchas (pre-Session 19)

For forensic readers. These should NOT apply anymore as of Session 19.

- **iCloud was syncing `.git/`.** The repo used to live at `~/Library/Mobile Documents/com~apple~CloudDocs/Desktop/site/`. iCloud evicted loose git objects mid-operation, producing `.git/index 2`, `index 3`, … conflict files (sometimes 19+). Fix: moved to `~/crfw-site`, off iCloud.
- **Astro build hung on telemetry.** Without `CI=1` and `ASTRO_TELEMETRY_DISABLED=1`, astro blocked waiting for a TTY. Fix: env vars in `~/.claude/settings.json`.
- **Python subprocess workaround for git.** When shell-invoked git hung, we ran `subprocess.run(["/usr/bin/git", ...], cwd=...)` from a Python helper. Not needed post-reset.
- **iCloud conflict copies of scripts** — e.g., `sync-vault 2.mjs`, `db-sync 3.json`. `.gitignore` now catches ` [2-9].*`. Should not recur off iCloud.
- **Session 18 dupe commits.** 5 `Session 18: timeline bucket system + …` commits on main are real history — 4 cancelled pushes and 1 success that all created commits. Left as-is (rewriting main is worse than 4 duplicates). Post-reset, see "Push hang policy" to prevent recurrence.

If you're reading this section because something feels wrong, the first check is "am I on `~/crfw-site`?" — if no, that's the first fix.

---

## See also

- `CONVENTIONS.md` — commit-message style.
- `SCRIPT_PIPELINE.md` — what scripts are safe to run standalone.
- `SESSIONS.md` — per-session history.
- `/Users/dward/.claude/plans/snappy-bubbling-planet.md` — the Session 19 plan that introduced this workflow.
