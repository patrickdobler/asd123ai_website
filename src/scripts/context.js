const CONTEXT_WINDOWS = [4096, 8192, 16384, 32768, 65536, 131072];
const FIXED_PROMPT_OVERHEAD = 300;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const MODEL_PROFILES = {
    generic: {
        label: 'Generic LLM',
        charsPerToken: 4.0,
        wordsPerTokenFactor: 1.32,
        cjkCharsPerToken: 1.55,
        otherScriptCharsPerToken: 2.6,
        multiplier: 1
    },
    llama: {
        label: 'Llama / Mistral',
        charsPerToken: 3.8,
        wordsPerTokenFactor: 1.36,
        cjkCharsPerToken: 1.45,
        otherScriptCharsPerToken: 2.4,
        multiplier: 1.05
    },
    qwen: {
        label: 'Qwen',
        charsPerToken: 3.6,
        wordsPerTokenFactor: 1.42,
        cjkCharsPerToken: 1.25,
        otherScriptCharsPerToken: 2.7,
        multiplier: 1.08
    },
    gemma: {
        label: 'Gemma',
        charsPerToken: 4.2,
        wordsPerTokenFactor: 1.28,
        cjkCharsPerToken: 1.65,
        otherScriptCharsPerToken: 2.9,
        multiplier: 1
    },
    gpt: {
        label: 'GPT-style',
        charsPerToken: 4.0,
        wordsPerTokenFactor: 1.33,
        cjkCharsPerToken: 1.45,
        otherScriptCharsPerToken: 2.5,
        multiplier: 1
    }
};

// Exact counting (opt-in): tokenizer-only downloads, no model weights.
const TRANSFORMERS_CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0';
const TOKENIZER_REPOS = {
    generic: 'Xenova/gpt-4o',
    gpt: 'Xenova/gpt-4o',
    llama: 'onnx-community/Llama-3.2-1B-Instruct',
    qwen: 'onnx-community/Qwen3.5-0.8B-ONNX',
    gemma: 'onnx-community/gemma-4-E2B-it-ONNX'
};

const STATUS_COPY = {
    empty: {
        label: '-',
        tone: 'neutral',
        detail: 'Paste text or upload a supported file to estimate the context window.'
    },
    tooSmall: {
        label: 'Too small',
        tone: 'danger',
        detail: 'This context window is likely to overflow before the model can answer.'
    },
    tight: {
        label: 'Tight',
        tone: 'warning',
        detail: 'This can work, but leaves little room for a useful answer.'
    },
    good: {
        label: 'Good',
        tone: 'good',
        detail: 'This leaves practical space for the prompt and a normal answer.'
    },
    overkill: {
        label: 'Overkill',
        tone: 'neutral',
        detail: 'This is more context than the current input usually needs.'
    }
};

function formatTokens(value) {
    const rounded = Math.max(0, Math.round(Number(value) || 0));
    return rounded.toLocaleString('en-US');
}

function formatContext(value) {
    const numeric = Number(value) || 0;
    return numeric >= 1024 ? `${Math.round(numeric / 1024)}K` : String(numeric);
}

function normalizeText(text) {
    return String(text || '')
        .replace(/\r\n/g, '\n')
        .replace(/\u00a0/g, ' ')
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim();
}

