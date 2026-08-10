// File-size guardrails. Everything runs in the browser, so a big file is never a
// server limit — the only real risk is freezing the tab. PDFs and images are
// processed in full (every page is rendered, every pixel is read by OCR), so they
// keep a tighter cap. Container/text formats (PPTX/XLSX/DOCX/HTML/CSV/plain text)
// only have their *text* extracted — embedded media is ignored — so the file size
// barely reflects the work and they get a much larger allowance.
const MAX_FILE_SIZE = 75 * 1024 * 1024;       // PDF, images (OCR)
const MAX_TEXT_FILE_SIZE = 250 * 1024 * 1024; // PPTX, XLSX, XLS, DOCX, HTML, CSV, plain text

const ENGINE_HINTS = {
    standard: 'Fast, lightweight pdf.js reader. Good for most single-column PDFs. PDF only; DOCX always uses mammoth.js.',
    liteparse: 'LiteParse WebAssembly engine. Reconstructs reading order across columns. Loads a one-time ~4 MB module locally on first use.',
    edgeparse: 'EdgeParse WebAssembly engine. Rust parser with XY-cut reading order and native Markdown tables. Loads a one-time ~2.7 MB module locally on first use.',
    pdfinspector: 'pdf-inspector WebAssembly engine (Firecrawl). Rust parser tuned for tables and multi-column reading order; also detects scanned pages and tells you when OCR is needed. Loads a one-time ~4.6 MB module locally on first use.',
    ocr: 'PP-OCRv6 Tiny optical character recognition for scanned PDFs and images (PNG, JPG, WebP). Reads text from pixels locally. Loads a one-time ~6 MB model on first use.'
};

const OCR_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'bmp'];

// Office formats where the user can pick the parser: the lightweight
// specialists (mammoth / SheetJS / JSZip) or anydoc.
const OFFICE_CHOICE_EXTENSIONS = ['docx', 'pptx', 'xlsx', 'xls', 'csv'];

// Formats only anydoc can read. Legacy binary Office, OpenDocument, RTF and
// EPUB have no lightweight in-browser parser here, so they always route to it.
const ANYDOC_ONLY_EXTENSIONS = [
    'doc', 'docm',
    'ppt', 'pps', 'pot', 'pptm', 'ppsx', 'ppsm',
    'xlsm', 'xlsb',
    'odt', 'ods', 'odp',
    'rtf', 'epub'
];

// The engine selector only applies to PDFs. For every other input there is a
// single fixed conversion path (or forced OCR for images), so the selector is
// disabled and one of these hints explains what runs instead.
const ENGINE_DISABLED_HINTS = {
    image: "Images are read with OCR automatically. The PDF engine selector only applies to PDFs.",
    docx: "Word (DOCX) uses the document engine below. The PDF engine selector only applies to PDFs.",
    pptx: "PowerPoint (PPTX) uses the document engine below. The PDF engine selector only applies to PDFs.",
    xlsx: "Excel (XLSX) uses the document engine below. The PDF engine selector only applies to PDFs.",
    xls: "Excel (XLS) uses the document engine below. The PDF engine selector only applies to PDFs.",
    csv: "CSV uses the document engine below. The PDF engine selector only applies to PDFs.",
    html: "HTML is converted automatically. The PDF engine selector only applies to PDFs.",
    htm: "HTML is converted automatically. The PDF engine selector only applies to PDFs.",
    text: "Plain text is passed through automatically. The PDF engine selector only applies to PDFs.",
    default: "This file is converted automatically. The PDF engine selector only applies to PDFs."
};

// Hints for the document (non-PDF) engine selector.
const DOC_ENGINE_HINTS = {
    standard: 'Lightweight specialists: mammoth.js for Word, SheetJS for Excel/CSV, and a built-in reader for PowerPoint. Small downloads (0.1-0.9 MB) and the proven default.',
    anydoc: 'anydoc WebAssembly engine (Firecrawl). One Rust parser for Word, PowerPoint, Excel, OpenDocument, RTF and EPUB, with stronger structure and table handling. Loads a one-time ~6 MB module locally on first use.'
};

// Shown when the document engine selector cannot be changed for the chosen file.
const DOC_ENGINE_DISABLED_HINTS = {
    pdf: 'PDFs are handled by the PDF parsing engine above; anydoc is never used for PDFs.',
    image: 'Images are read with OCR. The document engine applies to Word, PowerPoint, Excel, OpenDocument, RTF and EPUB files.',
    html: 'HTML is converted with the built-in reader. The document engine applies to Office, OpenDocument, RTF and EPUB files.',
    htm: 'HTML is converted with the built-in reader. The document engine applies to Office, OpenDocument, RTF and EPUB files.',
    text: 'Plain text is passed through unchanged. The document engine applies to Office, OpenDocument, RTF and EPUB files.',
    anydocOnly: 'This format is read by anydoc, the only engine here that supports it.',
    default: 'The document engine applies to Word, PowerPoint, Excel, OpenDocument, RTF and EPUB files.'
};

function loadExternalScript(src) {
    return new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', () => resolve(), { once: true });
            existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.onload = () => {
            script.dataset.loaded = 'true';
            resolve();
        };
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.head.appendChild(script);
    });
}

async function loadMammoth() {
    if (!window.mammoth) {
        await loadExternalScript('vendor/mammoth.browser.min.js');
    }
    return window.mammoth;
}

// SheetJS — reads XLSX/XLS/CSV. Lazy-loaded on first spreadsheet conversion.
async function loadSheetJs() {
    if (!window.XLSX) {
        await loadExternalScript('vendor/xlsx.full.min.js');
    }
    return window.XLSX;
}

// JSZip — PPTX is a ZIP of XML; used to read the slide parts. Lazy-loaded.
async function loadJSZip() {
    if (!window.JSZip) {
        await loadExternalScript('vendor/jszip.min.js');
    }
    return window.JSZip;
}

let pdfjsModulePromise = null;
async function loadPdfJs() {
    if (!pdfjsModulePromise) {
        pdfjsModulePromise = (async () => {
            const mod = await import('../vendor/pdf.min.mjs');
            mod.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.mjs';
            return mod;
        })().catch(error => {
            pdfjsModulePromise = null;
            throw error;
        });
    }
    return pdfjsModulePromise;
}

// Lazy-loaded LiteParse (LlamaIndex) WebAssembly engine.
// Only fetched the first time the high-accuracy PDF mode is used so the
// ~4 MB module never affects users who stay on the default pdf.js path.
let liteParseModulePromise = null;
async function loadLiteParse() {
    if (!liteParseModulePromise) {
        liteParseModulePromise = (async () => {
            const mod = await import('../vendor/liteparse/liteparse_wasm.js');
            await mod.default({ module_or_path: 'vendor/liteparse/liteparse_wasm_bg.wasm' });
            return mod;
        })().catch(error => {
            liteParseModulePromise = null;
            throw error;
        });
    }
    return liteParseModulePromise;
}

// Lazy-loaded EdgeParse (Rust) WebAssembly engine.
// Like LiteParse, only fetched the first time the EdgeParse mode is used so
// the ~2.7 MB module never affects users who stay on the default pdf.js path.
let edgeParseModulePromise = null;
async function loadEdgeParse() {
    if (!edgeParseModulePromise) {
        edgeParseModulePromise = (async () => {
            const mod = await import('../vendor/edgeparse/edgeparse_wasm.js');
            await mod.default({ module_or_path: 'vendor/edgeparse/edgeparse_wasm_bg.wasm' });
            if (typeof mod.init === 'function') {
                mod.init();
            }
            return mod;
        })().catch(error => {
            edgeParseModulePromise = null;
            throw error;
        });
    }
    return edgeParseModulePromise;
}

// Lazy-loaded pdf-inspector (Firecrawl, Rust) WebAssembly engine.
// Like the other WASM parsers it is only fetched when its mode is selected, so
// the ~4.6 MB module never affects users who stay on the default path. Its
// processPdf() returns the Markdown *and* a classification (TextBased/Scanned/
// ImageBased/Mixed) in one pass, which we use for a precise "this needs OCR"
// message instead of a bare empty result.
let pdfInspectorModulePromise = null;
async function loadPdfInspector() {
    if (!pdfInspectorModulePromise) {
        pdfInspectorModulePromise = (async () => {
            const mod = await import('../vendor/pdfinspector/pdf_inspector_wasm.js');
            await mod.default({ module_or_path: 'vendor/pdfinspector/pdf_inspector_wasm_bg.wasm' });
            return mod;
        })().catch(error => {
            pdfInspectorModulePromise = null;
            throw error;
        });
    }
    return pdfInspectorModulePromise;
}

