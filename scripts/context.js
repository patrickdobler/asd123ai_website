const CONTEXT_WINDOWS = [4096, 8192, 16384, 32768, 65536, 131072];
const FIXED_PROMPT_OVERHEAD = 300;
const MAX_FILE_SIZE = 25 * 1024 * 1024;

const MODEL_PROFILES = {
    generic: {
        label: 'Generic LLM',
        charsPerToken: 4.0,
        wordsPerTokenFactor: 1.32,
        cjkCharsPerToken: 1.55,
        multiplier: 1
    },
    llama: {
        label: 'Llama / Mistral',
        charsPerToken: 3.8,
        wordsPerTokenFactor: 1.36,
        cjkCharsPerToken: 1.45,
        multiplier: 1.05
    },
    qwen: {
        label: 'Qwen',
        charsPerToken: 3.6,
        wordsPerTokenFactor: 1.42,
        cjkCharsPerToken: 1.25,
        multiplier: 1.08
    },
    gemma: {
        label: 'Gemma',
        charsPerToken: 4.2,
        wordsPerTokenFactor: 1.28,
        cjkCharsPerToken: 1.65,
        multiplier: 1
    },
    gpt: {
        label: 'GPT-style',
        charsPerToken: 4.0,
        wordsPerTokenFactor: 1.33,
        cjkCharsPerToken: 1.45,
        multiplier: 1
    }
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
    const cjkMatches = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) || [];
    const cjkChars = cjkMatches.length;
    const latinText = normalized.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu, ' ');
    const wordMatches = latinText.match(/[A-Za-zÀ-ÖØ-öø-ÿ0-9]+(?:[-'][A-Za-zÀ-ÖØ-öø-ÿ0-9]+)*/g) || [];
    const words = wordMatches.length;
    const latinChars = Math.max(0, nonWhitespace.length - cjkChars);

    const latinByWords = words * profile.wordsPerTokenFactor;
    const latinByChars = latinChars / profile.charsPerToken;
    const cjkTokens = cjkChars / profile.cjkCharsPerToken;
    const contentTokens = Math.ceil((Math.max(latinByWords, latinByChars) + cjkTokens) * profile.multiplier);

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
        if (!window.pdfjsLib) {
            await this.loadScript('vendor/pdf.min.js');
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
        }
        return window.pdfjsLib;
    }

    loadScript(src) {
        return new Promise((resolve, reject) => {
            const existing = document.querySelector(`script[src="${src}"]`);
            if (existing) {
                existing.addEventListener('load', () => resolve(), { once: true });
                existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
                if (src.includes('mammoth') && window.mammoth) resolve();
                if (src.includes('pdf') && window.pdfjsLib) resolve();
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
            clearBtn: document.getElementById('contextClearBtn'),
            inputTokens: document.getElementById('contextInputTokens'),
            reserveTokens: document.getElementById('contextReserveTokens'),
            tableBody: document.getElementById('contextTableBody'),
            meta: document.getElementById('contextMeta')
        };

        this.fileName = '';
        this.processor = new ContextFileProcessor(message => this.setFileStatus(message, 'working'));
        this.lastResult = null;
        this.debouncedEstimate = this.debounce(() => this.updateEstimate(), 120);
        this.bindEvents();
        this.populateTable();
        this.updateReserveLabel();
        this.updateEstimate();
        setTimeout(() => this.updateEstimate(), 0);
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
        const estimate = estimateTokens(text, profileId);
        const windows = CONTEXT_WINDOWS.map(size => classifyWindow(estimate.estimatedInputTokens, size, reservePercent));
        const recommendation = windows.find(row => row.status !== 'tooSmall') || windows[windows.length - 1];
        const exceedsMax = estimate.estimatedInputTokens > windows[windows.length - 1].usableBudget;

        this.lastResult = {
            estimate,
            reservePercent,
            windows,
            recommendation,
            exceedsMax
        };

        this.renderResult(announce);
    }

    renderResult(announce) {
        const { estimate, reservePercent, windows, recommendation, exceedsMax } = this.lastResult;
        this.elements.inputTokens.textContent = estimate.estimatedInputTokens ? formatTokens(estimate.estimatedInputTokens) : '0';
        this.elements.reserveTokens.textContent = recommendation ? `${reservePercent}% (${formatTokens(recommendation.reservedTokens)})` : `${reservePercent}%`;

        this.elements.meta.textContent = estimate.estimatedInputTokens
            ? `${formatTokens(estimate.characters)} characters · ${formatTokens(estimate.words)} words`
            : 'No text loaded yet.';

        this.renderTable(windows, recommendation, exceedsMax);

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

    renderTable(windows, recommendation, exceedsMax) {
        const hasInput = windows.some(row => row.status !== 'empty');
        this.elements.tableBody.innerHTML = windows.map(row => {
            const status = STATUS_COPY[row.status] || STATUS_COPY.empty;
            const isRecommended = hasInput && !exceedsMax && recommendation.contextWindow === row.contextWindow;
            return `
                <tr class="${isRecommended ? 'context-table-row--recommended' : ''}">
                    <td>${formatContext(row.contextWindow)}${isRecommended ? ' · recommended' : ''}</td>
                    <td>${formatTokens(row.usableBudget)}</td>
                    <td><span class="context-status-pill" data-tone="${status.tone}">${status.label}</span></td>
                </tr>
            `;
        }).join('');
    }

    clear() {
        this.elements.input.value = '';
        this.fileName = '';
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
