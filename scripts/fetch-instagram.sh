#!/usr/bin/env bash
# Fetch Instagram posts for one handle into tmp/instagram/<handle>/.
#
# Stage 1 of the IG ingest pipeline. Stage 2 is
# scripts/import-instagram.mjs, which reads the output of this script
# and writes photo/video entries into src/content/.
#
# Uses gallery-dl with browser-cookie auth. Why not instaloader:
# instaloader's session-health-check endpoint (graphql/query with an
# empty-variables hash) returns 401 on recent Instagram backends, and
# instaloader interprets that as "session expired" and falls through to
# an interactive password prompt that can't be satisfied in a script.
# gallery-dl uses the real web endpoints with your browser's current
# cookies and works through the same auth IG gives a logged-in tab.
#
# Prereq (one-time): brew install gallery-dl
#                    Log into instagram.com in Chrome (or Safari/Firefox).
#
# Usage:
#   ./scripts/fetch-instagram.sh <handle>
#   ./scripts/fetch-instagram.sh <handle> --browser chrome|safari|firefox
#
# Notes:
#   - Feed posts only (gallery-dl's default). Stories need extra config.
#   - Re-running is additive: gallery-dl skips posts already on disk.
#   - macOS may prompt once for Keychain access to read Chrome cookies.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <instagram-handle> [--browser chrome|safari|firefox]" >&2
  exit 2
fi

HANDLE="$1"
shift
BROWSER="chrome"
while [ $# -gt 0 ]; do
  case "$1" in
    --browser)
      BROWSER="$2"
      shift 2
      ;;
    *)
      echo "error: unknown flag '$1'" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$REPO_ROOT/tmp/instagram/$HANDLE"
mkdir -p "$OUT_DIR"

if ! command -v gallery-dl >/dev/null 2>&1; then
  echo "error: gallery-dl not found on PATH." >&2
  echo "  install with: brew install gallery-dl" >&2
  exit 1
fi

echo "Handle:   @$HANDLE"
echo "Cookies:  $BROWSER"
echo "Out dir:  $OUT_DIR"
echo

# Flags:
#   --cookies-from-browser   pull IG session cookies from the browser
#   --write-metadata         emit <file>.json sidecar with post metadata
#   -D <path>                exact destination (flat, no category subdirs)
#   --filename               predictable names keyed by shortcode + index
gallery-dl \
  --cookies-from-browser "$BROWSER" \
  --write-metadata \
  -D "$OUT_DIR" \
  --filename "{post_shortcode}_{num}.{extension}" \
  "https://instagram.com/$HANDLE/"

echo
echo "Done."
echo "Next: node scripts/import-instagram.mjs --user $HANDLE"
