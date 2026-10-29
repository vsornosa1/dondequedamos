#!/bin/sh
# Render the film and put the music on it.
#   sh scripts/render.sh                    # PNG frames -> out/video.mp4 -> out/dondequedamos-demo.mp4
#   sh scripts/render.sh mux public/music-rumba.wav out/dondequedamos-demo-rumba.mp4
# Frames are PNG, not Remotion's default JPEG at 80 %: the JPEG blocks made the blobs look
# pixelated. The video is encoded once, without sound, so a different score is only a remux.
set -e
cd "$(dirname "$0")/.."
mux() {
  ffmpeg -y -hide_banner -loglevel error -i out/video.mp4 -i "$1" \
    -filter_complex "[1:a]atrim=0:60,afade=t=out:st=58.667:d=1.333[a]" -map 0:v -map "[a]" \
    -c:v copy -c:a aac -b:a 320k -ar 48000 -movflags +faststart -shortest "$2"
  echo "wrote $2"
}
if [ "$1" = mux ]; then mux "$2" "$3"; exit; fi
rm -rf out/frames
npx remotion render src/index.ts Main out/frames --sequence --image-format=png --props='{"music":false}' --gl=angle --log=error
ffmpeg -y -hide_banner -loglevel error -framerate 30 -i out/frames/element-%04d.png \
  -vf "scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p" \
  -c:v libx264 -preset slow -crf 15 -tune animation -profile:v high \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv -an -movflags +faststart out/video.mp4
cp out/frames/element-0098.png out/poster.png
rm -rf out/frames
mux public/music.wav out/dondequedamos-demo.mp4
