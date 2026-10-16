#!/usr/bin/env bash
# usage: tools/record.sh <ID>  → runs demo/<ID>.sh; writes casts/<ID>.cast and video/term/<ID>.mp4
set -euo pipefail
W="$(cd "$(dirname "$0")/.." && pwd)"
id="$1"
[ -f "$W/demo/$id.sh" ] || { echo "missing demo/$id.sh" >&2; exit 1; }
tmp="$W/work/rec-$id"
mkdir -p "$tmp"
asciinema rec --overwrite --headless --window-size 100x26 -i 2 \
  -c "bash $W/demo/$id.sh" "$W/casts/$id.cast"
# the header holds the absolute script path (privacy)
sed -i.bak "1s/.*/$(head -1 "$W/casts/$id.cast" | jq -c 'del(.command, .env)' | sed 's/[&\/]/\\&/g')/" "$W/casts/$id.cast" && rm -f "$W/casts/$id.cast.bak"
# the header holds the absolute script path and the environment: drop both (privacy grep)
sed -i '' '1s/,"command":"[^"]*"//; 1s/,"env":{[^}]*}//' "$W/casts/$id.cast"
agg --font-size 22 --font-family "JetBrains Mono,Menlo" --theme monokai --idle-time-limit 2 \
  "$W/casts/$id.cast" "$tmp/$id.gif"
ffmpeg -loglevel error -y -i "$tmp/$id.gif" -movflags +faststart -pix_fmt yuv420p \
  -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" "$W/video/term/$id.mp4"
rm -rf "$tmp"
echo "ok $id: casts/$id.cast video/term/$id.mp4"
