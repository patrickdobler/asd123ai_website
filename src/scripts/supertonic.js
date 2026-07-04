// Supertonic 3 (multilingual) running fully in the browser via onnxruntime-web.
//
// This is a port of the official supertone-inc/supertonic web reference
// (web/helper.js). Language is conditioned by wrapping the text in <lang> tags
// (e.g. <de>...</de>), which the model was trained to recognize — no server and
// no external phonemizer required. The four ONNX models (~380 MB total) and the
// unicode indexer / config are fetched from Hugging Face on first use and
// cached by the browser; the onnxruntime-web runtime is self-hosted.

const ORT_MODULE = new URL('../vendor/paddleocr/ort.wasm.bundle.min.mjs', import.meta.url).href;
const ORT_WASM_DIR = new URL('../vendor/paddleocr/', import.meta.url).href;

const BASE = 'https://huggingface.co/Supertone/supertonic-3/resolve/main/';
const ONNX = `${BASE}onnx/`;
const VOICE_BASE = `${BASE}voice_styles/`;

// Languages this tool exposes (the model supports 31; we offer these).
const SUPERTONIC_LANGS = ['en', 'de', 'fr', 'es', 'it'];

let ortPromise = null;

async function loadOrt() {
    if (!ortPromise) {
        ortPromise = import(/* @vite-ignore */ ORT_MODULE).then(ort => {
            ort.env.wasm.wasmPaths = ORT_WASM_DIR;
            ort.env.wasm.numThreads = 1;
            return ort;
        }).catch(error => {
            ortPromise = null;
            throw error;
        });
    }
    return ortPromise;
}

// Fetch a model as bytes while reporting download progress. The progress shape
// matches the Transformers.js callback ({status, file, progress}) so the engine
// and worker can handle Supertonic and Kokoro identically.
async function fetchModelBytes(url, label, onProgress) {
    const report = pct => { if (onProgress) onProgress({ status: 'progress', file: label, progress: pct }); };
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download ${label} (HTTP ${res.status}).`);
    const total = Number(res.headers.get('content-length')) || 0;
    if (!res.body || !total) {
        report(null);
        return new Uint8Array(await res.arrayBuffer());
    }
    const reader = res.body.getReader();
    const chunks = [];
    let loaded = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        loaded += value.length;
        report((loaded / total) * 100);
    }
    const out = new Uint8Array(loaded);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out;
}

// ---------------------------------------------------------------------------
// Text preprocessing (ported from the official UnicodeProcessor)
// ---------------------------------------------------------------------------
const DASHES = { '–': '-', '‑': '-', '—': '-', '_': ' ', '“': '"', '”': '"', '‘': "'", '’': "'", '´': "'", '`': "'", '[': ' ', ']': ' ', '|': ' ', '/': ' ', '#': ' ', '→': ' ', '←': ' ' };
const EMOJI = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]+/gu;

