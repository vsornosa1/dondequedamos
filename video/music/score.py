"""Original score for the ¿Dónde quedamos? demo: Mediterranean house, 120 BPM, A major.

Synthesised from scratch with numpy and scipy, so it carries no licence
questions. One beat is 15 video frames, so every hit and sound effect is
placed from the film's own cut list (music/cues.json, which
scripts/cues.ts exports from src/timing.ts).

The first score (music/score_rumba.py) imitated acoustic instruments (a
plucked nylon guitar, marimba, whistle) and sounded like a demo. This one
only uses sounds that are synthetic by nature: drum-machine kick, clap and
hats, congas and clave in the 808 manner, a filtered synth bass, wide
detuned chord stabs and pads, and a pluck lead with ping-pong delay. Every
tone is built from its harmonics through a resonant low-pass, so nothing
aliases and the filters can move. It is mixed for phone speakers: the kick
and bass carry harmonics above 150 Hz.

Dramatic reading:

    beats   0-8    hook      a pluck note per blob, then the filtered groove
    beats   8-28   problem   F#m D under the night map, filtered and tense
    beat    28     drop 1    the logo: impact, the filter opens, the hook
    beats  38-62   the app   a lighter groove with clave under the taps
    beats  62-66   loader    drums out, the chords swell, riser and roll
    beat    66     drop 2    the fair place: full chorus with the hook
    beats  86-98   share     the groove carries on, the hook softer
    beats  98-103  payoff    build while they travel
    beats 103-106  arrival   band stop, glasses clink
    beats 106-120  end card  last chorus, home to A, rings out

Harmony: A Amaj9, C#m7, Dmaj9, E6 (I iii IV V) in the choruses, F#m7 and
Dmaj9 under the problem, every build on E. The hook is one rhythm, the
tresillo (3+3+2), repeated over each chord.

Usage: python music/score.py music/raw.wav  (music/master.sh does this)
"""

import json
import sys

import numpy as np
from scipy.io import wavfile
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from scipy.signal import butter, fftconvolve, lfilter, sosfilt

SR = 48000
CUES = json.load(open('music/cues.json', encoding='utf8'))
FPS = CUES['fps']
BEAT = 0.5  # seconds: 120 BPM, 15 frames
K = CUES['K']
T = CUES['T']
LENGTH = CUES['total'] / FPS + 2.0
RNG = np.random.default_rng(23)

# Bass root, the stab voicing (rootless, so the bass names the chord) and the
# six notes of the hook over that chord.
CHORDS = {
    'A': {'bass': 45, 'stab': [61, 64, 68, 71], 'riff': [76, 73, 76, 81, 80, 76]},
    'C#m': {'bass': 37, 'stab': [64, 68, 71, 73], 'riff': [76, 73, 76, 80, 83, 80]},
    'D': {'bass': 38, 'stab': [66, 69, 73, 76], 'riff': [78, 74, 78, 81, 85, 81]},
    'E': {'bass': 40, 'stab': [68, 71, 73, 76], 'riff': [80, 76, 80, 83, 85, 83]},
    'F#m': {'bass': 42, 'stab': [61, 64, 66, 69], 'riff': [78, 73, 78, 81, 80, 78]},
    'Dn': {'bass': 38, 'stab': [61, 64, 66, 69], 'riff': [78, 73, 78, 81, 76, 73]},  # Dmaj9 at night
}

# (start beat, chord): a chord lasts until the next change.
PROGRESSION = [
    (0, 'D'), (4, 'E'),
    (8, 'F#m'), (12, 'Dn'), (16, 'F#m'), (20, 'Dn'), (24, 'E'),
    (28, 'A'), (32, 'C#m'), (36, 'D'),
    (42, 'E'), (46, 'C#m'), (50, 'F#m'), (54, 'D'), (58, 'E'),
    (66, 'A'), (70, 'C#m'), (74, 'D'), (78, 'E'), (82, 'A'),
    (86, 'C#m'), (90, 'D'), (94, 'E'),
    (98, 'F#m'), (100, 'D'), (102, 'E'),
    (106, 'A'), (108, 'C#m'), (110, 'D'), (112, 'E'), (114, 'D'), (115, 'E'), (116, 'A'), (124, None),
]

DROPS = (28, 66, 106)
CHORUS = [(28, 38), (66, 86), (106, 116)]
GROOVE = [(4, 26), (28, 62), (66, 103), (106, 116)]  # where the kick plays
STOP = (103, 106)
TRESILLO = (0.0, 0.75, 1.5, 2.0, 2.75, 3.5)
SWING = 0.035  # beats added to every off 16th


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def at(seconds):
    return int(round(seconds * SR))


def fsec(frame):
    return frame / FPS


def bsec(beat):
    return beat * BEAT


