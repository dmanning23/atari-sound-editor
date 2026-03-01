'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AtariSong, MusicPattern, MusicStep } from '@/types/music';
import { ALL_NOTES, findNote, TIANoteEntry } from '@/utils/atariNoteTable';
import { exportSongToAsm, loadSong, saveSong } from '@/utils/atariMusicExporter';
import { useAtariMusicPlayer } from '@/utils/useAtariMusicPlayer';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

const CELL_H = 18;   // px per note row
const CELL_W = 22;   // px per step column
const LABEL_W = 52;  // px for note label column
const TYPE_W = 26;   // px for sound type abbreviation column
const GROUP_H = 14;  // px for group header rows

const DEFAULT_VOLUME = 15;

function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function createPattern(name = 'Pattern 1', length: 8 | 16 | 32 = 16): MusicPattern {
  return {
    id: genId(),
    name,
    length,
    voice0: Array(length).fill(null),
    voice1: Array(length).fill(null),
  };
}

const INITIAL_PATTERN_ID = 'init-pat';
const INITIAL_SONG_ID = 'init-song';

function makeDefaultSong(): AtariSong {
  return {
    id: INITIAL_SONG_ID,
    name: 'New Song',
    artist: '',
    tempo: 4,
    patterns: [
      {
        id: INITIAL_PATTERN_ID,
        name: 'Pattern 1',
        length: 16,
        voice0: Array(16).fill(null),
        voice1: Array(16).fill(null),
      },
    ],
    arrangement: [INITIAL_PATTERN_ID],
  };
}

// ─── Note row groups ─────────────────────────────────────────────────────────

interface RowItem {
  type: 'group';
  label: string;
  color: string;
}

interface NoteRowItem {
  type: 'note';
  entry: TIANoteEntry;
}

type PianoRollRow = RowItem | NoteRowItem;

// Group notes by sound type in a musically logical order (melody → bass → drums)
const TYPE_ORDER = ['Square', 'Lead', 'Saw', 'Bass'] as const;

function buildRows(): PianoRollRow[] {
  const rows: PianoRollRow[] = [];

  for (const typeName of TYPE_ORDER) {
    const notes = ALL_NOTES.filter(e => !e.isDrum && e.soundType === typeName);
    if (notes.length === 0) continue;
    rows.push({ type: 'group', label: typeName, color: notes[0].color });
    for (const entry of notes) {
      rows.push({ type: 'note', entry });
    }
  }

  const drums = ALL_NOTES.filter(e => e.isDrum);
  if (drums.length > 0) {
    rows.push({ type: 'group', label: 'Drums', color: drums[0].color });
    for (const entry of drums) {
      rows.push({ type: 'note', entry });
    }
  }

  return rows;
}

const PIANO_ROLL_ROWS = buildRows();

// ─── Small UI primitives ──────────────────────────────────────────────────────

function DarkButton({
  children,
  onClick,
  active = false,
  title,
  className,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={cn(
        'px-2 py-1 rounded text-xs font-medium transition-colors',
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-700 text-gray-200 hover:bg-gray-600',
        className,
      )}
    >
      {children}
    </button>
  );
}

// ─── PianoRollCell ────────────────────────────────────────────────────────────

interface CellProps {
  noteEntry: TIANoteEntry;
  stepIndex: number;
  hasVoice0: boolean;
  hasVoice1: boolean;
  isPlayhead: boolean;
  isBeat: boolean;          // first step of each 4-step beat group
  rowColor: string;
  onMouseDown: (noteEntry: TIANoteEntry, stepIndex: number) => void;
}

