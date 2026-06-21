// Multi-model, multi-language text-to-speech engine running fully in the browser.
//
// - Supertonic 3 (official ONNX, onnxruntime-web) is genuinely multilingual:
//   the language is conditioned by wrapping text in <lang> tags. See
//   ./supertonic.js. Used for English, German, French, Spanish.
// - Kokoro (kokoro-js) covers English natively; for Spanish/French/Italian we
//   phonemize with the standalone eSpeak NG phonemizer and call
//   generate_from_ids() directly (the voice check is bypassed there).
//
// Runtimes and model weights are fetched on first use and cached by the
// browser. Text is processed locally and never sent to ASD123.ai.

import { loadSupertonic, SUPERTONIC_LANGS } from './supertonic.js';

const KOKORO_CDN = 'https://cdn.jsdelivr.net/npm/kokoro-js@1.2.1';
// Full eSpeak NG (all languages) compiled to WASM, used to phonemize the
// non-English Kokoro voices to IPA. ~19 MB, loaded only when first needed.
const ESPEAK_BASE = 'https://cdn.jsdelivr.net/npm/espeak-ng@1.0.2/dist/';

const KOKORO_REPO = 'onnx-community/Kokoro-82M-v1.0-ONNX';

// ---------------------------------------------------------------------------
// Languages (order shown in the language selector)
// ---------------------------------------------------------------------------
const LANGUAGES = [
    { code: 'en', label: 'English' },
    { code: 'de', label: 'German' },
    { code: 'fr', label: 'French' },
    { code: 'es', label: 'Spanish' },
    { code: 'it', label: 'Italian' }
];

// ---------------------------------------------------------------------------
// Kokoro: precision variants (shown directly in the model dropdown) and voices
// ---------------------------------------------------------------------------
const KOKORO_SIZES = [
    { dtype: 'q8', label: '8-bit', mb: 88 },
    { dtype: 'fp16', label: '16-bit', mb: 156 },
    { dtype: 'fp32', label: '32-bit', mb: 310 }
];

// English voices use kokoro-js's own phonemizer (accent picked from the prefix).
// Non-English voices are phonemized with the standalone eSpeak NG phonemizer.
// `grade` is the upstream "Overall Grade" from hexgrad/Kokoro-82M VOICES.md.
// English voices are ordered best-grade first. Spanish voices have no published
// grade. Voices are sorted within each accent by grade.
const KOKORO_VOICES = {
    en: [
        { id: 'af_heart', name: 'Heart', gender: 'Female', accent: 'American', grade: 'A' },
        { id: 'af_bella', name: 'Bella', gender: 'Female', accent: 'American', grade: 'A-' },
        { id: 'af_nicole', name: 'Nicole', gender: 'Female', accent: 'American', grade: 'B-' },
        { id: 'af_aoede', name: 'Aoede', gender: 'Female', accent: 'American', grade: 'C+' },
        { id: 'af_kore', name: 'Kore', gender: 'Female', accent: 'American', grade: 'C+' },
        { id: 'af_sarah', name: 'Sarah', gender: 'Female', accent: 'American', grade: 'C+' },
        { id: 'af_nova', name: 'Nova', gender: 'Female', accent: 'American', grade: 'C' },
        { id: 'af_alloy', name: 'Alloy', gender: 'Female', accent: 'American', grade: 'C' },
        { id: 'af_sky', name: 'Sky', gender: 'Female', accent: 'American', grade: 'C-' },
        { id: 'af_jessica', name: 'Jessica', gender: 'Female', accent: 'American', grade: 'D' },
        { id: 'af_river', name: 'River', gender: 'Female', accent: 'American', grade: 'D' },
        { id: 'am_michael', name: 'Michael', gender: 'Male', accent: 'American', grade: 'C+' },
        { id: 'am_fenrir', name: 'Fenrir', gender: 'Male', accent: 'American', grade: 'C+' },
        { id: 'am_puck', name: 'Puck', gender: 'Male', accent: 'American', grade: 'C+' },
        { id: 'am_echo', name: 'Echo', gender: 'Male', accent: 'American', grade: 'D' },
        { id: 'am_eric', name: 'Eric', gender: 'Male', accent: 'American', grade: 'D' },
        { id: 'am_liam', name: 'Liam', gender: 'Male', accent: 'American', grade: 'D' },
        { id: 'am_onyx', name: 'Onyx', gender: 'Male', accent: 'American', grade: 'D' },
        { id: 'am_santa', name: 'Santa', gender: 'Male', accent: 'American', grade: 'D-' },
        { id: 'am_adam', name: 'Adam', gender: 'Male', accent: 'American', grade: 'F+' },
        { id: 'bf_emma', name: 'Emma', gender: 'Female', accent: 'British', grade: 'B-' },
        { id: 'bf_isabella', name: 'Isabella', gender: 'Female', accent: 'British', grade: 'C' },
        { id: 'bf_alice', name: 'Alice', gender: 'Female', accent: 'British', grade: 'D' },
        { id: 'bf_lily', name: 'Lily', gender: 'Female', accent: 'British', grade: 'D' },
        { id: 'bm_george', name: 'George', gender: 'Male', accent: 'British', grade: 'C' },
        { id: 'bm_fable', name: 'Fable', gender: 'Male', accent: 'British', grade: 'C' },
        { id: 'bm_lewis', name: 'Lewis', gender: 'Male', accent: 'British', grade: 'D+' },
        { id: 'bm_daniel', name: 'Daniel', gender: 'Male', accent: 'British', grade: 'D' }
    ],
    es: [
        { id: 'ef_dora', name: 'Dora', gender: 'Female' },
        { id: 'em_alex', name: 'Alex', gender: 'Male' },
        { id: 'em_santa', name: 'Santa', gender: 'Male' }
    ],
    fr: [
        { id: 'ff_siwis', name: 'Siwis', gender: 'Female', grade: 'B-' }
    ],
    it: [
        { id: 'if_sara', name: 'Sara', gender: 'Female', grade: 'C' },
        { id: 'im_nicola', name: 'Nicola', gender: 'Male', grade: 'C' }
    ]
    // Kokoro ships no German voice, so German is handled by Supertonic.
};