def swung(beat):
    """Push the second and fourth 16th of each beat a little late."""
    sixteenth = round((beat % 1) * 4, 6)
    return beat + (SWING if sixteenth in (1, 3) else 0)


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


def bars(b0, b1):
    """Like segments, but no piece longer than a bar, so one-bar patterns can repeat."""
    out = []
    for b, ch, seg in segments(b0, b1):
        for k in range(0, int(np.ceil(seg)), 4):
            out.append((b + k, ch, min(4, seg - k)))
    return out


def add(bus, start, sound, gain=1.0, pan=0.0):
    """Mix a mono or stereo sound into a stereo bus at `start` seconds."""
    i = at(start)
    if i >= len(bus) or gain == 0 or i < 0:
        return
    if sound.ndim == 1:
        left = np.cos((pan + 1) * np.pi / 4)
        right = np.sin((pan + 1) * np.pi / 4)
        sound = np.stack([sound * left, sound * right], axis=1) * np.sqrt(2)
    end = min(len(bus), i + len(sound))
    bus[i:end] += gain * sound[:end - i]


def human(vel, spread=0.12):
    return vel * (1 + spread * (RNG.random() - 0.5))


# ---------- Oscillators and filters ----------

def lp_gain(f, fc, q):
    x = f / fc
    return 1.0 / np.sqrt((1 - x * x) ** 2 + (x / q) ** 2)


def ladder(f, fc, res):
    """Magnitude of a 24 dB/octave low-pass: a resonant stage and a plain one."""
    return lp_gain(f, fc, res) * lp_gain(f, fc, 0.6)


def osc(f0, t, cutoff, shape='saw', res=0.9, phase=0.0, top=None):
    """A band-limited saw or square through a low-pass, summed from its harmonics.

    f0 and cutoff may be numbers or arrays over t (a glide, a filter envelope)."""
    glide = np.ndim(f0) > 0
    base = 2 * np.pi * np.cumsum(f0) / SR if glide else 2 * np.pi * f0 * t
    f_hi = np.max(f0) if glide else f0
    c_hi = np.max(cutoff)
    limit = min(SR * 0.45, top or SR, c_hi * 6)
    out = np.zeros_like(t)
    k = 1
    while k * f_hi < limit:
        if shape == 'square' and k % 2 == 0:
            k += 1
            continue
        out += ladder(k * f0, cutoff, res) / k * np.sin(k * (base + phase))
        k += 1
    return out


def shelf(x, f0, gain_db, high):
    """RBJ shelving filter: lift or cut everything above (high) or below f0."""
    a_ = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    cw, alpha = np.cos(w0), np.sin(w0) / 2 * np.sqrt(2)
    sq = 2 * np.sqrt(a_) * alpha
    s_ = -1 if high else 1
    b = [a_ * ((a_ + 1) - s_ * (a_ - 1) * cw + sq), 2 * s_ * a_ * ((a_ - 1) - s_ * (a_ + 1) * cw), a_ * ((a_ + 1) - s_ * (a_ - 1) * cw - sq)]
    a = [(a_ + 1) + s_ * (a_ - 1) * cw + sq, -2 * s_ * ((a_ - 1) + s_ * (a_ + 1) * cw), (a_ + 1) + s_ * (a_ - 1) * cw - sq]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)


def bell_eq(x, f0, gain_db, q):
    """RBJ peaking filter."""
    a_ = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    alpha = np.sin(w0) / (2 * q)
    b = [1 + alpha * a_, -2 * np.cos(w0), 1 - alpha * a_]
    a = [1 + alpha / a_, -2 * np.cos(w0), 1 - alpha / a_]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x, axis=0)


def adsr(t, a, d, s, r, gate):
    env = np.where(t < a, t / a, s + (1 - s) * np.exp(-(t - a) / d))
    return env * np.clip(1 - (t - gate) / r, 0, 1)


# ---------- Drums ----------

def kick():
    t = np.arange(at(0.5)) / SR
    freq = 55 + 160 * np.exp(-t / 0.032) + 260 * np.exp(-t / 0.004)  # lands on A1, so its harmonics stay in key
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR)
    body *= np.where(t < 0.04, 1, np.exp(-(t - 0.04) / 0.11))
    body = np.tanh(2.4 * body) / np.tanh(2.4)  # harmonics a phone can play
    knock = np.sin(2 * np.pi * 165 * t) * np.exp(-t / 0.02) * 0.5  # E3
    click = bp(RNG.standard_normal(len(t)), 2500, 9000) * np.exp(-t / 0.0022) * 0.6
    return (body * 0.75 + knock + click) * np.minimum(1, t / 0.0005)


def clap():
    t = np.arange(at(0.6)) / SR
    noise = RNG.standard_normal(len(t))
    bursts = sum(g * np.where(t >= d, np.exp(-(t - d) / 0.0045), 0) for d, g in ((0, 0.8), (0.0085, 0.9), (0.017, 1.0), (0.026, 0.85)))
    tail = np.where(t >= 0.026, np.exp(-(t - 0.026) / 0.12), 0) * 0.6
    return bp(noise, 850, 2700) * (bursts + tail) * 1.6 + bp(noise, 4000, 11000) * (0.3 * bursts + 0.25 * tail)


