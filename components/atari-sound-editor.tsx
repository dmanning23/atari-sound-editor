import React, { useState } from 'react';
import { Download, Plus, Save, Trash2, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FC } from 'react';
import { SoundEffect, Tone } from '@/types';
import { exportToAsm } from '@/utils/atariSoundExporter';


const AtariSoundEditor: FC = () => {
    const [gameName, setGameName] = useState('My Atari Game');
    const [soundEffects, setSoundEffects] = useState<SoundEffect[]>([]);

    const addSoundEffect = () => {
        setSoundEffects([...soundEffects, {
            id: Date.now(),
            name: 'New Sound Effect',
            tones: []
        }]);
    };

    const deleteSoundEffect = (id: number) => {
        setSoundEffects(soundEffects.filter(effect => effect.id !== id));
    };

    const updateSoundEffectName = (id: number, name: string) => {
        setSoundEffects(soundEffects.map(effect =>
            effect.id === id ? { ...effect, name } : effect
        ));
    };

    const addTone = (effectId: number) => {
        setSoundEffects(soundEffects.map(effect => {
            if (effect.id === effectId) {
                return {
                    ...effect,
                    tones: [...effect.tones, {
                        id: Date.now(),
                        channel: 0,
                        volume: 15,
                        frequency: 0
                    }]
                };
            }
            return effect;
        }));
    };

    const updateTone = (effectId: number, toneId: number, field: keyof Tone, value: number) => {
        setSoundEffects(soundEffects.map(effect => {
            if (effect.id === effectId) {
                return {
                    ...effect,
                    tones: effect.tones.map(tone =>
                        tone.id === toneId ? { ...tone, [field]: Number(value) } : tone
                    )
                };
            }
            return effect;
        }));
    };

    const deleteTone = (effectId: number, toneId: number) => {
        setSoundEffects(soundEffects.map(effect => {
            if (effect.id === effectId) {
                return {
                    ...effect,
                    tones: effect.tones.filter(tone => tone.id !== toneId)
                };
            }
            return effect;
        }));
    };

    const saveProject = () => {
        const project = {
            gameName,
            soundEffects
        };
        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
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
        const files = event.target.files;
        if (files && files[0]) {
            const reader = new FileReader();
            reader.onload = (e: ProgressEvent<FileReader>) => {
                try {
                    if (e.target?.result) {
                        const project = JSON.parse(e.target.result as string);
                        setGameName(project.gameName);
                        setSoundEffects(project.soundEffects);
                    }
                } catch (error) {
                    console.error('Error loading project:', error);
                }
            };
            reader.readAsText(files[0]);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between w-full gap-8">
                        <Input
                            value={gameName}
                            onChange={(e) => setGameName(e.target.value)}
                            className="text-2xl font-bold w-96"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" className="relative">
                                <Upload className="w-4 h-4 mr-2" />
                                Load
                                <input
                                    type="file"
                                    onChange={loadProject}
                                    accept=".json"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                />
                            </Button>
                            <Button onClick={saveProject} size="sm">
                                <Save className="w-4 h-4 mr-2" />
                                Save
                            </Button>
                            <Button onClick={() => exportToAsm(soundEffects, gameName)} size="sm">
                                <Download className="w-4 h-4 mr-2" />
                                Export
                            </Button>
                        </div>
                    </div>
                </CardHeader>
            </Card>

            <div className="space-y-4">
                {soundEffects.map(effect => (
                    <Card key={effect.id}>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={effect.name}
                                    onChange={(e) => updateSoundEffectName(effect.id, e.target.value)}
                                    className="text-xl font-semibold w-64"
                                />
                                <Button variant="destructive" size="sm" onClick={() => deleteSoundEffect(effect.id)}>
                                    <Trash2 className="w-4 h-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {effect.tones.map(tone => (
                                    <div key={tone.id} className="grid grid-cols-4 gap-4 items-center">
                                        <div>
                                            <Label>Channel (0-15)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="15"
                                                value={tone.channel}
                                                onChange={(e) => updateTone(effect.id, tone.id, 'channel', parseInt(e.target.value, 10))}
                                            />
                                        </div>
                                        <div>
                                            <Label>Volume (0-15)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="15"
                                                value={tone.volume}
                                                onChange={(e) => updateTone(effect.id, tone.id, 'volume', parseInt(e.target.value, 10))}
                                            />
                                        </div>
                                        <div>
                                            <Label>Frequency (0-31)</Label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="31"
                                                value={tone.frequency}
                                                onChange={(e) => updateTone(effect.id, tone.id, 'frequency', parseInt(e.target.value, 10))}
                                            />
                                        </div>
                                        <div className="flex items-end">
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() => deleteTone(effect.id, tone.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                <Button onClick={() => addTone(effect.id)} size="sm" className="w-full">
                                    <Plus className="w-4 h-4 mr-2" />
                                    Add Tone
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ))}
                <Button onClick={addSoundEffect} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Sound Effect
                </Button>
            </div>
        </div>
    );
};

export default AtariSoundEditor;