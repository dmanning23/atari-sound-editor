import { useCallback, useEffect, useRef, useState } from 'react';
import { MusicPattern, MusicStep } from '@/types/music';
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

  // Quick attack, hold, then cut slightly before next step to avoid clicks
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

  // Kick: AUDC=15, freq=30
  if (audc === 15 && audf === 30) {
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

  // HiHat: AUDC=8, freq=0
  if (audc === 8 && audf === 0) {
    playNoiseBurst(ctx, startTime, 0.04, vol * 0.25, 8000);
    return;
  }

  // Snare (Noise): AUDC=8
  if (audc === 8) {
    playNoiseBurst(ctx, startTime, Math.min(0.1, duration), vol * 0.5, 2000);
    return;
  }

  // Buzz snare / Buzz kick: AUDC=15
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

export interface AtariMusicPlayer {
  isPlaying: boolean;
  playheadStep: number; // -1 = stopped
  playPattern: (pattern: MusicPattern, tempo: number) => void;
  stop: () => void;
}

export function useAtariMusicPlayer(): AtariMusicPlayer {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadStep, setPlayheadStep] = useState(-1);

  const audioCtxRef = useRef<AudioContext | null>(null);
  // Scheduler interval (runs every ~25ms to schedule notes ahead)
  const schedulerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // UI interval (runs every step to update playhead display)
  const uiIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const nextStepTimeRef = useRef(0);
  const currentStepRef = useRef(0);
  const patternRef = useRef<MusicPattern | null>(null);
  const tempoRef = useRef(4);
  const isPlayingRef = useRef(false);

  const SCHEDULE_AHEAD = 0.15; // schedule 150ms ahead of audio time

  const scheduleAhead = useCallback(() => {
    const ctx = audioCtxRef.current;
    const pattern = patternRef.current;
    if (!ctx || !pattern || !isPlayingRef.current) return;

    const stepDuration = tempoRef.current / 60;

    while (nextStepTimeRef.current < ctx.currentTime + SCHEDULE_AHEAD) {
      const step = currentStepRef.current % pattern.length;
      playToneStep(ctx, pattern.voice0[step], nextStepTimeRef.current, stepDuration);
      playToneStep(ctx, pattern.voice1[step], nextStepTimeRef.current, stepDuration);
      nextStepTimeRef.current += stepDuration;
      currentStepRef.current++;
    }
  }, []);

  const stopIntervals = useCallback(() => {
    if (schedulerRef.current) { clearInterval(schedulerRef.current); schedulerRef.current = null; }
    if (uiIntervalRef.current) { clearInterval(uiIntervalRef.current); uiIntervalRef.current = null; }
  }, []);

  const stop = useCallback(() => {
    isPlayingRef.current = false;
    stopIntervals();
    setIsPlaying(false);
    setPlayheadStep(-1);
  }, [stopIntervals]);

  const playPattern = useCallback(
    (pattern: MusicPattern, tempo: number) => {
      // Resume or create AudioContext (browser autoplay policy)
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') ctx.resume();

      stopIntervals();

      patternRef.current = pattern;
      tempoRef.current = tempo;
      currentStepRef.current = 0;
      nextStepTimeRef.current = ctx.currentTime + 0.05;
      isPlayingRef.current = true;

      setIsPlaying(true);
      setPlayheadStep(0);

      // Schedule notes ahead of playback
      schedulerRef.current = setInterval(scheduleAhead, 25);

      // Update playhead display each step
      const stepMs = (tempo / 60) * 1000;
      uiIntervalRef.current = setInterval(() => {
        if (!isPlayingRef.current || !patternRef.current) return;
        const step =
          Math.floor(currentStepRef.current - SCHEDULE_AHEAD / (tempo / 60)) %
          patternRef.current.length;
        setPlayheadStep(Math.max(0, step));
      }, stepMs);
    },
    [scheduleAhead, stopIntervals],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isPlayingRef.current = false;
      stopIntervals();
      audioCtxRef.current?.close();
    };
  }, [stopIntervals]);

  return { isPlaying, playheadStep, playPattern, stop };
}