def snare():
    t = np.arange(at(0.3)) / SR
    freq = 185 * (1 + 0.5 * np.exp(-t / 0.01))
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / 0.05) * 0.6
    tone += np.sin(2 * np.pi * 330 * t) * np.exp(-t / 0.03) * 0.3
    noise = bp(RNG.standard_normal(len(t)), 1800, 9000) * np.exp(-t / 0.09)
    return (tone + noise) * np.minimum(1, t / 0.0008)


METAL = (205.3, 304.4, 369.6, 522.7, 540.0, 800.0)  # the 808's six square waves


def metal(dur, decay, seed):
    t = np.arange(at(dur)) / SR
    rng = np.random.default_rng(seed)
    x = sum(np.sign(np.sin(2 * np.pi * f * 1.7 * t + i * 1.3)) for i, f in enumerate(METAL))
    x = bp(x, 7000, 13000) * 0.35 + bp(rng.standard_normal(len(t)), 8500, 14500) * 0.3
    return x * np.minimum(1, t / 0.0004) * np.exp(-t / decay)


def shaker():
    t = np.arange(at(0.09)) / SR
    env = np.minimum(1, t / 0.012) * np.exp(-t / 0.026)
    return bp(RNG.standard_normal(len(t)), 4500, 11000) * env


def tambourine():
    t = np.arange(at(0.25)) / SR
    jingle = sum(np.sin(2 * np.pi * f * t + i) for i, f in enumerate((6150, 7040, 8360, 9530)))
    noise = bp(RNG.standard_normal(len(t)), 6000, 14000)
    return (0.25 * jingle + noise) * np.minimum(1, t / 0.002) * np.exp(-t / 0.06)


def conga(f0, decay, slap=False):
    t = np.arange(at(0.4)) / SR
    freq = f0 * (1 + 0.3 * np.exp(-t / 0.007))
    tone = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t / decay)
    tone += 0.22 * np.sin(2 * np.pi * np.cumsum(freq * 2.27) / SR) * np.exp(-t / (decay * 0.35))
    if slap:
        tone += bp(RNG.standard_normal(len(t)), 1500, 6000) * np.exp(-t / 0.005) * 0.45
    return tone * np.minimum(1, t / 0.0006)


def clave():
    t = np.arange(at(0.1)) / SR
    tone = np.sin(2 * np.pi * 1660 * t) + 0.25 * np.sin(2 * np.pi * 3320 * t)
    return tone * np.exp(-t / 0.018) * np.minimum(1, t / 0.0004)


def crash(dur=2.4, seed=0):
    """Band-limited noise for the wash, with inharmonic partials that shimmer."""
    t = np.arange(at(dur)) / SR
    rng = np.random.default_rng(seed)
    noise = bp(rng.standard_normal((len(t), 2)), 3500, 13000)
    ring = np.zeros((len(t), 2))
    for i, f in enumerate((3570, 4790, 5930, 7310, 8460, 9820)):
        for ch, beat in ((0, 0.9), (1, 1.3)):
            ring[:, ch] += np.sin(2 * np.pi * (f + beat * (i + 1)) * t + i) * 0.06 * np.exp(-t / (0.9 - 0.08 * i))
    return (noise * np.exp(-t / 0.7)[:, None] + ring) * np.minimum(1, t / 0.003)[:, None]


def reverse_crash(dur):
    x = crash(dur + 0.4, seed=5)[::-1][-at(dur):]
    return x * (np.linspace(0, 1, len(x)) ** 2)[:, None]


# ---------- Tonal instruments ----------

def bass_note(midi, dur, vel=1.0, slide_from=None):
    f = hz(midi)
    t = np.arange(at(dur + 0.05)) / SR
    if slide_from is not None:
        f = hz(midi) + (hz(slide_from) - hz(midi)) * np.exp(-t / 0.03)
    cutoff = 340 + 1500 * vel * np.exp(-t / 0.075)
    saw = osc(f, t, cutoff, 'saw', res=1.5, top=6000)
    sub = np.sin(2 * np.pi * np.cumsum(np.broadcast_to(f, t.shape)) / SR)
    env = np.minimum(1, t / 0.003) * np.clip(1 - (t - dur) / 0.04, 0, 1)
    return vel * np.tanh(1.6 * (1.0 * saw + 0.45 * sub)) * env


_stabs = {}


