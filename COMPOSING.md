# Atari 2600 Music Composition Guide

This document is a self-contained reference for composing songs in the Atari Sound Editor's Music format. Read this before writing any music JSON.

---

## JSON Schema

Each song is a single JSON file matching the `AtariSong` type:

```json
{
  "id": "unique-string-001",
  "name": "Song Title",
  "artist": "Game Name OST",
  "tempo": 4,
  "patterns": [ /* MusicPattern[] */ ],
  "arrangement": ["pattern-id-1", "pattern-id-2", "..."]
}
```

Each `MusicPattern`:

```json
{
  "id": "unique-pattern-id",
  "name": "Human-readable name",
  "length": 16,
  "voice0": [ /* (MusicStep | null)[] — length must equal .length */ ],
  "voice1": [ /* (MusicStep | null)[] — length must equal .length */ ]
}
```

`length` must be exactly `8`, `16`, or `32`. Both voice arrays must have **exactly** that many elements.

Each `MusicStep`:

```json
{ "audc": 4, "audf": 25, "audv": 10 }
```

Use `null` (not `{ "audv": 0 }`) for rests/silence.

**`arrangement`** is an ordered list of pattern IDs. The arrangement loops when it reaches the end. Pattern IDs may repeat. The `arrangement` array may reference any pattern any number of times — this is how you build AABA, verse/chorus, etc.

---

## Voice Roles

| Voice | Piano Roll Colour | Typical Use |
|-------|------------------|-------------|
| `voice0` | Green | Bass, kick drums, rhythm, Saw drone |
| `voice1` | Amber | Melody, lead line, high stabs |

These are conventions only — either voice can carry any sound type.

---

## Complete Note Table (Paul Slocum Setup #1)

All valid `{ audc, audf }` pairs. Any other combination is **not** in the note table and will not display correctly in the editor.

### Square — AUDC = 4 (bright, high-pitched square wave)

| Note | audf | MIDI |
|------|------|------|
| F6   | 10   | 89   |
| D6   | 12   | 86   |
| F5   | 21   | 77   |
| E5   | 22   | 76   |
| D5   | 25   | 74   |
| C5   | 28   | 72   |
| B4   | 30   | 71   |

### Lead — AUDC = 12 (warmer square wave, one octave lower)

| Note | audf | MIDI |
|------|------|------|
| Bb4  | 10   | 70   |
| G4   | 12   | 67   |
| Bb3  | 21   | 58   |
| A3   | 22   | 57   |
| G3   | 25   | 55   |
| F3   | 28   | 53   |
| E3   | 30   | 52   |

### Saw — AUDC = 1 (buzzy, wavering — good for drones and texture)

| Note | audf | MIDI |
|------|------|------|
| F#3  | 10   | 54   |
| Eb3  | 12   | 51   |
| F#2  | 21   | 42   |
| Eb2  | 25   | 39   |
| D2   | 27   | 38   |
| C2   | 30   | 36   |

### Bass — AUDC = 6 (fat, low, sawtooth bass)

| Note | audf | MIDI |
|------|------|------|
| B5   | 0    | 83   |
| B4   | 1    | 71   |
| E4   | 2    | 64   |
| B3   | 3    | 59   |
| G3   | 4    | 55   |
| E3   | 5    | 52   |
| B2   | 7    | 47   |
| A2   | 8    | 45   |
| G2   | 9    | 43   |
| E2   | 11   | 40   |
| C2   | 14   | 36   |
| B1   | 15   | 35   |
| A1   | 17   | 33   |
| G1   | 19   | 31   |
| E1   | 23   | 28   |
| D1   | 26   | 26   |
| C1   | 29   | 24   |
| B0   | 31   | 23   |

### Drums — Buzz AUDC = 15

| Sound | audf |
|-------|------|
| Kick  | 30   |
| Snare | 6    |

### Drums — Noise AUDC = 8

| Sound  | audf |
|--------|------|
| HiHat  | 0    |
| Snare  | 8    |

---

## Tempo Reference

`tempo` = frames per step at NTSC 60 fps.

