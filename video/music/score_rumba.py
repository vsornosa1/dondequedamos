"""First score for the ¿Dónde quedamos? demo (rumba): upbeat, 120 BPM, A major.

Kept as the alternative to music/score.py. Render it with
`sh music/master.sh score_rumba.py public/music-rumba.wav`.

Synthesised from scratch with numpy and scipy, so it carries no licence
questions. One beat is 15 video frames, so every hit and sound effect is
placed from the film's own cut list (music/cues.json, which
scripts/cues.ts exports from src/timing.ts).

Dramatic reading: a cheeky question, then the unfair midpoint (a comic
"boing" when Yania's counter stops at 54), the drop on the logo, a light
groove under the app, a held breath while it calculates, the full chorus on
the fair place, a band stop when everyone arrives (glasses clink), and the
end card resolving home.

    beats   0-8    hook       a marimba note per blob, then guitar and claps
    beats   8-28   problem    F#m D A E, full groove, counter ticks, riser
    beat    28     drop 1     impact, chorus A E F#m with the marimba hook
    beats  38-62   the app    lighter groove under taps and typing
    beats  62-66   loader     drums out, muted guitar and a riser on E
    beat    66     drop 2     ding, full chorus with hook
    beats  98-106  payoff     build, band stop on arrival, clinks
    beats 106-120  end card   last chorus with whistle, final A rings out

Instruments: Karplus-Strong nylon guitar strumming a rumba pattern, a pluck
bass bouncing in octaves, four-on-the-floor kick, claps, hats, shaker,
marimba, whistle and a soft pad, all sidechained to the kick.

Usage: python music/score_rumba.py music/raw.wav  (music/master.sh does this)
"""

import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 48000
CUES = json.load(open('music/cues.json', encoding='utf8'))
FPS = CUES['fps']
BEAT = 0.5  # seconds: 120 BPM, 15 frames
K = CUES['K']
T = CUES['T']
LENGTH = CUES['total'] / FPS + 2.0
RNG = np.random.default_rng(11)

CHORDS = {
    'A': {'root': 45, 'gtr': [45, 52, 57, 61, 64]},
    'E': {'root': 40, 'gtr': [40, 47, 52, 56, 59, 64]},
    'F#m': {'root': 42, 'gtr': [42, 49, 54, 57, 61, 66]},
    'D': {'root': 38, 'gtr': [50, 57, 62, 66]},
}
PAD = {'A': [57, 61, 64, 69], 'E': [56, 59, 64, 68], 'F#m': [57, 61, 66, 69], 'D': [57, 62, 66, 69]}

# (start beat, chord) changes; a chord lasts until the next change.
PROGRESSION = [
    (0, None), (4, 'A'),
    (8, 'F#m'), (12, 'D'), (16, 'A'), (20, 'E'),
    (28, 'A'), (32, 'E'), (36, 'F#m'),
    (38, 'D'), (42, 'A'), (46, 'E'), (50, 'F#m'), (54, 'D'), (58, 'E'),
    (66, 'A'), (70, 'E'), (74, 'F#m'), (78, 'D'), (82, 'A'), (86, 'E'), (90, 'F#m'), (94, 'D'),
    (98, 'F#m'), (100, 'D'), (102, 'E'),
    (106, 'A'), (110, 'E'), (112, 'D'), (114, 'E'), (116, 'A'), (124, None),
]

CHORUS = [(28, 38), (66, 98), (106, 112)]
STOP = (103, 106)  # band stop when the four arrive


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def at(seconds):
    return int(round(seconds * SR))


def fsec(frame):
    return frame / FPS


def bsec(beat):
    return beat * BEAT


def sos(kind, freq, order=2):
    return butter(order, freq, btype=kind, fs=SR, output='sos')


def hp(x, f, order=2):
    return sosfilt(sos('high', f, order), x, axis=0)


def lp(x, f, order=2):
    return sosfilt(sos('low', f, order), x, axis=0)


def bp(x, lo, hi, order=2):
    return sosfilt(sos('band', [lo, hi], order), x, axis=0)


def chord_at(beat):
    name = None
    for start, ch in PROGRESSION:
        if start <= beat + 1e-6:
            name = ch
    return name


def in_ranges(beat, ranges):
    return any(a <= beat < b for a, b in ranges)


