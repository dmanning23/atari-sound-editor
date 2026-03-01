// src/utils/atariSoundService.ts
import { SoundEffect } from '@/types';

declare global {
    interface Go {
        importObject: WebAssembly.Imports;
        run: (instance: WebAssembly.Instance) => Promise<void>;
    }

    interface Window {
        Go: {
            new(): Go;
        };
        updateSamples: (json: string) => void;
        playSample: (name: string) => void;
    }
}

export interface AtariSoundService {
    initialize(): Promise<void>;
    updateSamples(gameName: string, soundEffects: SoundEffect[]): void;
    playSample(name: string): Promise<void>;
    isInitialized(): boolean;
    getError(): string | null;
    setExitCallback(cb: () => void): void;
}

class AtariSoundServiceImpl implements AtariSoundService {
    private wasmModule: WebAssembly.Module | null = null;
    private goInstance: Go | null = null;
    private wasmInstance: WebAssembly.Instance | null = null;
    private initialized = false;
    private error: string | null = null;
    private initializationPromise: Promise<void> | null = null;
    private exited = false;

    // Cache the last-known samples so they can be restored after re-init
    private cachedGameName = '';
    private cachedSoundEffects: SoundEffect[] = [];

    // Called when the Go runtime exits (normal or error)
    private exitCallback: (() => void) | null = null;

    isInitialized(): boolean {
        return this.initialized && this.wasmInstance !== null && !this.exited;
    }

    getError(): string | null {
        return this.error;
    }

    setExitCallback(cb: () => void): void {
        this.exitCallback = cb;
    }

    async initialize(): Promise<void> {
        this.exited = false;

        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.doInitialize();
        return this.initializationPromise;
    }

    private async doInitialize(): Promise<void> {
        try {
            await this.loadWasmExec();

            if (!this.wasmModule) {
                this.wasmModule = await WebAssembly.compileStreaming(fetch("/main.wasm"));
            }

            await this.instantiateWasm();

            this.initialized = true;
            this.error = null;
        } catch (err) {
            this.initialized = false;
            this.error = err instanceof Error ? err.message : 'Failed to initialize WASM';
            console.error('WASM initialization error:', err);
            throw err;
        } finally {
            this.initializationPromise = null;
        }
    }

    private async loadWasmExec(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (window.Go) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = '/wasm_exec.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load wasm_exec.js'));
            document.head.appendChild(script);
        });
    }

    private async instantiateWasm(): Promise<void> {
        if (!this.wasmModule) {
            throw new Error('WASM module not loaded');
        }

        const go = new window.Go();
        this.goInstance = go;

        const instance = await WebAssembly.instantiate(this.wasmModule, go.importObject);
        this.wasmInstance = instance;
        this.exited = false;

        // Handle both normal exit (resolves) and error exit (rejects) — the original
        // code only used .catch(), so normal Go exits were silently missed.
        const handleExit = () => {
            console.log('Go instance exited');
            this.wasmInstance = null;
            this.goInstance = null;
            this.exited = true;
            this.exitCallback?.();
        };

        go.run(instance).then(handleExit, handleExit);
    }

    private sendCachedSamples(): void {
        if (this.cachedSoundEffects.length === 0 || !window.updateSamples) return;
        try {
            window.updateSamples(JSON.stringify({
                gameName: this.cachedGameName,
                soundEffects: this.cachedSoundEffects,
            }));
        } catch (e) {
            console.error('Failed to restore samples after re-init:', e);
        }
    }

    updateSamples(gameName: string, soundEffects: SoundEffect[]): void {
        // Always cache, regardless of whether WASM is ready
        this.cachedGameName = gameName;
        this.cachedSoundEffects = soundEffects;

        if (this.exited || !this.isInitialized() || !window.updateSamples) {
            console.warn('Skipping updateSamples: WASM not initialized or exited');
            return;
        }

        try {
            window.updateSamples(JSON.stringify({ gameName, soundEffects }));
        } catch (error) {
            console.error('Failed to update samples:', error);
            if (error instanceof Error && error.message.includes('Go program has already exited')) {
                this.wasmInstance = null;
                this.goInstance = null;
                this.exited = true;
            }
        }
    }

    async playSample(name: string): Promise<void> {
        if (this.exited || !this.isInitialized()) {
            await this.initialize();
            // Restore samples to the fresh Go instance before playing
            this.sendCachedSamples();
        }

        if (!window.playSample) {
            throw new Error('playSample function not available');
        }

        try {
            window.playSample(name);
        } catch (error) {
            console.error('Failed to play sample:', error);

            if (error instanceof Error && error.message.includes('Go program has already exited')) {
                this.wasmInstance = null;
                this.goInstance = null;
                this.exited = true;

                await this.initialize();
                this.sendCachedSamples();

                try {
                    window.playSample(name);
                } catch (retryError) {
                    console.error('Failed to play sample after re-initialization:', retryError);
                    throw retryError;
                }
            } else {
                throw error;
            }
        }
    }
}

const atariSoundService = new AtariSoundServiceImpl();
export default atariSoundService;
