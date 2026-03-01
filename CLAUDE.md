# Atari Sound Editor — Claude Context

## Stack
- **Next.js 15** (Turbopack), **React 19**, **TypeScript 5**, **Tailwind CSS 3**, **Radix UI**
- **Go WASM** (`public/main.wasm` + `public/wasm_exec.js`) for Atari TIA audio playback
- Dev server: `npm run dev` on port 3000

## App Structure
Two editors, switchable via a tab bar in `pages/index.tsx`:
- **♪ Sound Effects** — light theme (`bg-gray-50`), uses WASM for playback
- **♫ Music** — dark theme (`bg-gray-950`), uses Web Audio API for playback

---

## Sound Effects Editor

### Key Files
| File | Purpose |
|---|---|
| `components/atari-sound-editor.tsx` | Main SFX editor UI |
| `utils/atariSoundService.ts` | WASM singleton (`initialize`, `updateSamples`, `playSample`) |
| `utils/useAtariSoundService.ts` | React hook wrapping the service |
| `utils/atariSoundExporter.tsx` | Generates 6502 assembly from SFX data |
| `types/index.tsx` | `Tone` (control 0-15, volume 0-15, frequency 0-31) and `SoundEffect` |
| `pages/_document.tsx` | Loads `wasm_exec.js` with `beforeInteractive` strategy |

### WASM Architecture
- Go program exposes `window.updateSamples(json)` and `window.playSample(name)`
- Go's `main()` exits normally after playing — `.run()` promise resolves (not rejects)
- `wasmModule` (compiled) is cached; only `instantiate` repeats on reconnect
- `go.run().then(handleExit, handleExit)` catches both normal exits and errors
- Samples are cached in the service so they survive Go exit/reconnect cycles
- `setExitCallback(cb)` notifies the hook immediately on exit → auto-reconnect

### UI Details
- `SliderField` component: range slider + live value for Control / Volume / Frequency
- `StatusBadge`: green (ready) / amber pulsing (connecting) / red clickable (reconnect)
- Tone rows show index numbers (#1, #2, …)
- `updateSamples` called unconditionally — service handles the guard internally

---

## Music Editor

### Key Files
| File | Purpose |
|---|---|
| `types/music.ts` | `MusicStep`, `MusicPattern`, `AtariSong` types |
| `utils/atariNoteTable.ts` | Paul Slocum Setup #1 note table (38 tonal + 4 drum rows) |
| `utils/useAtariMusicPlayer.ts` | Web Audio API step sequencer hook |
| `utils/atariMusicExporter.ts` | `exportSongToAsm()`, `saveSong()`, `loadSong()` |
| `components/atari-music-editor.tsx` | GB Studio-style piano roll editor |

### Atari TIA Sound Types (Setup #1)
| Name | AUDC | Driver Code | Notes available |
|---|---|---|---|
| Square | 4 | 000 | F6 D6 F5 E5 D5 C5 B4 |
| Lead | 12 | 101 | Bb4 G4 Bb3 A3 G3 F3 E3 |
| Saw | 1 | 110 | F#3 Eb3 F#2 Eb2 D2 C2 |
| Bass | 6 | 001 | B5→B0 (18 notes) |
| Noise | 8 | 011 | HiHat (f=0), Snare (f=8) |
| Buzz | 15 | 100 | Kick (f=30), Snare (f=6) |

Note code byte format: `[driverCode(3 bits)][frequency(5 bits)]`

### Piano Roll Layout
- Y-axis: notes grouped by type — Square → Lead → Saw → Bass → Drums
- X-axis: steps (8 / 16 / 32 per pattern)
- **Voice 0** = green (`bg-emerald-600`), **Voice 1** = amber (`bg-amber-500`)
- Click a cell to toggle a note on the active voice
- Step properties (note, sound type, AUDC, AUDF, volume) shown in right panel on selection

### Playback
- Web Audio API with look-ahead scheduling (25ms scheduler interval)
- Drum synthesis: kick = sine with pitch drop, hihat = noise + HPF, snare = noise burst
- Oscillator types: `square` for Square/Lead, `sawtooth` for Saw/Bass/Buzz
- Tempo = frames per step at NTSC 60fps (e.g. tempo=4 ≈ 120 BPM at 16 steps)

### Data Model
```ts
MusicStep   = { audc, audf, audv }
MusicPattern = { id, name, length: 8|16|32, voice0: (MusicStep|null)[], voice1: ... }
AtariSong   = { id, name, artist, tempo, patterns, arrangement: string[] }
```

### Export
- Generates Paul Slocum driver-compatible 6502 ASM
- Pattern data: note code bytes + volume bytes per voice
- Arrangement table + `MUSIC_INIT` / `MUSIC_UPDATE` / `MUSIC_STOP` engine stubs
- Save/load as JSON

---

## Known Issues
- `tailwind.config.ts` has a TS error on `darkMode: ["class"]` — pre-existing, ignore it
