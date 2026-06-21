// PP-OCRv6 OCR pipeline running fully in the browser via onnxruntime-web.
//
// Two ONNX models per tier: a DBNet text detector (produces a probability map
// of where text is) and a CTC recognizer (reads the text in each detected
// box). Everything here runs locally; no image or text ever leaves the device.
//
// Tiers (download size of the two models combined):
//   tiny   ~6 MB    small  ~31 MB    medium ~138 MB
// The onnxruntime-web WASM runtime (~13 MB) is shared across tiers and loaded
// once on first OCR use.

const ORT_BASE = 'vendor/paddleocr/';
const MODEL_BASE = 'vendor/paddleocr/models/';

// Only the tiny tier is shipped. Small and medium ONNX files are large (small
// rec ~20 MB, medium files exceed Cloudflare Workers' 25 MiB per-asset limit),
// so tiny is the single self-hosted tier.
const TIERS = {
    tiny: { det: 'v6_tiny_det.onnx', rec: 'v6_tiny_rec.onnx' }
};

// Detection config from PP-OCRv6 det inference.yml.
const DET_MEAN = [0.485, 0.456, 0.406];
const DET_STD = [0.229, 0.224, 0.225];
const DET_THRESH = 0.2;        // binarize the probability map
const DET_BOX_THRESH = 0.4;    // minimum mean confidence to keep a box
const DET_UNCLIP_RATIO = 1.4;  // expand each box outward
const DET_MAX_SIDE = 960;      // longest side after resize (multiple of 32)
const REC_HEIGHT = 48;         // recognizer input height
const REC_MAX_WIDTH = 1600;    // cap recognizer input width

let ortPromise = null;
async function loadOrt() {
    if (!ortPromise) {
        ortPromise = (async () => {
            const ort = await import('../vendor/paddleocr/ort.wasm.bundle.min.mjs');
            // wasmPaths is used as a dynamic-import() specifier for the wasm glue,
            // so it must be an absolute URL, not a bare relative path.
            ort.env.wasm.wasmPaths = new URL(ORT_BASE, document.baseURI).href;
            ort.env.wasm.numThreads = 1;
            return ort;
        })().catch(error => {
            ortPromise = null;
            throw error;
        });
    }
    return ortPromise;
}

let charsetPromise = null;
async function loadCharset() {
    if (!charsetPromise) {
        charsetPromise = (async () => {
            const response = await fetch(`${ORT_BASE}charset.json`);
            if (!response.ok) throw new Error('Failed to load OCR character set.');
            const chars = await response.json();
            // CTC decode: index 0 is the blank token, the dictionary follows,
            // and a trailing space token closes the set (PaddleOCR convention).
            return ['<blank>', ...chars, ' '];
        })();
    }
    return charsetPromise;
}

const sessionCache = new Map();
async function loadSession(ort, url) {
    if (!sessionCache.has(url)) {
        sessionCache.set(url, ort.InferenceSession.create(url, {
            executionProviders: ['wasm'],
            graphOptimizationLevel: 'all'
        }).catch(error => {
            sessionCache.delete(url);
            throw error;
        }));
    }
    return sessionCache.get(url);
}

function clamp(value, lo, hi) {
    return Math.max(lo, Math.min(hi, value));
}

// Draw a source bitmap onto a canvas at a target size and return its pixels.
function rasterize(source, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(source, 0, 0, width, height);
    return ctx.getImageData(0, 0, width, height);
}

class OcrEngine {
    constructor({ tier = 'tiny' } = {}) {
        this.tier = TIERS[tier] ? tier : 'tiny';
    }

    async run(imageSource, statusCallback) {
        const setStatus = statusCallback || (() => {});
        const tier = this.tier;
        setStatus('Loading OCR runtime (one-time download)...');
        const [ort, charset] = await Promise.all([loadOrt(), loadCharset()]);

        setStatus(`Loading ${tier} OCR models...`);
        const models = TIERS[tier];
        const [detSession, recSession] = await Promise.all([
            loadSession(ort, `${MODEL_BASE}${models.det}`),
            loadSession(ort, `${MODEL_BASE}${models.rec}`)
        ]);

        setStatus('Detecting text regions...');
        const bitmap = await this.toBitmap(imageSource);
        const boxes = await this.detect(ort, detSession, bitmap);
        if (!boxes.length) {
            return { lines: [], text: '' };
        }

        const lines = [];
        for (let i = 0; i < boxes.length; i++) {
            if (i % 5 === 0) {
                setStatus(`Reading text ${i + 1} of ${boxes.length}...`);
                await new Promise(resolve => setTimeout(resolve, 0));
            }
            const text = await this.recognize(ort, recSession, charset, bitmap, boxes[i]);
            if (text && text.trim()) {
                lines.push({ box: boxes[i], text: text.trim() });
            }
        }

        return { lines, text: this.composeText(lines) };
    }