const PianoRollCell = React.memo(function PianoRollCell({
  noteEntry,
  stepIndex,
  hasVoice0,
  hasVoice1,
  isPlayhead,
  isBeat,
  rowColor,
  onMouseDown,
}: CellProps) {
  let bg = '';
  if (hasVoice0 && hasVoice1) {
    bg = 'bg-gradient-to-b from-emerald-600 to-amber-500';
  } else if (hasVoice0) {
    bg = 'bg-emerald-600';
  } else if (hasVoice1) {
    bg = 'bg-amber-500';
  }

  return (
    <div
      className={cn(
        'flex-shrink-0 cursor-pointer transition-colors',
        !hasVoice0 && !hasVoice1 && rowColor,
        bg,
        isPlayhead && !hasVoice0 && !hasVoice1 && 'bg-red-900/60',
        isBeat && !hasVoice0 && !hasVoice1 && !isPlayhead && 'brightness-125',
      )}
      style={{ width: CELL_W, height: CELL_H, borderRight: '1px solid rgba(255,255,255,0.04)' }}
      onMouseDown={() => onMouseDown(noteEntry, stepIndex)}
    />
  );
});

// ─── Main component ───────────────────────────────────────────────────────────

export default function AtariMusicEditor() {
  const [songs, setSongs] = useState<AtariSong[]>(() => [makeDefaultSong()]);
  const [activeSongId, setActiveSongId] = useState(INITIAL_SONG_ID);
  const [activePatternId, setActivePatternId] = useState(INITIAL_PATTERN_ID);
  const [activeVoice, setActiveVoice] = useState<0 | 1>(0);
  const [defaultVolume, setDefaultVolume] = useState(DEFAULT_VOLUME);
  const [selectedCell, setSelectedCell] = useState<{
    noteId: string;
    stepIndex: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const player = useAtariMusicPlayer();

  // Derive active song / pattern
  const activeSong = songs.find(s => s.id === activeSongId) ?? songs[0];
  const activePattern =
    activeSong.patterns.find(p => p.id === activePatternId) ??
    activeSong.patterns[0];

  // ── Song / pattern helpers ──────────────────────────────────────────────

  const updateSong = useCallback(
    (updater: (song: AtariSong) => AtariSong) => {
      setSongs(prev =>
        prev.map(s => (s.id === activeSongId ? updater(s) : s)),
      );
    },
    [activeSongId],
  );

  const updatePattern = useCallback(
    (updater: (p: MusicPattern) => MusicPattern) => {
      updateSong(song => ({
        ...song,
        patterns: song.patterns.map(p =>
          p.id === activePatternId ? updater(p) : p,
        ),
      }));
    },
    [activePatternId, updateSong],
  );

  // ── Cell interaction ────────────────────────────────────────────────────

  const handleCellMouseDown = useCallback(
    (noteEntry: TIANoteEntry, stepIndex: number) => {
      const voiceKey = activeVoice === 0 ? 'voice0' : 'voice1';
      const current = activePattern[voiceKey][stepIndex];
      const isSameNote =
        current &&
        current.audc === noteEntry.audc &&
        current.audf === noteEntry.audf;

      const newStep: MusicStep | null = isSameNote
        ? null
        : { audc: noteEntry.audc, audf: noteEntry.audf, audv: defaultVolume };

      updatePattern(p => {
        const steps = [...p[voiceKey]];
        steps[stepIndex] = newStep;
        return { ...p, [voiceKey]: steps };
      });

      setSelectedCell(
        isSameNote ? null : { noteId: noteEntry.id, stepIndex },
      );
    },
    [activePattern, activeVoice, defaultVolume, updatePattern],
  );

  // ── Pattern management ──────────────────────────────────────────────────

  const addPattern = useCallback(() => {
    const idx = activeSong.patterns.length + 1;
    const p = createPattern(`Pattern ${idx}`);
    updateSong(s => ({
      ...s,
      patterns: [...s.patterns, p],
      arrangement: [...s.arrangement, p.id],
    }));
    setActivePatternId(p.id);
  }, [activeSong.patterns.length, updateSong]);

  const addSong = useCallback(() => {
    const s = makeDefaultSong();
    s.id = genId();
    setSongs(prev => [...prev, s]);
    setActiveSongId(s.id);
    setActivePatternId(s.patterns[0].id);
  }, []);

  const duplicatePattern = useCallback(() => {
    const src = activePattern;
    const p: MusicPattern = {
      ...src,
      id: genId(),
      name: `${src.name} copy`,
      voice0: [...src.voice0],
      voice1: [...src.voice1],
    };
    updateSong(s => ({
      ...s,
      patterns: [...s.patterns, p],
    }));
    setActivePatternId(p.id);
  }, [activePattern, updateSong]);

  const deletePattern = useCallback((patternId: string) => {
    updateSong(s => {
      const remaining = s.patterns.filter(p => p.id !== patternId);
      const newArr = s.arrangement.filter(id => id !== patternId);
      const fallback = remaining[0]?.id ?? '';
      if (activePatternId === patternId) setActivePatternId(fallback);
      return {
        ...s,
        patterns: remaining.length > 0 ? remaining : [createPattern()],
        arrangement: newArr,
      };
    });
  }, [activePatternId, updateSong]);

  const addToArrangement = useCallback((patternId: string) => {
    updateSong(s => ({ ...s, arrangement: [...s.arrangement, patternId] }));
  }, [updateSong]);

  const removeFromArrangement = useCallback((arrIndex: number) => {
    updateSong(s => {
      const arr = [...s.arrangement];
      arr.splice(arrIndex, 1);
      return { ...s, arrangement: arr };
    });
  }, [updateSong]);

  // ── Pattern length change ───────────────────────────────────────────────

  const changePatternLength = useCallback(
    (length: 8 | 16 | 32) => {
      updatePattern(p => {
        const resize = (steps: (MusicStep | null)[]) => {
          if (steps.length >= length) return steps.slice(0, length);
          return [...steps, ...Array(length - steps.length).fill(null)];
        };
        return {
          ...p,
          length,
          voice0: resize(p.voice0),
          voice1: resize(p.voice1),
        };
      });
    },
    [updatePattern],
  );

  // ── Save / load / export ────────────────────────────────────────────────

  const handleSave = useCallback(() => saveSong(activeSong), [activeSong]);

  const handleLoad = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const loaded = await loadSong(file);
    if (loaded) {
      setSongs(prev => {
        const exists = prev.find(s => s.id === loaded.id);
        return exists ? prev.map(s => s.id === loaded.id ? loaded : s) : [...prev, loaded];
      });
      setActiveSongId(loaded.id);
      setActivePatternId(loaded.patterns[0]?.id ?? '');
    }
    e.target.value = '';
  }, []);

  const handleExport = useCallback(() => exportSongToAsm(activeSong), [activeSong]);

  // ── Get selected step info ──────────────────────────────────────────────

  const selectedStep: (MusicStep & { noteEntry: TIANoteEntry }) | null = (() => {
    if (!selectedCell) return null;
    const [audc, audf] = selectedCell.noteId.split('-').map(Number);
    const noteEntry = findNote(audc, audf);
    if (!noteEntry) return null;
    const v0 = activePattern.voice0[selectedCell.stepIndex];
    const v1 = activePattern.voice1[selectedCell.stepIndex];
    const step = (v0?.audc === audc && v0?.audf === audf ? v0 : null) ??
                 (v1?.audc === audc && v1?.audf === audf ? v1 : null);
    if (!step) return null;
    return { ...step, noteEntry };
  })();

  const updateSelectedVolume = useCallback(
    (audv: number) => {
      if (!selectedCell) return;
      const [audc, audf] = selectedCell.noteId.split('-').map(Number);
      const si = selectedCell.stepIndex;
      const voiceKey = activeVoice === 0 ? 'voice0' : 'voice1';
      updatePattern(p => {
        const s = p[voiceKey][si];
        if (!s || s.audc !== audc || s.audf !== audf) return p;
        const steps = [...p[voiceKey]];
        steps[si] = { ...s, audv };
        return { ...p, [voiceKey]: steps };
      });
    },
    [selectedCell, activeVoice, updatePattern],
  );

  // ── Playback ────────────────────────────────────────────────────────────

  const handlePlay = useCallback(() => {
    if (player.isPlaying) {
      player.stop();
    } else {
      player.playPattern(activePattern, activeSong.tempo);
    }
  }, [player, activePattern, activeSong.tempo]);

  // Keep player in sync when pattern changes while playing
  useEffect(() => {
    if (player.isPlaying) {
      player.stop();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePatternId]);

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full bg-gray-950 text-gray-100 select-none overflow-hidden font-mono text-xs">
      {/* ── Left Panel ──────────────────────────────────────────────────── */}
      <div className="w-48 flex-shrink-0 flex flex-col border-r border-gray-800 bg-gray-900">
        {/* Songs */}
        <div className="p-2 border-b border-gray-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-gray-400 uppercase tracking-wide" style={{ fontSize: 10 }}>Songs</span>
            <button onClick={addSong} className="text-gray-400 hover:text-white text-sm leading-none" title="Add song">+</button>
          </div>
          <div className="space-y-0.5 max-h-28 overflow-y-auto">
            {songs.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveSongId(s.id);
                  setActivePatternId(s.patterns[0]?.id ?? '');
                }}
                className={cn(
                  'w-full text-left px-2 py-0.5 rounded truncate transition-colors',
                  s.id === activeSongId
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700',
                )}
              >
                ♪ {s.name}
              </button>
            ))}
          </div>
        </div>

        {/* Voice config */}
        <div className="p-2 border-b border-gray-800">
          <span className="text-gray-400 uppercase tracking-wide block mb-1" style={{ fontSize: 10 }}>Voices</span>
          <VoiceLabel voice={0} active={activeVoice === 0} onClick={() => setActiveVoice(0)} />
          <VoiceLabel voice={1} active={activeVoice === 1} onClick={() => setActiveVoice(1)} />
        </div>

        {/* Legend */}
        <div className="p-2 border-b border-gray-800">
          <span className="text-gray-400 uppercase tracking-wide block mb-1" style={{ fontSize: 10 }}>Legend</span>
          <div className="flex items-center gap-1.5 mb-0.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-600 flex-shrink-0" />
            <span className="text-gray-300">Voice 0</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-amber-500 flex-shrink-0" />
            <span className="text-gray-300">Voice 1</span>
          </div>
        </div>

        {/* Default volume */}
        <div className="p-2">
          <span className="text-gray-400 uppercase tracking-wide block mb-1" style={{ fontSize: 10 }}>Default Vol</span>
          <div className="flex items-center gap-1">
            <input
              type="range" min={1} max={15} value={defaultVolume}
              onChange={e => setDefaultVolume(Number(e.target.value))}
              className="flex-1 accent-indigo-500"
            />
            <span className="w-5 text-right text-gray-300">{defaultVolume}</span>
          </div>
        </div>
      </div>

      {/* ── Center + Right ───────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800 bg-gray-900 flex-shrink-0">
          {/* Voice tabs */}
          <DarkButton active={activeVoice === 0} onClick={() => setActiveVoice(0)}>
            <span className="w-2 h-2 inline-block rounded-full bg-emerald-500 mr-1" />
            Voice 0
          </DarkButton>
          <DarkButton active={activeVoice === 1} onClick={() => setActiveVoice(1)}>
            <span className="w-2 h-2 inline-block rounded-full bg-amber-400 mr-1" />
            Voice 1
          </DarkButton>

          <div className="w-px h-5 bg-gray-700 mx-1" />

          {/* Playback */}
          <DarkButton
            onClick={handlePlay}
            title={player.isPlaying ? 'Stop' : 'Play pattern'}
            className="w-8"
          >
            {player.isPlaying ? '■' : '▶'}
          </DarkButton>

          <div className="w-px h-5 bg-gray-700 mx-1" />

          {/* Pattern name */}
          <input
            value={activePattern.name}
            onChange={e =>
              updatePattern(p => ({ ...p, name: e.target.value }))
            }
            className="bg-gray-800 border border-gray-600 rounded px-2 py-0.5 text-gray-100 w-28 text-xs"
            placeholder="Pattern name"
          />

          {/* Pattern length */}
          <select
            value={activePattern.length}
            onChange={e => changePatternLength(Number(e.target.value) as 8 | 16 | 32)}
            className="bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-gray-100 text-xs"
          >
            <option value={8}>8 steps</option>
            <option value={16}>16 steps</option>
            <option value={32}>32 steps</option>
          </select>

          <div className="flex-1" />

          <DarkButton onClick={duplicatePattern} title="Duplicate pattern">⧉</DarkButton>
        </div>

        {/* Main area: piano roll + right panel */}
        <div className="flex flex-1 min-h-0">
          {/* Piano Roll */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Step number header */}
            <div
              className="flex-shrink-0 flex bg-gray-900 border-b border-gray-700 sticky top-0 z-10"
              style={{ paddingLeft: LABEL_W, paddingRight: TYPE_W }}
            >
              {Array.from({ length: activePattern.length }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex-shrink-0 text-center text-gray-500',
                    player.playheadStep === i && 'text-red-400 font-bold',
                    i % 4 === 0 && 'text-gray-400',
                  )}
                  style={{ width: CELL_W, fontSize: 9, lineHeight: '18px' }}
                >
                  {i % 4 === 0 ? i + 1 : '·'}
                </div>
              ))}
            </div>

            {/* Scrollable note rows */}
            <div className="flex-1 overflow-auto">
              <div style={{ minWidth: LABEL_W + activePattern.length * CELL_W + TYPE_W }}>
                {PIANO_ROLL_ROWS.map((row, rowIdx) => {
                  if (row.type === 'group') {
                    return (
                      <GroupHeaderRow key={`group-${rowIdx}`} label={row.label} color={row.color} patternLength={activePattern.length} />
                    );
                  }

                  const { entry } = row;
                  const steps = Array.from({ length: activePattern.length }, (_, si) => {
                    const v0 = activePattern.voice0[si];
                    const v1 = activePattern.voice1[si];
                    const hasV0 = !!v0 && v0.audc === entry.audc && v0.audf === entry.audf;
                    const hasV1 = !!v1 && v1.audc === entry.audc && v1.audf === entry.audf;
                    return { hasV0, hasV1, si };
                  });

                  return (
                    <NoteRow
                      key={entry.id}
                      entry={entry}
                      steps={steps}
                      playheadStep={player.playheadStep}
                      onCellMouseDown={handleCellMouseDown}
                    />
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="w-48 flex-shrink-0 border-l border-gray-800 bg-gray-900 flex flex-col overflow-y-auto">
            <SongProperties
              song={activeSong}
              onUpdate={updater => updateSong(updater)}
            />
            {selectedStep && (
              <StepProperties
                step={selectedStep}
                noteEntry={selectedStep.noteEntry}
                onVolumeChange={updateSelectedVolume}
              />
            )}
          </div>
        </div>

        {/* Bottom panel */}
        <div className="flex-shrink-0 border-t border-gray-800 bg-gray-900" style={{ minHeight: 120 }}>
          <BottomPanel
            song={activeSong}
            activePatternId={activePatternId}
            onSelectPattern={setActivePatternId}
            onAddPattern={addPattern}
            onDeletePattern={deletePattern}
            onAddToArrangement={addToArrangement}
            onRemoveFromArrangement={removeFromArrangement}
            onSave={handleSave}
            onLoad={() => fileInputRef.current?.click()}
            onExport={handleExport}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleLoad}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VoiceLabel({
  voice,
  active,
  onClick,
}: {
  voice: 0 | 1;
  active: boolean;
  onClick: () => void;
}) {
  const color = voice === 0 ? 'bg-emerald-600' : 'bg-amber-500';
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2 py-0.5 rounded mb-0.5 transition-colors',
        active ? 'bg-gray-700' : 'hover:bg-gray-800',
      )}
    >
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', color)} />
      <span className="text-gray-200">Voice {voice}</span>
      {active && <span className="ml-auto text-indigo-400 text-xs">editing</span>}
    </button>
  );
}

