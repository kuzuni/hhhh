#!/bin/bash
# Linux headless-chromium equivalent of shot2.sh
# usage: bash tools/shotlin.sh <file.html[?query]> <out.png> [W,H]
set -e
SRC="$1"; OUT="$2"; SIZE="${3:-1680,1500}"
SIZE="${SIZE/x/,}"
# headless chrome window includes ~87px of chrome; grow the window so the
# VIEWPORT matches the requested size exactly.
W="${SIZE%%,*}"; H="${SIZE##*,}"; H=$((H+87)); SIZE="$W,$H"
CHROME="/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
QUERY=""
case "$SRC" in *\?*) QUERY="?${SRC#*\?}"; SRC="${SRC%%\?*}";; esac
ABS_HTML="$(realpath "$SRC")"
mkdir -p "$(dirname "$OUT")"
OUT_ABS="$(cd "$(dirname "$OUT")" && pwd)/$(basename "$OUT")"
PROFILE="$(mktemp -d)"
rm -f "$OUT_ABS"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --no-sandbox \
  --user-data-dir="$PROFILE" \
  --force-color-profile=srgb --virtual-time-budget=4000 \
  --window-size=$SIZE --screenshot="$OUT_ABS" \
  "file://${ABS_HTML}${QUERY}" >/dev/null 2>&1 || true
rm -rf "$PROFILE" 2>/dev/null || true
# 창 높이엔 크롬 UI 87px가 포함돼 스샷 하단에 띠가 남는다 — 요청 크기로 잘라낸다
python3 - "$OUT_ABS" "$W" "$((H-87))" <<'PYEOF'
import sys
from PIL import Image
p,w,h=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
im=Image.open(p)
if im.size!=(w,h): im.crop((0,0,w,h)).save(p)
PYEOF
ls -la "$OUT_ABS"
