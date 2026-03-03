import { useCallback, useEffect, useRef, useState } from 'react';
import { AtariSong, MusicPattern, MusicStep } from '@/types/music';
import { findNote, getOscType, midiToHz } from './atariNoteTable';

// ─── Audio helpers ────────────────────────────────────────────────────────────

function playToneStep(
  ctx: AudioContext,
  step: MusicStep | null,
  startTime: number,
  duration: number,
) {
  if (!step || step.audv === 0) return;

  const noteEntry = findNote(step.audc, step.audf);
  if (!noteEntry) return;

  const vol = step.audv / 15;

  if (noteEntry.isDrum) {
    playDrumStep(ctx, step, startTime, duration, vol);
    return;
  }

  const hz = midiToHz(noteEntry.midiNote);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = getOscType(step.audc);
  osc.frequency.value = hz;

  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(vol * 0.4, startTime + 0.005);
  gain.gain.setValueAtTime(vol * 0.4, startTime + duration * 0.85);
  gain.gain.linearRampToValueAtTime(0, startTime + duration * 0.95);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

function playDrumStep(
  ctx: AudioContext,
  step: MusicStep,
  startTime: number,
  duration: number,
  vol: number,
) {
  const { audc, audf } = step;

  if (audc === 15 && audf === 30) {
    // Kick
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(100, startTime);
    osc.frequency.exponentialRampToValueAtTime(40, startTime + 0.1);
    gain.gain.setValueAtTime(vol * 0.9, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.min(0.18, duration));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + Math.min(0.2, duration));
    return;
  }

  if (audc === 8 && audf === 0) {
    // HiHat
    playNoiseBurst(ctx, startTime, 0.04, vol * 0.25, 8000);
    return;
  }

  if (audc === 8) {
    // Snare (Noise)
    playNoiseBurst(ctx, startTime, Math.min(0.1, duration), vol * 0.5, 2000);
    return;
  }

  // Buzz snare / other buzz
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = 120;
  gain.gain.setValueAtTime(vol * 0.5, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + Math.min(0.08, duration));
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + Math.min(0.1, duration));
}

