import React, { useState, useEffect } from 'react';
import { Download, Play, Plus, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FC } from 'react';
import { SoundEffect, Tone } from '@/types';
import { exportToAsm } from '@/utils/atariSoundExporter';
import { useAtariSoundService } from '@/utils/useAtariSoundService';

// ─── Slider row ──────────────────────────────────────────────────────────────

interface SliderFieldProps {
    label: string;
    value: number;
    min: number;
    max: number;
    onChange: (v: number) => void;
}

const SliderField: FC<SliderFieldProps> = ({ label, value, min, max, onChange }) => (
    <div className="flex flex-col gap-1 min-w-0">
        <div className="flex justify-between text-xs text-muted-foreground">
            <span>{label}</span>
            <span className="font-mono tabular-nums w-6 text-right">{value}</span>
        </div>
        <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-slate-700 dark:accent-slate-300"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground/50">
            <span>{min}</span>
            <span>{max}</span>
        </div>
    </div>
);

// ─── Status badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
    initialized: boolean;
    loading: boolean;
    error: string | null;
    onReconnect: () => void;
}

const StatusBadge: FC<StatusBadgeProps> = ({ initialized, loading, error, onReconnect }) => {
    if (loading) {
        return (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                Connecting…
            </span>
        );
    }
    if (initialized) {
        return (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Sound ready
            </span>
        );
    }
    return (
        <button
            onClick={onReconnect}
            className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 transition-colors"
            title={error ?? 'Sound engine disconnected'}
        >
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Disconnected — click to reconnect
            <RefreshCw className="w-3 h-3" />
        </button>
    );
};

// ─── Main editor ─────────────────────────────────────────────────────────────

