// types/index.ts
export interface Tone {
    id: number;
    control: number;
    volume: number;
    frequency: number;
}

export interface SoundEffect {
    id: number;
    name: string;
    tones: Tone[];
}