// Lazy-loaded anydoc (Firecrawl, Rust) WebAssembly engine. One parser for
// Word, PowerPoint, Excel, OpenDocument, RTF and EPUB — including the legacy
// binary formats the lightweight parsers cannot read. ~6 MB, so it is only
// fetched when anydoc is actually selected or a format requires it; the
// default DOCX/XLSX/PPTX paths keep using their much smaller specialists.
let anydocModulePromise = null;
async function loadAnydoc() {
    if (!anydocModulePromise) {
        anydocModulePromise = (async () => {
            const mod = await import('../vendor/anydoc/anydoc_wasm.js');
            await mod.default({ module_or_path: 'vendor/anydoc/anydoc_wasm_bg.wasm' });
            return mod;
        })().catch(error => {
            anydocModulePromise = null;
            throw error;
        });
    }
    return anydocModulePromise;
}

// Lazy-loaded PP-OCRv6 pipeline (onnxruntime-web). Only fetched when the OCR
// engine is selected; the runtime + models are a much larger download than the
// text parsers, so they never load for users who stay on another engine.
let ocrModulePromise = null;
async function loadOcr() {
    if (!ocrModulePromise) {
        ocrModulePromise = import('./ocr.js').catch(error => {
            ocrModulePromise = null;
            throw error;
        });
    }
    return ocrModulePromise;
}

function fileExtension(name) {
    return String(name || '').split('.').pop().toLowerCase();
}

function escapeMarkdown(text) {
    return String(text).replace(/([\\`*_{}\[\]<>])/g, '\\$1');
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function collapseWhitespace(markdown) {
    // Fenced code blocks are exempt: collapsing runs of spaces would destroy
    // code indentation.
    return String(markdown)
        .replace(/\r\n/g, '\n')
        .split(/(```[\s\S]*?```)/)
        .map((part, index) => index % 2 === 1 ? part : part
            .replace(/\u00a0/g, ' ')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/(^|[^\\])[ \t]{2,}/g, '$1 ')
            .replace(/\n{3,}/g, '\n\n'))
        .join('')
        .trim();
}

class HtmlToMarkdown {
    constructor({ preserveFormatting = true, keepTables = true, keepLinks = true } = {}) {
        this.preserveFormatting = preserveFormatting;
        this.keepTables = keepTables;
        this.keepLinks = keepLinks;
    }

    convert(html) {
        // Parse with DOMParser: the resulting document is inert, so <img src>
        // in the input NEVER triggers network requests (setting innerHTML on a
        // live element did — a privacy leak for HTML files with tracking pixels).
        const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
        return this.convertElement(doc.body || doc.documentElement);
    }

    convertElement(root) {
        if (!root) return '';
        const markdown = this.renderChildren(root, { listDepth: 0 }).trim();
        return markdown.replace(/\n{3,}/g, '\n\n');
    }

    renderChildren(node, ctx) {
        let output = '';
        for (const child of Array.from(node.childNodes)) {
            output += this.renderNode(child, ctx);
        }
        return output;
    }

    renderNode(node, ctx) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.replace(/\s+/g, ' ');
            return escapeMarkdown(text);
        }

        if (node.nodeType !== Node.ELEMENT_NODE) {
            return '';
        }

        const tag = node.tagName.toLowerCase();

        switch (tag) {
            case 'h1':
            case 'h2':
            case 'h3':
            case 'h4':
            case 'h5':
            case 'h6': {
                const level = Number(tag[1]);
                const inner = this.renderChildren(node, ctx).trim().replace(/\n+/g, ' ');
                return `\n\n${'#'.repeat(level)} ${inner}\n\n`;
            }
            case 'p': {
                const inner = this.renderChildren(node, ctx).trim();
                return inner ? `\n\n${inner}\n\n` : '';
            }
            case 'br':
                // Backslash hard break — survives whitespace collapsing,
                // unlike the two-trailing-spaces form.
                return '\\\n';
            case 'strong':
            case 'b': {
                if (!this.preserveFormatting) return this.renderChildren(node, ctx);
                const inner = this.renderChildren(node, ctx).trim();
                return inner ? `**${inner}**` : '';
            }
            case 'em':
            case 'i': {
                if (!this.preserveFormatting) return this.renderChildren(node, ctx);
                const inner = this.renderChildren(node, ctx).trim();
                return inner ? `*${inner}*` : '';
            }
            case 'u': {
                const inner = this.renderChildren(node, ctx);
                return inner;
            }
            case 'code': {
                const inner = node.textContent.replace(/\n/g, ' ');
                return inner ? '`' + inner + '`' : '';
            }
            case 'pre': {
                const inner = node.textContent.replace(/\n+$/, '');
                return `\n\n\`\`\`\n${inner}\n\`\`\`\n\n`;
            }
            case 'blockquote': {
                const inner = this.renderChildren(node, ctx).trim();
                if (!inner) return '';
                const quoted = inner.split('\n').map(line => `> ${line}`).join('\n');
                return `\n\n${quoted}\n\n`;
            }
            case 'a': {
                const inner = this.renderChildren(node, ctx).trim();
                const href = node.getAttribute('href');
                if (this.keepLinks && href) {
                    return `[${inner || href}](${href})`;
                }
                return inner;
            }
            case 'img': {
                const alt = node.getAttribute('alt') || '';
                const src = node.getAttribute('src') || '';
                if (!src) return '';
                return `![${alt}](${src})`;
            }
            case 'ul':
                return this.renderList(node, ctx, false);
            case 'ol':
                return this.renderList(node, ctx, true);
            case 'li': {
                const inner = this.renderChildren(node, ctx).trim();
                return inner;
            }
            case 'hr':
                return '\n\n---\n\n';
            case 'table':
                return this.keepTables ? this.renderTable(node, ctx) : this.renderChildren(node, ctx);
            case 'thead':
            case 'tbody':
            case 'tr':
            case 'th':
            case 'td':
                return this.renderChildren(node, ctx);
            case 'script':
            case 'style':
                return '';
            default:
                return this.renderChildren(node, ctx);
        }
    }

    renderList(node, ctx, ordered) {
        const items = Array.from(node.children).filter(child => child.tagName.toLowerCase() === 'li');
        if (!items.length) return '';
        const indent = '  '.repeat(ctx.listDepth);
        const lines = items.map((item, index) => {
            const marker = ordered ? `${index + 1}.` : '-';
            const childCtx = { ...ctx, listDepth: ctx.listDepth + 1 };
            let nestedBlocks = '';
            const inlineParts = [];

            for (const child of Array.from(item.childNodes)) {
                if (child.nodeType === Node.ELEMENT_NODE && (child.tagName.toLowerCase() === 'ul' || child.tagName.toLowerCase() === 'ol')) {
                    nestedBlocks += '\n' + this.renderNode(child, childCtx).replace(/^\n+|\n+$/g, '');
                } else {
                    inlineParts.push(this.renderNode(child, childCtx));
                }
            }

            const inline = inlineParts.join('').trim().replace(/\s*\n+\s*/g, ' ');
            return `${indent}${marker} ${inline}${nestedBlocks}`;
        });

        return `\n\n${lines.join('\n')}\n\n`;
    }

    renderTable(node, ctx) {
        const rows = Array.from(node.querySelectorAll('tr'));
        if (!rows.length) return '';
        const matrix = rows.map(row => Array.from(row.children).map(cell => this.renderChildren(cell, ctx).trim().replace(/\s*\n+\s*/g, ' ').replace(/\|/g, '\\|')));
        if (!matrix[0] || !matrix[0].length) return '';
        const header = matrix[0];
        const separator = header.map(() => '---');
        const body = matrix.slice(1);
        const lines = [
            `| ${header.join(' | ')} |`,
            `| ${separator.join(' | ')} |`,
            ...body.map(row => `| ${row.join(' | ')} |`)
        ];
        return `\n\n${lines.join('\n')}\n\n`;
    }
}

class PdfToMarkdown {
    constructor({ headingMode = 'auto', collapseWhitespace: shouldCollapse = true } = {}) {
        this.headingMode = headingMode;
        this.collapseWhitespace = shouldCollapse;
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Loading PDF reader...');
        const pdfjsLib = await loadPdfJs();
        setStatus('Reading PDF locally...');
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        const lines = [];
        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            setStatus(`Parsing page ${pageNumber} of ${pdf.numPages}...`);
            const page = await pdf.getPage(pageNumber);
            const content = await page.getTextContent();
            lines.push(...this.extractLines(content.items));

            if (pageNumber < pdf.numPages) {
                lines.push({ text: '', height: 0, isBlank: true });
            }

            if (pageNumber % 6 === 0) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        if (!lines.length) {
            throw new Error('No readable text was found in this PDF. Scanned or image-only PDFs need OCR first.');
        }

        const fontStats = this.analyzeFonts(lines);
        const markdown = this.linesToMarkdown(lines, fontStats);
        return this.collapseWhitespace ? collapseWhitespace(markdown) : markdown.trim();
    }

