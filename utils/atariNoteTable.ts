import { SoundTypeName } from '@/types/music';

export interface TIANoteEntry {
  id: string;          // unique key: `${audc}-${audf}`
  label: string;       // display name e.g. "E4", "Bb4", "Kick"
  audc: number;        // TIA AUDC register value
  audf: number;        // TIA AUDF register value
  midiNote: number;    // MIDI note number for sorting/playback (-1 = drum)
  soundType: SoundTypeName;
  isDrum: boolean;
  typeAbbr: string;    // short label: "Sq", "Bs", "Ld", etc.
  color: string;       // Tailwind bg class for the note row tint
}

const TYPE_META: Record<SoundTypeName, { abbr: string; color: string }> = {
  Square:  { abbr: 'Sq', color: 'bg-sky-950'      },
  Bass:    { abbr: 'Bs', color: 'bg-violet-950'   },
  Pitfall: { abbr: 'Pf', color: 'bg-violet-950'   },
  Lead:    { abbr: 'Ld', color: 'bg-blue-950'     },
  Saw:     { abbr: 'Sw', color: 'bg-teal-950'     },
  Noise:   { abbr: 'No', color: 'bg-red-950'      },
  Buzz:    { abbr: 'Bz', color: 'bg-orange-950'   },
  Engine:  { abbr: 'En', color: 'bg-yellow-950'   },
};

function n(
  label: string,
  soundType: SoundTypeName,
  audc: number,
  audf: number,
  midiNote: number,
): TIANoteEntry {
  const { abbr, color } = TYPE_META[soundType];
  return {
    id: `${audc}-${audf}`,
    label,
    audc,
    audf,
    midiNote,
    soundType,
    isDrum: soundType === 'Noise' || soundType === 'Buzz',
    typeAbbr: abbr,
    color,
  };
}

// ─── Setup #1 tonal notes (Paul Slocum guide) ───────────────────────────────
// MIDI formula: 12*(octave+1)+semitone  (C=-1=0, C0=12, C4=60, A4=69)
// German 'h' = B in English notation

const SETUP1_TONAL: TIANoteEntry[] = [
  // Square (AUDC=4) — high-pitched square wave
  n('F6',  'Square',  4, 10, 89),
  n('D6',  'Square',  4, 12, 86),
  n('F5',  'Square',  4, 21, 77),
  n('E5',  'Square',  4, 22, 76),
  n('D5',  'Square',  4, 25, 74),
  n('C5',  'Square',  4, 28, 72),
  n('B4',  'Square',  4, 30, 71),

  // Lead (AUDC=12) — lower-pitch square
  n('Bb4', 'Lead',   12, 10, 70),
  n('G4',  'Lead',   12, 12, 67),
  n('Bb3', 'Lead',   12, 21, 58),
  n('A3',  'Lead',   12, 22, 57),
  n('G3',  'Lead',   12, 25, 55),
  n('F3',  'Lead',   12, 28, 53),
  n('E3',  'Lead',   12, 30, 52),

  // Saw (AUDC=1) — saw-like waveform
  n('F#3', 'Saw',     1, 10, 54),
  n('Eb3', 'Saw',     1, 12, 51),
  n('F#2', 'Saw',     1, 21, 42),
  n('Eb2', 'Saw',     1, 25, 39),
  n('D2',  'Saw',     1, 27, 38),
  n('C2',  'Saw',     1, 30, 36),

  // Bass (AUDC=6) — fat bass sound
  n('B5',  'Bass',    6,  0, 83),
  n('B4',  'Bass',    6,  1, 71),
  n('E4',  'Bass',    6,  2, 64),
  n('B3',  'Bass',    6,  3, 59),
  n('G3',  'Bass',    6,  4, 55),
  n('E3',  'Bass',    6,  5, 52),
  n('B2',  'Bass',    6,  7, 47),
  n('A2',  'Bass',    6,  8, 45),
  n('G2',  'Bass',    6,  9, 43),
  n('E2',  'Bass',    6, 11, 40),
  n('C2',  'Bass',    6, 14, 36),
  n('B1',  'Bass',    6, 15, 35),
  n('A1',  'Bass',    6, 17, 33),
  n('G1',  'Bass',    6, 19, 31),
  n('E1',  'Bass',    6, 23, 28),
  n('D1',  'Bass',    6, 26, 26),
  n('C1',  'Bass',    6, 29, 24),
  n('B0',  'Bass',    6, 31, 23),
];

// Sort tonal notes high→low (descending MIDI), with secondary sort by AUDC
const TONAL_NOTES: TIANoteEntry[] = [...SETUP1_TONAL].sort(
  (a, b) => b.midiNote - a.midiNote || a.audc - b.audc,
);

// ─── Drum notes ─────────────────────────────────────────────────────────────
// midiNote set to negative values for sort order (below tonal notes)
const DRUM_NOTES: TIANoteEntry[] = [
  n('Kick',  'Buzz',  15, 30, -1),  // AUDC=15 (Buzz), freq=30
  n('Snare', 'Buzz',  15,  6, -2),  // AUDC=15 (Buzz), freq=6
  n('HiHat', 'Noise',  8,  0, -3), // AUDC=8  (Noise), freq=0
  n('Snare', 'Noise',  8,  8, -4), // AUDC=8  (Noise), freq=8
];

/** All note rows for the piano roll: tonal (high→low) then drums */
export const ALL_NOTES: TIANoteEntry[] = [...TONAL_NOTES, ...DRUM_NOTES];

/** Look up a note entry by its AUDC+AUDF pair */
const NOTE_MAP = new Map<string, TIANoteEntry>(
  ALL_NOTES.map(e => [e.id, e]),
);

export function findNote(audc: number, audf: number): TIANoteEntry | undefined {
  return NOTE_MAP.get(`${audc}-${audf}`);
}

/** Convert a MIDI note number to Hz */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Paul Slocum driver code (3-bit) for a TIA AUDC value */
export const AUDC_TO_DRIVER_CODE: Record<number, number> = {
  4:  0, // Square
  6:  1, // Bass
  7:  2, // Pitfall
  8:  3, // Noise
  15: 4, // Buzz
  12: 5, // Lead
  1:  6, // Saw
  3:  7, // Engine
};

/** TIA AUDC value for a Paul Slocum driver code */
export const DRIVER_CODE_TO_AUDC: number[] = [4, 6, 7, 8, 15, 12, 1, 3];

/** Encode a MusicStep as a single note byte: [driverCode(3)] [freq(5)] */
export function encodeNoteCode(audc: number, audf: number): number {
  const driverCode = AUDC_TO_DRIVER_CODE[audc] ?? 0;
  return ((driverCode & 0x07) << 5) | (audf & 0x1f);
}

/** Oscillator type for Web Audio API preview */
export function getOscType(audc: number): OscillatorType {
  switch (audc) {
    case 4:  return 'square';   // Square
    case 12: return 'square';   // Lead
    case 1:  return 'sawtooth'; // Saw
    case 6:  return 'sawtooth'; // Bass
    case 7:  return 'sawtooth'; // Pitfall
    default: return 'square';
  }
}