def stab(chord, dur, cutoff, voices=4, detune=11):
    """Wide detuned saws on the chord's voicing; cached, since they repeat."""
    key = (chord, round(dur, 3), int(cutoff / 50))
    if key in _stabs:
        return _stabs[key]
    t = np.arange(at(dur + 0.2)) / SR
    fc = cutoff * (0.6 + 0.4 * np.exp(-t / 0.05))
    out = np.zeros((len(t), 2))
    rng = np.random.default_rng(len(_stabs))
    for m in CHORDS[chord]['stab']:
        for v in range(voices):
            x = v / (voices - 1) * 2 - 1  # -1..1 across the voices
            s = osc(hz(m) * 2 ** (detune * x / 1200), t, fc, res=1.1, phase=rng.random() * 6.28)
            out[:, 0] += s * np.cos((x * 0.8 + 1) * np.pi / 4)
            out[:, 1] += s * np.sin((x * 0.8 + 1) * np.pi / 4)
    out *= adsr(t, 0.002, 0.09, 0.4, 0.12, dur)[:, None]
    out /= np.sqrt(np.mean(out ** 2)) * 12 + 1e-9
    _stabs[key] = out
    return out


def pad(chord, dur, cutoff=1700):
    t = np.arange(at(dur + 1.0)) / SR
    wobble = cutoff * (1 + 0.18 * np.sin(2 * np.pi * 0.23 * t))
    out = np.zeros((len(t), 2))
    rng = np.random.default_rng(int(dur * 100) + len(chord))
    for m in [CHORDS[chord]['stab'][0] - 12] + CHORDS[chord]['stab']:
        for side, x in ((0, -1), (1, 1), (0, 0.3), (1, -0.3)):
            out[:, side] += osc(hz(m) * 2 ** (7 * x / 1200), t, wobble, res=0.8, phase=rng.random() * 6.28, top=5000)
    env = np.minimum(1, t / 0.45) ** 2 * np.clip(1 - (t - dur) / 1.0, 0, 1)
    out *= env[:, None]
    return out / (np.sqrt(np.mean(out ** 2)) * 12 + 1e-9)


def pluck(midi, dur, vel=1.0):
    """The hook: a bright saw and square with a snappy filter, over a sine."""
    f = hz(midi)
    t = np.arange(at(dur + 0.6)) / SR
    fc = 700 + 6500 * vel * np.exp(-t / 0.085)
    x = 0.6 * osc(f, t, fc, 'saw', res=1.2) + 0.45 * osc(f * 1.004, t, fc, 'square', res=1.2)
    x += 0.35 * np.sin(2 * np.pi * f * t)
    env = np.minimum(1, t / 0.002) * np.exp(-t / 0.32) * np.clip(1 - (t - dur) / 0.12, 0, 1)
    return vel * x * env


# ---------- Effects ----------

def make_ir(rt, pre, seed):
    """A room from noise that dies faster in the highs, with a few early reflections."""
    rng = np.random.default_rng(seed)
    n = at(rt * 1.2)
    t = np.arange(n) / SR
    ir = np.zeros((n, 2))
    for lo, hi, t60 in ((None, 400, rt * 1.1), (400, 1600, rt), (1600, 5000, rt * 0.7), (5000, None, rt * 0.38)):
        noise = rng.standard_normal((n, 2))
        band = lp(noise, hi) if lo is None else hp(noise, lo) if hi is None else bp(noise, lo, hi)
        ir += band * (10 ** (-3 * t / t60))[:, None]
    ir *= np.minimum(1, t / 0.015)[:, None]
    early = np.zeros((at(0.04), 2))
    for d, g, ch in ((0.006, 0.9, 0), (0.0095, 0.8, 1), (0.014, 0.6, 0), (0.019, 0.55, 1), (0.026, 0.4, 0), (0.033, 0.35, 1)):
        early[at(d), ch] = g * np.sqrt(np.mean(ir[:, ch] ** 2)) * 8
    ir[:len(early)] += early
    ir = np.concatenate([np.zeros((at(pre), 2)), ir])
    return ir / np.sqrt((ir ** 2).sum(axis=0))


def convolve(x, ir):
    return np.stack([fftconvolve(x[:, ch], ir[:, ch])[:len(x)] for ch in range(2)], axis=1)


def pingpong(x, delay, fb=0.42, n=6, tone=3800):
    """Echoes that bounce left and right, each a little darker."""
    out = np.zeros_like(x)
    y = x.mean(axis=1)
    d = at(delay)
    for k in range(1, n + 1):
        y = lp(y, tone, 1)
        if k * d >= len(x):
            break
        out[k * d:, k % 2] += fb ** k * y[:len(x) - k * d]
    return out


def glue(x, thr_db=-16.0, ratio=2.0):
    """A gentle bus compressor: RMS detector, smoothed gain."""
    a = 1 - np.exp(-1 / (SR * 0.03))
    level = np.sqrt(lfilter([a], [1, a - 1], np.mean(x ** 2, axis=1)) + 1e-12)
    over = np.maximum(0, 20 * np.log10(level) - thr_db)
    b = 1 - np.exp(-1 / (SR * 0.08))
    gain_db = lfilter([b], [1, b - 1], -over * (1 - 1 / ratio))
    return x * (10 ** (gain_db / 20))[:, None]