    extractLines(items) {
        const lines = [];
        let current = null;

        for (const item of items) {
            const text = (item.str || '').replace(/\s+$/, '');
            const transform = item.transform || [0, 0, 0, 0, 0, 0];
            const height = Math.abs(transform[3] || transform[0] || 0);
            const y = transform[5];

            if (!text && !item.hasEOL) {
                continue;
            }

            if (current && Math.abs(current.y - y) <= 1.5 && !item.hasEOL) {
                current.text += text;
                current.height = Math.max(current.height, height);
            } else {
                if (current) {
                    lines.push(current);
                }
                current = {
                    text,
                    height,
                    y,
                    isBlank: !text
                };
            }

            if (item.hasEOL) {
                lines.push(current);
                current = null;
            }
        }

        if (current) {
            lines.push(current);
        }

        const mapped = lines.map(line => ({
            text: (line.text || '').replace(/\s+/g, ' ').trim(),
            height: line.height,
            y: line.y,
            isBlank: !line.text || !line.text.trim()
        }));

        // Mark a paragraph break wherever the vertical gap between consecutive
        // lines is noticeably larger than the normal line spacing. This is the
        // reliable signal for new paragraphs, unlike sentence-ending punctuation
        // (which would split every line of ordinary prose).
        const gaps = [];
        for (let i = 1; i < mapped.length; i++) {
            const prev = mapped[i - 1];
            const cur = mapped[i];
            if (!prev.isBlank && !cur.isBlank && typeof prev.y === 'number' && typeof cur.y === 'number') {
                const gap = prev.y - cur.y;
                if (gap > 0) gaps.push(gap);
            }
        }
        gaps.sort((a, b) => a - b);
        const medianGap = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
        const paragraphGap = medianGap * 1.6;

        const result = [];
        for (let i = 0; i < mapped.length; i++) {
            const line = mapped[i];
            const prev = mapped[i - 1];
            if (!line.isBlank && prev && !prev.isBlank && paragraphGap > 0 &&
                typeof prev.y === 'number' && typeof line.y === 'number') {
                if (prev.y - line.y > paragraphGap) {
                    result.push({ text: '', height: 0, isBlank: true });
                }
            }
            result.push(line);
        }
        return result;
    }

    analyzeFonts(lines) {
        const heights = lines.filter(line => !line.isBlank && line.height > 0).map(line => line.height);
        if (!heights.length) {
            return { body: 0, thresholds: [] };
        }

        heights.sort((a, b) => a - b);
        const median = heights[Math.floor(heights.length / 2)];
        const unique = Array.from(new Set(heights.map(value => Math.round(value * 10) / 10)))
            .sort((a, b) => b - a);

        const thresholds = unique
            .filter(value => value > median * 1.08)
            .slice(0, 3);

        return { body: median, thresholds };
    }

    headingLevel(height, fontStats) {
        if (this.headingMode === 'off' || !fontStats.thresholds.length) {
            return 0;
        }
        const rounded = Math.round(height * 10) / 10;
        const index = fontStats.thresholds.findIndex(value => rounded >= value);
        if (index === -1) return 0;
        return Math.min(3, index + 1);
    }

    linesToMarkdown(lines, fontStats) {
        const blocks = [];
        let buffer = [];
        let currentListType = null;

        const flushBuffer = () => {
            if (!buffer.length) return;
            const paragraph = buffer.join(' ').replace(/\s+/g, ' ').trim();
            if (paragraph) {
                blocks.push(paragraph);
            }
            buffer = [];
        };

        const closeList = () => {
            currentListType = null;
        };

        for (const line of lines) {
            if (line.isBlank) {
                flushBuffer();
                closeList();
                continue;
            }

            const text = line.text;
            const heading = this.headingLevel(line.height, fontStats);

            if (heading > 0 && text.length <= 160) {
                flushBuffer();
                closeList();
                blocks.push(`${'#'.repeat(heading)} ${text}`);
                continue;
            }

            const bulletMatch = text.match(/^[•◦▪▫·\-\*]\s+(.*)/);
            const numberedMatch = text.match(/^(\d{1,3})[.)]\s+(.*)/);

            if (bulletMatch) {
                flushBuffer();
                currentListType = 'ul';
                blocks.push(`- ${bulletMatch[1].trim()}`);
                continue;
            }

            if (numberedMatch) {
                flushBuffer();
                currentListType = 'ol';
                blocks.push(`${numberedMatch[1]}. ${numberedMatch[2].trim()}`);
                continue;
            }

            if (currentListType && /^\s/.test(line.text)) {
                blocks.push(`  ${text}`);
                continue;
            }

            closeList();

            // Paragraph breaks come from blank lines (vertical gaps detected in
            // extractLines), so consecutive non-blank lines join into one
            // paragraph instead of splitting on sentence-ending punctuation.
            buffer.push(text);
        }

        flushBuffer();

        return blocks.join('\n\n');
    }
}

// High-accuracy PDF path backed by the LiteParse WASM engine.
// LiteParse returns rich per-line text items with real x/y coordinates and
// font sizes, which lets us reconstruct reading order across columns and
// detect headings far more reliably than pdf.js text content alone.
class LiteParsePdfToMarkdown {
    constructor({ headingMode = 'auto', collapseWhitespace: shouldCollapse = true } = {}) {
        this.headingMode = headingMode;
        this.collapseWhitespace = shouldCollapse;
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Loading LiteParse engine (one-time ~4 MB)...');
        const mod = await loadLiteParse();
        setStatus('Parsing PDF locally with LiteParse...');

        const bytes = new Uint8Array(await file.arrayBuffer());
        const parser = new mod.LiteParse({ ocrEnabled: false, outputFormat: 'json' });
        let result;
        try {
            result = await parser.parse(bytes);
        } finally {
            if (typeof parser.free === 'function') {
                parser.free();
            }
        }

        const pages = (result && result.pages) || [];
        if (!pages.length) {
            throw new Error('LiteParse found no readable text. Scanned or image-only PDFs need OCR first.');
        }

        const fontStats = this.analyzeFonts(pages);
        const blocks = [];
        pages.forEach((page, index) => {
            const pageBlocks = this.pageToBlocks(page, fontStats);
            blocks.push(...pageBlocks);
            if (index < pages.length - 1) {
                blocks.push('');
            }
        });

        const markdown = blocks.filter((block, i, arr) => !(block === '' && arr[i - 1] === '')).join('\n\n');
        return this.collapseWhitespace ? collapseWhitespace(markdown) : markdown.trim();
    }

    analyzeFonts(pages) {
        const sizes = [];
        for (const page of pages) {
            for (const item of page.textItems || []) {
                if (item.text && item.text.trim() && item.fontSize > 0) {
                    sizes.push(item.fontSize);
                }
            }
        }
        if (!sizes.length) {
            return { body: 0, thresholds: [] };
        }
        sizes.sort((a, b) => a - b);
        const median = sizes[Math.floor(sizes.length / 2)];
        const unique = Array.from(new Set(sizes.map(value => Math.round(value * 10) / 10)))
            .sort((a, b) => b - a)
            .filter(value => value > median * 1.08)
            .slice(0, 3);
        return { body: median, thresholds: unique };
    }

    headingLevel(fontSize) {
        if (this.headingMode === 'off' || !fontSize) {
            return 0;
        }
        const rounded = Math.round(fontSize * 10) / 10;
        const index = this.thresholds ? this.thresholds.findIndex(value => rounded >= value) : -1;
        if (index === -1) return 0;
        return Math.min(3, index + 1);
    }

    // Group a page's text items into columns, then order lines top-to-bottom
    // within each column (left column fully before right column).
    pageToBlocks(page, fontStats) {
        this.thresholds = fontStats.thresholds;
        const items = (page.textItems || []).filter(item => item.text && item.text.trim());
        if (!items.length) return [];

        const columns = this.detectColumns(items, page.width || 0);
        const blocks = [];

        for (const column of columns) {
            const lines = this.groupLines(column);
            blocks.push(...this.linesToBlocks(lines));
        }
        return blocks;
    }

