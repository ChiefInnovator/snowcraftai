#!/usr/bin/env python3
"""Synthesize the game's sound effects from scratch (oscillators, noise, envelopes).

No audio files are read. Python 3 stdlib only. Output is deterministic (fixed seed).

    python3 -I tools/sfx/generate_sfx.py        # from repo root

Writes 22050 Hz / 16-bit / mono WAVs to src/assets/sfx/.
"""

import math
import os
import random
import struct
import wave

SR = 22050
PEAK = 10 ** (-1.0 / 20.0)  # -1 dBFS
TAU = 2.0 * math.pi
SEED = 20261108

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "src", "assets", "sfx")


# --------------------------------------------------------------------------- basics

def n_samples(sec):
    return int(round(sec * SR))


def silence(sec):
    return [0.0] * n_samples(sec)


def mix_into(dst, src, at_sec=0.0, gain=1.0):
    off = n_samples(at_sec)
    for i, v in enumerate(src):
        j = off + i
        if j >= len(dst):
            break
        dst[j] += v * gain
    return dst


def mul(sig, env):
    return [a * b for a, b in zip(sig, env)]


def scale(sig, g):
    return [v * g for v in sig]


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


# --------------------------------------------------------------------------- envelopes

def env_ad(sec, attack, decay_tau, hold=0.0):
    """Linear attack, optional hold, exponential decay (time constant decay_tau)."""
    out = []
    for i in range(n_samples(sec)):
        t = i / SR
        if t < attack:
            out.append(t / attack)
        elif t < attack + hold:
            out.append(1.0)
        else:
            out.append(math.exp(-(t - attack - hold) / decay_tau))
    return out


def env_hump(sec, peak_at, power=1.0):
    """Smooth rise to peak_at (fraction of length) then fall to zero."""
    n = n_samples(sec)
    out = []
    for i in range(n):
        x = i / max(1, n - 1)
        if x < peak_at:
            v = math.sin(0.5 * math.pi * x / peak_at)
        else:
            v = math.cos(0.5 * math.pi * (x - peak_at) / (1.0 - peak_at))
        out.append(max(0.0, v) ** power)
    return out


def glide_exp(f0, f1, sec):
    """Per-sample frequency list, exponential glide f0 -> f1."""
    n = n_samples(sec)
    return [f0 * (f1 / f0) ** (i / max(1, n - 1)) for i in range(n)]


# --------------------------------------------------------------------------- oscillators

def _poly_blep(t, dt):
    if t < dt:
        t /= dt
        return t + t - t * t - 1.0
    if t > 1.0 - dt:
        t = (t - 1.0) / dt
        return t * t + t + t + 1.0
    return 0.0


def osc(freqs, shape="sine", phase=0.0):
    """Oscillator driven by a per-sample frequency list."""
    out = []
    ph = phase
    for f in freqs:
        dt = f / SR
        if shape == "sine":
            v = math.sin(TAU * ph)
        elif shape == "tri":
            v = 4.0 * abs(ph - 0.5) - 1.0
        elif shape == "square":
            v = 1.0 if ph < 0.5 else -1.0
            v += _poly_blep(ph, dt)
            v -= _poly_blep((ph + 0.5) % 1.0, dt)
        elif shape == "saw":
            v = 2.0 * ph - 1.0
            v -= _poly_blep(ph, dt)
        else:
            raise ValueError(shape)
        out.append(v)
        ph = (ph + dt) % 1.0
    return out


def const(f, sec):
    return [f] * n_samples(sec)


def vibrato(freqs, rate, cents, delay=0.0):
    out = []
    for i, f in enumerate(freqs):
        t = i / SR
        depth = 0.0 if t < delay else min(1.0, (t - delay) / 0.08)
        out.append(f * 2 ** (depth * cents * math.sin(TAU * rate * t) / 1200.0))
    return out


def fm_bell(freq, sec, ratio=3.5, index=3.0, index_tau=0.15, amp_tau=0.35):
    """Two-operator FM with decaying modulation index (bright attack, mellow tail)."""
    out = []
    for i in range(n_samples(sec)):
        t = i / SR
        idx = index * math.exp(-t / index_tau)
        m = math.sin(TAU * freq * ratio * t)
        a = min(1.0, t / 0.003) * math.exp(-t / amp_tau)
        out.append(a * math.sin(TAU * freq * t + idx * m))
    return out