// eSpeak NG voice code per language for the non-English Kokoro path.
const KOKORO_ESPEAK = { es: 'es', fr: 'fr-fr', it: 'it' };

// ---------------------------------------------------------------------------
// Supertonic 3: ten language-agnostic preset voices (no official names exist).
// Multilingual via <lang> tags — see ./supertonic.js. SUPERTONIC_LANGS is
// imported from there (en, de, fr, es).
// ---------------------------------------------------------------------------
const SUPERTONIC_VOICES = [
    { id: 'F1', name: 'Female 1', gender: 'Female' },
    { id: 'F2', name: 'Female 2', gender: 'Female' },
    { id: 'F3', name: 'Female 3', gender: 'Female' },
    { id: 'F4', name: 'Female 4', gender: 'Female' },
    { id: 'F5', name: 'Female 5', gender: 'Female' },
    { id: 'M1', name: 'Male 1', gender: 'Male' },
    { id: 'M2', name: 'Male 2', gender: 'Male' },
    { id: 'M3', name: 'Male 3', gender: 'Male' },
    { id: 'M4', name: 'Male 4', gender: 'Male' },
    { id: 'M5', name: 'Male 5', gender: 'Male' }
];
const SUPERTONIC_MB = 380;

// ---------------------------------------------------------------------------
// Registry helpers
// ---------------------------------------------------------------------------
function getLanguages() {
    return LANGUAGES;
}

function kokoroSupports(langCode) {
    return Array.isArray(KOKORO_VOICES[langCode]) && KOKORO_VOICES[langCode].length > 0;
}

// Build the model dropdown options for a language. Each option carries the
// engine + precision so the controller can synthesize without extra lookups.
// Order: Kokoro variants first (higher quality), then Supertonic.
function getModelOptions(langCode) {
    const options = [];
    if (kokoroSupports(langCode)) {
        for (const size of KOKORO_SIZES) {
            options.push({
                key: `kokoro:${size.dtype}`,
                engine: 'kokoro',
                dtype: size.dtype,
                mb: size.mb,
                label: `Kokoro · ${size.label} (~${size.mb} MB)`
            });
        }
    }
    if (SUPERTONIC_LANGS.includes(langCode)) {
        options.push({
            key: 'supertonic:std',
            engine: 'supertonic',
            dtype: 'std',
            mb: SUPERTONIC_MB,
            label: `Supertonic (~${SUPERTONIC_MB} MB)`
        });
    }
    return options;
}

function getVoices(engine, langCode) {
    if (engine === 'kokoro') return KOKORO_VOICES[langCode] || [];
    return SUPERTONIC_VOICES;
}

