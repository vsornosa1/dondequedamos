"""Original score for the relaunch clip (design/VUELVE.md): 20 s of the demo's sound.

The same Mediterranean house as the demo (music/score.py), 120 BPM, A major, with
its instruments, effects and mix borrowed straight from that file, so the two
films sound like one brand. One beat is 15 video frames and every hit is placed
from this clip's cut list (music/cues-vuelve.json, exported from
src/vuelve/timing.ts by scripts/cues-vuelve.ts).

Dramatic reading:

    beats  0-8    viral     a pluck per blob, then the full groove while the counters run;
                            the free quota overflows on beat 5 (a boing, like Yania's)
    beat   8      power cut the whole band stops at once, a pitch falling to nothing
    beats  8-16   paused    F#m and Dmaj9 pads, filtered and alone; the sign lands
    beats 16-20   "unos días después"  E, snare roll, riser and the stabs swelling
    beat   20     drop      the sign flips to HA VUELTO: crash, boom, the hook
    beats 20-32   back      chorus A C#m D E with the hook; a blip per promise card
    beats 32-36   end card  D E, the night closes in
    beat   36     home      A, held, rings out to the fade

Usage: python music/score_vuelve.py music/raw.wav  (music/master.sh does this)
"""

import json
import sys

import numpy as np
from scipy.io import wavfile

import score as s  # the demo's instruments, effects and mix

CUES = json.load(open('music/cues-vuelve.json', encoding='utf8'))
K = CUES['K']
TOTAL = CUES['total']
LENGTH = TOTAL / s.FPS + 2.0

# (start beat, chord): the demo's chords, re-cut for this story.
s.PROGRESSION = [
    (0, 'A'), (4, 'C#m'),
    (8, 'F#m'), (12, 'Dn'),
    (16, 'E'),
    (20, 'A'), (24, 'C#m'), (28, 'D'), (30, 'E'),
    (32, 'D'), (34, 'E'),
    (36, 'A'), (44, None),
]
GROOVE = [(0, 8), (20, 36)]  # where the kick plays
CHORUS = [(2, 8), (20, 36)]
DROP = 20
HOME = 36
add, bsec, fsec = s.add, s.bsec, s.fsec


def power_down(dur=0.9):
    """The band's power cut: a low hum that falls to nothing, with a crackle."""
    t = np.arange(s.at(dur)) / s.SR
    freq = 220 * np.exp(-t * 4.2) + 18
    tone = np.sin(2 * np.pi * np.cumsum(freq) / s.SR) + 0.35 * np.sign(np.sin(2 * np.pi * np.cumsum(freq) / s.SR))
    crackle = s.bp(s.RNG.standard_normal(len(t)), 1500, 6000) * (s.RNG.random(len(t)) > 0.995) * 3
    env = np.exp(-t * 2.2) * np.minimum(1, t / 0.004)
    return s.lp(tone * env + crackle * np.exp(-t * 6), 2400)