    detectColumns(items, pageWidth) {
        // Heuristic: if a clear horizontal gap splits item centers into two
        // clusters, treat as two columns. Otherwise a single column.
        if (!pageWidth || items.length < 6) {
            return [items];
        }

        const mid = pageWidth / 2;
        const centerOf = item => item.x + (item.width || 0) / 2;
        const centers = items.map(centerOf);

        const leftCount = centers.filter(c => c < mid).length;
        const rightCount = centers.length - leftCount;

        // Both sides must hold a meaningful share of the content.
        const minShare = Math.max(2, items.length * 0.2);
        if (leftCount < minShare || rightCount < minShare) {
            return [items];
        }

        // Require an actual whitespace gutter around the midline: very few
        // items should straddle it (full-width titles are tolerated as noise).
        const band = pageWidth * 0.06;
        const straddlers = centers.filter(c => Math.abs(c - mid) < band).length;
        if (straddlers > Math.max(1, items.length * 0.12)) {
            return [items];
        }

        const left = items.filter(item => centerOf(item) < mid);
        const right = items.filter(item => centerOf(item) >= mid);
        return [left, right];
    }

    groupLines(items) {
        const sorted = [...items].sort((a, b) => (a.y - b.y) || (a.x - b.x));
        const lines = [];
        let current = null;

        for (const item of sorted) {
            const tolerance = Math.max(2, (item.height || item.fontSize || 10) * 0.5);
            if (current && Math.abs(item.y - current.y) <= tolerance) {
                current.items.push(item);
                current.y = (current.y * (current.items.length - 1) + item.y) / current.items.length;
                current.maxFont = Math.max(current.maxFont, item.fontSize || 0);
            } else {
                if (current) lines.push(current);
                current = { y: item.y, items: [item], maxFont: item.fontSize || 0 };
            }
        }
        if (current) lines.push(current);

        return lines.map(line => {
            const text = line.items
                .sort((a, b) => a.x - b.x)
                .map(item => item.text.trim())
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
            return { text, fontSize: line.maxFont };
        }).filter(line => line.text);
    }

    linesToBlocks(lines) {
        const blocks = [];
        let buffer = [];

        const flush = () => {
            if (!buffer.length) return;
            const paragraph = buffer.join(' ').replace(/\s+/g, ' ').trim();
            if (paragraph) blocks.push(paragraph);
            buffer = [];
        };

        for (const line of lines) {
            const text = line.text;
            const heading = this.headingLevel(line.fontSize);

            if (heading > 0 && text.length <= 160) {
                flush();
                blocks.push(`${'#'.repeat(heading)} ${text}`);
                continue;
            }

            const bulletMatch = text.match(/^[•◦▪▫·\-\*]\s+(.*)/);
            const numberedMatch = text.match(/^(\d{1,3})[.)]\s+(.*)/);

            if (bulletMatch) {
                flush();
                blocks.push(`- ${bulletMatch[1].trim()}`);
                continue;
            }
            if (numberedMatch) {
                flush();
                blocks.push(`${numberedMatch[1]}. ${numberedMatch[2].trim()}`);
                continue;
            }

            const previous = buffer[buffer.length - 1];
            if (previous && /[.!?:;。！？]$/.test(previous)) {
                flush();
            }
            buffer.push(text);
        }

        flush();
        return blocks;
    }
}

// High-accuracy PDF path backed by the EdgeParse (Rust) WASM engine.
// EdgeParse emits GitHub-flavoured Markdown directly, including tables, so no
// manual block reconstruction is needed here. Reading order is handled by its
// built-in XY-cut analysis; the heading-mode toggle maps to reading_order.
class EdgeParsePdfToMarkdown {
    constructor({ headingMode = 'auto', collapseWhitespace: shouldCollapse = true } = {}) {
        this.headingMode = headingMode;
        this.collapseWhitespace = shouldCollapse;
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Loading EdgeParse engine (one-time ~2.7 MB)...');
        const mod = await loadEdgeParse();
        setStatus('Parsing PDF locally with EdgeParse...');

        const bytes = new Uint8Array(await file.arrayBuffer());
        const readingOrder = this.headingMode === 'off' ? 'off' : 'auto';
        const markdown = mod.convert_to_string(bytes, 'markdown', 'all', readingOrder, 'cluster');

        if (!markdown || !markdown.trim()) {
            throw new Error('EdgeParse found no readable text. Scanned or image-only PDFs need OCR first.');
        }

        return this.collapseWhitespace ? collapseWhitespace(markdown) : markdown.trim();
    }
}

// High-accuracy PDF path backed by pdf-inspector (Firecrawl, Rust WASM).
// It emits GitHub-flavoured Markdown directly and, in the same pass, classifies
// the document — so when a PDF has no text layer we can say exactly that and
// point at OCR, instead of returning an empty document.
class PdfInspectorToMarkdown {
    constructor({ headingMode = 'auto', collapseWhitespace: shouldCollapse = true } = {}) {
        this.headingMode = headingMode;
        this.collapseWhitespace = shouldCollapse;
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Loading pdf-inspector engine (one-time ~4.6 MB)...');
        const mod = await loadPdfInspector();
        setStatus('Parsing PDF locally with pdf-inspector...');

        const bytes = new Uint8Array(await file.arrayBuffer());
        // 'fidelity' keeps the source structure; 'compact' would drop blank lines
        // and is aimed at token budgets rather than readable Markdown.
        const result = mod.processPdf(bytes, { profile: 'fidelity' });
        const markdown = result && result.markdown;

        if (!markdown || !markdown.trim()) {
            const type = result ? result.pdfType : null;
            if (type === 'Scanned' || type === 'ImageBased') {
                // A classification result is a fact about the document, not an
                // engine hiccup: falling back to pdf.js would only produce the
                // same empty output with a vaguer message.
                const err = new Error(`This is a ${type === 'Scanned' ? 'scanned' : 'image-only'} PDF with no text layer (detected with ${Math.round((result.confidence || 0) * 100)}% confidence). Switch the engine to OCR to read it.`);
                err.skipFallback = true;
                throw err;
            }
            throw new Error('pdf-inspector found no readable text. Scanned or image-only PDFs need OCR first.');
        }

        // A text PDF can still have unreadable pages (broken font encodings or
        // embedded scans); surfacing that beats silently returning partial text.
        if (result.hasEncodingIssues) {
            setStatus('Converted, but some fonts use broken encodings — check the output, or try OCR.');
        } else if (Array.isArray(result.pagesNeedingOcr) && result.pagesNeedingOcr.length) {
            setStatus(`Converted. Pages ${result.pagesNeedingOcr.join(', ')} look scanned — run OCR for those.`);
        }

        return this.collapseWhitespace ? collapseWhitespace(markdown) : markdown.trim();
    }
}

// Document path backed by anydoc (Firecrawl, Rust WASM). Handles Word,
// PowerPoint, Excel, OpenDocument, RTF and EPUB through one parser and emits
// GitHub-flavoured Markdown directly.
class AnydocToMarkdown {
    constructor({ collapseWhitespace: shouldCollapse = true, ext = '' } = {}) {
        this.collapseWhitespace = shouldCollapse;
        this.ext = ext;
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Loading anydoc engine (one-time ~6 MB)...');
        const mod = await loadAnydoc();
        setStatus('Converting document locally with anydoc...');

        const bytes = new Uint8Array(await file.arrayBuffer());

        // anydoc detects the format from the bytes, which is more reliable than
        // trusting a file extension — except for CSV, which has no signature and
        // must be named explicitly.
        const format = this.ext === 'csv' ? 'csv' : null;

        // PDFs have their own dedicated engines here; anydoc must never take
        // that path, even if a file arrives with a misleading extension.
        if (format === null && typeof mod.formatFromBytes === 'function') {
            if (mod.formatFromBytes(bytes) === 'pdf') {
                throw new Error('This file is a PDF. Use the PDF parsing engine selector instead.');
            }
        }

        let markdown;
        try {
            markdown = mod.toMarkdownBytes(bytes, format);
        } catch (error) {
            // anydoc reports a machine-readable reason; turn the common ones
            // into something the user can act on.
            const reasons = {
                unsupported: 'anydoc does not support this file type.',
                malformed: 'This file is structurally damaged and could not be read.',
                encrypted: 'This file is password-protected. Remove the protection and try again.',
                resourceLimit: 'This file exceeds anydoc\'s safety limits (deeply nested or heavily compressed).',
                missingPart: 'This file is missing a part required to read it.'
            };
            throw new Error(reasons[error && error.code] || `anydoc could not convert this file (${error.message || 'unknown error'}).`);
        }

        if (!markdown || !markdown.trim()) {
            throw new Error('anydoc found no readable text in this file.');
        }

        return this.collapseWhitespace ? collapseWhitespace(markdown) : markdown.trim();
    }
}