def noise(sec, rng):
    return [rng.uniform(-1.0, 1.0) for _ in range(n_samples(sec))]


# --------------------------------------------------------------------------- filters

def svf(sig, cutoffs, q=0.707, mode="band"):
    """Topology-preserving state-variable filter; cutoffs is a float or per-sample list."""
    k = 1.0 / q
    ic1 = ic2 = 0.0
    out = []
    per_sample = isinstance(cutoffs, list)
    fc = cutoffs
    for i, x in enumerate(sig):
        if per_sample:
            fc = cutoffs[min(i, len(cutoffs) - 1)]
        fc = min(max(fc, 20.0), SR * 0.45)
        g = math.tan(math.pi * fc / SR)
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == "low":
            out.append(v2)
        elif mode == "band":
            out.append(v1)
        elif mode == "high":
            out.append(x - k * v1 - v2)
        else:
            raise ValueError(mode)
    return out


def tiny_room(sig, mix=0.18):
    """Small Schroeder-style room (3 combs + 1 allpass), for musical cues only."""
    combs = [(int(SR * d), fb) for d, fb in ((0.0297, 0.62), (0.0371, 0.58), (0.0411, 0.55))]
    wet = [0.0] * len(sig)
    for delay, fb in combs:
        buf = [0.0] * delay
        p = 0
        for i, x in enumerate(sig):
            y = buf[p]
            buf[p] = x + y * fb
            p = (p + 1) % delay
            wet[i] += y / len(combs)
    d = int(SR * 0.005)
    buf = [0.0] * d
    p = 0
    g = 0.5
    ap = []
    for x in wet:
        b = buf[p]
        y = -g * x + b
        buf[p] = x + g * y
        p = (p + 1) % d
        ap.append(y)
    return [a + mix * b for a, b in zip(sig, ap)]


# --------------------------------------------------------------------------- building blocks

def snow_crunch(sec, rng, grains, center=2600.0, q=1.1, grain_ms=(3.0, 9.0), decay_tau=None):
    """Granular snow crunch: many tiny filtered noise bursts at random times."""
    buf = silence(sec)
    for _ in range(grains):
        start = rng.uniform(0.0, sec * 0.8)
        if decay_tau is not None:
            # bias grains toward the start
            start = min(start, -decay_tau * math.log(1.0 - rng.random() * 0.98))
        glen = rng.uniform(*grain_ms) / 1000.0
        amp = rng.uniform(0.4, 1.0)
        g = noise(glen, rng)
        g = mul(g, env_ad(glen, 0.0005, glen / 3.0))
        mix_into(buf, scale(g, amp), start)
    buf = svf(buf, center, q=q, mode="band")
    if decay_tau is not None:
        buf = mul(buf, env_ad(sec, 0.001, decay_tau))
    return buf


def thump(sec, f0, f1, tau, rng=None, click=0.0):
    """Muffled body thump: sine with fast downward pitch drop, optional soft click."""
    freqs = glide_exp(f0, f1, min(sec, tau * 2.5)) + const(f1, max(0.0, sec - tau * 2.5))
    body = mul(osc(freqs[: n_samples(sec)], "sine"), env_ad(sec, 0.002, tau))
    if click and rng is not None:
        c = svf(noise(0.012, rng), 900.0, q=0.8, mode="low")
        c = mul(c, env_ad(0.012, 0.0005, 0.003))
        mix_into(body, c, 0.0, click)
    return body


def note(freq, sec, shape="tri", attack=0.005, decay_tau=0.25, hold=0.0, vib=None, lp=None):
    freqs = const(freq, sec)
    if vib:
        freqs = vibrato(freqs, *vib)
    s = osc(freqs, shape)
    if lp:
        s = svf(s, lp, q=0.707, mode="low")
    return mul(s, env_ad(sec, attack, decay_tau, hold))


# --------------------------------------------------------------------------- the sounds

def sfx_throw(rng):
    d = 0.18
    centers = glide_exp(700.0, 2600.0, d)
    w = svf(noise(d, rng), centers, q=1.6, mode="band")
    w = mul(w, env_hump(d, 0.35, 1.4))
    # faint low air layer for body
    air = svf(noise(d, rng), 500.0, q=0.7, mode="low")
    air = mul(air, env_hump(d, 0.3, 2.0))
    return mix_into(w, air, 0.0, 0.35)