function modelLabel(engine) {
    return engine === 'kokoro' ? 'Kokoro' : 'Supertonic';
}

// ---------------------------------------------------------------------------
// Lazy runtime loading (cached per model + precision)
// ---------------------------------------------------------------------------
const runtimeCache = new Map();
let espeakFactoryPromise = null;
let espeakReady = false;

function runtimeKey(engine, dtype) {
    return `${engine}:${dtype}`;
}

async function loadKokoro(dtype, onProgress) {
    const { KokoroTTS } = await import(/* @vite-ignore */ KOKORO_CDN);
    return KokoroTTS.from_pretrained(KOKORO_REPO, { dtype, progress_callback: onProgress });
}

function loadRuntime(engine, dtype, onProgress) {
    const key = runtimeKey(engine, dtype);
    if (!runtimeCache.has(key)) {
        const promise = (engine === 'kokoro'
            ? loadKokoro(dtype, onProgress)
            : loadSupertonic(onProgress)
        ).catch(error => {
            runtimeCache.delete(key);
            throw error;
        });
        runtimeCache.set(key, promise);
    }
    return runtimeCache.get(key);
}

async function loadEspeakFactory() {
    if (!espeakFactoryPromise) {
        espeakFactoryPromise = import(/* @vite-ignore */ `${ESPEAK_BASE}espeak-ng.js`)
            .then(mod => mod.default || mod)
            .catch(error => {
                espeakFactoryPromise = null;
                throw error;
            });
    }
    return espeakFactoryPromise;
}