def segments(b0, b1):
    """(start, chord, length) pieces of [b0, b1), split at chord changes."""
    cuts = sorted({b0, b1} | {s for s, _ in PROGRESSION if b0 < s < b1})
    return [(a, chord_at(a), b - a) for a, b in zip(cuts, cuts[1:]) if chord_at(a)]


def add(bus, start, sound, gain=1.0, pan=0.0):
    """Mix a mono or stereo sound into a stereo bus at `start` seconds."""
    i = at(start)
    if i >= len(bus) or gain == 0:
        return
    if sound.ndim == 1:
        left = np.cos((pan + 1) * np.pi / 4)
        right = np.sin((pan + 1) * np.pi / 4)
        sound = np.stack([sound * left, sound * right], axis=1) * np.sqrt(2)
    end = min(len(bus), i + len(sound))
    bus[i:end] += gain * sound[:end - i]


# ---------- Drums ----------

def kick():
    t = np.arange(at(0.42)) / SR
    freq = 56 + 130 * np.exp(-t * 30)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 9)
    punch = np.sin(2 * np.pi * 125 * t) * np.exp(-t * 38) * 0.35
    click = hp(RNG.standard_normal(len(t)), 2500) * np.exp(-t * 450) * 0.3
    return (0.8 * body + punch + click) * np.minimum(1, t / 0.0015)


def clap():
    t = np.arange(at(0.32)) / SR
    env = np.zeros_like(t)
    for d in (0.0, 0.010, 0.021):
        env += np.where(t >= d, np.exp(-(t - d) * 190), 0)
    env += np.where(t >= 0.021, np.exp(-(t - 0.021) * 24) * 0.45, 0)
    return bp(RNG.standard_normal(len(t)), 900, 3400) * env


def hat(open_=False):
    t = np.arange(at(0.32 if open_ else 0.07)) / SR
    noise = hp(RNG.standard_normal(len(t)), 7500, 3)
    return noise * np.exp(-t * (11 if open_ else 75))


def shaker():
    t = np.arange(at(0.09)) / SR
    env = np.minimum(1, t / 0.012) * np.exp(-t * 38)
    return bp(RNG.standard_normal(len(t)), 4500, 11000) * env


def snare():
    t = np.arange(at(0.22)) / SR
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30) * 0.5
    noise = bp(RNG.standard_normal(len(t)), 1500, 8000) * np.exp(-t * 22)
    return tone + noise


def crash():
    t = np.arange(at(2.2)) / SR
    noise = hp(RNG.standard_normal((len(t), 2)), 4000, 2)
    return noise * np.exp(-t * 2.4)[:, None] * np.minimum(1, t / 0.004)[:, None]


# ---------- Tonal instruments ----------

def bass_note(midi, dur, vel=1.0):
    f = hz(midi)
    t = np.arange(at(dur + 0.08)) / SR
    tone = 0.75 * np.sin(2 * np.pi * f * t)
    for k in range(2, 9):
        if k * f > 3500:
            break
        tone += (0.55 / k) * np.sin(2 * np.pi * k * f * t) * np.exp(-t * (4 + 4.5 * k))
    env = np.minimum(1, t / 0.004) * np.clip(1 - (t - dur) / 0.08, 0, 1) * (0.65 + 0.35 * np.exp(-t * 9))
    return vel * tone * env


def pluck(midi, dur, vel=1.0, mute=False, bright=0.55, seed=0):
    """Karplus-Strong nylon string, tuned with an allpass in the loop."""
    f = hz(midi)
    n = at(dur + (0.04 if mute else 1.4))
    period = SR / f
    delay = int(np.floor(period - 0.6))
    frac = period - 0.5 - delay
    coef = (1 - frac) / (1 + frac)
    t60 = 0.07 if mute else (2.6 if midi < 50 else 1.9 if midi < 60 else 1.3)
    gain = 10 ** (-3 / (t60 * f))
    rng = np.random.default_rng(seed)
    burst = lp(rng.uniform(-1, 1, delay), 1200 + 6000 * bright, 1)
    burst -= np.roll(burst, int(delay * 0.2)) * 0.5  # plucked a fifth along the string
    x = np.zeros(n)
    x[:delay] = burst
    a = np.zeros(delay + 3)
    a[0], a[1] = 1.0, coef
    a[delay] -= 0.5 * gain * coef
    a[delay + 1] -= 0.5 * gain * (1 + coef)
    a[delay + 2] -= 0.5 * gain
    y = lfilter([1.0, coef], a, x)
    t = np.arange(n) / SR
    rel = 0.03 if mute else 0.22
    return vel * y * np.clip(1 - (t - dur) / rel, 0, 1)


