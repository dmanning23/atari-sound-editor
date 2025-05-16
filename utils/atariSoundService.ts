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
}

class AtariSoundServiceImpl implements AtariSoundService {
    private wasmModule: WebAssembly.Module | null = null;
    private goInstance: Go | null = null;
    private wasmInstance: WebAssembly.Instance | null = null;
    private initialized = false;
    private error: string | null = null;
    private initializationPromise: Promise<void> | null = null;
    private exited = false;

    constructor() {
        // No initialization in constructor
    }

    isInitialized(): boolean {
        return this.initialized && this.wasmInstance !== null && !this.exited;
    }

    getError(): string | null {
        return this.error;
    }

    async initialize(): Promise<void> {
        // Clear exited flag when we initialize
        this.exited = false;

        // If already initializing, return the existing promise
        if (this.initializationPromise) {
            return this.initializationPromise;
        }

        this.initializationPromise = this.doInitialize();
        return this.initializationPromise;
    }

    private async doInitialize(): Promise<void> {
        try {
            // Load wasm_exec.js if needed
            await this.loadWasmExec();

            // Compile module if not already done
            if (!this.wasmModule) {
                this.wasmModule = await WebAssembly.compileStreaming(fetch("/main.wasm"));
            }

            // Instantiate the module
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

        // Create a new Go instance
        const go = new window.Go();
        this.goInstance = go;

        // Instantiate the module
        const instance = await WebAssembly.instantiate(this.wasmModule, go.importObject);
        this.wasmInstance = instance;
        this.exited = false;

        // Run the instance
        go.run(instance).catch((e: Error) => {
            console.log('Go instance exited, will re-instantiate on next use');
            this.wasmInstance = null;
            this.goInstance = null;
            this.exited = true;
        });
    }

    updateSamples(gameName: string, soundEffects: SoundEffect[]): void {
        // Skip if exited or not initialized
        if (this.exited || !this.isInitialized() || !window.updateSamples) {
            console.warn('Skipping updateSamples: WASM not initialized or exited');
            return;
        }

        const projectData = {
            gameName,
            soundEffects
        };

        try {
            window.updateSamples(JSON.stringify(projectData));
        } catch (error) {
            console.error('Failed to update samples:', error);

            // Check for Go exit error
            if (error instanceof Error && error.message.includes('Go program has already exited')) {
                this.wasmInstance = null;
                this.goInstance = null;
                this.exited = true;
            }
        }
    }

    async playSample(name: string): Promise<void> {
        // Re-instantiate if needed
        if (this.exited || !this.isInitialized()) {
            await this.initialize();
        }

        if (!window.playSample) {
            throw new Error('playSample function not available');
        }

        try {
            window.playSample(name);
        } catch (error) {
            console.error('Failed to play sample:', error);

            // If the error is about Go exiting, mark as not initialized
            if (error instanceof Error && error.message.includes('Go program has already exited')) {
                this.wasmInstance = null;
                this.goInstance = null;
                this.exited = true;

                // Try once more after re-initializing
                await this.initialize();
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

// Create and export a singleton instance
const atariSoundService = new AtariSoundServiceImpl();
export default atariSoundService;