function estimateTokens(text, profileId) {
    const normalized = normalizeText(text);
    if (!normalized) {
        return {
            normalized,
            contentTokens: 0,
            estimatedInputTokens: 0,
            characters: 0,
            words: 0,
            cjkShare: 0
        };
    }

    const profile = MODEL_PROFILES[profileId] || MODEL_PROFILES.generic;
    const nonWhitespace = normalized.replace(/\s/g, '');
    const cjkRe = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu;
    const cjkChars = (normalized.match(cjkRe) || []).length;
    const noCjkText = normalized.replace(cjkRe, ' ');

    // Words across ALL scripts (Cyrillic, Greek, Arabic, ... included) — the
    // old Latin-only regex reported "0 words" for e.g. Russian text.
    const wordMatches = noCjkText.match(/[\p{L}\p{N}]+(?:['\u2019-][\p{L}\p{N}]+)*/gu) || [];
    const words = wordMatches.length;

    // Non-Latin letters outside CJK (Cyrillic, Greek, Arabic, Hebrew, Thai,
    // Devanagari, ...) tokenize far denser than Latin text in common BPE
    // vocabularies — give them their own divisor instead of the Latin one.
    const totalLetters = (noCjkText.match(/\p{L}/gu) || []).length;
    const latinLetters = (noCjkText.match(/\p{Script=Latin}/gu) || []).length;
    const otherScriptChars = Math.max(0, totalLetters - latinLetters);
    const latinWords = wordMatches.filter(word => /^[\p{Script=Latin}\p{N}'\u2019-]+$/u.test(word)).length;
    const latinChars = Math.max(0, nonWhitespace.length - cjkChars - otherScriptChars);

    const latinByWords = latinWords * profile.wordsPerTokenFactor;
    const latinByChars = latinChars / profile.charsPerToken;
    const cjkTokens = cjkChars / profile.cjkCharsPerToken;
    const otherTokens = otherScriptChars / (profile.otherScriptCharsPerToken || 2.6);
    const contentTokens = Math.ceil((Math.max(latinByWords, latinByChars) + cjkTokens + otherTokens) * profile.multiplier);

    return {
        normalized,
        contentTokens,
        estimatedInputTokens: contentTokens + FIXED_PROMPT_OVERHEAD,
        characters: normalized.length,
        words,
        cjkShare: nonWhitespace.length ? cjkChars / nonWhitespace.length : 0
    };
}

function classifyWindow(estimatedInputTokens, contextWindow, reservePercent) {
    const usableBudget = Math.floor(contextWindow * (1 - reservePercent / 100));
    const reservedTokens = contextWindow - usableBudget;
    const ratio = usableBudget ? estimatedInputTokens / usableBudget : 1;
    let status = 'overkill';

    if (estimatedInputTokens <= 0) {
        status = 'empty';
    } else if (ratio > 1) {
        status = 'tooSmall';
    } else if (ratio > 0.88) {
        status = 'tight';
    } else if (ratio > 0.42) {
        status = 'good';
    }

    if (contextWindow === CONTEXT_WINDOWS[0] && status === 'overkill') {
        status = 'good';
    }

    return {
        contextWindow,
        usableBudget,
        reservedTokens,
        ratio,
        status
    };
}

class ContextFileProcessor {
    constructor(statusCallback) {
        this.statusCallback = statusCallback;
    }

    validate(file) {
        const extension = this.extension(file.name);
        if (!['txt', 'md', 'markdown', 'docx', 'pdf'].includes(extension)) {
            throw new Error(`${file.name} is not supported. Use TXT, Markdown, DOCX, or PDF files.`);
        }

        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`${file.name} is larger than 25 MB. Use a smaller file or paste a section instead.`);
        }
    }

    async extract(file) {
        this.validate(file);
        const extension = this.extension(file.name);

        if (['txt', 'md', 'markdown'].includes(extension)) {
            return file.text();
        }

        if (extension === 'docx') {
            return this.extractDocx(file);
        }

        if (extension === 'pdf') {
            return this.extractPdf(file);
        }

        return '';
    }

    extension(name) {
        return String(name || '').split('.').pop().toLowerCase();
    }

    async extractDocx(file) {
        this.setStatus('Loading DOCX reader...');
        const mammoth = await this.loadMammoth();
        this.setStatus('Extracting DOCX text locally...');
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = normalizeText(result.value);

        if (!text) {
            throw new Error('No readable text was found in this DOCX file.');
        }

        return text;
    }

    async extractPdf(file) {
        this.setStatus('Loading PDF reader...');
        const pdfjsLib = await this.loadPdfJs();
        this.setStatus('Extracting PDF text locally...');
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const pages = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            this.setStatus(`Reading PDF page ${pageNumber} of ${pdf.numPages}...`);
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            const line = content.items.map(item => item.str).join(' ').trim();
            if (line) {
                pages.push(line);
            }

            if (pageNumber % 8 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const text = normalizeText(pages.join('\n'));
        if (!text) {
            throw new Error('No readable PDF text was found. Scanned, image-only, or password-protected PDFs may need OCR before estimation.');
        }

        return text;
    }

    async loadMammoth() {
        if (!window.mammoth) {
            await this.loadScript('vendor/mammoth.browser.min.js');
        }
        return window.mammoth;
    }

    async loadPdfJs() {
        if (!this._pdfjsPromise) {
            this._pdfjsPromise = (async () => {
                const mod = await import('../vendor/pdf.min.mjs');
                mod.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.mjs';
                return mod;
            })().catch(error => {
                this._pdfjsPromise = null;
                throw error;
            });
        }
        return this._pdfjsPromise;
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
                if (src.includes('mammoth') && window.mammoth) resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load ${src}`));
            document.head.appendChild(script);
        });
    }

    setStatus(message) {
        if (this.statusCallback) {
            this.statusCallback(message);
        }
    }
}

class ContextEstimatorApp {
    constructor() {
        this.elements = {
            input: document.getElementById('contextInput'),
            fileInput: document.getElementById('contextFileInput'),
            dropzone: document.getElementById('contextDropzone'),
            chooseFileBtn: document.getElementById('chooseContextFileBtn'),
            fileStatus: document.getElementById('contextFileStatus'),
            profileSelect: document.getElementById('contextProfileSelect'),
            reserveInput: document.getElementById('contextReserveInput'),
            reserveValue: document.getElementById('contextReserveValue'),
            estimateBtn: document.getElementById('contextEstimateBtn'),
            exactBtn: document.getElementById('contextExactBtn'),
            clearBtn: document.getElementById('contextClearBtn'),
            inputTokens: document.getElementById('contextInputTokens'),
            reserveTokens: document.getElementById('contextReserveTokens'),
            tableBody: document.getElementById('contextTableBody'),
            meta: document.getElementById('contextMeta')
        };

        this.fileName = '';
        this.processor = new ContextFileProcessor(message => this.setFileStatus(message, 'working'));
        this.lastResult = null;
        this.exactResult = null;
        this._estimateCache = null;
        this.debouncedEstimate = this.debounce(() => this.updateEstimate(), 120);
        this.bindEvents();
        this.populateTable();
        this.updateReserveLabel();
        this.updateEstimate();
    }

    bindEvents() {
        this.elements.input.addEventListener('input', () => {
            this.fileName = '';
            this.setFileStatus('Text input is used for this estimate.', 'neutral');
            this.debouncedEstimate();
        });

        this.elements.profileSelect.addEventListener('change', () => this.updateEstimate());
        this.elements.reserveInput.addEventListener('input', () => {
            this.updateReserveLabel();
            this.updateEstimate();
        });
        this.elements.estimateBtn.addEventListener('click', () => this.updateEstimate({ announce: true }));
        if (this.elements.exactBtn) {
            this.elements.exactBtn.addEventListener('click', () => this.runExactCount());
        }
        document.querySelectorAll('[data-reserve-preset]').forEach(button => {
            button.addEventListener('click', () => {
                this.elements.reserveInput.value = button.dataset.reservePreset;
                this.updateReserveLabel();
                this.updateEstimate();
            });
        });
        this.elements.clearBtn.addEventListener('click', () => this.clear());
        this.elements.chooseFileBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', event => this.handleFiles(event.target.files));

        ['dragenter', 'dragover'].forEach(eventName => {
            this.elements.dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                this.elements.dropzone.classList.add('context-dropzone--active');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.elements.dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                this.elements.dropzone.classList.remove('context-dropzone--active');
            });
        });

        this.elements.dropzone.addEventListener('drop', event => this.handleFiles(event.dataTransfer.files));
    }

    async handleFiles(fileList) {
        const file = fileList?.[0];
        if (!file) {
            return;
        }

        try {
            this.setFileStatus(`Preparing ${file.name}...`, 'working');
            this.elements.chooseFileBtn.disabled = true;
            const text = await this.processor.extract(file);
            this.fileName = file.name;
            this.elements.input.value = text;
            this.setFileStatus(`${file.name} extracted locally. ${formatTokens(text.length)} characters ready.`, 'good');
            this.updateEstimate({ announce: true });
        } catch (error) {
            this.setFileStatus(error.message || 'File extraction failed.', 'danger');
        } finally {
            this.elements.chooseFileBtn.disabled = false;
            this.elements.fileInput.value = '';
        }
    }

    updateReserveLabel() {
        this.elements.reserveValue.textContent = `${this.elements.reserveInput.value}%`;
    }

    updateEstimate({ announce = false } = {}) {
        const text = this.elements.input.value;
        const profileId = this.elements.profileSelect.value;
        const profile = MODEL_PROFILES[profileId] || MODEL_PROFILES.generic;
        const reservePercent = Number(this.elements.reserveInput.value) || 35;
        const estimate = this.getCachedEstimate(text, profileId);
        const exactActive = this.isExactResultValid(text, profileId);
        const inputTokens = exactActive ? this.exactResult.tokens : estimate.estimatedInputTokens;
        const windows = CONTEXT_WINDOWS.map(size => classifyWindow(inputTokens, size, reservePercent));
        // Recommend the first window with real headroom ("Good"); a "Tight"
        // window is only recommended when nothing better exists — the guide
        // itself says to take the next larger window when the fit is tight.
        const recommendation = windows.find(row => row.status === 'good' || row.status === 'overkill') ||
            windows.find(row => row.status !== 'tooSmall') ||
            windows[windows.length - 1];
        const exceedsMax = inputTokens > windows[windows.length - 1].usableBudget;

        this.lastResult = {
            estimate,
            inputTokens,
            exactActive,
            reservePercent,
            windows,
            recommendation,
            exceedsMax
        };

        this.renderResult(announce);
    }

    // Normalization + several unicode regex passes over the full text are the
    // expensive part; profile/reserve changes reuse the cached result.
    getCachedEstimate(text, profileId) {
        if (this._estimateCache &&
            this._estimateCache.text === text &&
            this._estimateCache.profileId === profileId) {
            return this._estimateCache.estimate;
        }
        const estimate = estimateTokens(text, profileId);
        this._estimateCache = { text, profileId, estimate };
        return estimate;
    }

    isExactResultValid(text, profileId) {
        return Boolean(this.exactResult &&
            this.exactResult.text === text &&
            this.exactResult.profileId === profileId);
    }

    async runExactCount() {
        const text = this.elements.input.value;
        const profileId = this.elements.profileSelect.value;
        const normalized = normalizeText(text);

        if (!normalized) {
            this.setFileStatus('Paste text first, then count exactly.', 'neutral');
            return;
        }

        const repo = TOKENIZER_REPOS[profileId] || TOKENIZER_REPOS.generic;
        this.elements.exactBtn.disabled = true;

        try {
            this.setFileStatus('Loading tokenizer (one-time, a few MB — only on this click)...', 'working');
            if (!this._transformersPromise) {
                this._transformersPromise = import(TRANSFORMERS_CDN).catch(error => {
                    this._transformersPromise = null;
                    throw new Error('Could not load the tokenizer library (offline or CDN blocked). The heuristic estimate still works.');
                });
            }
            const { AutoTokenizer } = await this._transformersPromise;

            this._tokenizers = this._tokenizers || new Map();
            let tokenizer = this._tokenizers.get(repo);
            if (!tokenizer) {
                tokenizer = await AutoTokenizer.from_pretrained(repo);
                this._tokenizers.set(repo, tokenizer);
            }

            this.setFileStatus('Counting tokens exactly...', 'working');
            await new Promise(resolve => setTimeout(resolve, 0));
            const encoded = tokenizer.encode(normalized);
            const tokens = (encoded?.length || 0) + FIXED_PROMPT_OVERHEAD;

            this.exactResult = { text, profileId, tokens, repo };
            this.updateEstimate();
            this.setFileStatus(`Exact count with the ${MODEL_PROFILES[profileId]?.label || profileId} tokenizer: ${formatTokens(tokens)} tokens incl. overhead.`, 'good');
        } catch (error) {
            this.setFileStatus(error.message || 'Exact counting failed. The heuristic estimate still works.', 'danger');
        } finally {
            this.elements.exactBtn.disabled = false;
        }
    }

    renderResult(announce) {
        const { estimate, inputTokens, exactActive, reservePercent, windows, recommendation, exceedsMax } = this.lastResult;
        this.elements.inputTokens.textContent = inputTokens ? formatTokens(inputTokens) : '0';
        this.elements.reserveTokens.textContent = recommendation ? `${reservePercent}% (${formatTokens(recommendation.reservedTokens)})` : `${reservePercent}%`;

        const parts = [];
        if (inputTokens) {
            parts.push(`${formatTokens(estimate.characters)} characters · ${formatTokens(estimate.words)} words`);
            parts.push(exactActive ? 'exact tokenizer count' : 'heuristic estimate');
        }
        this.elements.meta.textContent = parts.length ? parts.join(' · ') : 'No text loaded yet.';

        this.renderTable(windows, recommendation, exceedsMax, inputTokens);

        if (announce) {
            this.setFileStatus('Estimate updated locally.', 'good');
        }
    }

    populateTable() {
        this.elements.tableBody.innerHTML = CONTEXT_WINDOWS
            .map(size => `
                <tr>
                    <td>${formatContext(size)}</td>
                    <td data-context-usable="${size}">-</td>
                    <td><span class="context-status-pill" data-tone="neutral">-</span></td>
                </tr>
            `)
            .join('');
    }

    renderTable(windows, recommendation, exceedsMax, inputTokens = 0) {
        const hasInput = windows.some(row => row.status !== 'empty');
        this.elements.tableBody.innerHTML = windows.map(row => {
            const status = STATUS_COPY[row.status] || STATUS_COPY.empty;
            const isRecommended = hasInput && !exceedsMax && recommendation.contextWindow === row.contextWindow;
            // Concrete headroom beats an abstract label: show what is left of
            // the usable input budget (or how far it overflows).
            let detail = '';
            if (hasInput && inputTokens > 0) {
                const leftover = row.usableBudget - inputTokens;
                detail = leftover >= 0
                    ? `<small class="context-row-detail">${formatTokens(leftover)} left</small>`
                    : `<small class="context-row-detail">${formatTokens(-leftover)} over</small>`;
            }
            return `
                <tr class="${isRecommended ? 'context-table-row--recommended' : ''}">
                    <td>${formatContext(row.contextWindow)}${isRecommended ? ' · recommended' : ''}</td>
                    <td>${formatTokens(row.usableBudget)} ${detail}</td>
                    <td><span class="context-status-pill" data-tone="${status.tone}">${status.label}</span></td>
                </tr>
            `;
        }).join('');
    }

    clear() {
        this.elements.input.value = '';
        this.fileName = '';
        this.exactResult = null;
        this.setFileStatus('Cleared. No text is stored by this tool.', 'neutral');
        this.updateEstimate();
        this.elements.input.focus();
    }

    setFileStatus(message, tone = 'neutral') {
        this.elements.fileStatus.textContent = message;
        this.elements.fileStatus.dataset.tone = tone;
    }

    debounce(callback, delay) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => callback(...args), delay);
        };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ContextEstimatorApp();
});