    async toBitmap(source) {
        if (source instanceof HTMLCanvasElement) return source;
        if (typeof ImageBitmap !== 'undefined' && source instanceof ImageBitmap) return source;
        // Blob / File -> ImageBitmap
        if (source instanceof Blob) {
            return createImageBitmap(source);
        }
        // HTMLImageElement already loaded
        return source;
    }

    // ---- Detection (DBNet) ----

    async detect(ort, session, bitmap) {
        const srcW = bitmap.width;
        const srcH = bitmap.height;

        // Resize so the longest side <= DET_MAX_SIDE and both sides are /32.
        let scale = Math.min(DET_MAX_SIDE / Math.max(srcW, srcH), 1);
        let rw = Math.max(32, Math.round((srcW * scale) / 32) * 32);
        let rh = Math.max(32, Math.round((srcH * scale) / 32) * 32);

        const imageData = rasterize(bitmap, rw, rh);
        const input = this.normalizeForDet(imageData, rw, rh);

        const tensor = new ort.Tensor('float32', input, [1, 3, rh, rw]);
        const feeds = {};
        feeds[session.inputNames[0]] = tensor;
        const output = await session.run(feeds);
        const probMap = output[session.outputNames[0]];
        const [, , outH, outW] = probMap.dims;
        const data = probMap.data;

        const boxes = this.boxesFromProbMap(data, outW, outH);
        // Map boxes back to original image coordinates.
        const sx = srcW / outW;
        const sy = srcH / outH;
        return boxes.map(b => ({
            x: clamp(Math.floor(b.x * sx), 0, srcW - 1),
            y: clamp(Math.floor(b.y * sy), 0, srcH - 1),
            w: clamp(Math.ceil(b.w * sx), 1, srcW),
            h: clamp(Math.ceil(b.h * sy), 1, srcH)
        }));
    }

    normalizeForDet(imageData, w, h) {
        const { data } = imageData;
        const size = w * h;
        const out = new Float32Array(3 * size);
        for (let i = 0; i < size; i++) {
            const r = data[i * 4] / 255;
            const g = data[i * 4 + 1] / 255;
            const b = data[i * 4 + 2] / 255;
            out[i] = (r - DET_MEAN[0]) / DET_STD[0];
            out[size + i] = (g - DET_MEAN[1]) / DET_STD[1];
            out[size * 2 + i] = (b - DET_MEAN[2]) / DET_STD[2];
        }
        return out;
    }

    // Threshold the probability map, label connected components, and emit an
    // axis-aligned box per component (with confidence + unclip expansion).
    boxesFromProbMap(data, w, h) {
        const bin = new Uint8Array(w * h);
        for (let i = 0; i < w * h; i++) {
            bin[i] = data[i] > DET_THRESH ? 1 : 0;
        }

        const visited = new Uint8Array(w * h);
        const boxes = [];
        const stack = new Int32Array(w * h);

        for (let start = 0; start < w * h; start++) {
            if (!bin[start] || visited[start]) continue;
            // Iterative flood fill (4-connectivity).
            let top = 0;
            stack[top++] = start;
            visited[start] = 1;
            let minX = w, minY = h, maxX = 0, maxY = 0;
            let sum = 0, count = 0;

            while (top > 0) {
                const idx = stack[--top];
                const x = idx % w;
                const y = (idx - x) / w;
                sum += data[idx];
                count++;
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;

                if (x > 0 && bin[idx - 1] && !visited[idx - 1]) { visited[idx - 1] = 1; stack[top++] = idx - 1; }
                if (x < w - 1 && bin[idx + 1] && !visited[idx + 1]) { visited[idx + 1] = 1; stack[top++] = idx + 1; }
                if (y > 0 && bin[idx - w] && !visited[idx - w]) { visited[idx - w] = 1; stack[top++] = idx - w; }
                if (y < h - 1 && bin[idx + w] && !visited[idx + w]) { visited[idx + w] = 1; stack[top++] = idx + w; }
            }

            const boxW = maxX - minX + 1;
            const boxH = maxY - minY + 1;
            if (count < 4 || boxW < 3 || boxH < 3) continue;
            const confidence = sum / count;
            if (confidence < DET_BOX_THRESH) continue;

            // Unclip: expand the box outward proportionally to its size.
            const expandX = (boxW * (DET_UNCLIP_RATIO - 1)) / 2;
            const expandY = (boxH * (DET_UNCLIP_RATIO - 1)) / 2;
            boxes.push({
                x: clamp(minX - expandX, 0, w - 1),
                y: clamp(minY - expandY, 0, h - 1),
                w: Math.min(boxW + expandX * 2, w),
                h: Math.min(boxH + expandY * 2, h),
                confidence
            });
        }

        // Reading order: top-to-bottom, then left-to-right within a row band.
        boxes.sort((a, b) => {
            const rowBand = Math.max(a.h, b.h) * 0.5;
            if (Math.abs(a.y - b.y) > rowBand) return a.y - b.y;
            return a.x - b.x;
        });
        return boxes;
    }

