#!/usr/bin/env bash
# Interactive wizard — fetch + import one Instagram handle end-to-end.
#
# Wraps fetch-instagram.sh + import-instagram.mjs with prompts so the
# whole pipeline is one command. Stops for confirmation between the
# dry-run and the write pass; runs `npm run build` at the end to verify
# schemas still validate.
#
# Does NOT git-commit the new content — curator reviews /admin first
# (password crfw), then commits manually once they've curated titles,
# project assignments, and which entries to publish.
#
# Usage:
#   ./scripts/ingest-instagram.sh                 # prompts for handle
#   ./scripts/ingest-instagram.sh <handle>        # handle from arg
#   ./scripts/ingest-instagram.sh <handle> <tag>  # both preset

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# --- utility ---
say()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

ask() {
  # ask <prompt> [default]   — echoes answer; default used on empty input
  local prompt="$1"
  local default="${2:-}"
  local suffix=""
  [ -n "$default" ] && suffix=" [$default]"
  local answer
  read -r -p "$(printf '\033[36m?\033[0m %s%s: ' "$prompt" "$suffix")" answer </dev/tty
  printf '%s' "${answer:-$default}"
}

confirm() {
  # confirm <prompt>  — returns 0 on y/Y/yes, 1 on n/N/no or empty
  local answer
  read -r -p "$(printf '\033[36m?\033[0m %s [y/N]: ' "$1")" answer </dev/tty
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

# --- Step 0: preflight ---
say "CRFW Instagram ingest wizard"

if ! command -v instaloader >/dev/null 2>&1; then
  warn "instaloader not found on PATH."
  echo "   macOS:  brew install instaloader"
  echo "   any:    pipx install instaloader"
  die  "re-run the wizard after installing."
fi
ok "instaloader present: $(instaloader --version 2>&1 | head -1)"

if ! command -v node >/dev/null 2>&1; then
  die "node not found on PATH."
fi

# --- Step 1: handle ---
HANDLE="${1:-}"
if [ -z "$HANDLE" ]; then
  HANDLE="$(ask 'Instagram handle (no @)')"
fi
[ -z "$HANDLE" ] && die "handle is required."
# strip a leading @ if the user typed one
HANDLE="${HANDLE#@}"
ok "handle: @$HANDLE"

# --- Step 2: tag ---
TAG="${2:-}"
if [ -z "$TAG" ]; then
  echo
  echo "   Tag applied to every new entry. Convention:"
  echo "     instagram-personal   personal account"
  echo "     instagram-art        art/project account"
  echo "     (or anything else slug-shaped)"
  TAG="$(ask 'Tag' 'instagram-personal')"
fi
ok "tag: $TAG"

# --- Step 3: fetch ---
say "Stage 1 · fetching @$HANDLE into tmp/instagram/"
if [ -d "tmp/instagram/$HANDLE" ]; then
  existing_count=$(find "tmp/instagram/$HANDLE" -maxdepth 1 -name '*.json' ! -name '*_profile.json' 2>/dev/null | wc -l | tr -d ' ')
  warn "tmp/instagram/$HANDLE already exists ($existing_count post JSONs). instaloader will add any new posts and skip existing ones."
fi

if ! ./scripts/fetch-instagram.sh "$HANDLE"; then
  die "fetch failed. Common causes: IG rate-limit (wait ~1h), private account, typo in handle."
fi

fetched_count=$(find "tmp/instagram/$HANDLE" -maxdepth 1 -name '*.json' ! -name '*_profile.json' | wc -l | tr -d ' ')
ok "$fetched_count post JSONs on disk in tmp/instagram/$HANDLE/"

# --- Step 4: dry-run import ---
say "Stage 2a · dry-run import (no files touched)"
node scripts/import-instagram.mjs --user "$HANDLE" --tag "$TAG"

echo
if ! confirm "Apply these changes? (writes src/content/ JSON + copies media into public/media/)"; then
  warn "aborted before write. Re-run anytime; fetched data is in tmp/instagram/$HANDLE/."
  exit 0
fi

# --- Step 5: write import ---
say "Stage 2b · writing entries"
node scripts/import-instagram.mjs --user "$HANDLE" --tag "$TAG" --write

# --- Step 6: build verify ---
say "Verifying schema with npm run build"
if npm run build >/tmp/ingest-ig-build.log 2>&1; then
  ok "build passed (full log: /tmp/ingest-ig-build.log)"
  grep -E '\[build\] [0-9]+ page' /tmp/ingest-ig-build.log | tail -1 | sed 's/^/   /' || true
else
  warn "build failed — full log:"
  tail -40 /tmp/ingest-ig-build.log
  die "fix schema errors and re-run \`npm run build\` before committing."
fi

# --- Step 7: summary ---
new_photos=$(find src/content/photos -name "ig-${HANDLE}-*.json" 2>/dev/null | wc -l | tr -d ' ')
new_videos=$(find src/content/videos -name "ig-${HANDLE}-*.json" 2>/dev/null | wc -l | tr -d ' ')

say "Done"
echo "   photos entries (total for @$HANDLE): $new_photos"
echo "   videos entries (total for @$HANDLE): $new_videos"
echo
echo "   Next steps:"
echo "     1. npm run dev  → visit http://localhost:4321/admin (password: crfw)"
echo "     2. curate title / project / summary via /admin CSV export → Sheets → import-csv-edits.mjs"
echo "     3. flip published: true on the entries you want public"
echo "     4. git commit the new src/content/ + public/media/ when ready"
