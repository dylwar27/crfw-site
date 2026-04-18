#!/usr/bin/env bash
# Stage 1 of ig-archive: fetch public Instagram posts for one handle.
#
# Wraps gallery-dl with browser-cookie auth. Output is a flat dump of
# media files and gallery-dl .json sidecars into <out>/<handle>/.
# Stage 2 (import.mjs) reads that dump and emits a normalized
# manifest.json.
#
# Why gallery-dl, not instaloader: instaloader's session-health-check
# endpoint returns 401 on current Instagram backends and falls through
# to an interactive password prompt that EOFs in scripted shells.
# gallery-dl uses browser cookies directly and works through the same
# auth IG gives a logged-in tab.
#
# Prereq (one-time):
#   brew install gallery-dl            (macOS — recommended)
#   pipx install gallery-dl            (or any OS)
# Plus: be logged into instagram.com in Chrome (or Safari / Firefox).
#
# Usage:
#   ./fetch.sh <handle>
#   ./fetch.sh <handle> --browser chrome|safari|firefox
#   ./fetch.sh <handle> --out ./my-archive
#
# Notes:
#   - Feed posts only (gallery-dl's default). Stories require extra config.
#   - Re-running is additive: gallery-dl skips posts already on disk.
#   - macOS may prompt once for Keychain access to read Chrome cookies.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <instagram-handle> [--browser NAME] [--out DIR]" >&2
  exit 2
fi

HANDLE="$1"
shift
BROWSER="chrome"
OUT_ROOT="./ig-archive"
while [ $# -gt 0 ]; do
  case "$1" in
    --browser)
      BROWSER="$2"; shift 2 ;;
    --out)
      OUT_ROOT="$2"; shift 2 ;;
    *)
      echo "error: unknown flag '$1'" >&2
      exit 2
      ;;
  esac
done

HANDLE="${HANDLE#@}"   # tolerate a leading @
OUT_DIR="$OUT_ROOT/$HANDLE"
mkdir -p "$OUT_DIR"

if ! command -v gallery-dl >/dev/null 2>&1; then
  echo "error: gallery-dl not found on PATH." >&2
  echo "  macOS:  brew install gallery-dl" >&2
  echo "  any:    pipx install gallery-dl" >&2
  exit 1
fi

echo "Handle:   @$HANDLE"
echo "Cookies:  $BROWSER"
echo "Out dir:  $OUT_DIR"
echo

# Flags:
#   --cookies-from-browser   pull IG session cookies from the browser
#   --write-metadata         emit <file>.json sidecar per media file
#   -D <path>                exact destination (flat, no category subdirs)
#   --filename               predictable names for shortcode grouping
gallery-dl \
  --cookies-from-browser "$BROWSER" \
  --write-metadata \
  -D "$OUT_DIR" \
  --filename "{post_shortcode}_{num}.{extension}" \
  "https://instagram.com/$HANDLE/"

echo
echo "Done."
echo "Next: node $(dirname "$0")/import.mjs --handle $HANDLE --out $OUT_ROOT"
