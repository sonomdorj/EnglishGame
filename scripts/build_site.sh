#!/bin/sh
# Copies only the files the game needs into one folder (default: _site), for static hosting.
#   sh scripts/build_site.sh [out-dir]
set -eu
OUT="${1:-_site}"
cd "$(dirname "$0")/.."
rm -rf "$OUT"
mkdir -p "$OUT"
cp index.html style.css test_dates.html "$OUT/"
for f in *.js; do
  [ "$f" = playwright.config.js ] || cp "$f" "$OUT/"
done
cp villagers.json quests.json words.json letters.json buu.json audio_manifest.json "$OUT/"
if [ -d audio ]; then cp -R audio "$OUT/"; fi
echo "site: $(find "$OUT" -type f | wc -l | tr -d ' ') files in $OUT"
