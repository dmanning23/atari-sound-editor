# Atari 2600 Sound Editor

A browser-based audio tool for the Atari 2600 TIA chip. Design sound effects and compose music visually, preview them in real time, and export ready-to-use 6502 assembly for your game.

---

## Running the editor

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Two editors in one

The app has two tabs:

| Tab | Theme | Purpose |
|-----|-------|---------|
| **♪ Sound Effects** | Light | Design per-frame TIA sound effects, preview via WASM, export `SoundEngine.asm` |
| **♫ Music** | Dark | Compose two-voice music with a piano roll, export `MusicEngine.asm` |

Both engines can run simultaneously in the same game — the music engine automatically yields a TIA channel to a sound effect while it plays, then resumes.

---

## Sound Effects Editor

### Game name

The game name at the top of the page is used as the prefix for all exported symbols. Set it before you start designing sounds so the exported identifiers match your project.

### Sound effects

Each sound effect is an ordered list of **tones**. The sound engine plays one tone per video frame (1/60 s on NTSC), stepping through them in sequence until the list is exhausted.

**To add a sound effect**, click **Add Sound Effect** at the bottom of the page.

**To add a tone**, expand a sound effect and click **Add Tone**. New tones copy their values from the previous tone so you can iterate quickly.

**To preview a sound**, click **Play** on the sound effect card. The status badge in the header shows whether the audio engine is ready (green), connecting (amber), or disconnected (red — click it to reconnect).

**To collapse/expand** a sound effect card, click the chevron (▶/▼) on the left of its header. Use **Collapse all / Expand all** in the toolbar to manage long projects.

### Tone parameters

Each tone controls three TIA registers for one frame:

| Parameter | Range | TIA register | Description |
|-----------|-------|-------------|-------------|
| **Control** | 0 – 15 | `AUDC0` / `AUDC1` | Waveform / sound type. 0 = silence, 4/5 = pure tone, 7/8 = white noise, 12–14 = electronic buzzes. See the [TIA sound reference](http://www.alienbill.com/2600/101/docs/stella.html#sound) for all values. |
| **Volume** | 0 – 15 | `AUDV0` / `AUDV1` | Loudness. 0 = silent, 15 = maximum. |
| **Frequency** | 0 – 31 | `AUDF0` / `AUDF1` | Pitch divisor. Higher values produce lower pitches. |

Drag the sliders to adjust values. The number on the right of each slider shows the current value.

### Saving and loading projects

- **Save** — downloads a `.json` file containing all sound effects for the current game.
- **Load** — opens a previously saved `.json` file and restores all sound effects.

Project files are plain JSON and safe to keep alongside your game source.

### Exporting to assembly

Click **Export** to download a `-sfx.asm` file. This file contains:

- `SFX_ID_*` constants (one per sound effect)
- `SFX_*_LENGTH` constants for reference
- The packed sound data tables
- The complete sound engine (`SFX_OFF`, `SFX_TRIGGER`, `SFX_UPDATE`)

---

## Music Editor

The music editor uses a GB Studio-style piano roll to compose two-voice music using the Paul Slocum Setup #1 note table.

### Song properties

- **Name / Artist** — embedded in the exported assembly as comments.
- **Tempo** — frames per step at NTSC 60fps (e.g. tempo=4 ≈ 120 BPM with 16-step patterns). Lower = faster.

### Patterns

Each pattern has a fixed length (8, 16, or 32 steps) and two voices:

- **Voice 0** (green) — typically bass, kick drums, and rhythm.
- **Voice 1** (amber) — typically melody and lead lines.

Click a cell to toggle a note on the active voice. Select a step to see its properties (note, AUDC, AUDF, volume) in the right panel.

### Song arrangement

The arrangement is an ordered list of patterns that plays from top to bottom, then loops. Patterns can appear multiple times — this is how you build verse/chorus structures.

### Available sounds (Paul Slocum Setup #1)

| Type | AUDC | Notes available |
|------|------|----------------|
| Square | 4 | F6 D6 F5 E5 D5 C5 B4 |
| Lead | 12 | Bb4 G4 Bb3 A3 G3 F3 E3 |
| Saw | 1 | F#3 Eb3 F#2 Eb2 D2 C2 |
| Bass | 6 | B5 through B0 (18 notes) |
| Kick | 15 | audf=30 |
| Snare (Buzz) | 15 | audf=6 |
| HiHat | 8 | audf=0 |
| Snare (Noise) | 8 | audf=8 |

### Saving and loading songs

- **Save** — downloads a `.json` file for the current song.
- **Load** — opens a previously saved song `.json`.

See [COMPOSING.md](COMPOSING.md) for the full JSON schema and composition guide.

### Exporting to assembly

Click **Export** to download a `-music.asm` file. This file contains:

- `MUSIC_TEMPO` and `MUSIC_NUM_PATS` constants
- All pattern data (note codes and volumes for each voice)
- The arrangement table
- The complete music engine (`MUSIC_INIT`, `MUSIC_UPDATE`, `MUSIC_STOP`)

---

## Using the exported assembly in your game

See `example_projects/Music/test.dasm` for a complete working example with both engines running together.

### Step 1 — Export and place the files

Export your sound effects (`-sfx.asm`) and music (`-music.asm`) from the editor and place them in your project folder.

### Step 2 — Reserve zero-page variables

```asm
; Sound engine
SFX_LEFT        .byte   ; ID of SFX playing on left channel (0 = idle)
SFX_RIGHT       .byte   ; ID of SFX playing on right channel (0 = idle)
SFX_LEFT_TIMER  .byte   ; Frame counter for left channel
SFX_RIGHT_TIMER .byte   ; Frame counter for right channel
TempWord        .word   ; Scratch pointer used by the sound engine

; Music engine
MUS_FRAME       .byte   ; Frame countdown per step
MUS_STEP        .byte   ; Step within current pattern
MUS_PAT_IDX     .byte   ; Index into the arrangement table
MUS_PLAYING     .byte   ; 0 = stopped, 1 = playing
MUS_ARR_OFF     .byte   ; Saved arrangement byte offset (internal)
MUS_PTR         .word   ; Scratch pointer used by the music engine
```

### Step 3 — Initialise on startup

```asm
Start:
    CLEAN_START
    jsr SFX_OFF      ; silence channels, reset sound engine
    jsr MUSIC_INIT   ; start music from the beginning
```

### Step 4 — Trigger sound effects

```asm
    ldy #SFX_ID_SHOOT
    jsr SFX_TRIGGER
```

Higher IDs have higher priority and will preempt lower-priority sounds. The music engine automatically skips any TIA channel that the sound engine is currently using, then resumes when the SFX ends.

### Step 5 — Update every frame

Call both engines once per frame. `MUSIC_UPDATE` is lightweight when the tempo countdown hasn't expired — call it during underscan or overscan alongside `SFX_UPDATE`:

```asm
    jsr MUSIC_UPDATE   ; advance music step if tempo countdown reached 0
    ; ...
    jsr SFX_UPDATE     ; advance active sound effects by one frame
```

### Step 6 — Include the exported files

```asm
    include "mygame-sfx.asm"
    include "SoundEngine.asm"     ; included in the sfx export, or separately
    include "mysong-music.asm"    ; includes the music engine automatically
```

---

## Example projects

### `example_projects/` — Sound effects demo

A minimal Atari 2600 program based on the Aliens 2600 prototype that plays a sound effect on button press.

| File | Description |
|------|-------------|
| `aliens2600-sounds.json` | Editor save file — load this to see the sounds in the editor |
| `aliens2600-sfx.asm` | Exported assembly generated from the above |
| `test.dasm` | Plays the AlienDeath SFX on button press |
| `vcs.h` / `macro.h` / `xmacro.h` | Standard DASM headers |

### `example_projects/Music/` — Music + SFX demo

A complete example showing music playback with the Paul Slocum driver and simultaneous sound effects.

| File | Description |
|------|-------------|
| `shadows_gather-music.asm` | Exported music data for "Shadows Gather — Forest of Mysteries OST" |
| `SoundEngine.asm` | Sound effects engine |
| `MusicEngine.asm` | Music playback engine |
| `test.dasm` | Full demo: plays the song continuously, fires an AlienDeath SFX on button press |
| `aliens2600-sfx.asm` | Sound effects data used by the demo |

### Assembling the examples

You need [DASM](https://dasm-assembler.github.io/):

```bash
# Sound effects demo
dasm example_projects/test.dasm -f3 -v5 -o test.bin

# Music + SFX demo
dasm example_projects/Music/test.dasm -f3 -v5 -o music-test.bin
```

The resulting `.bin` can be loaded in any Atari 2600 emulator (e.g. [Stella](https://stella-emu.github.io/)).