def sfx_throw_full(rng):
    d = 0.35
    centers = glide_exp(450.0, 3300.0, d)
    a = svf(noise(d, rng), centers, q=2.0, mode="band")
    b = svf(noise(d, rng), [c * 1.5 for c in centers], q=2.5, mode="band")
    w = [x + 0.6 * y for x, y in zip(a, b)]
    w = mul(w, env_hump(d, 0.45, 1.2))
    air = svf(noise(d, rng), glide_exp(250.0, 700.0, d), q=0.7, mode="low")
    air = mul(air, env_hump(d, 0.4, 1.5))
    return mix_into(w, air, 0.0, 0.6)


def sfx_hit(rng):
    d = 0.2
    out = thump(d, 150.0, 55.0, 0.045, rng, click=0.5)
    crunch = snow_crunch(d, rng, grains=55, center=2300.0, q=0.9, decay_tau=0.05)
    mix_into(out, crunch, 0.002, 0.9)
    # soft "poof" of powder
    poof = svf(noise(d, rng), glide_exp(1800.0, 600.0, d), q=0.8, mode="low")
    mix_into(out, mul(poof, env_ad(d, 0.003, 0.04)), 0.0, 0.35)
    return out


def sfx_splat(rng):
    d = 0.12
    out = snow_crunch(d, rng, grains=28, center=2900.0, q=1.0, grain_ms=(2.0, 6.0), decay_tau=0.03)
    mix_into(out, thump(d, 110.0, 60.0, 0.02), 0.0, 0.25)
    return out


def sfx_knockdown(rng):
    d = 0.4
    out = thump(d, 170.0, 48.0, 0.07, rng, click=0.6)
    crunch = snow_crunch(0.15, rng, grains=30, center=2000.0, q=0.9, decay_tau=0.04)
    mix_into(out, crunch, 0.0, 0.6)
    # descending bonk: triangle + quieter sine an octave below-ish, quick pitch fall
    bonk_d = 0.32
    f = glide_exp(560.0, 250.0, bonk_d)
    bonk = [0.7 * a + 0.5 * b for a, b in zip(osc(f, "tri"), osc([x * 0.5 for x in f], "sine"))]
    bonk = mul(bonk, env_ad(bonk_d, 0.003, 0.09))
    mix_into(out, bonk, 0.045, 0.8)
    return out


def sfx_green_out(rng):
    d = 0.6
    base = glide_exp(1500.0, 330.0, d)
    f = vibrato(base, 6.5, 35.0, delay=0.05)
    tone = osc(f, "sine")
    tone2 = osc([x * 2 for x in f], "sine")
    s = [a + 0.12 * b for a, b in zip(tone, tone2)]
    breath = svf(noise(d, rng), f, q=6.0, mode="band")
    s = [a + 0.25 * b for a, b in zip(s, breath)]
    env = env_ad(d, 0.02, 1.0, hold=0.4)
    tail = [1.0 if i < n_samples(0.45) else max(0.0, 1.0 - (i - n_samples(0.45)) / n_samples(0.15))
            for i in range(n_samples(d))]
    return mul(mul(s, env), tail)


def sfx_red_daze(rng):
    d = 0.8
    out = silence(d)
    chirps = [(0.00, 2300.0, 3500.0), (0.19, 2600.0, 3900.0), (0.38, 2200.0, 3300.0), (0.57, 2700.0, 4100.0)]
    for at, lo, hi in chirps:
        cd = 0.13
        n = n_samples(cd)
        f = []
        for i in range(n):
            x = i / (n - 1)
            # quick rise, slower fall back to just above start: a little "tweet"
            if x < 0.3:
                shape = math.sin(0.5 * math.pi * x / 0.3)
            else:
                shape = 1.0 - 0.7 * (x - 0.3) / 0.7
            f.append(lo + (hi - lo) * shape)
        f = vibrato(f, 38.0, 60.0)
        c = mul(osc(f, "sine"), env_hump(cd, 0.2, 1.3))
        mix_into(out, c, at, 0.8)
    return out


