# Atari 2600 Sound Editor

A browser-based sound effect editor for the Atari 2600 TIA chip. Design sound effects visually, preview them in real time, and export ready-to-use 6502 assembly for your game.

---

## Running the editor

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Using the editor

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

## Using the exported assembly in your game

See `example_projects/test.dasm` for a minimal working example. The six steps are:

### Step 1 — Export and place the file

Run **Export** in the editor and copy the downloaded `-sfx.asm` file into your project folder.

### Step 2 — Reserve zero-page variables

Add five variables in your zero-page / RAM segment:

```asm
SFX_LEFT        .byte   ; ID of sound playing on left channel (0 = idle)
SFX_RIGHT       .byte   ; ID of sound playing on right channel (0 = idle)
SFX_LEFT_TIMER  .byte   ; Frame counter for left channel
SFX_RIGHT_TIMER .byte   ; Frame counter for right channel
TempWord        .word   ; Scratch pointer used by the engine
```

### Step 3 — Initialise on startup

Call `SFX_OFF` once at the start of your game to silence both TIA audio channels and reset the engine state:

```asm
Start:
    CLEAN_START
    jsr SFX_OFF
```

### Step 4 — Trigger sound effects

Load the sound effect ID into the Y register and call `SFX_TRIGGER`. Sound effects are numbered from 1; higher IDs have higher priority and will preempt lower-priority sounds already playing:

```asm
    ldy #SFX_ID_SHOOT
    jsr SFX_TRIGGER
```

The engine manages two channels (left and right TIA audio channels). It automatically picks the idle channel, or the lower-priority one if both are busy.

### Step 5 — Update every frame

Call `SFX_UPDATE` exactly once per frame, typically during overscan or underscan:

```asm
    ; overscan
    TIMER_SETUP 29
    jsr SFX_UPDATE
    TIMER_WAIT
```

This advances each active sound by one tone and writes the appropriate values to `AUDF`, `AUDC`, and `AUDV`.

### Step 6 — Include the exported file

At the end of your code segment, include the exported assembly file:

```asm
    include "mygame-sfx.asm"
```

Make sure this comes **after** your code but **before** the epilogue vectors.

---

## Example project

`example_projects/` contains a complete working example based on an Aliens 2600 prototype:

| File | Description |
|------|-------------|
| `aliens2600-sounds.json` | Editor save file — load this to see the sounds in the editor |
| `aliens2600-sfx.asm` | Exported assembly generated from the above |
| `test.dasm` | Minimal Atari 2600 program that plays the AlienDeath sound on button press |
| `vcs.h` | Standard VCS hardware register definitions |
| `macro.h` / `xmacro.h` | DASM macro helpers (`CLEAN_START`, `VERTICAL_SYNC`, `TIMER_SETUP`, etc.) |

To assemble `test.dasm` you need [DASM](https://dasm-assembler.github.io/):

```bash
dasm example_projects/test.dasm -f3 -v5 -o example_projects/bin/test.bin
```

The resulting `.bin` can be loaded in any Atari 2600 emulator (e.g. [Stella](https://stella-emu.github.io/)).
