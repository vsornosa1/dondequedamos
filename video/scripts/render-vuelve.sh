#!/bin/sh
# Render the relaunch clip and put its music on it (like scripts/render.sh for the demo).
#   node scripts/cues-vuelve.ts && sh music/master.sh score_vuelve.py public/music-vuelve.wav
#   sh scripts/render-vuelve.sh            # PNG frames at 1.6x -> out/vuelve-video.mp4 -> out/dondequedamos-vuelve.mp4
#   BROWSER=/path/to/chrome-headless-shell sh scripts/render-vuelve.sh   # in a container without Remotion's browser
set -e
cd "$(dirname "$0")/.."
browser=${BROWSER:+--browser-executable=$BROWSER}
rm -rf out/frames-vuelve
npx remotion render src/index.ts Vuelve out/frames-vuelve --sequence --image-format=png --scale=1.6 --props='{"music":false}' $browser --concurrency=4 --log=error
ffmpeg -y -hide_banner -loglevel error -framerate 30 -i out/frames-vuelve/element-%03d.png \
  -vf "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p" \
  -c:v libx264 -preset slow -crf 15 -tune animation -profile:v high \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -an -movflags +faststart out/vuelve-video.mp4
cp out/frames-vuelve/element-545.png out/vuelve-poster.png
rm -rf out/frames-vuelve
ffmpeg -y -hide_banner -loglevel error -i out/vuelve-video.mp4 -i public/music-vuelve.wav \
  -filter_complex "[1:a]atrim=0:20,afade=t=out:st=18.8:d=1.2[a]" -map 0:v -map "[a]" \
  -c:v copy -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest out/dondequedamos-vuelve.mp4
echo "wrote out/dondequedamos-vuelve.mp4"
