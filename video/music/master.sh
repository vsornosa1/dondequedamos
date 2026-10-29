#!/bin/sh
# Export the cut list, render a score and master it to -14 LUFS, true peak -1.5 dBTP (two-pass).
#   sh music/master.sh                                          # music/score.py -> public/music.wav
#   sh music/master.sh score_rumba.py public/music-rumba.wav    # the first score
set -e
cd "$(dirname "$0")/.."
score=${1:-score.py}
out=${2:-public/music.wav}
node scripts/cues.ts
python "music/$score" music/raw.wav
ffmpeg -hide_banner -nostats -i music/raw.wav \
  -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2> music/measure.txt
get() { grep "\"$1\"" music/measure.txt | sed 's/.*: "\(.*\)".*/\1/'; }
ffmpeg -y -hide_banner -loglevel error -i music/raw.wav -af \
  "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
  -ar 48000 -c:a pcm_s16le "$out"
rm -f music/raw.wav music/measure.txt
echo "wrote $out"
