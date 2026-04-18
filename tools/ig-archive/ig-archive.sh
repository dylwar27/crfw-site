#!/usr/bin/env bash
# Interactive wizard — fetch + normalize one Instagram handle end-to-end.
#
# Runs fetch.sh and import.mjs with prompts in between. Result: a
# <out>/<handle>/ directory containing all media files plus a
# manifest.json describing every post.
#
# Usage:
#   ./ig-archive.sh                       # prompts for handle + browser + out
#   ./ig-archive.sh <handle>              # handle preset
#   ./ig-archive.sh <handle> chrome       # handle + browser preset
#   ./ig-archive.sh <handle> chrome ./out # all three preset

set -euo pipefail

TOOL_DIR="$(cd "$(dirname "$0")" && pwd)"

say()  { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '\033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

ask() {
  local prompt="$1" default="${2:-}" suffix="" answer
  [ -n "$default" ] && suffix=" [$default]"
  read -r -p "$(printf '\033[36m?\033[0m %s%s: ' "$prompt" "$suffix")" answer </dev/tty
  printf '%s' "${answer:-$default}"
}

confirm() {
  local answer
  read -r -p "$(printf '\033[36m?\033[0m %s [y/N]: ' "$1")" answer </dev/tty
  case "$answer" in
    y|Y|yes|YES) return 0 ;;
    *) return 1 ;;
  esac
}

say "ig-archive wizard"

# --- preflight ---
if ! command -v gallery-dl >/dev/null 2>&1; then
  warn "gallery-dl not found on PATH."
  echo "   macOS:  brew install gallery-dl"
  echo "   any:    pipx install gallery-dl"
  die  "re-run after installing."
fi
ok "gallery-dl present: $(gallery-dl --version 2>&1 | head -1)"

if ! command -v node >/dev/null 2>&1; then
  die "node not found on PATH."
fi
ok "node present: $(node --version)"

# --- handle ---
HANDLE="${1:-}"
[ -z "$HANDLE" ] && HANDLE="$(ask 'Instagram handle (no @)')"
[ -z "$HANDLE" ] && die "handle is required."
HANDLE="${HANDLE#@}"
ok "handle: @$HANDLE"

# --- browser ---
BROWSER="${2:-}"
if [ -z "$BROWSER" ]; then
  echo
  echo "   gallery-dl reads IG session cookies from your browser."
  echo "   You need to be logged into instagram.com in that browser first."
  BROWSER="$(ask 'Browser (chrome/safari/firefox)' 'chrome')"
fi
ok "browser: $BROWSER"

# --- output dir ---
OUT_ROOT="${3:-}"
[ -z "$OUT_ROOT" ] && OUT_ROOT="$(ask 'Output root' './ig-archive')"
ok "output: $OUT_ROOT/$HANDLE/"

# --- fetch ---
say "Stage 1 · fetching posts (gallery-dl)"
if ! "$TOOL_DIR/fetch.sh" "$HANDLE" --browser "$BROWSER" --out "$OUT_ROOT"; then
  echo
  warn "fetch failed. Common causes:"
  echo "   - 401 Unauthorized: not logged into IG in $BROWSER. Log in via the browser and retry."
  echo "   - Keychain prompt denied: macOS blocked gallery-dl from reading Chrome cookies."
  echo "   - typo in handle / account doesn't exist / account is private."
  exit 1
fi

# --- dry-run normalize ---
say "Stage 2a · dry-run normalize"
node "$TOOL_DIR/import.mjs" --handle "$HANDLE" --out "$OUT_ROOT" --dry-run

echo
if ! confirm "Write manifest.json?"; then
  warn "aborted before write. Fetched media remains at $OUT_ROOT/$HANDLE/."
  exit 0
fi

# --- write manifest ---
say "Stage 2b · writing manifest.json"
node "$TOOL_DIR/import.mjs" --handle "$HANDLE" --out "$OUT_ROOT"

# --- summary ---
say "Done"
echo "   $OUT_ROOT/$HANDLE/manifest.json"
echo "   $(find "$OUT_ROOT/$HANDLE" -maxdepth 1 -type f -not -name '*.json' 2>/dev/null | wc -l | tr -d ' ') media files alongside"
echo
echo "   Consumers read manifest.json and resolve post.primary.file and"
echo "   post.extras[].file as paths relative to the manifest directory."