def render():
    n = s.at(LENGTH)
    buses = {name: np.zeros((n, 2)) for name in ('kick', 'drums', 'perc', 'bass', 'stabs', 'pads', 'lead', 'fx', 'sfx')}
    drums, perc, bass, stabs, pads, lead, fx, sfx = (buses[k] for k in ('drums', 'perc', 'bass', 'stabs', 'pads', 'lead', 'fx', 'sfx'))
    duck = np.zeros(n)

    k_sound, clap_s, snare_s = s.kick(), s.clap(), s.snare()
    hats_c = [s.metal(0.12, 0.016, seed) for seed in range(4)]
    hat_o = s.metal(0.6, 0.11, 9)
    shake, tamb = s.shaker(), s.tambourine()
    conga_hi, conga_lo, conga_slap = s.conga(330, 0.09), s.conga(220, 0.13), s.conga(330, 0.06, slap=True)
    duck_shape = (1 - np.exp(-np.arange(s.at(0.45)) / s.SR / 0.004)) * np.exp(-np.arange(s.at(0.45)) / s.SR / 0.12)

    def kick_at(sec, gain=1.0):
        add(buses['kick'], sec, k_sound, gain)
        i = s.at(sec)
        m = min(n - i, len(duck_shape))
        duck[i:i + m] = np.maximum(duck[i:i + m], duck_shape[:m] * gain)

    # Drums: four on the floor in the grooves, clap on 2 and 4, open hats in the choruses.
    for b in range(0, HOME):
        beat = float(b)
        sec = bsec(beat)
        if not s.in_ranges(beat, GROOVE):
            continue
        kick_at(sec)
        chorus = s.in_ranges(beat, CHORUS)
        if b % 2 == 1:
            add(drums, sec, clap_s, 0.62, 0.04)
            if chorus:
                add(perc, sec, tamb, 0.35, 0.3)
        if chorus:
            add(drums, bsec(beat + 0.5), hat_o, 0.3, 0.25)
        else:
            add(drums, bsec(beat + 0.5), hats_c[b % 4], 0.42, 0.25)
        for sub in (0.25, 0.75):
            add(drums, bsec(s.swung(beat + sub)), hats_c[(b + int(sub * 4)) % 4], s.human(0.17), 0.3)
        for sub in range(4):
            add(perc, bsec(s.swung(beat + sub / 4)), shake, s.human(0.13 * (1.0 if sub == 2 else 0.6)), -0.4)

    # Congas in the choruses.
    congas = ((0.25, conga_hi, 0.45), (0.75, conga_slap, 0.75), (1.25, conga_lo, 0.55), (1.5, conga_hi, 0.45),
              (2.25, conga_hi, 0.45), (2.75, conga_slap, 0.75), (3.0, conga_lo, 0.65), (3.5, conga_hi, 0.5))
    for bar in range(0, 10):
        for off, snd, vel in congas:
            beat = bar * 4 + off
            if s.in_ranges(beat, CHORUS):
                add(perc, bsec(s.swung(beat)), snd, s.human(vel * 0.5), 0.35 if snd is conga_lo else -0.25)

    # The build: a snare roll that thickens, a reversed crash, then crash and boom on the drop and home.
    steps = 16  # beats 16-20 in 16ths: eighths first, then sixteenths, into the drop
    for st in range(steps):
        x = st / (steps - 1)
        if x < 0.5 and st % 2:
            continue
        add(drums, bsec(16) + st * s.BEAT / 4, snare_s, 0.5 * (0.2 + 0.8 * x ** 1.5), 0.08)
    for b in (DROP, HOME):
        add(fx, bsec(b) - bsec(1), s.reverse_crash(bsec(1)), 0.35 if b == DROP else 0.25)
        add(drums, bsec(b), s.crash(3.0 if b == HOME else 2.4, 2 if b == HOME else 0), 0.22)
        add(fx, bsec(b), s.boom(), 0.55)

    # Bass: off-beat eighths with octave pickups in the grooves, long notes elsewhere.
    pattern = ((0.5, 0, 0.32, 1.0), (1.5, 0, 0.32, 1.0), (1.75, 12, 0.18, 0.75), (2.5, 0, 0.32, 1.0), (3.5, 0, 0.3, 1.0), (3.75, 12, 0.18, 0.75))
    for b0, b1 in [(2, 8), (DROP, HOME)]:
        for b, ch, seg in s.bars(b0, b1):
            root = s.CHORDS[ch]['bass']
            for off, step, dur, vel in pattern:
                if off < seg and b + off < b1:
                    add(bass, bsec(s.swung(b + off)), s.bass_note(root + step, bsec(dur), s.human(vel, 0.08)))
    for b, ch, seg in s.segments(10, DROP):  # the pause and the build: long, quiet notes
        add(bass, bsec(b), s.bass_note(s.CHORDS[ch]['bass'], bsec(seg) - 0.05, 0.55 if b < 16 else 0.7))
    add(bass, bsec(HOME), s.bass_note(s.CHORDS['A']['bass'], bsec(3.6), 0.9))

    # Stabs: filtered on the way in, open in the grooves; the build swells into the drop.
    for b, ch, seg in s.bars(0, 8):
        for off in (0.5, 1.5, 2.5, 3.5):
            if off < seg:
                cutoff = 1400 + 5400 * min(1, (b + off) / 4)
                add(stabs, bsec(b + off), s.stab(ch, bsec(0.4), cutoff), s.human(0.85, 0.08))
    for k in range(16):
        beat = 16 + k / 4
        add(stabs, bsec(beat), s.stab('E', bsec(0.2), 900 + 5200 * (k / 15) ** 2), 0.25 + 0.5 * k / 15)
    for b, ch, seg in s.bars(DROP, HOME):
        for off in (0.5, 1.5, 2.5, 3.5):
            if off < seg:
                add(stabs, bsec(b + off), s.stab(ch, bsec(0.4), 6800), s.human(0.9, 0.08))
    add(stabs, bsec(HOME), s.stab('A', bsec(3.4), 5200), 0.95)

    # Pads: under everything, darker in the pause; the home chord held to the end.
    for b, ch, seg in s.segments(0, HOME):
        dark = 8 <= b < 16
        add(pads, bsec(b), s.pad(ch, bsec(seg), 1100 if dark else 1900), 0.75 if dark else 0.55)
    add(pads, bsec(HOME), s.pad('A', bsec(4), 2000), 0.75)

    # The hook: a pluck per blob as they pop, the tresillo riff in the choruses, home at the end.
    for k, note in enumerate((81, 85, 88, 93)):
        add(lead, fsec(K['viral']['pops'][k]), s.pluck(note, 0.25, 0.8))
    for b0, b1 in CHORUS:
        for b, ch, seg in s.bars(b0, b1):
            for off, note in zip(s.TRESILLO, s.CHORDS[ch]['riff']):
                if off < seg and b + off < b1:
                    short = off in (1.5, 3.5)
                    add(lead, bsec(b + off), s.pluck(note, bsec(0.35 if short else 0.55), s.human(0.85, 0.1)))
    add(lead, bsec(HOME), s.pluck(81, bsec(2.5), 0.9))
    add(lead, bsec(HOME) + 0.04, s.pluck(88, bsec(2.5), 0.6))
    # Two lonely notes in the pause, so it is quiet but not dead.
    add(lead, bsec(10), s.pluck(78, bsec(1.5), 0.45))
    add(lead, bsec(14), s.pluck(73, bsec(1.5), 0.4))

    # FX: the riser into the drop.
    add(fx, bsec(16), s.riser(bsec(4)), 0.34)

    # ----- Sound effects from the cut list -----
    V, P, B, BK, E = (K[x] for x in ('viral', 'pause', 'build', 'back', 'end'))
    for k, f in enumerate(V['pops']):
        add(sfx, fsec(f), s.blip(320 + 60 * k, 900 + 120 * k, 0.1, 0.32))
    # Counter ticks, rising as the numbers climb.
    for a, b in (V['impCount'], (V['routesCount'][0], V['overflow'])):
        tk = a
        while tk < b:
            x = (tk - a) / (b - a)
            add(sfx, fsec(tk), s.tick(1900 + 1300 * x, 0.14))
            tk += 3.75
    add(sfx, fsec(V['impCount'][1]), s.bell(88, 0.24))
    add(sfx, fsec(V['overflow']), s.boing(0.45))
    add(sfx, fsec(V['overflow'] + 2), s.blip(900, 300, 0.2, 0.3))
    add(sfx, bsec(8), power_down(), 0.3)
    # The sign: letters flapping as they flip, a thud when it lands.
    for k in range(8):
        add(sfx, fsec(P['sign'] + 4 + 1.6 * k), s.flap(0.25), pan=-0.2 + 0.05 * k)
    add(sfx, fsec(P['sign'] + 12), s.boom(0.3))
    for k in range(9):
        add(sfx, fsec(BK['flip'] + 1.6 * k), s.flap(0.28), pan=-0.2 + 0.05 * k)
    for k, f in enumerate(BK['cards']):
        add(sfx, fsec(f), s.blip(600 + 120 * k, 950 + 160 * k, 0.1, 0.28))
    add(sfx, fsec(E['night']), s.whoosh(0.4, 300, 5000, 0.3))
    add(sfx, fsec(E['qr']), s.blip(600, 950, 0.09, 0.2))

    # ----- Mix (as the demo's) -----
    side = duck[:, None]
    bass *= 1 - 0.55 * side
    stabs *= 1 - 0.6 * side
    pads *= 1 - 0.7 * side
    lead *= 1 - 0.18 * side
    perc *= 1 - 0.2 * side

    bass = s.lp(s.hp(bass, 45), 3500)
    stabs = s.hp(stabs, 180)
    pads = s.hp(pads, 220)
    lead = s.hp(lead, 250) + 0.5 * s.pingpong(s.hp(lead, 400), bsec(0.75))
    perc = s.hp(perc, 150)

    gains = {'kick': 1.0, 'drums': 2.0, 'perc': 1.0, 'bass': 0.6, 'stabs': 3.6, 'pads': 2.6, 'lead': 0.56, 'fx': 0.7, 'sfx': 2.5}
    m = {k: buses[k] * g for k, g in gains.items() if k not in ('bass', 'stabs', 'pads', 'lead', 'perc')}
    m.update(bass=bass * gains['bass'], stabs=stabs * gains['stabs'], pads=pads * gains['pads'], lead=lead * gains['lead'], perc=perc * gains['perc'])
    room, hall = s.make_ir(0.7, 0.008, 3), s.make_ir(2.3, 0.025, 4)
    wet = s.convolve(s.hp(m['drums'] * 0.1 + m['perc'] * 0.12, 300), room)
    wet += s.convolve(s.hp(m['stabs'] * 0.12 + m['pads'] * 0.2 + m['lead'] * 0.28 + m['fx'] * 0.3 + m['sfx'] * 0.12, 250), hall)

    # The power cut: the band stops dead on beat 8 (only the pads and the reverb ring on).
    silence = np.ones((n, 1))
    silence[s.at(bsec(8)):s.at(bsec(9.5))] = 0
    for k in ('kick', 'drums', 'perc', 'bass', 'stabs', 'lead'):
        m[k] *= silence

    music = sum(v for k, v in m.items() if k != 'sfx') + wet
    peak = np.max(np.abs(music))
    music = s.glue(music / peak, -14, 2.0)
    # The pause sits lower, so the drop lands.
    level = [(0, 0.95), (8, 0.75), (16, 0.85), (20, 1.0), (36, 1.0)]
    beats = np.arange(len(music)) / s.SR / s.BEAT
    music *= np.interp(beats, [b for b, _ in level], [g for _, g in level])[:, None]
    music = s.shelf(s.shelf(music, 90, -2.0, high=False), 5000, 2.5, high=True)
    music = s.bell_eq(music, 3200, 2.0, 0.7)  # presence, for phone speakers
    mix = np.tanh(1.1 * (music + m['sfx'] / peak)) / 1.1
    mix = s.hp(mix, 28)

    mix = mix[:s.at(TOTAL / s.FPS)]
    fade = np.clip((len(mix) - np.arange(len(mix))) / s.at(1.2), 0, 1)
    mix *= fade[:, None]
    return s.limiter(mix / np.max(np.abs(mix)) * 1.4, -1.0)


def report(mix):
    """RMS in dB per second, to check the shape without ears: party, cut, pause, drop, home."""
    sec = s.SR
    for i in range(0, len(mix) // sec):
        x = mix[i * sec:(i + 1) * sec]
        print(f'{i:2d}s {20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9):6.1f} dB')


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'music/raw.wav'
    mix = render()
    wavfile.write(out, s.SR, mix.astype(np.float32))
    if '--report' in sys.argv:
        report(mix)
    print(f'wrote {out}: {len(mix) / s.SR:.2f} s')


if __name__ == '__main__':
    main()