function GroupHeaderRow({
  label,
  color,
  patternLength,
}: {
  label: string;
  color: string;
  patternLength: number;
}) {
  return (
    <div
      className={cn('flex items-center border-t border-b border-gray-700/50', color)}
      style={{ height: GROUP_H }}
    >
      <div
        className="flex-shrink-0 px-1.5 text-gray-400 font-semibold uppercase"
        style={{ width: LABEL_W, fontSize: 8, letterSpacing: '0.1em' }}
      >
        {label}
      </div>
      {Array.from({ length: patternLength }, (_, i) => (
        <div
          key={i}
          className={cn('flex-shrink-0', i % 4 === 0 && 'border-l border-gray-700/50')}
          style={{ width: CELL_W, height: GROUP_H }}
        />
      ))}
      <div className="flex-shrink-0" style={{ width: TYPE_W }} />
    </div>
  );
}

interface NoteRowProps {
  entry: TIANoteEntry;
  steps: { hasV0: boolean; hasV1: boolean; si: number }[];
  playheadStep: number;
  onCellMouseDown: (entry: TIANoteEntry, si: number) => void;
}

const NoteRow = React.memo(function NoteRow({
  entry,
  steps,
  playheadStep,
  onCellMouseDown,
}: NoteRowProps) {
  return (
    <div
      className="flex border-b border-gray-800/60 hover:brightness-110"
      style={{ height: CELL_H }}
    >
      {/* Note label */}
      <div
        className={cn(
          'flex-shrink-0 sticky left-0 z-10 flex items-center justify-end pr-1.5',
          entry.color,
          'border-r border-gray-700/50',
        )}
        style={{ width: LABEL_W, fontSize: 10 }}
      >
        <span className="text-gray-200">{entry.label}</span>
      </div>

      {/* Step cells */}
      {steps.map(({ hasV0, hasV1, si }) => (
        <PianoRollCell
          key={si}
          noteEntry={entry}
          stepIndex={si}
          hasVoice0={hasV0}
          hasVoice1={hasV1}
          isPlayhead={playheadStep === si}
          isBeat={si % 4 === 0}
          rowColor={entry.color}
          onMouseDown={onCellMouseDown}
        />
      ))}

      {/* Type abbreviation */}
      <div
        className={cn(
          'flex-shrink-0 sticky right-0 z-10 flex items-center justify-center',
          entry.color,
          'border-l border-gray-700/50',
        )}
        style={{ width: TYPE_W, fontSize: 9 }}
      >
        <span className="text-gray-400">{entry.typeAbbr}</span>
      </div>
    </div>
  );
});

