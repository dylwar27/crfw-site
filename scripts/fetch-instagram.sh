#!/usr/bin/env bash
# Fetch public Instagram posts for one handle into tmp/instagram/<handle>/.
#
# Stage 1 of the IG ingest pipeline. Stage 2 is
# scripts/import-instagram.mjs, which reads the output of this script and
# writes photo/video entries into src/content/.
#
# Prereq (one-time): brew install instaloader      (macOS — recommended)
#                    pipx install instaloader      (or any OS)
#
# Usage:
#   ./scripts/fetch-instagram.sh <handle>
#   ./scripts/fetch-instagram.sh <handle> --login <burner-account>
#
# Notes:
#   - Anonymous (no --login) access to IG's GraphQL API is broken for most
#     accounts as of 2025 — Instagram returns 403 to unauthenticated
#     graphql/query hits. A burner IG account is the reliable workaround.
#     Instaloader prompts for the burner password on first run and caches
#     the session in ~/Library/Application Support/Instaloader/.
#   - Feed posts only. Stories/highlights need login AND an account that
#     follows the target; not in scope here.
#   - Re-running is additive: instaloader skips posts it has already saved.

set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: $0 <instagram-handle> [--login <burner>]" >&2
  exit 2
fi

HANDLE="$1"
shift
LOGIN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --login)
      LOGIN="$2"
      shift 2
      ;;
    *)
      echo "error: unknown flag '$1'" >&2
      exit 2
      ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT_DIR="$REPO_ROOT/tmp/instagram"
mkdir -p "$OUT_DIR"

if ! command -v instaloader >/dev/null 2>&1; then
  echo "error: instaloader not found on PATH." >&2
  echo "  macOS:  brew install instaloader" >&2
  echo "  any:    pipx install instaloader" >&2
  exit 1
fi

cd "$OUT_DIR"

# Flags:
#   --no-profile-pic          skip profile avatar download (not useful for archive)
#   --no-compress-json        keep sidecars as plain .json (not .json.xz)
#   --dirname-pattern         flat directory per handle
#   --filename-pattern        readable names: YYYY-MM-DD_HH-MM-SS_UTC_<shortcode>
#   --post-metadata-txt=""    suppress the .txt caption dump; we read the .json
#   --login                   burner account to authenticate as
LOGIN_ARGS=()
if [ -n "$LOGIN" ]; then
  LOGIN_ARGS=(--login "$LOGIN")
  echo "Logging in as: $LOGIN (session cached after first run)"
fi

instaloader \
  --no-profile-pic \
  --no-compress-json \
  --dirname-pattern "{target}" \
  --filename-pattern "{date_utc}_{shortcode}" \
  --post-metadata-txt="" \
  "${LOGIN_ARGS[@]}" \
  "$HANDLE"

echo
echo "Done. Posts saved to: $OUT_DIR/$HANDLE/"
echo "Next: node scripts/import-instagram.mjs --user $HANDLE"
