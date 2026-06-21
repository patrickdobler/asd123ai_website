// Web Worker that runs all speech synthesis off the main thread, so the page
// stays responsive while a model downloads and audio is generated.
//
// The heavy work (Transformers.js / kokoro-js / eSpeak NG inference) happens
// here; the main thread only sends the request and receives progress messages
// plus the final audio. The engine module is shared with the main thread,
// which uses it only for lightweight registry lookups.

import { TtsEngine } from './tts.js';

const engine = new TtsEngine();

self.onmessage = async event => {
    const { id, payload } = event.data || {};
    if (!payload) return;

    try {
        const result = await engine.synthesize(payload.text, {
            engine: payload.engine,
            dtype: payload.dtype,
            langCode: payload.langCode,
            voice: payload.voice,
            steps: payload.steps,
            speed: payload.speed,
            onProgress: progress => {
                // Forward only the cloneable fields of the progress object.
                if (progress && progress.status === 'progress' && progress.file) {
                    self.postMessage({
                        id,
                        type: 'progress',
                        file: String(progress.file),
                        progress: typeof progress.progress === 'number' ? progress.progress : null
                    });
                }
            },
            onChunk: (i, total) => self.postMessage({ id, type: 'chunk', i, total })
        });

        // Transfer the audio buffer (zero-copy). The WAV Blob is cloned by reference.
        const transfer = result.audio && result.audio.buffer ? [result.audio.buffer] : [];
        self.postMessage({ id, type: 'done', result }, transfer);
    } catch (error) {
        self.postMessage({ id, type: 'error', message: (error && error.message) ? error.message : String(error) });
    }
};
