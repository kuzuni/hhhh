#!/bin/bash
# Render tools/spider-inspect.html (WebGL montage) to a PNG via headless Edge.
# usage: bash tools/shot-spider.sh <outfile.png>
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$DIR/tools/spider.png}"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
WIN_HTML="$(cygpath -m "$DIR/tools/spider-inspect.html")"
WIN_OUT="$(cygpath -m "$OUT")"
rm -f "$OUT"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
  --force-color-profile=srgb --virtual-time-budget=6000 \
  --window-size=2292,1312 --screenshot="$WIN_OUT" \
  "file:///${WIN_HTML}" >/dev/null 2>&1 || true
if [ ! -f "$OUT" ] && [ -f "screenshot.png" ]; then mv screenshot.png "$OUT"; fi
ls -la "$OUT"
