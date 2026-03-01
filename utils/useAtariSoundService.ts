// src/hooks/useAtariSoundService.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import atariSoundService from '../utils/atariSoundService';
import { SoundEffect } from '@/types';

export function useAtariSoundService() {
    const [initialized, setInitialized] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;

        const doInit = async () => {
            try {
                setLoading(true);
                await atariSoundService.initialize();
                if (mountedRef.current) {
                    setInitialized(true);
                    setError(null);
                }
            } catch (err) {
                if (mountedRef.current) {
                    setError(err instanceof Error ? err.message : 'Failed to initialize sound service');
                    setInitialized(false);
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false);
                }
            }
        };

        // When Go exits, mark as disconnected then auto-reconnect.
        // The service caches the last samples, so after re-init they'll be
        // restored automatically on the next playSample call.
        atariSoundService.setExitCallback(async () => {
            if (!mountedRef.current) return;
            setInitialized(false);
            setLoading(true);
            try {
                await atariSoundService.initialize();
                if (mountedRef.current) {
                    setInitialized(true);
                    setError(null);
                }
            } catch (err) {
                if (mountedRef.current) {
                    setError(err instanceof Error ? err.message : 'Sound service disconnected');
                }
            } finally {
                if (mountedRef.current) {
                    setLoading(false);
                }
            }
        });

        doInit();

        return () => {
            mountedRef.current = false;
        };
    }, []);

    const updateSamples = useCallback((gameName: string, soundEffects: SoundEffect[]) => {
        // Always call — the service caches even when not yet ready, and
        // will skip the WASM call if not initialized.
        try {
            atariSoundService.updateSamples(gameName, soundEffects);
        } catch (err) {
            console.error('Error updating samples:', err);
            if (!atariSoundService.isInitialized()) {
                setInitialized(false);
                setError('WASM service exited unexpectedly');
            }
        }
    }, []);

    const playSample = useCallback(async (name: string) => {
        try {
            await atariSoundService.playSample(name);
            if (atariSoundService.isInitialized()) {
                setInitialized(true);
                setError(null);
            }
            return true;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to play sample');
            if (!atariSoundService.isInitialized()) {
                setInitialized(false);
            }
            return false;
        }
    }, []);

    const reconnect = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            await atariSoundService.initialize();
            setInitialized(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to reconnect');
            setInitialized(false);
        } finally {
            setLoading(false);
        }
    }, []);

    return { initialized, loading, error, updateSamples, playSample, reconnect };
}
