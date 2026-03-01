export type SoundTypeName =
  | 'Square'
  | 'Bass'
  | 'Pitfall'
  | 'Noise'
  | 'Buzz'
  | 'Lead'
  | 'Saw'
  | 'Engine';

/** One step of audio on one TIA voice channel */
export interface MusicStep {
  audc: number; // TIA AUDC register (sound type, 0-15)
  audf: number; // TIA AUDF register (frequency divisor, 0-31)
  audv: number; // TIA AUDV register (volume, 0-15)
}

/** A repeating block of steps for both voices */
export interface MusicPattern {
  id: string;
  name: string;
  length: 8 | 16 | 32;
  voice0: (MusicStep | null)[]; // channel 0 (typically bass/drums)
  voice1: (MusicStep | null)[]; // channel 1 (typically melody)
}

/** A complete song with patterns and a playback arrangement */
export interface AtariSong {
  id: string;
  name: string;
  artist: string;
  tempo: number;        // frames per step (3–6, default 4 at NTSC 60fps)
  patterns: MusicPattern[];
  arrangement: string[]; // pattern IDs in playback order
}