def sfx_red_out(rng):
    d = 0.8
    out = silence(d)

    def wah(freqs, sec, cut0, cut1):
        sq_a = osc([x * 2 ** (7 / 1200) for x in freqs], "square")
        sq_b = osc([x * 2 ** (-7 / 1200) for x in freqs], "square", phase=0.3)
        tri = osc(freqs, "tri")
        s = [0.35 * a + 0.35 * b + 0.5 * c for a, b, c in zip(sq_a, sq_b, tri)]
        s = svf(s, glide_exp(cut0, cut1, sec), q=2.2, mode="low")
        return s

    # note 1: short, steady
    d1 = 0.3
    f1 = vibrato(const(311.0, d1), 5.5, 18.0, delay=0.08)
    n1 = mul(wah(f1, d1, 450.0, 1600.0), env_ad(d1, 0.02, 0.4, hold=0.18))
    mix_into(out, n1, 0.0)
    # note 2: lower, sags downward with wider vibrato and closing filter
    d2 = 0.5
    f2 = vibrato(glide_exp(262.0, 220.0, d2), 5.0, 40.0, delay=0.1)
    n2 = wah(f2, d2, 1800.0, 380.0)
    n2 = mul(n2, env_ad(d2, 0.03, 0.25, hold=0.15))
    mix_into(out, n2, 0.3)
    return out


def sfx_deny(rng):
    d = 0.15
    out = silence(d)
    for at, f in ((0.0, 1760.0), (0.075, 1480.0)):
        bd = 0.055
        b = osc(const(f, bd), "square")
        b = svf(b, 3500.0, q=0.707, mode="low")
        b = mul(b, env_ad(bd, 0.002, 0.018, hold=0.012))
        mix_into(out, b, at, 0.7)
    return out


def sfx_step(rng):
    d = 0.08
    out = snow_crunch(d, rng, grains=14, center=1700.0, q=0.8, grain_ms=(3.0, 8.0), decay_tau=0.025)
    mix_into(out, thump(d, 90.0, 60.0, 0.015), 0.0, 0.3)
    return out


def sfx_cheer(rng):
    d = 1.0
    out = silence(d)
    # zig-zag climb through a major pentatonic, staccato, with a pitch "bounce" on each onset
    seq = [72, 76, 74, 79, 76, 81, 79, 84]
    step = 0.085
    for i, m in enumerate(seq):
        f = midi(m)
        nd = 0.11
        n = n_samples(nd)
        freqs = [f * (1.0 + 0.06 * math.exp(-k / (0.012 * SR))) for k in range(n)]
        s = [0.6 * a + 0.4 * b for a, b in zip(osc(freqs, "square"), osc(freqs, "tri"))]
        s = svf(s, 2800.0, q=0.9, mode="low")
        s = mul(s, env_ad(nd, 0.003, 0.05))
        mix_into(out, s, i * step, 0.55)
    # final cheeky wobble on the top note
    at = len(seq) * step
    ld = d - at
    f = vibrato(const(midi(84), ld), 9.0, 45.0, delay=0.04)
    s = [0.5 * a + 0.5 * b for a, b in zip(osc(f, "square"), osc(f, "tri"))]
    s = svf(s, 2600.0, q=0.9, mode="low")
    s = mul(s, env_ad(ld, 0.004, 0.12, hold=0.1))
    mix_into(out, s, at, 0.55)
    return tiny_room(out, 0.12)


def sfx_level_clear(rng):
    d = 1.2
    out = silence(d)
    # D major: D5 F#5 A5 E5 -> D6 (held, with A5 under it)
    seq = [(0.00, 74), (0.11, 78), (0.22, 81), (0.33, 76)]
    for at, m in seq:
        mix_into(out, fm_bell(midi(m), 0.5, ratio=2.0, index=2.2, index_tau=0.06, amp_tau=0.18), at, 0.45)
        mix_into(out, note(midi(m), 0.3, "tri", decay_tau=0.1), at, 0.25)
    at = 0.46
    mix_into(out, fm_bell(midi(86), d - at, ratio=2.0, index=2.5, index_tau=0.1, amp_tau=0.35), at, 0.55)
    mix_into(out, fm_bell(midi(81), d - at, ratio=2.0, index=1.5, index_tau=0.1, amp_tau=0.35), at, 0.3)
    mix_into(out, note(midi(86), d - at, "tri", decay_tau=0.3, vib=(5.5, 10.0, 0.15)), at, 0.25)
    return tiny_room(out, 0.2)


