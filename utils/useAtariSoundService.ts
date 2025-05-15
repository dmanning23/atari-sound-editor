// src/hooks/useAtariSoundService.ts

import { useState, useEffect } from 'react';
import atariSoundService, { AtariSoundService } from '@/utils/atariSoundService';
import { SoundEffect } from '@/types';

export function useAtariSoundService() {
    const [initialized, setInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const initService = async () => {
            try {
                setLoading(true);
                await atariSoundService.initialize();
                if (mounted) {
                    setInitialized(true);
                    setError(null);
                }
            } catch (err) {
                if (mounted) {
                    setError(err instanceof Error ? err.message : 'Failed to initialize sound service');
                    setInitialized(false);
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initService();

        return () => {
            mounted = false;
        };
    }, []);

    const updateSamples = (gameName: string, soundEffects: SoundEffect[]) => {
        if (initialized) {
            atariSoundService.updateSamples(gameName, soundEffects);
        }
    };

    const playSample = async (name: string) => {
        try {
            await atariSoundService.playSample(name);
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to play sample');
            return false;
        }
    };

    return {
        initialized,
        loading,
        error,
        updateSamples,
        playSample
    };
}