class DocxToMarkdown {
    constructor(options = {}) {
        this.options = {
            preserveFormatting: true,
            keepTables: true,
            keepLinks: true,
            ...options
        };
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Loading DOCX reader...');
        const mammoth = await loadMammoth();
        setStatus('Reading DOCX locally...');
        const arrayBuffer = await file.arrayBuffer();

        const styleMap = [
            "p[style-name='Title'] => h1:fresh",
            "p[style-name='Subtitle'] => h2:fresh",
            "p[style-name='Heading 1'] => h1:fresh",
            "p[style-name='Heading 2'] => h2:fresh",
            "p[style-name='Heading 3'] => h3:fresh",
            "p[style-name='Heading 4'] => h4:fresh",
            "p[style-name='Heading 5'] => h5:fresh",
            "p[style-name='Heading 6'] => h6:fresh",
            "p[style-name='Quote'] => blockquote:fresh",
            "p[style-name='Intense Quote'] => blockquote:fresh"
        ];

        const result = await mammoth.convertToHtml({ arrayBuffer }, { styleMap });

        if (!result || !result.value) {
            throw new Error('No readable content was found in this DOCX file.');
        }

        const converter = new HtmlToMarkdown({
            preserveFormatting: this.options.preserveFormatting,
            keepTables: this.options.keepTables,
            keepLinks: this.options.keepLinks
        });

        const markdown = converter.convert(result.value);
        return this.options.collapseWhitespace ? collapseWhitespace(markdown) : markdown.trim();
    }
}

// Build a GitHub-flavoured Markdown table from an array-of-arrays (sheet rows).
function aoaToMarkdownTable(rows) {
    const clean = (rows || []).filter(row => Array.isArray(row));
    if (!clean.length) return '';
    const width = Math.max(1, ...clean.map(row => row.length));
    const cell = value => String(value ?? '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|').trim();
    const pad = row => Array.from({ length: width }, (_, i) => cell(row[i]));
    const header = pad(clean[0]).map((text, i) => text || `Column ${i + 1}`);
    const line = cells => `| ${cells.join(' | ')} |`;
    const out = [line(header), line(header.map(() => '---'))];
    for (const row of clean.slice(1)) out.push(line(pad(row)));
    return out.join('\n');
}

// HTML files: clean the document, then reuse the shared HTML→Markdown renderer.
class HtmlFileToMarkdown {
    constructor(options = {}) {
        this.options = options;
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Reading HTML locally...');
        const text = await file.text();
        const doc = new DOMParser().parseFromString(text, 'text/html');
        doc.querySelectorAll('script, style, noscript, template, svg, iframe, head').forEach(el => el.remove());
        const root = doc.querySelector('main') || doc.querySelector('article') || doc.body || doc.documentElement;
        const markdown = new HtmlToMarkdown({
            preserveFormatting: this.options.preserveFormatting,
            keepTables: this.options.keepTables,
            keepLinks: this.options.keepLinks
        }).convertElement(root);
        if (!markdown.trim()) {
            throw new Error('No readable content was found in this HTML file.');
        }
        return this.options.collapseWhitespace ? collapseWhitespace(markdown) : markdown.trim();
    }
}

// Spreadsheets (XLSX/XLS/CSV): one Markdown table per sheet.
class XlsxToMarkdown {
    constructor(options = {}) {
        this.options = options;
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Loading spreadsheet reader...');
        const XLSX = await loadSheetJs();
        setStatus('Reading spreadsheet locally...');
        // CSV: decode as UTF-8 text first (reading raw bytes mis-detects the
        // codepage and mangles accents). XLSX/XLS: read the binary directly.
        const workbook = /\.csv$/i.test(file.name)
            ? XLSX.read(await file.text(), { type: 'string' })
            : XLSX.read(new Uint8Array(await file.arrayBuffer()), { type: 'array' });
        const multiSheet = workbook.SheetNames.length > 1;
        const parts = [];
        for (const name of workbook.SheetNames) {
            // raw:false returns the formatted cell text, so dates appear as
            // dates (not Excel serial numbers like 46188) and numbers keep
            // their cell formatting.
            const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, blankrows: false, defval: '', raw: false });
            const table = aoaToMarkdownTable(rows);
            if (!table) continue;
            parts.push(multiSheet ? `## ${name}\n\n${table}` : table);
        }
        if (!parts.length) {
            throw new Error('No readable cells were found in this spreadsheet.');
        }
        const markdown = parts.join('\n\n');
        return this.options.collapseWhitespace ? collapseWhitespace(markdown) : markdown.trim();
    }
}

// PowerPoint (PPTX): a ZIP of XML; extract slide text in order, one section per slide.
class PptxToMarkdown {
    constructor(options = {}) {
        this.options = options;
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Loading PPTX reader...');
        const JSZip = await loadJSZip();
        setStatus('Reading PPTX locally...');
        const zip = await JSZip.loadAsync(await file.arrayBuffer());
        const slideNum = path => {
            const match = path.match(/slide(\d+)\.xml$/);
            return match ? parseInt(match[1], 10) : 0;
        };
        const slidePaths = Object.keys(zip.files)
            .filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path))
            .sort((a, b) => slideNum(a) - slideNum(b));
        if (!slidePaths.length) {
            throw new Error('No slides were found in this PPTX file.');
        }
        const parts = [];
        for (let i = 0; i < slidePaths.length; i++) {
            const xml = await zip.files[slidePaths[i]].async('string');
            const body = this.slideToMarkdown(xml);
            const notes = await this.extractNotes(zip, slidePaths[i]);
            const section = [`## Slide ${i + 1}`];
            if (body) section.push(body);
            if (notes) section.push(`> **Speaker notes:** ${notes}`);
            parts.push(section.join('\n\n'));
        }
        const markdown = parts.join('\n\n');
        return this.options.collapseWhitespace ? collapseWhitespace(markdown) : markdown.trim();
    }

    // Speaker notes live in ppt/notesSlides/, linked from each slide's .rels
    // file. Falls back to the index-matched notesSlideN when rels are missing.
    async extractNotes(zip, slidePath) {
        try {
            let notesPath = null;
            const slideFile = slidePath.split('/').pop();
            const relsPath = `ppt/slides/_rels/${slideFile}.rels`;
            if (zip.files[relsPath]) {
                const rels = await zip.files[relsPath].async('string');
                const match = rels.match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
                if (match) notesPath = `ppt/notesSlides/${match[1]}`;
            }
            if (!notesPath) {
                const fallback = slideFile.replace('slide', 'notesSlide');
                if (zip.files[`ppt/notesSlides/${fallback}`]) {
                    notesPath = `ppt/notesSlides/${fallback}`;
                }
            }
            if (!notesPath || !zip.files[notesPath]) return '';

            const xml = await zip.files[notesPath].async('string');
            const doc = new DOMParser().parseFromString(xml, 'application/xml');
            const lines = [];
            for (const paragraph of Array.from(doc.getElementsByTagName('a:p'))) {
                const text = Array.from(paragraph.getElementsByTagName('a:t'))
                    .map(node => node.textContent)
                    .join('')
                    .replace(/\s+/g, ' ')
                    .trim();
                // Skip the slide-number placeholder (a lone digit).
                if (text && !/^\d+$/.test(text)) lines.push(text);
            }
            return lines.join(' ');
        } catch (error) {
            // Notes are a bonus; a malformed notes part must not fail the slide.
            return '';
        }
    }

    slideToMarkdown(xml) {
        const doc = new DOMParser().parseFromString(xml, 'application/xml');
        const lines = [];
        for (const paragraph of Array.from(doc.getElementsByTagName('a:p'))) {
            const text = Array.from(paragraph.getElementsByTagName('a:t'))
                .map(node => node.textContent)
                .join('')
                .replace(/\s+/g, ' ')
                .trim();
            if (text) lines.push(`- ${text}`);
        }
        return lines.join('\n');
    }
}

// Fallback for any other extension: pass the file through as text if it is
// readable text (Markdown/TXT/JSON/code/logs/…), otherwise reject binary files.
class PlainTextToMarkdown {
    constructor(options = {}) {
        this.options = options;
    }