def limiter(x, ceiling_db=-1.0, look=0.004, release=0.09):
    ceiling = 10 ** (ceiling_db / 20)
    need = np.minimum(1, ceiling / np.maximum(np.max(np.abs(x), axis=1), 1e-12))
    w = at(look)
    need = uniform_filter1d(minimum_filter1d(need, 2 * w + 1), w)
    a = np.exp(-1 / (SR * release))
    slow = lfilter([1 - a], [1, -a], need, zi=[need[0] * a])[0]
    return x * np.minimum(need, slow)[:, None]


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


def riser(dur, vel=1.0):
    """Noise sweeping up with a saw that climbs an octave under it."""
    t = np.arange(at(dur)) / SR
    x = t / dur
    noise = whoosh(dur, 400, 9000, 1.0) * x ** 1.4 * 1.8
    f = hz(64) * 2 ** x
    saw = osc(f, t, 500 + 6000 * x ** 2, res=1.4) * x ** 2 * 0.5
    return vel * (noise + saw)


def tick(freq=2400, vel=1.0):
    t = np.arange(at(0.03)) / SR
    return vel * np.sin(2 * np.pi * freq * t) * np.exp(-t * 180)


def click(vel=1.0):
    t = np.arange(at(0.03)) / SR
    tone = np.sin(2 * np.pi * 1320 * t) * np.exp(-t * 230)
    noise = bp(RNG.standard_normal(len(t)), 2500, 8000) * np.exp(-t * 500) * 0.5
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
    freq = 40 + 55 * np.exp(-t * 7)
    body = np.sin(2 * np.pi * np.cumsum(freq) / SR) * np.exp(-t * 2.0) * np.minimum(1, t / 0.004)
    return vel * np.tanh(1.8 * body)


# ---------- The arrangement ----------