| tempo | Feel | Use for |
|-------|------|---------|
| 2     | Frantic | Jump scares, panic stings |
| 3     | Very fast | Chase, action |
| 4     | Brisk (~120 BPM) | Upbeat overworld, victory |
| 5     | Medium | Adventure, moderate pace |
| 6     | Slow | Dungeon, suspense |
| 7     | Very slow | Title screens, dread |
| 8–9   | Glacial | Ambient, atmosphere |

---

## Sound Character Guide

**Square (AUDC=4):** Bright, cutting, NES-like. Use for lead melodies when you want presence. The limited note range (B4–F6) keeps it in the upper register — good for heroic or urgent themes.

**Lead (AUDC=12):** Warmer, slightly hollow square. Sits below Square. Excellent for melodies that need to feel softer or more melancholic (E3–Bb4 range). Mixing Lead and Square in the same voice line (changing AUDC per step) is fine — use it for wide-range melodies.

**Saw (AUDC=1):** Wavering, buzzy, almost out-of-tune quality. Do not use for clean melody — use it for atmosphere, drones, and texture. The clustered pitches (F#3/Eb3, F#2/Eb2) create inherent dissonance, making Saw ideal for horror, unease, and industrial sounds.

**Bass (AUDC=6):** Deep, round, and fat. The widest range of any sound type (B0–B5, 18 notes). Use for bass lines and root motion. At very low frequencies (B0–E1) it becomes more of a rumble than a pitched note.

**Kick (AUDC=15, audf=30):** Short, punchy attack. The primary rhythmic anchor. Works at `audv` 10–15.

**Snare — Buzz (AUDC=15, audf=6):** Buzzier snap. Good for backbeat (beats 2 and 4).

**HiHat (AUDC=8, audf=0):** Noise-based, metallic. Use sparingly as a groove element between kicks.

**Snare — Noise (AUDC=8, audf=8):** Broader noise burst. Can double with Buzz Snare for a fuller crack.

---

## `audv` (Volume) Guidelines

| Context | audv range |
|---------|-----------|
| Full-volume melody | 10–12 |
| Drums (kick/snare) | 10–15 |
| Background bass | 8–10 |
| Atmosphere / Saw drone | 5–8 |
| Ambient whisper | 4–7 |
| Fading / decay | decrease across steps |
| Max impact (stings) | 15 |

`audv = 0` is silence — use `null` instead.

---

## Scales and Keys That Work Well

Given the available notes, these pitch groupings produce musically coherent results:

**D pentatonic major** (D5, E5, B4, G4, A3) — heroic, adventurous, uplifting. Good for overworld and victory themes.

**A/E minor** (E5, D5, C5, B4, A3, G3, E3) — melancholic, tense. Good for dungeons and suspense.

**Chromatic horror cluster** (Bb3, A3, G3, F3, E3 from Lead + Saw F#3/Eb3) — dissonant, unsettling. Half-step clashes are intentional. Ideal for horror.

**Sparse single-note ambient** — pick 2–3 notes from the same octave (e.g., E3, G3, Bb3) and leave large gaps of silence. The sparseness creates unease.

---

## Rhythmic Patterns

### Standard 4/4 beat (kick on 1 and 3, snare on 2 and 4, 16 steps)

```
Steps:    0    1    2    3    4    5    6    7    8    9    10   11   12   13   14   15
voice0:  Kick  -    -    -   Snare -    -    -   Kick  -    -    -   Snare -    -    -
```
(indices 0, 4, 8, 12 for kick / 4-step snare offset)

In a 16-step pattern at tempo=4, each step is a 16th note. So beats fall on steps 0, 4, 8, 12.

### Driving chase beat (kick every 4 steps, snare on off-beats)

```
Steps:    0    1    2    3    4    5    6    7 ...
voice0:  Kick  -   Bass  -   Kick Snare Bass  -  ...
```

### Horror pulse (very slow, single hits)

```
Steps:    0    1    2    3    4    5    6    7    8 ...
voice0:  Kick  -    -    -    -    -    -    -   Kick ...
```
Single kick every 8 steps at tempo=7 becomes a slow heartbeat.

---

## Song-Type Recipes

### Title / Menu
- Tempo: 7–8
- No drums, or single isolated kick stabs (never rhythmic)
- Saw drone in voice0 at low volume (audv 5–7)
- Lead melody in voice1 with long rests between phrases
- Use chromatic dissonance (Bb3 against A3, F#3 Saw against E3 Lead)
- 3+ patterns; arrangement should be long so it doesn't feel loopy

### Ambient / Exploration
- Tempo: 8–10
- No drums at all
- Very sparse — 3–4 notes per 16-step pattern, rest is silence
- Saw texture in voice0 at audv 4–6
- Multiple patterns (4+) with varied note placements so the loop feels irregular
- Keep audv low throughout (7 max)

### Chase / Action
- Tempo: 3–4
- Relentless kick every 4 steps (or even every 2 for maximum urgency)
- Snare on off-beats
- Melody uses fast repeated notes or chromatic runs (E5/F5 half-step is stressful)
- Bass follows kick rhythm
- 3 patterns minimum — vary intensity (p1 intense, p2 more intense, p3 peak)
- Long arrangement (8–10 entries) so it doesn't feel repetitive under pressure

### Jump Scare / Sting
- Tempo: 2
- Pattern length: 8 steps
- P1: All-channels hit simultaneously at audv 13–15, then decay rapidly over 4–5 steps
  - voice1: high Square note (F6 or D6) at max volume, decaying
  - voice0: Kick + Snare at max volume, decaying
- P2: Near-silence aftermath — single faint note or heartbeat kick
- Arrangement: [p1, p2, p2, p2] — stab once, hold the silence

### Victory / Win
- Tempo: 4–5
- Bright Square melody in upper register (D5, E5 range)
- D pentatonic (D5, E5, B4, G4, A3) is reliably cheerful
- Standard kick/snare groove; add HiHat for extra energy
- Final pattern should be a fast ascending run ending on a strong note
- Arrangement climbs in intensity: intro → main → celebration → flourish → main

### Dungeon / Puzzle
- Tempo: 6
- Minor key: A minor (A3, G3, E3, C5) or E minor (E3, G3, B4)
- Sparse bass on downbeats; kick on beats 3 and 4 only (delayed, anxious feel)
- Occasional tritone stab (Bb3 against E3/A3) for dissonance
- Let patterns breathe — not every step needs a note

---

## Python Composition Template

When writing a composition script, use this helper pattern for clarity and to avoid AUDF mistakes:

```python
import json, os

# Note constructors
def Sq(audf, v=10):  return {"audc": 4,  "audf": audf, "audv": v}  # Square
def Ld(audf, v=10):  return {"audc": 12, "audf": audf, "audv": v}  # Lead
def Sw(audf, v=8):   return {"audc": 1,  "audf": audf, "audv": v}  # Saw
def Bs(audf, v=9):   return {"audc": 6,  "audf": audf, "audv": v}  # Bass
def Kick(v=11):      return {"audc": 15, "audf": 30,   "audv": v}
def Snare(v=10):     return {"audc": 15, "audf": 6,    "audv": v}
def HiHat(v=8):      return {"audc": 8,  "audf": 0,    "audv": v}
def NSnare(v=9):     return {"audc": 8,  "audf": 8,    "audv": v}
R = None  # rest

# Always validate before saving
def pat(id_, name, v0, v1):
    assert len(v0) == len(v1) and len(v0) in (8, 16, 32)
    return {"id": id_, "name": name, "length": len(v0), "voice0": v0, "voice1": v1}
```

---

## Common Mistakes

- **Wrong AUDF value**: Every AUDC has its own AUDF scale. An AUDF that works for Bass (AUDC=6) means something completely different for Square (AUDC=4). Always use the note table above.
- **Voice array length mismatch**: Both `voice0` and `voice1` must be exactly `length` elements. Off-by-one will likely cause silent or broken playback.
- **`audv: 0` instead of `null`**: Use `null` for rests. `audv: 0` is treated differently by the editor.
- **Arrangement referencing a missing pattern ID**: Double-check that every ID in `arrangement` exists in `patterns`.
- **No variation in arrangement**: Using `["p1"]` alone sounds like a broken record. Build at least 2 patterns and vary the arrangement.
- **Drums and bass fighting on voice0**: Kicks and bass share voice0. If you put Kick on every step *and* bass notes on every step, only one plays. Alternate them — kick on the beat, bass on the off-beat, or dedicate every other step.