    async convert(file, statusCallback) {
        const setStatus = statusCallback || (() => {});
        setStatus('Reading file locally...');
        const bytes = new Uint8Array(await file.arrayBuffer());
        const sample = bytes.subarray(0, 4096);
        let suspicious = 0;
        for (const byte of sample) {
            // NUL byte → definitely binary; otherwise count non-text control bytes.
            if (byte === 0) { suspicious = Infinity; break; }
            if (byte < 9 || (byte > 13 && byte < 32)) suspicious++;
        }
        if (suspicious > sample.length * 0.1) {
            throw new Error(`${file.name} could not be read as a document or text. Supported: PDF, DOCX, PPTX, XLSX, CSV, HTML, images (OCR engine), or plain-text files.`);
        }
        const text = new TextDecoder('utf-8').decode(bytes);
        if (!text.trim()) {
            throw new Error(`${file.name} appears to be empty.`);
        }
        // True pass-through: indentation in code/config files carries meaning,
        // so the collapse-whitespace option is intentionally NOT applied here.
        return text.replace(/\r\n/g, '\n').replace(/\s+$/, '');
    }
}

class MarkdownPreviewRenderer {
    render(markdown) {
        const escaped = escapeHtml(markdown).replace(/\r\n/g, '\n');
        const lines = escaped.split('\n');
        const out = [];
        let listType = null;
        let inCodeBlock = false;
        let codeBuffer = [];
        let paragraphBuffer = [];

        const flushParagraph = () => {
            if (paragraphBuffer.length) {
                out.push(`<p>${this.inlineFormat(paragraphBuffer.join(' '))}</p>`);
                paragraphBuffer = [];
            }
        };

        const closeList = () => {
            if (listType) {
                out.push(`</${listType}>`);
                listType = null;
            }
        };

        for (let i = 0; i < lines.length; i++) {
            const rawLine = lines[i];

            if (inCodeBlock) {
                if (/^```/.test(rawLine.trim())) {
                    out.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
                    codeBuffer = [];
                    inCodeBlock = false;
                } else {
                    codeBuffer.push(rawLine);
                }
                continue;
            }

            if (/^```/.test(rawLine.trim())) {
                flushParagraph();
                closeList();
                inCodeBlock = true;
                continue;
            }

            const line = rawLine;

            if (!line.trim()) {
                flushParagraph();
                closeList();
                continue;
            }

            // GFM table: a header row followed by a separator row (| --- | --- |).
            if (this.isTableRow(line) && i + 1 < lines.length && this.isTableSeparator(lines[i + 1])) {
                flushParagraph();
                closeList();
                const aligns = this.parseAlignments(lines[i + 1]);
                const rows = [line];
                let j = i + 2;
                while (j < lines.length && lines[j].trim() && this.isTableRow(lines[j]) && !this.isTableSeparator(lines[j])) {
                    rows.push(lines[j]);
                    j++;
                }
                out.push(this.renderTable(rows, aligns));
                i = j - 1;
                continue;
            }

            const headingMatch = line.match(/^(#{1,6})\s+(.*)/);
            if (headingMatch) {
                flushParagraph();
                closeList();
                const level = headingMatch[1].length;
                out.push(`<h${level}>${this.inlineFormat(headingMatch[2].trim())}</h${level}>`);
                continue;
            }

            const hrMatch = /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim());
            if (hrMatch) {
                flushParagraph();
                closeList();
                out.push('<hr>');
                continue;
            }

            const bulletMatch = line.match(/^(\s*)[\-\*]\s+(.*)/);
            const orderedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/);

            if (bulletMatch) {
                flushParagraph();
                if (listType !== 'ul') {
                    closeList();
                    out.push('<ul>');
                    listType = 'ul';
                }
                out.push(`<li>${this.inlineFormat(bulletMatch[2].trim())}</li>`);
                continue;
            }

            if (orderedMatch) {
                flushParagraph();
                if (listType !== 'ol') {
                    closeList();
                    out.push('<ol>');
                    listType = 'ol';
                }
                out.push(`<li>${this.inlineFormat(orderedMatch[3].trim())}</li>`);
                continue;
            }

            if (/^&gt;\s/.test(line)) {
                flushParagraph();
                closeList();
                out.push(`<blockquote>${this.inlineFormat(line.replace(/^&gt;\s/, '').trim())}</blockquote>`);
                continue;
            }

            paragraphBuffer.push(line.trim());
        }

        flushParagraph();
        closeList();
        if (inCodeBlock) {
            out.push(`<pre><code>${codeBuffer.join('\n')}</code></pre>`);
        }

        return out.join('\n');
    }

    isTableRow(line) {
        return line.includes('|') && line.trim().length > 0;
    }

    isTableSeparator(line) {
        // A line of only pipes, dashes, colons and spaces, with at least one dash.
        const trimmed = line.trim();
        return /-/.test(trimmed) && /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(trimmed);
    }

    splitTableCells(line) {
        let s = line.trim();
        const cells = [];
        let current = '';
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === '\\' && s[i + 1] === '|') {
                current += '|';
                i++;
                continue;
            }
            if (ch === '|') {
                cells.push(current);
                current = '';
                continue;
            }
            current += ch;
        }
        cells.push(current);
        if (cells.length && cells[0].trim() === '') cells.shift();
        if (cells.length && cells[cells.length - 1].trim() === '') cells.pop();
        return cells.map(cell => cell.trim());
    }

    parseAlignments(separatorLine) {
        return this.splitTableCells(separatorLine).map(cell => {
            const left = cell.startsWith(':');
            const right = cell.endsWith(':');
            if (left && right) return 'center';
            if (right) return 'right';
            if (left) return 'left';
            return '';
        });
    }

    renderTable(rows, aligns) {
        if (!rows.length) return '';
        const header = this.splitTableCells(rows[0]);
        const bodyRows = rows.slice(1).map(row => this.splitTableCells(row));
        const alignAttr = index => (aligns[index] ? ` style="text-align:${aligns[index]}"` : '');

        const thead = `<thead><tr>${header
            .map((cell, index) => `<th${alignAttr(index)}>${this.inlineFormat(cell)}</th>`)
            .join('')}</tr></thead>`;

        const tbody = bodyRows.length
            ? `<tbody>${bodyRows
                .map(cells => `<tr>${header
                    .map((_, index) => `<td${alignAttr(index)}>${this.inlineFormat(cells[index] || '')}</td>`)
                    .join('')}</tr>`)
                .join('')}</tbody>`
            : '';

        return `<table>${thead}${tbody}</table>`;
    }

    // Only render URLs with safe protocols; javascript:/data:text etc. in a
    // converted document must not become clickable in the preview.
    sanitizeUrl(url, { allowDataImage = false } = {}) {
        const trimmed = String(url || '').trim();
        if (allowDataImage && /^data:image\//i.test(trimmed)) {
            return trimmed;
        }
        try {
            const parsed = new URL(trimmed, window.location.origin);
            if (['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
                return trimmed;
            }
        } catch (error) {
            // Unparseable URL -> treat as unsafe.
        }
        return null;
    }

    inlineFormat(text) {
        let output = text;
        output = output.replace(/\\([\\`*_{}\[\]<>])/g, '$1');
        output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
        output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        output = output.replace(/(^|[\s(])\*(\S(?:[^*]*\S)?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
        output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            const safe = this.sanitizeUrl(src, { allowDataImage: true });
            return safe ? `<img alt="${alt}" src="${safe}">` : alt;
        });
        output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, href) => {
            const safe = this.sanitizeUrl(href);
            return safe ? `<a href="${safe}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
        });
        return output;
    }
}

class ConverterApp {
    constructor() {
        this.elements = {
            dropzone: document.getElementById('converterDropzone'),
            fileInput: document.getElementById('converterFileInput'),
            chooseFileBtn: document.getElementById('chooseConverterFileBtn'),
            fileStatus: document.getElementById('converterFileStatus'),
            engine: document.getElementById('converterEngine'),
            engineHint: document.getElementById('converterEngineHint'),
            docEngine: document.getElementById('converterDocEngine'),
            docEngineHint: document.getElementById('converterDocEngineHint'),
            headingMode: document.getElementById('converterHeadingMode'),
            preserveFormatting: document.getElementById('converterPreserveFormatting'),
            keepTables: document.getElementById('converterKeepTables'),
            keepLinks: document.getElementById('converterKeepLinks'),
            collapseWhitespace: document.getElementById('converterCollapseWhitespace'),
            output: document.getElementById('converterOutput'),
            preview: document.getElementById('converterPreview'),
            meta: document.getElementById('converterMeta'),
            viewMarkdown: document.getElementById('converterViewMarkdown'),
            viewPreview: document.getElementById('converterViewPreview'),
            copyBtn: document.getElementById('converterCopyBtn'),
            toTtsBtn: document.getElementById('converterToTtsBtn'),
            downloadBtn: document.getElementById('converterDownloadBtn')
        };

        this.previewRenderer = new MarkdownPreviewRenderer();
        this.currentFileName = '';
        this.currentMarkdown = '';
        this.lastFile = null;
        this.bindEvents();
        this.updateEngineHint();
        if (this.elements.docEngine) {
            this.elements.docEngine.addEventListener('change', () => {
                if (this.elements.docEngineHint) {
                    this.elements.docEngineHint.textContent =
                        DOC_ENGINE_HINTS[this.elements.docEngine.value] || DOC_ENGINE_HINTS.standard;
                }
            });
        }
    }

    updateEngineHint() {
        if (!this.elements.engine) return;
        const engine = this.elements.engine.value;
        if (this.elements.engineHint) {
            this.elements.engineHint.textContent = ENGINE_HINTS[engine] || ENGINE_HINTS.standard;
        }
        // No `accept` filter: the picker must allow any file (PPTX, images, plain
        // text, etc.). Format handling/validation happens after selection.
    }

    // The engine selector is meaningful only for PDFs. Enable it for PDFs (and the
    // no-file default); gray it out for everything else and explain what runs.
    updateEngineAvailability(type) {
        const sel = this.elements.engine;
        if (sel) {
            const card = sel.closest('.converter-engine-card');
            const appliesToFile = type == null || type === 'pdf';
            sel.disabled = !appliesToFile;
            if (card) card.classList.toggle('converter-engine-card--disabled', !appliesToFile);
            if (appliesToFile) {
                this.updateEngineHint();
            } else if (this.elements.engineHint) {
                this.elements.engineHint.textContent = ENGINE_DISABLED_HINTS[type] || ENGINE_DISABLED_HINTS.default;
            }
        }

        // The document engine is only a choice for the Office formats that have
        // both a lightweight parser and an anydoc path.
        const docSel = this.elements.docEngine;
        if (!docSel) return;
        const docCard = docSel.closest('.converter-engine-card');
        const isChoice = type == null || OFFICE_CHOICE_EXTENSIONS.includes(type);
        docSel.disabled = !isChoice;
        if (docCard) docCard.classList.toggle('converter-engine-card--disabled', !isChoice);
        if (this.elements.docEngineHint) {
            if (isChoice) {
                this.elements.docEngineHint.textContent = DOC_ENGINE_HINTS[docSel.value] || DOC_ENGINE_HINTS.standard;
            } else if (ANYDOC_ONLY_EXTENSIONS.includes(type)) {
                this.elements.docEngineHint.textContent = DOC_ENGINE_DISABLED_HINTS.anydocOnly;
            } else {
                this.elements.docEngineHint.textContent = DOC_ENGINE_DISABLED_HINTS[type] || DOC_ENGINE_DISABLED_HINTS.default;
            }
        }
    }

    bindEvents() {
        this.elements.chooseFileBtn.addEventListener('click', () => this.elements.fileInput.click());
        this.elements.fileInput.addEventListener('change', event => this.handleFiles(event.target.files));

        ['dragenter', 'dragover'].forEach(eventName => {
            this.elements.dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                this.elements.dropzone.classList.add('converter-dropzone--active');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            this.elements.dropzone.addEventListener(eventName, event => {
                event.preventDefault();
                this.elements.dropzone.classList.remove('converter-dropzone--active');
            });
        });

        this.elements.dropzone.addEventListener('drop', event => this.handleFiles(event.dataTransfer.files));

        this.elements.viewMarkdown.addEventListener('click', () => this.toggleView('markdown'));
        this.elements.viewPreview.addEventListener('click', () => this.toggleView('preview'));

        this.elements.copyBtn.addEventListener('click', () => this.copyMarkdown());
        if (this.elements.toTtsBtn) {
            this.elements.toTtsBtn.addEventListener('click', () => this.sendToTts());
        }
        this.elements.downloadBtn.addEventListener('click', () => this.downloadMarkdown());

        [
            this.elements.engine,
            this.elements.headingMode,
            this.elements.preserveFormatting,
            this.elements.keepTables,
            this.elements.keepLinks,
            this.elements.collapseWhitespace
        ].forEach(control => {
            if (!control) return;
            control.addEventListener('change', () => {
                if (control === this.elements.engine) {
                    this.updateEngineHint();
                }
                if (this.lastFile) {
                    this.convertFile(this.lastFile);
                }
            });
        });
    }

    async handleFiles(fileList) {
        const files = [...(fileList || [])];
        if (!files.length) return;
        if (files.length === 1) {
            await this.convertFile(files[0]);
            return;
        }
        await this.convertBatch(files);
    }

    // Multiple files: convert each one and combine them into a single Markdown
    // document with one "# filename" section per file. A failing file becomes
    // an error note instead of aborting the whole batch.
    async convertBatch(files) {
        this.elements.chooseFileBtn.disabled = true;
        const sections = [];
        let converted = 0;

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                this.setStatus(`Converting ${i + 1} of ${files.length}: ${file.name}...`, 'working');
                try {
                    const ext = this.validate(file);
                    this.updateEngineAvailability(ext);
                    const { markdown } = await this.runConversion(file, ext, this.collectOptions());
                    sections.push(`# ${file.name}\n\n${markdown}`);
                    converted++;
                } catch (error) {
                    sections.push(`# ${file.name}\n\n> Conversion failed: ${error.message || 'unknown error'}`);
                }
            }

            const markdown = sections.join('\n\n---\n\n');
            this.lastFile = null;
            this.currentFileName = 'converted-files.md';
            this.currentMarkdown = markdown;
            this.renderOutput(markdown);
            this.updateEngineAvailability(null);
            const wordCount = markdown.split(/\s+/).filter(Boolean).length;
            this.elements.meta.textContent = `${converted} of ${files.length} files converted locally. ${markdown.length.toLocaleString('en-US')} characters · ${wordCount.toLocaleString('en-US')} words.`;
            this.setStatus(`${converted} of ${files.length} files converted locally. No upload happened.`, converted ? 'good' : 'danger');
            this.elements.copyBtn.disabled = !markdown;
            this.elements.downloadBtn.disabled = !markdown;
            if (this.elements.toTtsBtn) this.elements.toTtsBtn.disabled = !markdown;
        } finally {
            this.elements.chooseFileBtn.disabled = false;
            this.elements.fileInput.value = '';
        }
    }

    collectOptions() {
        return {
            engine: this.currentEngine(),
            docEngine: this.elements.docEngine ? this.elements.docEngine.value : 'standard',
            headingMode: this.elements.headingMode.value,
            preserveFormatting: this.elements.preserveFormatting.checked,
            keepTables: this.elements.keepTables.checked,
            keepLinks: this.elements.keepLinks.checked,
            collapseWhitespace: this.elements.collapseWhitespace.checked
        };
    }

    validate(file) {
        const ext = fileExtension(file.name);
        const isImage = OCR_IMAGE_EXTENSIONS.includes(ext);
        const supported = ['pdf', 'html', 'htm'].concat(OFFICE_CHOICE_EXTENSIONS, ANYDOC_ONLY_EXTENSIONS);

        // PDFs/images are processed in full; everything else only has its text
        // extracted, so it gets the larger MAX_TEXT_FILE_SIZE allowance.
        const limit = (ext === 'pdf' || isImage) ? MAX_FILE_SIZE : MAX_TEXT_FILE_SIZE;
        if (file.size > limit) {
            const mb = Math.round(limit / (1024 * 1024));
            throw new Error(`${file.name} is larger than ${mb} MB. Convert a smaller file or split it first.`);
        }

        if (isImage) return 'image';
        if (supported.includes(ext)) return ext;
        // Anything else: try to read it as plain text (binary is caught at read time).
        return 'text';
    }

    currentEngine() {
        return this.elements.engine ? this.elements.engine.value : 'pdfinspector';
    }

    async convertFile(file) {
        try {
            const ext = this.validate(file);
            // Reflect that the PDF engine selector only applies to PDFs.
            this.updateEngineAvailability(ext);
            this.setStatus(`Preparing ${file.name}...`, 'working');
            this.elements.chooseFileBtn.disabled = true;
            this.lastFile = file;
            this.currentFileName = file.name;

            const options = this.collectOptions();
            const { markdown, engineNote } = await this.runConversion(file, ext, options);
            this.engineNote = engineNote;

            this.currentMarkdown = markdown;
            this.renderOutput(markdown);
            const wordCount = markdown.split(/\s+/).filter(Boolean).length;
            this.elements.meta.textContent = `${file.name} converted locally. ${markdown.length.toLocaleString('en-US')} characters · ${wordCount.toLocaleString('en-US')} words${engineNote}.`;
            this.setStatus(`${file.name} converted locally. No upload happened.`, 'good');
            this.elements.copyBtn.disabled = !markdown;
            this.elements.downloadBtn.disabled = !markdown;
            if (this.elements.toTtsBtn) this.elements.toTtsBtn.disabled = !markdown;
        } catch (error) {
            this.setStatus(error.message || 'Conversion failed.', 'danger');
            this.currentMarkdown = '';
            this.renderOutput('');
            this.elements.copyBtn.disabled = true;
            this.elements.downloadBtn.disabled = true;
            if (this.elements.toTtsBtn) this.elements.toTtsBtn.disabled = true;
        } finally {
            this.elements.chooseFileBtn.disabled = false;
            this.elements.fileInput.value = '';
        }
    }

    // Single-file conversion dispatch, shared by convertFile and convertBatch.
    async runConversion(file, ext, options) {
        let markdown = '';
        let engineNote = '';
        if (ext === 'image') {
            markdown = await this.runOcrOnImage(file, options.collapseWhitespace);
            engineNote = ` · OCR (PP-OCRv6 Tiny)`;
        } else if (ext === 'pdf') {
            const pdfOptions = {
                headingMode: options.headingMode,
                collapseWhitespace: options.collapseWhitespace
            };
            const runStandard = () => new PdfToMarkdown(pdfOptions).convert(file, message => this.setStatus(message, 'working'));

            if (options.engine === 'ocr') {
                markdown = await this.runOcrOnPdf(file, options.collapseWhitespace);
                engineNote = ` · OCR (PP-OCRv6 Tiny)`;
            } else if (options.engine === 'liteparse' || options.engine === 'edgeparse' || options.engine === 'pdfinspector') {
                const ENGINES = {
                    edgeparse: ['EdgeParse', EdgeParsePdfToMarkdown],
                    liteparse: ['LiteParse', LiteParsePdfToMarkdown],
                    pdfinspector: ['pdf-inspector', PdfInspectorToMarkdown]
                };
                const [engineLabel, Engine] = ENGINES[options.engine];
                try {
                    const converter = new Engine(pdfOptions);
                    markdown = await converter.convert(file, message => this.setStatus(message, 'working'));
                    engineNote = ` · ${engineLabel} engine`;
                } catch (engineError) {
                    // A document-level verdict (e.g. "this PDF has no text layer")
                    // must reach the user as-is; only real engine failures fall back.
                    if (engineError.skipFallback) throw engineError;
                    // Fall back to pdf.js so a WASM hiccup never blocks the user.
                    this.setStatus(`${engineLabel} failed (${engineError.message}). Falling back to the standard engine...`, 'warning');
                    markdown = await runStandard();
                    engineNote = ` · standard engine (${engineLabel} fallback)`;
                }
            } else {
                markdown = await runStandard();
            }
        } else if (ANYDOC_ONLY_EXTENSIONS.includes(ext)) {
            // No lightweight parser exists for these, so anydoc is the only path.
            markdown = await new AnydocToMarkdown({ ...options, ext }).convert(file, message => this.setStatus(message, 'working'));
            engineNote = ` · ${ext.toUpperCase()} (anydoc)`;
        } else if (OFFICE_CHOICE_EXTENSIONS.includes(ext) && options.docEngine === 'anydoc') {
            markdown = await new AnydocToMarkdown({ ...options, ext }).convert(file, message => this.setStatus(message, 'working'));
            engineNote = ` · ${ext.toUpperCase()} (anydoc)`;
        } else if (ext === 'docx') {
            const docxConverter = new DocxToMarkdown(options);
            markdown = await docxConverter.convert(file, message => this.setStatus(message, 'working'));
        } else if (ext === 'html' || ext === 'htm') {
            markdown = await new HtmlFileToMarkdown(options).convert(file, message => this.setStatus(message, 'working'));
            engineNote = ' · HTML';
        } else if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
            markdown = await new XlsxToMarkdown(options).convert(file, message => this.setStatus(message, 'working'));
            engineNote = ` · ${ext.toUpperCase()}`;
        } else if (ext === 'pptx') {
            markdown = await new PptxToMarkdown(options).convert(file, message => this.setStatus(message, 'working'));
            engineNote = ' · PPTX';
        } else if (ext === 'text') {
            markdown = await new PlainTextToMarkdown(options).convert(file, message => this.setStatus(message, 'working'));
            engineNote = ' · plain text';
        }
        return { markdown, engineNote };
    }

    async runOcrOnImage(file, shouldCollapse) {
        const mod = await loadOcr();
        const engine = new mod.OcrEngine({ tier: 'tiny' });
        const bitmap = await createImageBitmap(file);
        const result = await engine.run(bitmap, message => this.setStatus(message, 'working'));
        if (typeof bitmap.close === 'function') bitmap.close();
        const text = result.text || '';
        if (!text.trim()) {
            throw new Error('No text was recognized in this image. Use a clearer scan or higher-resolution image.');
        }
        return shouldCollapse ? collapseWhitespace(text) : text.trim();
    }

    async runOcrOnPdf(file, shouldCollapse) {
        const mod = await loadOcr();
        const engine = new mod.OcrEngine({ tier: 'tiny' });
        this.setStatus('Rendering PDF pages for OCR...', 'working');
        const pdfjsLib = await loadPdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const pageTexts = [];

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
            this.setStatus(`OCR page ${pageNumber} of ${pdf.numPages}...`, 'working');
            const page = await pdf.getPage(pageNumber);
            // Render at ~2x for legible OCR input.
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(viewport.width);
            canvas.height = Math.round(viewport.height);
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            const result = await engine.run(canvas, message => this.setStatus(`Page ${pageNumber}/${pdf.numPages}: ${message}`, 'working'));
            if (result.text && result.text.trim()) {
                pageTexts.push(result.text.trim());
            }
        }

        const text = pageTexts.join('\n\n');
        if (!text.trim()) {
            throw new Error('No text was recognized in this PDF. Use a clearer scan or higher-resolution image.');
        }
        return shouldCollapse ? collapseWhitespace(text) : text.trim();
    }

    renderOutput(markdown) {
        this.elements.output.value = markdown;
        if (this.elements.preview.hidden) {
            this.elements.preview.innerHTML = '';
        } else {
            this.elements.preview.innerHTML = markdown ? this.previewRenderer.render(markdown) : '';
        }
    }

    toggleView(mode) {
        const showPreview = mode === 'preview';
        this.elements.output.hidden = showPreview;
        this.elements.preview.hidden = !showPreview;
        this.elements.viewMarkdown.classList.toggle('converter-view-btn--active', !showPreview);
        this.elements.viewMarkdown.setAttribute('aria-pressed', String(!showPreview));
        this.elements.viewPreview.classList.toggle('converter-view-btn--active', showPreview);
        this.elements.viewPreview.setAttribute('aria-pressed', String(showPreview));

        if (showPreview) {
            this.elements.preview.innerHTML = this.currentMarkdown ? this.previewRenderer.render(this.currentMarkdown) : '<p class="converter-preview-empty">Convert a document to preview the Markdown here.</p>';
        }
    }

    async copyMarkdown() {
        if (!this.currentMarkdown) return;
        try {
            await navigator.clipboard.writeText(this.currentMarkdown);
            this.setStatus('Markdown copied to clipboard.', 'good');
        } catch (error) {
            this.setStatus('Could not copy to clipboard. Select and copy manually.', 'warning');
        }
    }

    sendToTts() {
        if (!this.currentMarkdown) return;
        try {
            sessionStorage.setItem('tts-input-text', this.currentMarkdown);
        } catch (_) {
            this.setStatus('Could not hand the text to the Speech tool in this browser.', 'warning');
            return;
        }
        window.location.href = '/tts';
    }

    downloadMarkdown() {
        if (!this.currentMarkdown) return;
        const baseName = (this.currentFileName || 'document').replace(/\.[^.]+$/, '');
        const blob = new Blob([this.currentMarkdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${baseName || 'document'}.md`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        this.setStatus('Download started. The file stays on this device.', 'good');
    }

    setStatus(message, tone = 'neutral') {
        this.elements.fileStatus.textContent = message;
        this.elements.fileStatus.dataset.tone = tone;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.__converterApp = new ConverterApp();
});