def render():
    n = at(LENGTH)
    buses = {name: np.zeros((n, 2)) for name in ('kick', 'drums', 'perc', 'bass', 'stabs', 'pads', 'lead', 'fx', 'sfx')}
    drums, perc, bass, stabs, pads, lead, fx, sfx = (buses[k] for k in ('drums', 'perc', 'bass', 'stabs', 'pads', 'lead', 'fx', 'sfx'))
    duck = np.zeros(n)

    k_sound, clap_s, snare_s = kick(), clap(), snare()
    hats_c = [metal(0.12, 0.016, s) for s in range(4)]
    hat_o = metal(0.6, 0.11, 9)
    shake, tamb, clv = shaker(), tambourine(), clave()
    conga_hi, conga_lo, conga_slap = conga(330, 0.09), conga(220, 0.13), conga(330, 0.06, slap=True)
    duck_shape = (1 - np.exp(-np.arange(at(0.45)) / SR / 0.004)) * np.exp(-np.arange(at(0.45)) / SR / 0.12)

    def kick_at(sec, gain=1.0):
        add(buses['kick'], sec, k_sound, gain)
        i = at(sec)
        m = min(n - i, len(duck_shape))
        duck[i:i + m] = np.maximum(duck[i:i + m], duck_shape[:m] * gain)

    # Drums on the beat grid.
    for b in range(0, 120):
        beat = float(b)
        sec = bsec(beat)
        chorus = in_ranges(beat, CHORUS)
        if in_ranges(beat, GROOVE):
            kick_at(sec)
        if b % 2 == 1 and in_ranges(beat, [(9, 26), (29, 62), (67, 103), (107, 116)]):
            add(drums, sec, clap_s, 0.62 if chorus else 0.55, 0.04)
            if chorus:
                add(perc, sec, tamb, 0.35, 0.3)
        if in_ranges(beat, [(4, 26), (28, 62), (66, 103), (106, 116)]):
            # Open hat on the off-beat in the choruses, closed elsewhere; soft 16ths under it.
            if chorus or beat >= 86:
                add(drums, bsec(beat + 0.5), hat_o, 0.3, 0.25)
            else:
                add(drums, bsec(beat + 0.5), hats_c[b % 4], 0.42 if beat >= 8 else 0.25, 0.25)
            if beat >= 8:
                for s in (0.25, 0.75):
                    add(drums, bsec(swung(beat + s)), hats_c[(b + int(s * 4)) % 4], human(0.17), 0.3)
                for s in range(4):
                    add(perc, bsec(swung(beat + s / 4)), shake, human(0.13 * (1.0 if s == 2 else 0.6)), -0.4)

    # Congas through the grooves, clave on the tresillo under the app.
    congas = ((0.25, conga_hi, 0.45), (0.75, conga_slap, 0.75), (1.25, conga_lo, 0.55), (1.5, conga_hi, 0.45),
              (2.25, conga_hi, 0.45), (2.75, conga_slap, 0.75), (3.0, conga_lo, 0.65), (3.5, conga_hi, 0.5))
    for bar in range(0, 30):
        b0 = bar * 4
        for off, s, vel in congas:
            beat = b0 + off
            if in_ranges(beat, [(28, 62), (66, 103), (106, 116)]):
                add(perc, bsec(swung(beat)), s, human(vel * 0.5), 0.35 if s is conga_lo else -0.25)
        for off in TRESILLO:
            beat = b0 + off
            if in_ranges(beat, [(40, 62), (86, 98)]):
                add(perc, bsec(beat), clv, 0.22, 0.15)

    # Builds: snare rolls that thicken, a reversed crash into each drop, crashes on them.
    def roll(b0, b1, gain):
        steps = int((b1 - b0) * 4)
        for s in range(steps):
            x = s / max(1, steps - 1)
            if x < 0.5 and s % 2:
                continue  # eighths first, then sixteenths
            add(drums, bsec(b0) + s * BEAT / 4, snare_s, gain * (0.2 + 0.8 * x ** 1.5), 0.08)
    roll(24, 28, 0.5)
    roll(64, 66, 0.5)
    roll(99, 103, 0.45)
    for b in DROPS:
        add(fx, bsec(b) - bsec(1), reverse_crash(bsec(1)), 0.35)
        add(drums, bsec(b), crash(), 0.22)
        add(fx, bsec(b), boom(), 0.55)
    add(drums, bsec(116), crash(3.0, 2), 0.22)

    # Bass: off-beat eighths with octave pickups in the choruses.
    chorus_bass = ((0.5, 0, 0.32, 1.0), (1.5, 0, 0.32, 1.0), (1.75, 12, 0.18, 0.75), (2.5, 0, 0.32, 1.0), (3.5, 0, 0.3, 1.0), (3.75, 12, 0.18, 0.75))
    plain_bass = ((0.5, 0, 0.36, 0.95), (1.5, 0, 0.36, 0.85), (2.5, 0, 0.36, 0.95), (3.5, 0, 0.36, 0.85))
    for b0, b1 in [(6, 26), (28, 62), (66, 103), (106, 116)]:
        for b, ch, seg in bars(b0, b1):
            root = CHORDS[ch]['bass']
            pattern = chorus_bass if in_ranges(b, CHORUS) or b >= 86 else plain_bass
            for off, step, dur, vel in pattern:
                if off < seg and b + off < b1:
                    add(bass, bsec(swung(b + off)), bass_note(root + step, bsec(dur), human(vel, 0.08)))
    for b, ch, seg in segments(62, 66):  # the loader: one long E that swells into the drop
        add(bass, bsec(b), bass_note(CHORDS[ch]['bass'], bsec(seg) - 0.05, 0.7))
    add(bass, bsec(103), bass_note(CHORDS['E']['bass'], bsec(2.6), 0.85))
    add(bass, bsec(116), bass_note(CHORDS['A']['bass'], bsec(3.5), 0.9))

    # Stabs: the tresillo under the night (filter slowly opening), off-beats in the choruses.
    def cutoff_at(beat):
        if beat < 8:
            return 650 + 500 * beat / 8
        if beat < 24:
            return 1100 + 1300 * (beat - 8) / 16
        if beat < 28:
            return 2400 + 4400 * ((beat - 24) / 4) ** 2
        if 38 <= beat < 62:
            return 2600
        if 86 <= beat < 98:
            return 4200
        if 98 <= beat < 103:
            return 3000 + 3600 * (beat - 98) / 5
        return 6800
    for b, ch, seg in bars(0, 103):
        if in_ranges(b, [(62, 66)]):
            continue
        night = b < 28
        hits = TRESILLO if night else (0.5, 1.5, 2.5, 3.5) if in_ranges(b, CHORUS) or b >= 86 else (0.5, 1.5, 2.5, 3.25, 3.5)
        for off in hits:
            beat = b + off
            if off >= seg or (night and beat >= 26) or (beat < 4 and off > 0):
                continue
            gain = 0.9 if in_ranges(beat, CHORUS) else 0.62 if 38 <= beat < 62 else 0.8
            add(stabs, bsec(beat), stab(ch, bsec(0.4), cutoff_at(beat)), human(gain, 0.08))
    for b, ch, seg in bars(106, 116):
        for off in (0.5, 1.5, 2.5, 3.5):
            if off < seg:
                add(stabs, bsec(b + off), stab(ch, bsec(0.4), 6800), human(0.9, 0.08))
    # The loader: the chord swells with the filter rising, then a held chord on the arrival.
    for k in range(16):
        beat = 62 + k / 4
        add(stabs, bsec(beat), stab('E', bsec(0.2), 900 + 5200 * (k / 15) ** 2), 0.25 + 0.5 * k / 15)
    add(stabs, bsec(103), stab('E', bsec(2.6), 3200), 0.75)
    add(stabs, bsec(116), stab('A', bsec(3.4), 5200), 0.95)

    # Pads: soft and wide under the night and the app, fuller in the choruses.
    for b, ch, seg in segments(0, 116):
        if in_ranges(b, [STOP]):
            continue
        level = 0.5 if b < 28 else 0.35 if 38 <= b < 62 else 0.6
        add(pads, bsec(b), pad(ch, bsec(seg), 1300 if b < 28 else 1900), level)
    add(pads, bsec(103), pad('E', bsec(3), 1500), 0.7)
    add(pads, bsec(116), pad('A', bsec(4), 2000), 0.75)

    # The hook: one note per blob as they pop, then the tresillo riff in the choruses.
    for k, note in enumerate((81, 85, 88, 93)):
        add(lead, fsec(K['hook']['pops'][k]), pluck(note, 0.25, 0.8))
    for b0, b1 in CHORUS + [(86, 98)]:
        soft = b0 == 86
        for b, ch, seg in bars(b0, b1):
            for off, note in zip(TRESILLO, CHORDS[ch]['riff']):
                if off < seg and not (soft and off in (2.0, 3.5)):
                    short = off in (1.5, 3.5)  # the notes before the 2 of 3+3+2
                    add(lead, bsec(b + off), pluck(note, bsec(0.35 if short else 0.55), human(0.6 if soft else 0.85, 0.1)))
    add(lead, bsec(116), pluck(81, bsec(2.5), 0.9))
    add(lead, bsec(116) + 0.04, pluck(88, bsec(2.5), 0.6))

    # FX: risers into each drop and the arrival, a fall after the night.
    add(fx, bsec(24), riser(bsec(4)), 0.32)
    add(fx, fsec(K['loader']['start']), riser(bsec(66) - fsec(K['loader']['start'])), 0.36)
    add(fx, bsec(99), riser(bsec(4)), 0.28)

    # ----- Sound effects from the cut list -----
    P, L, PE, PL, R, SH, PO, E = (K[x] for x in ('problem', 'logo', 'people', 'plan', 'result', 'share', 'payoff', 'end'))
    for k, f in enumerate(K['hook']['pops']):
        add(sfx, fsec(f), blip(320 + 60 * k, 900 + 120 * k, 0.1, 0.32))
    add(sfx, fsec(K['hook']['exit']), whoosh(0.5, 300, 3000, 0.35))
    add(sfx, fsec(P['pin']), blip(520, 170, 0.18, 0.5))
    # Counter ticks while the lines draw, rising as Yania's keeps going.
    yania_end = P['lines'] + 9 + 54 * P['perMin']
    tk = P['lines']
    while tk < yania_end:
        x = (tk - P['lines']) / (yania_end - P['lines'])
        add(sfx, fsec(tk), tick(1900 + 1300 * x, 0.16))
        tk += 3.75
    add(sfx, fsec(yania_end), boing(0.42))
    add(sfx, fsec(P['retract']), whoosh(0.7, 4000, 250, 0.24, up=False))
    add(sfx, fsec(L['fly'] + 2), whoosh(0.6, 250, 2500, 0.3))
    for k, f in enumerate(PE['rows']):
        add(sfx, fsec(f), blip(420 + 80 * k, 680 + 120 * k, 0.09, 0.28))
    for f in (PE['tap'], PE['mode'], PE['pick'], PL['canas'], PL['cenar'], PL['later'], PL['day'], PL['time'], PL['search'], SH['tap']):
        add(sfx, fsec(f), click(0.36))
    add(sfx, fsec(PE['sheet']), whoosh(0.35, 400, 2600, 0.22))
    add(sfx, fsec(PE['close']), whoosh(0.35, 2600, 400, 0.2, up=False))
    for k in range(5):
        add(sfx, fsec(PE['name'] + 3 * k), key_click(0.24))
    for k in range(6):
        add(sfx, fsec(PE['type'] + 3 * k), key_click(0.24))
    add(sfx, fsec(PE['suggest']), blip(700, 950, 0.07, 0.18))
    add(sfx, fsec(PL['canas']), blip(500, 800, 0.1, 0.2))
    add(sfx, fsec(PL['cenar']), blip(600, 950, 0.1, 0.24))
    add(sfx, fsec(R['ding']), bell(88, 0.3))
    add(sfx, fsec(R['ding']) + 0.12, bell(93, 0.26))
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
    add(sfx, fsec(PO['arrive']), boom(0.5))
    add(sfx, fsec(PO['cheers']), clink(0.34))
    add(sfx, fsec(PO['cheers'] + 6), clink(0.28), pan=0.15)
    add(sfx, fsec(E['wipe']), whoosh(0.4, 300, 5000, 0.3))
    add(sfx, fsec(E['qr']), blip(600, 950, 0.09, 0.2))

    # ----- Mix -----
    side = duck[:, None]
    bass *= 1 - 0.55 * side
    stabs *= 1 - 0.6 * side
    pads *= 1 - 0.7 * side
    lead *= 1 - 0.18 * side
    perc *= 1 - 0.2 * side

    bass = lp(hp(bass, 45), 3500)
    stabs = hp(stabs, 180)
    pads = hp(pads, 220)
    lead = hp(lead, 250) + 0.5 * pingpong(hp(lead, 400), bsec(0.75))
    perc = hp(perc, 150)

    # Levels set from the --report numbers (RMS in the second chorus): kick -15 dB,
    # bass -17, stabs and lead -21, pads -26, claps and hats -25, percussion -29; the UI
    # sounds sit where they did in the first score (their peaks 9 dB under the music).
    gains = {'kick': 1.0, 'drums': 2.0, 'perc': 1.0, 'bass': 0.6, 'stabs': 3.6, 'pads': 2.6, 'lead': 0.56, 'fx': 0.7, 'sfx': 2.5}
    m = {k: buses[k] * g for k, g in gains.items() if k not in ('bass', 'stabs', 'pads', 'lead', 'perc')}
    m.update(bass=bass * gains['bass'], stabs=stabs * gains['stabs'], pads=pads * gains['pads'], lead=lead * gains['lead'], perc=perc * gains['perc'])
    room, hall = make_ir(0.7, 0.008, 3), make_ir(2.3, 0.025, 4)
    wet = convolve(hp(m['drums'] * 0.1 + m['perc'] * 0.12, 300), room)
    wet += convolve(hp(m['stabs'] * 0.12 + m['pads'] * 0.2 + m['lead'] * 0.28 + m['fx'] * 0.3 + m['sfx'] * 0.12, 250), hall)

    music = sum(v for k, v in m.items() if k != 'sfx') + wet
    peak = np.max(np.abs(music))
    music = glue(music / peak, -14, 2.0)
    # The verses sit a couple of dB under the drops, so the drops land.
    level = [(0, 1.0), (8, 0.8), (24, 0.8), (28, 1.0), (38, 0.8), (62, 0.8), (66, 1.0), (86, 0.9), (98, 0.9), (103, 1.0)]
    beats = np.arange(len(music)) / SR / BEAT
    ride = np.interp(beats, [b for b, _ in level], [g for _, g in level])
    steps = {8, 38, 86}  # cuts that change level at once (smoothed over a 16th)
    for b in steps:
        i = at(bsec(b))
        w = at(bsec(0.25))
        before = dict(level)[[x for x, _ in level if x < b][-1]]
        ride[max(0, i - w):i] = np.linspace(before, ride[i], min(w, i))
    music *= ride[:, None]
    music = shelf(shelf(music, 90, -2.0, high=False), 5000, 2.5, high=True)
    music = bell_eq(music, 3200, 2.0, 0.7)  # presence, for phone speakers
    mix = np.tanh(1.1 * (music + m['sfx'] / peak)) / 1.1
    mix = hp(mix, 28)

    mix = mix[:at(CUES['total'] / FPS)]
    fade = np.clip((len(mix) - np.arange(len(mix))) / at(1.6), 0, 1)
    mix *= fade[:, None]
    mix = limiter(mix / np.max(np.abs(mix)) * 1.4, -1.0)
    stems = {**{k: m[k] for k in ('kick', 'drums', 'perc', 'bass', 'stabs', 'pads', 'lead', 'fx')}, 'wet': wet, 'sfx': m['sfx']}
    return mix, {k: v / peak for k, v in stems.items()}


def report(mix, stems):
    """RMS in dB of the mix and of each stem, per section, to balance the mix without ears."""
    parts = {'night': (8, 24), 'drop1': (28, 38), 'app': (38, 62), 'drop2': (66, 86), 'share': (86, 98), 'end': (106, 116)}
    db = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
    print('section   ' + ' '.join(f'{k:>6}' for k in ['mix', *stems]))
    for name, (b0, b1) in parts.items():
        i, j = at(bsec(b0)), at(bsec(b1))
        print(f'{name:9} ' + ' '.join(f'{db(x[i:j]):6.1f}' for x in [mix, *stems.values()]))


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else 'music/raw.wav'
    mix, stems = render()
    wavfile.write(out, SR, mix.astype(np.float32))
    if '--report' in sys.argv:
        report(mix, stems)
    if '--stems' in sys.argv:
        for name, s in stems.items():
            s = s[:len(mix)]
            wavfile.write(f'music/stem-{name}.wav', SR, (s / (np.max(np.abs(s)) + 1e-9) * 0.9).astype(np.float32))
    print(f'wrote {out}: {len(mix) / SR:.2f} s')


if __name__ == '__main__':
    main()
