#!/bin/bash
# Render tools/inspect.html to a PNG via headless Edge (Chromium/SwiftShader).
# usage: bash tools/shot.sh <outfile.png>
set -e
DIR="$(cd "$(dirname "$0")/.." && pwd)"
OUT="${1:-$DIR/tools/inspect.png}"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
# Windows-style path for both the screenshot target and the file:// URL
WIN_HTML="$(cygpath -m "$DIR/tools/inspect.html")"
WIN_OUT="$(cygpath -m "$OUT")"
rm -f "$OUT"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
  --force-color-profile=srgb --virtual-time-budget=2500 \
  --window-size=1680,1500 --screenshot="$WIN_OUT" \
  "file:///${WIN_HTML}" >/dev/null 2>&1 || true
# Edge sometimes writes to CWD/screenshot.png; normalize
if [ ! -f "$OUT" ] && [ -f "screenshot.png" ]; then mv screenshot.png "$OUT"; fi
ls -la "$OUT"
