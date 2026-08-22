#!/bin/bash
# Render any local HTML (optionally with ?query) to a PNG via headless Edge.
# usage: bash tools/shot2.sh <file.html[?query]> <out.png> [W,H]
# Concurrent-safe: each run uses its own throwaway --user-data-dir.
set -e
SRC="$1"; OUT="$2"; SIZE="${3:-1680,1500}"
SIZE="${SIZE/x/,}"
EDGE="/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
QUERY=""
case "$SRC" in *\?*) QUERY="?${SRC#*\?}"; SRC="${SRC%%\?*}";; esac
WIN_HTML="$(cygpath -m "$(realpath "$SRC")")"
OUT_ABS="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
WIN_OUT="$(cygpath -m "$OUT_ABS")"
PROFILE="$(cygpath -m "${TMP:-/tmp}")/edgeprof-$$-$RANDOM"
rm -f "$OUT_ABS"
"$EDGE" --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
  --user-data-dir="$PROFILE" \
  --force-color-profile=srgb --virtual-time-budget=4000 \
  --window-size=$SIZE --screenshot="$WIN_OUT" \
  "file:///${WIN_HTML}${QUERY}" >/dev/null 2>&1 || true
if [ ! -f "$OUT_ABS" ] && [ -f "screenshot.png" ]; then mv screenshot.png "$OUT_ABS"; fi
rm -rf "$PROFILE" 2>/dev/null || true
ls -la "$OUT_ABS"