    // ---- Recognition (CTC) ----

    async recognize(ort, session, charset, bitmap, box) {
        // Crop the box region, resize to fixed height, normalize to [-1, 1].
        const targetH = REC_HEIGHT;
        const ratio = box.w / box.h;
        let targetW = Math.round(targetH * ratio);
        targetW = clamp(targetW, REC_HEIGHT, REC_MAX_WIDTH);

        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, box.x, box.y, box.w, box.h, 0, 0, targetW, targetH);
        const { data } = ctx.getImageData(0, 0, targetW, targetH);

        const size = targetW * targetH;
        const input = new Float32Array(3 * size);
        for (let i = 0; i < size; i++) {
            // PaddleOCR rec normalization: (pixel/255 - 0.5) / 0.5
            input[i] = (data[i * 4] / 255 - 0.5) / 0.5;
            input[size + i] = (data[i * 4 + 1] / 255 - 0.5) / 0.5;
            input[size * 2 + i] = (data[i * 4 + 2] / 255 - 0.5) / 0.5;
        }

        const tensor = new ort.Tensor('float32', input, [1, 3, targetH, targetW]);
        const feeds = {};
        feeds[session.inputNames[0]] = tensor;
        const output = await session.run(feeds);
        const logits = output[session.outputNames[0]];
        return this.ctcDecode(logits, charset);
    }

    // CTC greedy decode: argmax per timestep, drop repeats and blanks.
    ctcDecode(logits, charset) {
        const dims = logits.dims; // [1, T, C]
        const T = dims[1];
        const C = dims[2];
        const data = logits.data;
        let result = '';
        let lastIndex = -1;

        for (let t = 0; t < T; t++) {
            let best = 0;
            let bestVal = -Infinity;
            const base = t * C;
            for (let c = 0; c < C; c++) {
                const v = data[base + c];
                if (v > bestVal) { bestVal = v; best = c; }
            }
            if (best !== 0 && best !== lastIndex) {
                result += charset[best] !== undefined ? charset[best] : '';
            }
            lastIndex = best;
        }
        return result;
    }

    // Group recognized lines into paragraphs by vertical gaps.
    composeText(lines) {
        if (!lines.length) return '';

        // Measure the gap between each line's bottom and the next line's top,
        // then treat only gaps well above the typical line spacing as paragraph
        // breaks. A fixed fraction of line height splits too eagerly on normal
        // single-spaced text.
        const gaps = [];
        for (let i = 1; i < lines.length; i++) {
            const gap = lines[i].box.y - (lines[i - 1].box.y + lines[i - 1].box.h);
            if (gap > 0) gaps.push(gap);
        }
        gaps.sort((a, b) => a - b);
        const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;

        const out = [];
        let prevBottom = null;
        let prevHeight = null;

        for (const line of lines) {
            const top = line.box.y;
            const height = line.box.h;
            if (prevBottom !== null) {
                const gap = top - prevBottom;
                // New paragraph when the gap clearly exceeds normal line spacing.
                const threshold = Math.max(medianGap * 1.8, (prevHeight || height) * 0.9);
                if (gap > threshold) {
                    out.push('');
                }
            }
            out.push(line.text);
            prevBottom = top + height;
            prevHeight = height;
        }

        // Join: blank entries become paragraph breaks, consecutive text lines
        // join with a single newline.
        const paragraphs = [];
        let current = [];
        for (const entry of out) {
            if (entry === '') {
                if (current.length) { paragraphs.push(current.join('\n')); current = []; }
            } else {
                current.push(entry);
            }
        }
        if (current.length) paragraphs.push(current.join('\n'));
        return paragraphs.join('\n\n');
    }
}

export { OcrEngine, TIERS };