def sfx_victory(rng):
    d = 2.5
    out = silence(d)

    def brass(freq, sec, gain=1.0):
        f = vibrato(const(freq, sec), 5.2, 12.0, delay=0.12)
        a = osc(f, "saw")
        b = osc([x * 1.004 for x in f], "saw", phase=0.4)
        s = [0.5 * (x + y) for x, y in zip(a, b)]
        n = n_samples(sec)
        cut = [600.0 + 2600.0 * min(1.0, i / (0.04 * SR)) * (0.6 + 0.4 * math.exp(-i / (0.2 * SR)))
               for i in range(n)]
        s = svf(s, cut, q=0.9, mode="low")
        rel = min(0.06, sec * 0.3)
        env = [min(1.0, (i / SR) / 0.015) * min(1.0, (sec - i / SR) / rel) for i in range(n)]
        return scale(mul(s, env), gain)

    def drum(sec=0.35):
        return thump(sec, 120.0, 52.0, 0.09)

    # original fanfare in F major
    mel = [
        (0.00, 0.13, 72), (0.15, 0.13, 72), (0.30, 0.28, 77),
        (0.60, 0.13, 76), (0.75, 0.13, 77), (0.90, 0.28, 79),
        (1.20, 1.15, 81),
    ]
    for at, nd, m in mel:
        mix_into(out, brass(midi(m), nd), at, 0.45)
    # harmony pad under the long note: F4 A4 C5
    for m in (65, 69, 72):
        mix_into(out, brass(midi(m), 1.15, 0.5), 1.2, 0.3)
    # bass hits on the strong beats
    for at in (0.0, 0.30, 0.90, 1.20):
        mix_into(out, drum(), at, 0.7)
    mix_into(out, thump(0.12, 160.0, 90.0, 0.03), 1.05, 0.4)
    mix_into(out, thump(0.12, 160.0, 90.0, 0.03), 1.12, 0.4)
    # sparkle: rising bell arpeggio over the held chord
    for i, m in enumerate((89, 93, 96, 101, 96, 101)):
        mix_into(out, fm_bell(midi(m), 0.6, ratio=3.0, index=1.8, index_tau=0.05, amp_tau=0.2),
                 1.32 + i * 0.09, 0.18)
    # tail: fade the whole thing over the last 0.3 s
    n = len(out)
    fade_n = n_samples(0.3)
    for i in range(n - fade_n, n):
        out[i] *= (n - i) / fade_n
    return tiny_room(out, 0.2)


def sfx_level_start(rng):
    d = 0.6
    out = silence(d)
    # rising fourth: A5 -> D6, soft bell + sine
    for at, m, g in ((0.0, 81, 0.5), (0.16, 86, 0.6)):
        f = midi(m)
        mix_into(out, fm_bell(f, d - at, ratio=3.0, index=1.2, index_tau=0.05, amp_tau=0.22), at, g)
        mix_into(out, note(f, d - at, "sine", attack=0.004, decay_tau=0.25), at, g * 0.6)
    return tiny_room(out, 0.15)


SOUNDS = [
    ("throw", sfx_throw),
    ("throw_full", sfx_throw_full),
    ("hit", sfx_hit),
    ("splat", sfx_splat),
    ("knockdown", sfx_knockdown),
    ("green_out", sfx_green_out),
    ("red_daze", sfx_red_daze),
    ("red_out", sfx_red_out),
    ("deny", sfx_deny),
    ("step", sfx_step),
    ("cheer", sfx_cheer),
    ("level_clear", sfx_level_clear),
    ("victory", sfx_victory),
    ("level_start", sfx_level_start),
]


# --------------------------------------------------------------------------- output

def finalize(sig, fade_in=0.002, fade_out=0.015):
    sig = list(sig)
    # remove DC offset
    mean = sum(sig) / len(sig)
    sig = [v - mean for v in sig]
    n = len(sig)
    fi = max(1, n_samples(fade_in))
    fo = max(1, n_samples(fade_out))
    for i in range(min(fi, n)):
        sig[i] *= i / fi
    for i in range(min(fo, n)):
        sig[n - 1 - i] *= i / fo
    peak = max(abs(v) for v in sig) or 1.0
    return [v * PEAK / peak for v in sig]


def write_wav(path, sig):
    frames = b"".join(struct.pack("<h", max(-32767, min(32767, int(round(v * 32767))))) for v in sig)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(frames)


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for name, fn in SOUNDS:
        rng = random.Random(f"{SEED}-{name}")  # per-sound seed: editing one sound won't change others
        sig = finalize(fn(rng))
        path = os.path.join(OUT_DIR, name + ".wav")
        write_wav(path, sig)
        print(f"{name:12s} {len(sig) / SR:5.3f}s  {os.path.getsize(path):6d} B")


if __name__ == "__main__":
    main()