def strum(bus, start, chord, kind, vel=1.0, seed=0):
    """kind: 'down' (all strings), 'up' (top four), 'chuck' (muted slap)."""
    notes = CHORDS[chord]['gtr']
    if kind == 'chuck':
        for k, m in enumerate(notes):
            add(bus, start + k * 0.004, pluck(m, 0.05, 0.5 * vel, mute=True, seed=seed + k))
        t = np.arange(at(0.05)) / SR
        add(bus, start, bp(RNG.standard_normal(len(t)), 700, 2600) * np.exp(-t * 90) * 0.5 * vel)
        return
    order = notes if kind == 'down' else notes[::-1][:4]
    space = 0.011 if kind == 'down' else 0.008
    for k, m in enumerate(order):
        v = vel * (1.0 if kind == 'down' else 0.6) * (0.85 + 0.15 * (k / max(1, len(order) - 1)))
        add(bus, start + k * space, pluck(m, BEAT * 0.9, v, bright=0.5 if kind == 'down' else 0.65, seed=seed + 31 * k))


def marimba(midi, vel=1.0):
    f = hz(midi)
    t = np.arange(at(1.4)) / SR
    tone = np.sin(2 * np.pi * f * t) * np.exp(-t * 3.4)
    tone += 0.32 * np.sin(2 * np.pi * 3.93 * f * t) * np.exp(-t * 15)
    if 9.2 * f < 18000:
        tone += 0.1 * np.sin(2 * np.pi * 9.2 * f * t) * np.exp(-t * 34)
    click = bp(RNG.standard_normal(len(t)), 2000, 7000) * np.exp(-t * 700) * 0.12
    return vel * (tone * np.minimum(1, t / 0.0015) + click)


def whistle(midi, dur, vel=1.0):
    f0 = hz(midi)
    t = np.arange(at(dur + 0.12)) / SR
    vib = 1 + 0.007 * np.sin(2 * np.pi * 5.4 * t) * np.clip((t - 0.15) / 0.25, 0, 1)
    scoop = 1 - 0.03 * np.exp(-t * 40)
    phase = 2 * np.pi * np.cumsum(f0 * vib * scoop) / SR
    tone = np.sin(phase) + 0.06 * np.sin(2 * phase)
    breath = bp(RNG.standard_normal(len(t)), f0 * 0.9, min(f0 * 1.8, 20000)) * 0.08
    env = np.minimum(1, t / 0.05) * np.clip(1 - (t - dur) / 0.1, 0, 1)
    return vel * (tone + breath) * env


def pad(midis, dur, gain):
    t = np.arange(at(dur + 1.2)) / SR
    out = np.zeros((len(t), 2))
    for midi in midis:
        base = hz(midi)
        for side, sign in ((0, -1), (1, 1)):
            for d in (-1, 0, 1):
                f0 = base * (1 + sign * d * 0.004)
                phase = np.random.default_rng(midi * 7 + d + side).random()
                for n in range(1, 8):
                    if n * f0 > 5000:
                        break
                    out[:, side] += np.exp(-n / 2.6) / n * np.sin(2 * np.pi * (n * f0 * t + phase * n))
    env = (np.minimum(1, t / 0.6) ** 2) * np.clip(1 - (t - dur) / 1.2, 0, 1)
    rms = np.sqrt(np.mean(out ** 2))
    return gain * 0.1 * out * env[:, None] / rms


# ---------- Sound effects ----------

def blip(f_start, f_end, dur, vel=1.0):
    t = np.arange(at(dur)) / SR
    freq = f_end + (f_start - f_end) * np.exp(-t * 6 / dur)
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    return vel * tone * np.minimum(1, t / 0.003) * np.exp(-t * 5 / dur)