const AtariSoundEditor: FC = () => {
    const [gameName, setGameName] = useState('My Atari Game');
    const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);

    const { initialized, loading, error, updateSamples, playSample, reconnect } =
        useAtariSoundService();

    // Keep WASM in sync whenever data changes
    useEffect(() => {
        updateSamples(gameName, soundEffects);
    }, [soundEffects, gameName, updateSamples]);

    // ── Sound effect operations ─────────────────────────────────────────────

    const addSoundEffect = () => {
        setSoundEffects(prev => [...prev, {
            id: Date.now(),
            name: 'New Sound Effect',
            tones: [],
        }]);
    };

    const deleteSoundEffect = (id: number) => {
        setSoundEffects(prev => prev.filter(e => e.id !== id));
    };

    const updateSoundEffectName = (id: number, name: string) => {
        setSoundEffects(prev => prev.map(e => e.id === id ? { ...e, name } : e));
    };

    // ── Tone operations ─────────────────────────────────────────────────────

    const addTone = (effectId: number) => {
        setSoundEffects(prev => prev.map(effect => {
            if (effect.id !== effectId) return effect;
            const last = effect.tones[effect.tones.length - 1] ?? null;
            const newTone: Tone = {
                id: Date.now(),
                control: last?.control ?? 0,
                volume: last?.volume ?? 15,
                frequency: last?.frequency ?? 0,
            };
            return { ...effect, tones: [...effect.tones, newTone] };
        }));
    };

    const updateTone = (effectId: number, toneId: number, field: keyof Tone, value: number) => {
        setSoundEffects(prev => prev.map(effect => {
            if (effect.id !== effectId) return effect;
            return {
                ...effect,
                tones: effect.tones.map(t =>
                    t.id === toneId ? { ...t, [field]: value } : t
                ),
            };
        }));
    };

    const deleteTone = (effectId: number, toneId: number) => {
        setSoundEffects(prev => prev.map(effect => {
            if (effect.id !== effectId) return effect;
            return { ...effect, tones: effect.tones.filter(t => t.id !== toneId) };
        }));
    };

    // ── Persistence ─────────────────────────────────────────────────────────

    const saveProject = () => {
        const blob = new Blob([JSON.stringify({ gameName, soundEffects }, null, 2)], {
            type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${gameName.toLowerCase().replace(/\s+/g, '-')}-sounds.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const loadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const project = JSON.parse(e.target?.result as string);
                setGameName(project.gameName);
                setSoundEffects(project.soundEffects);
            } catch {
                console.error('Error loading project');
            }
        };
        reader.readAsText(file);
    };

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-4">

            {/* Header */}
            <Card>
                <CardHeader>
                    <div className="flex flex-wrap items-center gap-4">
                        <Input
                            value={gameName}
                            onChange={(e) => setGameName(e.target.value)}
                            className="text-xl font-bold flex-1 min-w-48"
                        />

                        <StatusBadge
                            initialized={initialized}
                            loading={loading}
                            error={error}
                            onReconnect={reconnect}
                        />

                        <div className="flex gap-2 ml-auto">
                            <Button size="sm" className="relative" variant="outline">
                                <Upload className="w-4 h-4 mr-1" />
                                Load
                                <input
                                    type="file"
                                    onChange={loadProject}
                                    accept=".json"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </Button>
                            <Button onClick={saveProject} size="sm" variant="outline">
                                <Save className="w-4 h-4 mr-1" />
                                Save
                            </Button>
                            <Button onClick={() => exportToAsm(soundEffects, gameName)} size="sm" variant="outline">
                                <Download className="w-4 h-4 mr-1" />
                                Export
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            {/* Sound effects */}
            <div className="space-y-3">
                {soundEffects.map(effect => (
                    <Card key={effect.id}>
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={effect.name}
                                    onChange={(e) => updateSoundEffectName(effect.id, e.target.value)}
                                    className="font-semibold flex-1"
                                />
                                <Button
                                    onClick={() => playSample(effect.name)}
                                    size="sm"
                                    disabled={!initialized || loading}
                                    title={!initialized ? 'Sound engine not ready' : `Play "${effect.name}"`}
                                >
                                    <Play className="w-4 h-4 mr-1" />
                                    Play
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteSoundEffect(effect.id)}
                                    className="text-muted-foreground hover:text-destructive"
                                    title="Delete sound effect"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {effect.tones.length === 0
                                    ? 'No tones — add one below'
                                    : `${effect.tones.length} tone${effect.tones.length !== 1 ? 's' : ''}`}
                            </p>
                        </CardHeader>

                        <CardContent className="pt-0">
                            <div className="space-y-0 divide-y">
                                {effect.tones.map((tone, index) => (
                                    <div key={tone.id} className="py-3 flex items-start gap-3">
                                        {/* Tone index */}
                                        <span className="text-xs text-muted-foreground font-mono w-6 shrink-0 mt-1 text-right">
                                            {index + 1}
                                        </span>

                                        {/* Sliders */}
                                        <div className="grid grid-cols-3 gap-4 flex-1 min-w-0">
                                            <SliderField
                                                label="Control"
                                                min={0}
                                                max={15}
                                                value={tone.control}
                                                onChange={(v) => updateTone(effect.id, tone.id, 'control', v)}
                                            />
                                            <SliderField
                                                label="Volume"
                                                min={0}
                                                max={15}
                                                value={tone.volume}
                                                onChange={(v) => updateTone(effect.id, tone.id, 'volume', v)}
                                            />
                                            <SliderField
                                                label="Frequency"
                                                min={0}
                                                max={31}
                                                value={tone.frequency}
                                                onChange={(v) => updateTone(effect.id, tone.id, 'frequency', v)}
                                            />
                                        </div>

                                        {/* Delete tone */}
                                        <button
                                            onClick={() => deleteTone(effect.id, tone.id)}
                                            className="mt-1 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                                            title="Remove tone"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <Button
                                onClick={() => addTone(effect.id)}
                                size="sm"
                                variant="outline"
                                className="w-full mt-2"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                Add Tone
                            </Button>
                        </CardContent>
                    </Card>
                ))}

                <Button onClick={addSoundEffect} className="w-full" variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Sound Effect
                </Button>
            </div>
        </div>
    );
};

export default AtariSoundEditor;