function SongProperties({
  song,
  onUpdate,
}: {
  song: AtariSong;
  onUpdate: (updater: (s: AtariSong) => AtariSong) => void;
}) {
  return (
    <div className="p-2 border-b border-gray-800">
      <span className="text-gray-400 uppercase tracking-wide block mb-2" style={{ fontSize: 10 }}>Song</span>
      <PropField
        label="Name"
        value={song.name}
        onChange={v => onUpdate(s => ({ ...s, name: v }))}
      />
      <PropField
        label="Artist"
        value={song.artist}
        onChange={v => onUpdate(s => ({ ...s, artist: v }))}
      />
      <div className="mb-1">
        <span className="text-gray-400 block" style={{ fontSize: 10 }}>Tempo (frames/step)</span>
        <div className="flex items-center gap-1">
          <input
            type="range" min={1} max={12} value={song.tempo}
            onChange={e => onUpdate(s => ({ ...s, tempo: Number(e.target.value) }))}
            className="flex-1 accent-indigo-500"
          />
          <span className="w-4 text-right text-gray-300">{song.tempo}</span>
        </div>
      </div>
    </div>
  );
}

function StepProperties({
  step,
  noteEntry,
  onVolumeChange,
}: {
  step: MusicStep;
  noteEntry: TIANoteEntry;
  onVolumeChange: (v: number) => void;
}) {
  return (
    <div className="p-2">
      <span className="text-gray-400 uppercase tracking-wide block mb-2" style={{ fontSize: 10 }}>Step</span>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-gray-400">Note</span>
          <span className="text-gray-200">{noteEntry.label}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">Sound</span>
          <span className="text-gray-200">{noteEntry.soundType}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">AUDC</span>
          <span className="text-gray-400">{step.audc}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-400">AUDF</span>
          <span className="text-gray-400">{step.audf}</span>
        </div>
        <div>
          <div className="flex justify-between mb-0.5">
            <span className="text-gray-400">Volume</span>
            <span className="text-gray-200">{step.audv}</span>
          </div>
          <input
            type="range" min={0} max={15} value={step.audv}
            onChange={e => onVolumeChange(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
}

function PropField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="mb-1">
      <span className="text-gray-400 block" style={{ fontSize: 10 }}>{label}</span>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-gray-100 text-xs"
      />
    </div>
  );
}

interface BottomPanelProps {
  song: AtariSong;
  activePatternId: string;
  onSelectPattern: (id: string) => void;
  onAddPattern: () => void;
  onDeletePattern: (id: string) => void;
  onAddToArrangement: (id: string) => void;
  onRemoveFromArrangement: (idx: number) => void;
  onSave: () => void;
  onLoad: () => void;
  onExport: () => void;
}

function BottomPanel({
  song,
  activePatternId,
  onSelectPattern,
  onAddPattern,
  onDeletePattern,
  onAddToArrangement,
  onRemoveFromArrangement,
  onSave,
  onLoad,
  onExport,
}: BottomPanelProps) {
  return (
    <div className="flex flex-col h-full px-3 py-2 gap-2">
      {/* Pattern list + action buttons */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-gray-400 text-xs mr-1">Patterns:</span>
        {song.patterns.map(p => (
          <div key={p.id} className="flex items-center gap-0.5">
            <button
              onClick={() => onSelectPattern(p.id)}
              className={cn(
                'px-2 py-0.5 rounded text-xs transition-colors border',
                p.id === activePatternId
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700',
              )}
            >
              {p.name}
            </button>
            {song.patterns.length > 1 && (
              <button
                onClick={() => onDeletePattern(p.id)}
                className="text-gray-600 hover:text-red-400 text-xs leading-none px-0.5"
                title="Delete pattern"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={onAddPattern}
          className="px-2 py-0.5 rounded text-xs bg-gray-800 border border-gray-600 text-gray-400 hover:bg-gray-700"
        >
          + Add
        </button>

        <div className="flex-1" />

        <DarkButton onClick={onLoad}>Load</DarkButton>
        <DarkButton onClick={onSave}>Save</DarkButton>
        <DarkButton onClick={onExport}>Export ASM</DarkButton>
      </div>

      {/* Arrangement */}
      <div className="flex items-center gap-1 flex-wrap flex-1">
        <span className="text-gray-400 text-xs mr-1">Song:</span>
        {song.arrangement.map((pid, idx) => {
          const pat = song.patterns.find(p => p.id === pid);
          return (
            <div key={`${pid}-${idx}`} className="flex items-center gap-0.5">
              <span className="px-2 py-0.5 rounded text-xs bg-gray-700 border border-gray-600 text-gray-200">
                {pat?.name ?? '?'}
              </span>
              <button
                onClick={() => onRemoveFromArrangement(idx)}
                className="text-gray-600 hover:text-red-400 text-xs leading-none px-0.5"
                title="Remove from arrangement"
              >
                ×
              </button>
            </div>
          );
        })}
        <select
          value=""
          onChange={e => { if (e.target.value) onAddToArrangement(e.target.value); }}
          className="px-1 py-0.5 rounded text-xs bg-gray-800 border border-gray-600 text-gray-400"
        >
          <option value="">+ Add to song</option>
          {song.patterns.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