def whoosh(dur, lo=300, hi=4000, vel=1.0, up=True):
    n = at(dur)
    t = np.arange(n) / SR
    noise = RNG.standard_normal(n)
    out = np.zeros(n)
    steps = 24
    for k in range(steps):
        a, b = k * n // steps, (k + 1) * n // steps
        x = k / (steps - 1)
        c = lo * (hi / lo) ** (x if up else 1 - x)
        seg = bp(noise[max(0, a - 2000):b], c * 0.7, min(c * 1.4, 20000))
        out[a:b] = seg[-(b - a):]
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 2
    return vel * out * env


def tick(freq=2400, vel=1.0):
    t = np.arange(at(0.03)) / SR
    return vel * np.sin(2 * np.pi * freq * t) * np.exp(-t * 180)


def click(vel=1.0):
    t = np.arange(at(0.025)) / SR
    tone = np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 260)
    noise = hp(RNG.standard_normal(len(t)), 3000) * np.exp(-t * 600) * 0.4
    return vel * (tone + noise)


def key_click(vel=1.0):
    t = np.arange(at(0.02)) / SR
    return vel * bp(RNG.standard_normal(len(t)), 2500, 9000) * np.exp(-t * 500)


def bell(midi, vel=1.0):
    f = hz(midi)
    t = np.arange(at(2.0)) / SR
    tone = np.zeros_like(t)
    for ratio, amp, dec in ((1, 1, 2.2), (2.0, 0.5, 3.0), (3.01, 0.28, 4.5), (4.2, 0.18, 6), (5.43, 0.1, 8)):
        tone += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dec)
    return vel * tone * np.minimum(1, t / 0.002)


def boing(vel=1.0):
    t = np.arange(at(0.55)) / SR
    freq = 520 * (0.48 + 0.52 * np.exp(-t * 5)) * (1 + 0.04 * np.sin(2 * np.pi * 11 * t))
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    tone += 0.3 * np.sin(4 * np.pi * np.cumsum(freq) / SR)
    return vel * tone * np.minimum(1, t / 0.01) * np.exp(-t * 4.5)


def flap(vel=1.0):
    t = np.arange(at(0.018)) / SR
    return vel * bp(RNG.standard_normal(len(t)), 1200, 5000) * np.exp(-t * 400)


def clink(vel=1.0):
    t = np.arange(at(0.9)) / SR
    tone = np.zeros_like(t)
    for f, amp, dec in ((2793, 1, 7), (4123, 0.7, 9), (5610, 0.45, 12), (7380, 0.3, 15), (3312, 0.4, 10)):
        tone += amp * np.sin(2 * np.pi * f * t) * np.exp(-t * dec)
    return vel * tone * np.minimum(1, t / 0.0008)


def boom(vel=1.0):
    t = np.arange(at(1.6)) / SR
    freq = 42 + 40 * np.exp(-t * 8)
    return vel * np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 2.2) * np.minimum(1, t / 0.004)


def riser(dur, vel=1.0):
    n = at(dur)
    t = np.arange(n) / SR
    return whoosh(dur, 400, 6000, vel) * (t / dur)[: n] ** 1.5 * 1.8


# ---------- The arrangement ----------

