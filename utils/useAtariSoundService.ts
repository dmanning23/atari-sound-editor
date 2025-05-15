// src/hooks/useAtariSoundService.ts

import { useState, useEffect, useCallback } from 'react';
import atariSoundService from '../utils/atariSoundService';
import { SoundEffect } from '@/types';

export function useAtariSoundService() {
    const [initialized, setInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    // Initialize the service when the component mounts
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

    // Memoize the updateSamples function to avoid unnecessary re-renders
    const updateSamples = useCallback((gameName: string, soundEffects: SoundEffect[]) => {
        if (atariSoundService.isInitialized()) {
            try {
                atariSoundService.updateSamples(gameName, soundEffects);
            } catch (err) {
                console.error('Error updating samples:', err);
                // If service reports it's no longer initialized, update state
                if (!atariSoundService.isInitialized()) {
                    setInitialized(false);
                    setError('WASM service exited unexpectedly');
                }
            }
        }
    }, []);

    // Memoize the playSample function
    const playSample = useCallback(async (name: string) => {
        try {
            await atariSoundService.playSample(name);

            // If service was reinitialized, update state
            if (atariSoundService.isInitialized() && !initialized) {
                setInitialized(true);
                setError(null);
            }

            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to play sample');

            // If service reports it's no longer initialized, update state
            if (!atariSoundService.isInitialized()) {
                setInitialized(false);
            }

            return false;
        }
    }, [initialized]);

    return {
        initialized,
        loading,
        error,
        updateSamples,
        playSample
    };
}