// Phonemize `text` to IPA for an eSpeak voice (e.g. "es", "fr-fr", "it"),
// matching the phoneme format kokoro-js's tokenizer expects.
async function phonemizeToIpa(text, espeakVoice) {
    const ESpeakNg = await loadEspeakFactory();
    const bytes = new TextEncoder().encode(text);
    const espeak = await ESpeakNg({
        locateFile: p => `${ESPEAK_BASE}${p}`,
        preRun: [M => { M.FS.writeFile('in.txt', bytes); }],
        // -b 1 (NOT -b=1, which eSpeak misparses) selects UTF-8 input.
        arguments: ['--phonout', 'out', '--ipa', '--sep=', '-q', '-b', '1', '-v', espeakVoice, '-f', 'in.txt']
    });
    espeakReady = true;
    let out = '';
    try {
        out = espeak.FS.readFile('out', { encoding: 'utf8' });
    } catch (_) {
        out = '';
    }
    return out.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Chunking + WAV helpers (long text exceeds the model's ~510-token window, so
// it is split into chunks, synthesized separately, and concatenated)
// ---------------------------------------------------------------------------

// Greedily pack sentences into chunks no longer than maxLen characters.
function chunkBySentence(text, maxLen) {
    const pieces = text.match(/[^.!?。！?？\n]+[.!?。！?？]*\s*|\n+/g) || [text];
    const chunks = [];
    let cur = '';
    const pushHardSplit = piece => {
        let rest = piece;
        while (rest.length > maxLen) {
            let cut = rest.lastIndexOf(' ', maxLen);
            if (cut <= 0) cut = maxLen;
            chunks.push(rest.slice(0, cut).trim());
            rest = rest.slice(cut);
        }
        return rest;
    };
    for (const piece of pieces) {
        if ((cur + piece).length > maxLen && cur.trim()) {
            chunks.push(cur.trim());
            cur = '';
        }
        if (piece.length > maxLen) {
            cur = pushHardSplit(cur + piece);
        } else {
            cur += piece;
        }
    }
    if (cur.trim()) chunks.push(cur.trim());
    return chunks.filter(Boolean);
}

// Pack whitespace-separated IPA tokens into chunks no longer than maxLen.
function chunkPhonemes(phonemes, maxLen) {
    const words = phonemes.split(/\s+/).filter(Boolean);
    const chunks = [];
    let cur = '';
    for (const w of words) {
        if ((cur + ' ' + w).length > maxLen && cur) {
            chunks.push(cur);
            cur = w;
        } else {
            cur = cur ? `${cur} ${w}` : w;
        }
    }
    if (cur) chunks.push(cur);
    return chunks;
}

function concatFloat32(parts) {
    const total = parts.reduce((n, a) => n + (a ? a.length : 0), 0);
    const out = new Float32Array(total);
    let off = 0;
    for (const a of parts) {
        if (a) { out.set(a, off); off += a.length; }
    }
    return out;
}

// Encode mono Float32 PCM (-1..1) as a 16-bit PCM WAV Blob.
function encodeWav(samples, sampleRate) {
    const n = samples.length;
    const buffer = new ArrayBuffer(44 + n * 2);
    const view = new DataView(buffer);
    const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + n * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeStr(36, 'data');
    view.setUint32(40, n * 2, true);
    let off = 44;
    for (let i = 0; i < n; i++) {
        const s = Math.max(-1, Math.min(1, samples[i]));
        view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        off += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

const yieldToUi = () => new Promise(resolve => setTimeout(resolve, 0));

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------
class TtsEngine {
    constructor() {
        this.languages = LANGUAGES;
    }

    getLanguages() {
        return getLanguages();
    }

    getModelOptions(langCode) {
        return getModelOptions(langCode);
    }

    getVoices(engine, langCode) {
        return getVoices(engine, langCode);
    }

    modelLabel(engine) {
        return modelLabel(engine);
    }

    isReady(engine, dtype) {
        return runtimeCache.has(runtimeKey(engine, dtype));
    }

    // Non-English Kokoro needs the eSpeak NG pronunciation pack.
    needsPhonemizer(engine, langCode) {
        return engine === 'kokoro' && langCode !== 'en';
    }

    isPhonemizerReady() {
        return espeakReady;
    }

    /**
     * Generate speech. Long text is split into chunks, synthesized one at a
     * time (yielding to the UI between chunks), and concatenated, so there is
     * no ~23 s ceiling and the page can report progress instead of freezing.
     * @returns {{ blob: Blob, audio: Float32Array, sampleRate: number, durationSec: number }}
     */
    async synthesize(text, { engine, dtype, langCode, voice, steps = 8, speed = 1.0, onProgress, onChunk } = {}) {
        const trimmed = String(text || '').trim();
        if (!trimmed) throw new Error('Enter some text to generate speech.');
        if (!engine || !dtype) throw new Error('Select a model to generate speech.');

        const runtime = await loadRuntime(engine, dtype, onProgress);

        // Supertonic 3 handles language (<lang> tags) and chunking internally.
        if (engine === 'supertonic') {
            const result = await runtime.generate(trimmed, { lang: langCode, voice, steps, speed, onChunk });
            const merged = result.audio instanceof Float32Array ? result.audio : Float32Array.from(result.audio || []);
            if (!merged.length) throw new Error('No audio was generated.');
            const sampleRate = result.sampling_rate || 44100;
            return { blob: encodeWav(merged, sampleRate), audio: merged, sampleRate, durationSec: merged.length / sampleRate };
        }

        // Kokoro: build synthesis units. Non-English is phonemized once for the
        // whole text (one eSpeak load), then the IPA is chunked.
        let units;
        if (langCode !== 'en') {
            const espeakCode = KOKORO_ESPEAK[langCode] || 'en-us';
            const phonemes = await phonemizeToIpa(trimmed, espeakCode);
            if (!phonemes) throw new Error('Could not phonemize the text for this language.');
            units = chunkPhonemes(phonemes, 450).map(p => ({ phonemes: p }));
        } else {
            units = chunkBySentence(trimmed, 300).map(t => ({ text: t }));
        }
        if (!units.length) units = [{ text: trimmed }];

        const generateUnit = async unit => {
            if (unit.phonemes !== undefined) {
                const { input_ids } = runtime.tokenizer(unit.phonemes, { truncation: true });
                return runtime.generate_from_ids(input_ids, { voice, speed });
            }
            return runtime.generate(unit.text, { voice, speed });
        };

        const parts = [];
        let sampleRate = 24000;
        for (let i = 0; i < units.length; i++) {
            if (onChunk) onChunk(i, units.length);
            await yieldToUi(); // let the status paint before the blocking compute
            const result = await generateUnit(units[i]);
            if (result.audio instanceof Float32Array) parts.push(result.audio);
            sampleRate = result.sampling_rate || sampleRate;
        }

        const merged = concatFloat32(parts);
        if (!merged.length) throw new Error('No audio was generated.');
        return {
            blob: encodeWav(merged, sampleRate),
            audio: merged,
            sampleRate,
            durationSec: merged.length / sampleRate
        };
    }
}

export {
    TtsEngine,
    LANGUAGES,
    KOKORO_VOICES,
    SUPERTONIC_VOICES
};
