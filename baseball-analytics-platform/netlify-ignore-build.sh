#!/usr/bin/env bash
set -euo pipefail

# Netlify may run this from the repo root or from the base directory.
# This keeps the script safe either way.
if [ -d "baseball-analytics-platform" ]; then
  cd baseball-analytics-platform
fi

if [ -z "${CACHED_COMMIT_REF:-}" ] || [ -z "${COMMIT_REF:-}" ]; then
  echo "Missing Netlify commit refs. Running build."
  exit 1
fi

if [ "$CACHED_COMMIT_REF" = "$COMMIT_REF" ]; then
  echo "Cached commit equals current commit. Running build."
  exit 1
fi

if git diff --quiet "$CACHED_COMMIT_REF" "$COMMIT_REF" -- .   ':(exclude)data/stats.csv'   ':(exclude)data/last_updated.json'   ':(exclude)src/embeddedData.js'; then
  echo "Only data files changed. Skipping Netlify build."
  exit 0
else
  echo "App/code files changed. Running Netlify build."
  exit 1
fi
