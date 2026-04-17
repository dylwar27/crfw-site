#!/usr/bin/env bash
# Fetch public Instagram posts for one handle into tmp/instagram/<handle>/.
#
# Stage 1 of the IG ingest pipeline. Stage 2 is
# scripts/import-instagram.mjs, which reads the output of this script and
# writes photo/video entries into src/content/.
#
# Prereq (one-time): pipx install instaloader
#
# Usage:
#   ./scripts/fetch-instagram.sh <handle>
#
# Notes:
#   - Feed posts only. Stories/highlights are login-gated and skipped.
#   - Public accounts only; IG rate-limits hard — if it stalls, wait an
#     hour rather than re-running immediately.
#   - Re-running is additive: instaloader skips posts it has already saved.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <instagram-handle>" >&2
  exit 2
fi

HANDLE="$1"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$REPO_ROOT/tmp/instagram"
mkdir -p "$OUT_DIR"

if ! command -v instaloader >/dev/null 2>&1; then
  echo "error: instaloader not found on PATH. Install with: pipx install instaloader" >&2
  exit 1
fi

cd "$OUT_DIR"

# Flags:
#   --no-profile-pic          skip profile avatar download (not useful for archive)
#   --no-compress-json        keep sidecars as plain .json (not .json.xz)
#   --dirname-pattern         flat directory per handle
#   --filename-pattern        readable names: YYYY-MM-DD_HH-MM-SS_UTC_<shortcode>
#   --post-metadata-txt=""    suppress the .txt caption dump; we read the .json
instaloader \
  --no-profile-pic \
  --no-compress-json \
  --dirname-pattern "{target}" \
  --filename-pattern "{date_utc}_{shortcode}" \
  --post-metadata-txt="" \
  "$HANDLE"

echo
echo "Done. Posts saved to: $OUT_DIR/$HANDLE/"
echo "Next: node scripts/import-instagram.mjs --user $HANDLE"