function playNoiseBurst(
  ctx: AudioContext,
  startTime: number,
  burstDuration: number,
  vol: number,
  hpfFreq: number,
) {
  const bufferSize = Math.ceil(ctx.sampleRate * burstDuration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const hpf = ctx.createBiquadFilter();
  hpf.type = 'highpass';
  hpf.frequency.value = hpfFreq;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + burstDuration);

  src.connect(hpf);
  hpf.connect(gain);
  gain.connect(ctx.destination);
  src.start(startTime);
  src.stop(startTime + burstDuration);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type PlayMode = 'pattern' | 'song';

export interface AtariMusicPlayer {
  isPlaying: boolean;
  playMode: PlayMode | null;
  playheadStep: number;             // current step within current pattern (-1 = stopped)
  playheadPatternId: string | null; // ID of pattern currently being played
  playPattern: (pattern: MusicPattern, tempo: number, speed: number) => void;
  playSong: (song: AtariSong, speed: number) => void;
  stop: () => void;
}

const SCHEDULE_AHEAD = 0.15; // seconds to schedule ahead of audio playback

export function useAtariMusicPlayer(): AtariMusicPlayer {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);
  const [playheadStep, setPlayheadStep] = useState(-1);
  const [playheadPatternId, setPlayheadPatternId] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Playback state (all mutable refs, safe to read from scheduler interval)
  const tempoRef = useRef(4);          // frames per step
  const speedRef = useRef(1);          // multiplier (0.25 – 2)
  const isPlayingRef = useRef(false);
  const playStartTimeRef = useRef(0);  // AudioContext time when playback started

  // Arrangement: an ordered list of patterns to play through
  const arrangementRef = useRef<MusicPattern[]>([]);

  // Scheduling pointers (always ahead of audio clock by SCHEDULE_AHEAD)
  const schedPatIdxRef = useRef(0);   // which pattern in arrangement we're scheduling
  const schedStepRef = useRef(0);     // which step within that pattern
  const nextStepTimeRef = useRef(0);  // AudioContext time of next step to schedule

  // ── Step duration helper ──────────────────────────────────────────────────
  const getStepDuration = () => tempoRef.current / 60 / speedRef.current;

  // ── Scheduler ────────────────────────────────────────────────────────────
  const scheduleAhead = useCallback(() => {
    const ctx = audioCtxRef.current;
    const patterns = arrangementRef.current;
    if (!ctx || patterns.length === 0 || !isPlayingRef.current) return;

    while (nextStepTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const patIdx = schedPatIdxRef.current;
      const pat = patterns[patIdx];
      const step = schedStepRef.current;

      const dur = getStepDuration();
      playToneStep(ctx, pat.voice0[step], nextStepTimeRef.current, dur);
      playToneStep(ctx, pat.voice1[step], nextStepTimeRef.current, dur);

      nextStepTimeRef.current += dur;
      schedStepRef.current++;

      if (schedStepRef.current >= pat.length) {
        schedStepRef.current = 0;
        schedPatIdxRef.current = (patIdx + 1) % patterns.length;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── UI playhead (runs every 16ms; derives position from AudioContext clock) ─
  const updatePlayhead = useCallback(() => {
    const ctx = audioCtxRef.current;
    const patterns = arrangementRef.current;
    if (!ctx || patterns.length === 0 || !isPlayingRef.current) return;

    const elapsed = Math.max(0, ctx.currentTime - playStartTimeRef.current);
    const stepDur = getStepDuration();
    const totalStepsElapsed = Math.floor(elapsed / stepDur);

    // Total steps in one full arrangement loop
    const loopLen = patterns.reduce((s, p) => s + p.length, 0);
    let posInLoop = totalStepsElapsed % loopLen;

    // Walk the arrangement to find which pattern + step
    let displayPatIdx = 0;
    for (let i = 0; i < patterns.length; i++) {
      if (posInLoop < patterns[i].length) {
        displayPatIdx = i;
        break;
      }
      posInLoop -= patterns[i].length;
    }

    setPlayheadStep(posInLoop);
    setPlayheadPatternId(patterns[displayPatIdx]?.id ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Internal start ────────────────────────────────────────────────────────
  const startPlayback = useCallback((
    patterns: MusicPattern[],
    tempo: number,
    speed: number,
    mode: PlayMode,
  ) => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    // Clear any running intervals
    if (schedulerRef.current) { clearInterval(schedulerRef.current); schedulerRef.current = null; }
    if (uiIntervalRef.current) { clearInterval(uiIntervalRef.current); uiIntervalRef.current = null; }

    arrangementRef.current = patterns;
    schedPatIdxRef.current = 0;
    schedStepRef.current = 0;
    tempoRef.current = tempo;
    speedRef.current = speed;
    const startAt = ctx.currentTime + 0.05;
    nextStepTimeRef.current = startAt;
    playStartTimeRef.current = startAt;
    isPlayingRef.current = true;

    setIsPlaying(true);
    setPlayMode(mode);
    setPlayheadStep(0);
    setPlayheadPatternId(patterns[0]?.id ?? null);

    schedulerRef.current = setInterval(scheduleAhead, 25);
    uiIntervalRef.current = setInterval(updatePlayhead, 16);
  }, [scheduleAhead, updatePlayhead]);

  // ── Public API ────────────────────────────────────────────────────────────
  const playPattern = useCallback(
    (pattern: MusicPattern, tempo: number, speed: number) => {
      startPlayback([pattern], tempo, speed, 'pattern');
    },
    [startPlayback],
  );

  const playSong = useCallback(
    (song: AtariSong, speed: number) => {
      const byId = new Map(song.patterns.map(p => [p.id, p]));
      const patterns = song.arrangement
        .map(id => byId.get(id))
        .filter((p): p is MusicPattern => !!p);
      if (patterns.length === 0) return;
      startPlayback(patterns, song.tempo, speed, 'song');
    },
    [startPlayback],
  );

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    if (schedulerRef.current) { clearInterval(schedulerRef.current); schedulerRef.current = null; }
    if (uiIntervalRef.current) { clearInterval(uiIntervalRef.current); uiIntervalRef.current = null; }
    setIsPlaying(false);
    setPlayMode(null);
    setPlayheadStep(-1);
    setPlayheadPatternId(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      if (schedulerRef.current) clearInterval(schedulerRef.current);
      if (uiIntervalRef.current) clearInterval(uiIntervalRef.current);
      audioCtxRef.current?.close();
    };
  }, []);

  return { isPlaying, playMode, playheadStep, playheadPatternId, playPattern, playSong, stop };
}
