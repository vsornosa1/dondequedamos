#!/bin/sh
# Render a few frames of Main without music and tile them into one sheet: sh scripts/stills.sh name 10 60 200 ...
name=$1; shift
mkdir -p checks/$name
for fr in "$@"; do
  npx remotion still src/index.ts Main checks/$name/f$fr.png --frame=$fr --props='{"music":false}' --gl=angle --log=error || exit 1
done
n=$#
inputs=""; layout=""; i=0
for fr in "$@"; do inputs="$inputs -i checks/$name/f$fr.png"; done
cols=4; [ $n -lt 4 ] && cols=$n
filter=""
for i in $(seq 0 $((n-1))); do filter="$filter[$i:v]scale=360:-1,drawtext=text='$(echo "$@" | cut -d' ' -f$((i+1)))':x=8:y=8:fontsize=22:fontcolor=white:box=1:boxcolor=black@0.6[v$i];"; done
stack=""; for i in $(seq 0 $((n-1))); do stack="$stack[v$i]"; done
rows=$(( (n + cols - 1) / cols ))
lay=""; for i in $(seq 0 $((n-1))); do x=$(( (i % cols) * 360 )); y=$(( (i / cols) * 450 )); lay="$lay${x}_${y}|"; done
lay=${lay%|}
if [ $n -gt 1 ]; then
  ffmpeg -y -loglevel error $inputs -filter_complex "${filter}${stack}xstack=inputs=$n:layout=$lay:fill=black" checks/$name-sheet.png
else
  ffmpeg -y -loglevel error $inputs -vf scale=540:-1 checks/$name-sheet.png
fi
echo "checks/$name-sheet.png"