function preprocessText(text, lang) {
    text = text.normalize('NFKD').replace(EMOJI, '');
    for (const [k, v] of Object.entries(DASHES)) text = text.replaceAll(k, v);
    text = text.replace(/[♥☆♡©\\]/g, '');
    text = text.replaceAll('@', ' at ').replaceAll('e.g.,', 'for example, ').replaceAll('i.e.,', 'that is, ');
    text = text.replace(/ ,/g, ',').replace(/ \./g, '.').replace(/ !/g, '!').replace(/ \?/g, '?').replace(/ ;/g, ';').replace(/ :/g, ':').replace(/ '/g, "'");
    while (text.includes('""')) text = text.replace('""', '"');
    while (text.includes("''")) text = text.replace("''", "'");
    text = text.replace(/\s+/g, ' ').trim();
    if (!/[.!?;:,'")\]}…。」』】〉》›»]$/.test(text)) text += '.';
    return `<${lang}>${text}</${lang}>`;
}

// Split text into sentence-based chunks under maxLen characters.
function chunkText(text, maxLen) {
    const paragraphs = text.trim().split(/\n\s*\n+/).filter(p => p.trim());
    const chunks = [];
    for (let paragraph of paragraphs) {
        paragraph = paragraph.trim();
        if (!paragraph) continue;
        const sentences = paragraph.split(/(?<=[.!?])\s+/);
        let cur = '';
        for (const s of sentences) {
            if (cur.length + s.length + 1 <= maxLen) {
                cur += (cur ? ' ' : '') + s;
            } else {
                if (cur) chunks.push(cur.trim());
                // Hard-split an over-long sentence on spaces.
                let rest = s;
                while (rest.length > maxLen) {
                    let cut = rest.lastIndexOf(' ', maxLen);
                    if (cut <= 0) cut = maxLen;
                    chunks.push(rest.slice(0, cut).trim());
                    rest = rest.slice(cut);
                }
                cur = rest;
            }
        }
        if (cur.trim()) chunks.push(cur.trim());
    }
    return chunks.length ? chunks : [text.trim()];
}

// ---------------------------------------------------------------------------
// Supertonic instance
// ---------------------------------------------------------------------------
class Supertonic {
    constructor(ort, cfg, indexer, sessions) {
        this.ort = ort;
        this.cfg = cfg;
        this.indexer = indexer;
        this.dp = sessions.dp;
        this.te = sessions.te;
        this.ve = sessions.ve;
        this.voc = sessions.voc;
        this.sampleRate = cfg.ae.sample_rate;
        this.voiceCache = new Map();
    }

    async _style(voice) {
        if (!this.voiceCache.has(voice)) {
            const res = await fetch(`${VOICE_BASE}${voice}.json`);
            if (!res.ok) {
                throw new Error(`Could not load the "${voice}" voice style (HTTP ${res.status}). Try another voice.`);
            }
            const vs = await res.json();
            this.voiceCache.set(voice, {
                ttl: new this.ort.Tensor('float32', Float32Array.from(vs.style_ttl.data.flat(Infinity)), vs.style_ttl.dims),
                dp: new this.ort.Tensor('float32', Float32Array.from(vs.style_dp.data.flat(Infinity)), vs.style_dp.dims)
            });
        }
        return this.voiceCache.get(voice);
    }

    async _infer(rawText, lang, style, totalStep, speed) {
        const ort = this.ort;
        const processed = preprocessText(rawText, lang);
        const ids = [];
        for (const ch of processed) {
            const cp = ch.codePointAt(0);
            ids.push(cp < this.indexer.length ? this.indexer[cp] : -1);
        }
        const len = ids.length;
        const textIds = new ort.Tensor('int64', BigInt64Array.from(ids.map(x => BigInt(x))), [1, len]);
        const textMask = new ort.Tensor('float32', new Float32Array(len).fill(1), [1, 1, len]);

        const dur = Array.from((await this.dp.run({ text_ids: textIds, style_dp: style.dp, text_mask: textMask })).duration.data).map(d => d / speed);
        const textEmb = (await this.te.run({ text_ids: textIds, style_ttl: style.ttl, text_mask: textMask })).text_emb;

        const SR = this.sampleRate;
        const chunkSize = this.cfg.ae.base_chunk_size * this.cfg.ttl.chunk_compress_factor;
        const wavLenMax = Math.floor(Math.max(...dur) * SR);
        const latentLen = Math.floor((wavLenMax + chunkSize - 1) / chunkSize);
        const latentDimVal = this.cfg.ttl.latent_dim * this.cfg.ttl.chunk_compress_factor;

        let xt = new Float32Array(latentDimVal * latentLen);
        for (let i = 0; i < xt.length; i++) {
            const u1 = Math.max(1e-4, Math.random());
            const u2 = Math.random();
            xt[i] = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        }
        const maskRow = new Float32Array(latentLen);
        const ll = Math.floor((Math.floor(dur[0] * SR) + chunkSize - 1) / chunkSize);
        for (let t = 0; t < Math.min(ll, latentLen); t++) maskRow[t] = 1;
        for (let d = 0; d < latentDimVal; d++) {
            for (let t = 0; t < latentLen; t++) xt[d * latentLen + t] *= maskRow[t];
        }
        const latentMask = new ort.Tensor('float32', maskRow.slice(), [1, 1, latentLen]);
        const totalStepT = new ort.Tensor('float32', new Float32Array([totalStep]), [1]);

        for (let step = 0; step < totalStep; step++) {
            const cur = new ort.Tensor('float32', new Float32Array([step]), [1]);
            const xtT = new ort.Tensor('float32', xt.slice(), [1, latentDimVal, latentLen]);
            const out = await this.ve.run({
                noisy_latent: xtT, text_emb: textEmb, style_ttl: style.ttl,
                latent_mask: latentMask, text_mask: textMask, current_step: cur, total_step: totalStepT
            });
            xt = Float32Array.from(out.denoised_latent.data);
        }

        const finalXt = new ort.Tensor('float32', xt.slice(), [1, latentDimVal, latentLen]);
        const wav = (await this.voc.run({ latent: finalXt })).wav_tts.data;
        return wav instanceof Float32Array ? wav : Float32Array.from(wav);
    }

    async generate(text, { lang = 'en', voice = 'M1', steps = 8, speed = 1.05, onChunk } = {}) {
        const style = await this._style(voice);
        const maxLen = (lang === 'ko' || lang === 'ja') ? 120 : 300;
        const chunks = chunkText(text, maxLen);
        const silence = Math.floor(0.3 * this.sampleRate);
        const parts = [];
        for (let i = 0; i < chunks.length; i++) {
            if (onChunk) onChunk(i, chunks.length);
            const wav = await this._infer(chunks[i], lang, style, steps, speed);
            if (i > 0) parts.push(new Float32Array(silence));
            parts.push(wav);
        }
        const totalLen = parts.reduce((n, a) => n + a.length, 0);
        const merged = new Float32Array(totalLen);
        let off = 0;
        for (const a of parts) { merged.set(a, off); off += a.length; }
        return { audio: merged, sampling_rate: this.sampleRate };
    }
}

// ---------------------------------------------------------------------------
// Loader (cached)
// ---------------------------------------------------------------------------
let instancePromise = null;

function loadSupertonic(onProgress) {
    if (!instancePromise) {
        instancePromise = (async () => {
            const ort = await loadOrt();
            const cfg = await (await fetch(`${ONNX}tts.json`)).json();
            const indexer = await (await fetch(`${ONNX}unicode_indexer.json`)).json();
            const opts = { executionProviders: ['wasm'] };
            const mk = async (file) => ort.InferenceSession.create(await fetchModelBytes(`${ONNX}${file}`, file, onProgress), opts);
            const dp = await mk('duration_predictor.onnx');
            const te = await mk('text_encoder.onnx');
            const ve = await mk('vector_estimator.onnx');
            const voc = await mk('vocoder.onnx');
            return new Supertonic(ort, cfg, indexer, { dp, te, ve, voc });
        })().catch(error => {
            instancePromise = null;
            throw error;
        });
    }
    return instancePromise;
}

function supertonicReady() {
    return instancePromise !== null;
}

export { loadSupertonic, supertonicReady, SUPERTONIC_LANGS };