def render():
    n = at(LENGTH)
    drums = np.zeros((n, 2))
    bass = np.zeros((n, 2))
    gtr = np.zeros((n, 2))
    keys = np.zeros((n, 2))
    lead = np.zeros((n, 2))
    pads = np.zeros((n, 2))
    sfx = np.zeros((n, 2))
    kick_env = np.zeros(n)

    k_sound, clap_s, snare_s = kick(), clap(), snare()
    hat_c, hat_o, shake = hat(False), hat(True), shaker()

    def kick_at(sec, gain=1.0):
        add(drums, sec, k_sound, gain)
        i = at(sec)
        m = min(n - i, at(0.3))
        kick_env[i:i + m] = np.maximum(kick_env[i:i + m], np.exp(-np.arange(m) / SR * 14))

    # Drums, on the global beat grid (every section starts on an even beat).
    for b in range(0, 124):
        beat = float(b)
        sec = bsec(beat)
        if beat >= 118 or in_ranges(beat, [STOP]):
            continue
        groove = beat >= 8 and not (26 <= beat < 28) and not (62 <= beat < 66)
        if beat in (4, 6) or groove:
            kick_at(sec, 1.0)
        if b % 2 == 1 and (5 <= b < 26 or 29 <= b < 62 or 67 <= b < 103 or 107 <= b < 118):
            add(drums, sec, clap_s, 0.72, 0.05)
        if beat >= 8 and not in_ranges(beat, [(62, 66)]):
            chorus = in_ranges(beat, CHORUS)
            add(drums, sec + BEAT / 2, hat_o if chorus else hat_c, 0.22 if chorus else 0.26, 0.3)
        if beat >= 4:
            for s in range(4):
                accent = 1.0 if s == 2 else 0.55
                add(drums, sec + s * BEAT / 4, shake, 0.1 * accent * (0.6 if 62 <= beat < 66 else 1), -0.35)

    # Snare builds into the drops and the arrival.
    def roll(b0, b1, gain):
        steps = int((b1 - b0) * 4)
        for s in range(steps):
            x = s / max(1, steps - 1)
            add(drums, bsec(b0) + s * BEAT / 4, snare_s, gain * (0.25 + 0.75 * x ** 1.6), 0.1)
    roll(24, 28, 0.42)
    roll(62, 66, 0.42)
    roll(100, 103, 0.36)
    for b in (28, 66, 103, 106):
        add(drums, bsec(b), crash(), 0.22)
    add(drums, bsec(116), crash(), 0.26)

    # Bass: octave bounce in the choruses, driving eighths elsewhere.
    for b in range(4, 118):
        beat = float(b)
        ch = chord_at(beat)
        if ch is None or in_ranges(beat, [STOP]) or 26 <= beat < 28:
            continue
        root = CHORDS[ch]['root']
        if 62 <= beat < 66:
            add(bass, bsec(beat), bass_note(root, BEAT * 0.9, 0.7))
            continue
        if in_ranges(beat, CHORUS) or beat >= 106:
            add(bass, bsec(beat), bass_note(root, 0.2, 1.0))
            add(bass, bsec(beat + 0.5), bass_note(root + 12, 0.18, 0.75))
        else:
            add(bass, bsec(beat), bass_note(root, 0.22, 0.95))
            add(bass, bsec(beat + 0.5), bass_note(root, 0.18, 0.6 if beat >= 8 else 0.0))
    add(bass, bsec(103), bass_note(CHORDS['E']['root'], 1.2, 1.0))
    add(bass, bsec(116), bass_note(CHORDS['A']['root'], 2.5, 1.0))

    # Guitar: rumba strum, D u chuck u D u chuck u, the chucks on the claps.
    pattern = ['down', 'up', 'chuck', 'up', 'down', 'up', 'chuck', 'up']
    for b in range(4, 116):
        beat = float(b)
        ch = chord_at(beat)
        if ch is None or in_ranges(beat, [STOP]):
            continue
        if 26 <= beat < 28:
            if beat == 26:
                strum(gtr, bsec(26), ch, 'down', 1.0, seed=b)
            continue
        if 62 <= beat < 66:
            for s in range(4):
                strum(gtr, bsec(beat) + s * BEAT / 4, ch, 'chuck', 0.4 + 0.15 * s + 0.12 * (beat - 62), seed=b * 4 + s)
            continue
        vel = 0.85 if 38 <= beat < 62 else 0.95
        for half in range(2):
            kind = pattern[(b % 2) * 2 + half]  # chucks land on the odd beats, with the claps
            strum(gtr, bsec(beat + half * 0.5), ch, kind, vel * (1.0 if half == 0 else 0.85), seed=b * 2 + half)
    strum(gtr, bsec(103), 'E', 'down', 1.1, seed=903)
    strum(gtr, bsec(116), 'A', 'down', 1.15, seed=916)

    # Marimba: the blobs' notes, then the hook in the choruses.
    for k, note in enumerate((69, 73, 76, 81)):
        add(keys, fsec(K['hook']['pops'][k]), marimba(note, 0.9))
    for k, note in enumerate((69, 73, 76, 81)):
        add(keys, fsec(K['payoff']['travel'] - 10 + k * 3), marimba(note, 0.55))
    hook = {
        'A': [(0, 76), (0.5, 76), (1, 73), (1.5, 76), (2, 81), (3.5, 78)],
        'E': [(0, 76), (0.5, 76), (1, 71), (1.5, 76), (2, 80), (3.5, 78)],
        'F#m': [(0, 78), (0.5, 78), (1, 73), (1.5, 78), (2, 81), (3, 80), (3.5, 78)],
        'D': [(0, 78), (0.5, 76), (1, 74), (1.5, 76), (2, 78), (3, 76), (3.5, 73)],
    }
    for b0, b1 in CHORUS:
        for b, ch, seg in segments(b0, b1):
            for off, note in hook[ch]:
                if off < seg:
                    add(keys, bsec(b + off), marimba(note, 0.62 if off in (0, 2) else 0.48))
    # A run up into the last chord, then the chord itself rolled.
    for b, note in ((112, 78), (112.5, 81), (113, 86), (113.5, 81), (114, 80), (114.5, 83), (115, 88), (115.5, 83)):
        add(keys, bsec(b), marimba(note, 0.5))
    for k, note in enumerate((81, 85, 88, 93)):
        add(keys, bsec(116) + 0.03 * k, marimba(note, 0.6))

    # Whistle on the last chorus: long, consonant notes over the chords.
    for b, note, dur in ((106, 85, 3.5), (110, 83, 1.8), (112, 81, 1.8), (114, 80, 1.8), (116, 81, 3.5)):
        add(lead, bsec(b), whistle(note, bsec(dur), 0.5))

    # Pad under the choruses and the end.
    for b0, b1 in CHORUS + [(112, 120)]:
        for b, ch, seg in segments(b0, b1):
            add(pads, bsec(b), pad(PAD[ch], bsec(seg), 1.0))

    # ----- Sound effects from the cut list -----
    P, L, PE, PL, R, SH, PO, E = (K[x] for x in ('problem', 'logo', 'people', 'plan', 'result', 'share', 'payoff', 'end'))
    for k, f in enumerate(K['hook']['pops']):
        add(sfx, fsec(f), blip(320 + 60 * k, 900 + 120 * k, 0.12, 0.5))
    add(sfx, fsec(K['hook']['exit']), whoosh(0.5, 300, 3000, 0.35))
    add(sfx, fsec(P['pin']), blip(520, 170, 0.18, 0.5))
    # Counter ticks while the lines draw, rising as Yania's keeps going.
    yania_end = P['lines'] + 9 + 54 * P['perMin']
    tk = P['lines']
    while tk < yania_end:
        x = (tk - P['lines']) / (yania_end - P['lines'])
        add(sfx, fsec(tk), tick(1900 + 1300 * x, 0.18))
        tk += 3.75
    add(sfx, fsec(yania_end), boing(0.4))
    add(sfx, bsec(24), riser(bsec(4), 0.26))
    add(sfx, fsec(P['retract']), whoosh(0.7, 4000, 250, 0.22, up=False))
    add(sfx, fsec(L['burst']), boom(0.9))
    add(sfx, fsec(L['fly'] + 2), whoosh(0.6, 250, 2500, 0.3))
    for k, f in enumerate(PE['rows']):
        add(sfx, fsec(f), blip(420 + 80 * k, 680 + 120 * k, 0.09, 0.28))
    for f in (PE['tap'], PE['mode'], PE['pick'], PL['canas'], PL['cenar'], PL['later'], PL['day'], PL['time'], PL['search'], SH['tap']):
        add(sfx, fsec(f), click(0.32))
    add(sfx, fsec(PE['sheet']), whoosh(0.35, 400, 2600, 0.22))
    add(sfx, fsec(PE['close']), whoosh(0.35, 2600, 400, 0.2, up=False))
    for k in range(5):
        add(sfx, fsec(PE['name'] + 3 * k), key_click(0.22))
    for k in range(6):
        add(sfx, fsec(PE['type'] + 3 * k), key_click(0.22))
    add(sfx, fsec(PE['suggest']), blip(700, 950, 0.07, 0.18))
    add(sfx, fsec(PL['canas']), blip(500, 800, 0.1, 0.22))
    add(sfx, fsec(PL['cenar']), blip(600, 950, 0.1, 0.22))
    add(sfx, fsec(K['loader']['start']), riser(bsec(66) - fsec(K['loader']['start']), 0.32))
    add(sfx, fsec(R['sign']), boom(0.6))
    add(sfx, fsec(R['ding']), bell(88, 0.32))
    add(sfx, fsec(R['ding']) + 0.12, bell(93, 0.28))
    for k in range(11):
        add(sfx, fsec(R['sign'] + 6 + 1.1 * k), flap(0.25), pan=-0.2 + 0.04 * k)
    for k in range(4):
        add(sfx, fsec(R['lines'] + 5 * k), whoosh(0.22, 800 + 300 * k, 4000, 0.12))
    add(sfx, fsec(R['lines'] + 28), blip(600, 900, 0.1, 0.25))
    add(sfx, fsec(SH['chat']), whoosh(0.4, 500, 3000, 0.22))
    add(sfx, fsec(SH['sent']), whoosh(0.25, 1200, 6000, 0.22))
    add(sfx, fsec(SH['sent']) + 0.12, blip(700, 1100, 0.08, 0.25))
    for k, f in enumerate(SH['replies']):
        add(sfx, fsec(f), blip(560 + 140 * k, 980 + 160 * k, 0.1, 0.3))
    add(sfx, fsec(PO['map']), whoosh(0.6, 3000, 300, 0.25, up=False))
    add(sfx, fsec(PO['map'] + 10), blip(520, 170, 0.18, 0.45))
    add(sfx, fsec(PO['arrive']), boom(0.55))
    add(sfx, fsec(PO['cheers']), clink(0.32))
    add(sfx, fsec(PO['cheers'] + 6), clink(0.26), pan=0.15)
    add(sfx, fsec(E['wipe']), whoosh(0.4, 300, 5000, 0.3))
    add(sfx, fsec(T['end']['from']), boom(0.7))
    add(sfx, fsec(E['qr']), blip(600, 950, 0.09, 0.2))

    # Sidechain: the music breathes with the kick.
    bass *= 1 - 0.35 * kick_env[:, None]
    gtr *= 1 - 0.22 * kick_env[:, None]
    pads *= 1 - 0.55 * kick_env[:, None]
    keys *= 1 - 0.12 * kick_env[:, None]

    # Nylon body: a little warmth low, softer top. Slight stereo spread by delay.
    gtr = gtr + 0.35 * bp(gtr, 110, 380)
    gtr = lp(gtr, 6500)
    spread = at(0.011)
    gtr[spread:, 1] = 0.85 * gtr[spread:, 1] + 0.35 * gtr[:-spread, 0]

    bass = lp(bass, 2200)

    music = drums * 0.9 + bass * 0.42 + gtr * 0.8 + keys * 0.4 + lead * 0.26 + pads * 0.45
    mix = music + sfx * 0.9
    wet = reverb(hp(drums * 0.12 + gtr * 0.25 + keys * 0.35 + lead * 0.4 + pads * 0.3 + sfx * 0.25, 250))
    mix = mix + wet

    mix = mix[:at(CUES['total'] / FPS)]
    fade = np.clip((len(mix) - np.arange(len(mix))) / at(1.6), 0, 1)
    mix *= fade[:, None]
    mix = np.tanh(mix / np.max(np.abs(mix)) * 1.6) / np.tanh(1.6)
    return mix * 0.9, {'drums': drums * 0.9, 'bass': bass * 0.42, 'gtr': gtr * 0.8, 'keys': keys * 0.4, 'lead': lead * 0.26, 'pads': pads * 0.45, 'sfx': sfx * 0.9}


def reverb(x, seconds=1.5, decay=0.45):
    n = at(seconds)
    t = np.arange(n) / SR
    ir = RNG.standard_normal((n, 2)) * np.exp(-t / decay)[:, None]
    ir = lp(ir, 6000, 1)
    ir /= np.sqrt((ir ** 2).sum(axis=0))
    out = np.zeros_like(x)
    for ch in range(2):
        out[:, ch] = fftconvolve(x[:, ch], ir[:, ch])[:len(x)]
    return out


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'music/raw.wav'
    mix, stems = render()
    wavfile.write(out, SR, mix.astype(np.float32))
    if '--stems' in sys.argv:
        for name, s in stems.items():
            s = s[:len(mix)]
            wavfile.write(f'music/stem-{name}.wav', SR, (s / (np.max(np.abs(s)) + 1e-9) * 0.9).astype(np.float32))
    print(f'wrote {out}: {len(mix) / SR:.2f} s')


if __name__ == '__main__':
    main()
