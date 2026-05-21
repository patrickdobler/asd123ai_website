const MAX_FILE_SIZE = 25 * 1024 * 1024;

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

async function loadPdfJs() {
    if (!window.pdfjsLib) {
        await loadExternalScript('vendor/pdf.min.js');
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    }
    return window.pdfjsLib;
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
    return markdown
        .replace(/\r\n/g, '\n')
        .replace(/ /g, ' ')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

class HtmlToMarkdown {
    constructor({ preserveFormatting = true, keepTables = true, keepLinks = true } = {}) {
        this.preserveFormatting = preserveFormatting;
        this.keepTables = keepTables;
        this.keepLinks = keepLinks;
    }

    convert(html) {
        const container = document.createElement('div');
        container.innerHTML = html;
        const markdown = this.renderChildren(container, { listDepth: 0 }).trim();
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
                return '  \n';
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

        return lines.map(line => ({
            text: (line.text || '').replace(/\s+/g, ' ').trim(),
            height: line.height,
            isBlank: !line.text || !line.text.trim()
        }));
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

            const previous = buffer[buffer.length - 1];
            if (previous && /[.!?:;。！？]$/.test(previous)) {
                flushBuffer();
            }
            buffer.push(text);
        }

        flushBuffer();

        return blocks.join('\n\n');
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

        for (const rawLine of lines) {
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

    inlineFormat(text) {
        let output = text;
        output = output.replace(/\\([\\`*_{}\[\]<>])/g, '$1');
        output = output.replace(/`([^`]+)`/g, '<code>$1</code>');
        output = output.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        output = output.replace(/(^|[\s(])\*(\S(?:[^*]*\S)?)\*(?=[\s).,!?:;]|$)/g, '$1<em>$2</em>');
        output = output.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">');
        output = output.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
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
            downloadBtn: document.getElementById('converterDownloadBtn')
        };

        this.previewRenderer = new MarkdownPreviewRenderer();
        this.currentFileName = '';
        this.currentMarkdown = '';
        this.lastFile = null;
        this.bindEvents();
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
        this.elements.downloadBtn.addEventListener('click', () => this.downloadMarkdown());

        [
            this.elements.headingMode,
            this.elements.preserveFormatting,
            this.elements.keepTables,
            this.elements.keepLinks,
            this.elements.collapseWhitespace
        ].forEach(control => {
            control.addEventListener('change', () => {
                if (this.lastFile) {
                    this.convertFile(this.lastFile);
                }
            });
        });
    }

    async handleFiles(fileList) {
        const file = fileList?.[0];
        if (!file) return;
        await this.convertFile(file);
    }

    validate(file) {
        const ext = fileExtension(file.name);
        if (!['pdf', 'docx'].includes(ext)) {
            throw new Error(`${file.name} is not supported. Use a PDF or DOCX file.`);
        }
        if (file.size > MAX_FILE_SIZE) {
            throw new Error(`${file.name} is larger than 25 MB. Convert a smaller file or split it first.`);
        }
        return ext;
    }

    async convertFile(file) {
        try {
            const ext = this.validate(file);
            this.setStatus(`Preparing ${file.name}...`, 'working');
            this.elements.chooseFileBtn.disabled = true;
            this.lastFile = file;
            this.currentFileName = file.name;

            const options = {
                headingMode: this.elements.headingMode.value,
                preserveFormatting: this.elements.preserveFormatting.checked,
                keepTables: this.elements.keepTables.checked,
                keepLinks: this.elements.keepLinks.checked,
                collapseWhitespace: this.elements.collapseWhitespace.checked
            };

            let markdown = '';
            if (ext === 'pdf') {
                const pdfConverter = new PdfToMarkdown({
                    headingMode: options.headingMode,
                    collapseWhitespace: options.collapseWhitespace
                });
                markdown = await pdfConverter.convert(file, message => this.setStatus(message, 'working'));
            } else if (ext === 'docx') {
                const docxConverter = new DocxToMarkdown(options);
                markdown = await docxConverter.convert(file, message => this.setStatus(message, 'working'));
            }

            this.currentMarkdown = markdown;
            this.renderOutput(markdown);
            const wordCount = markdown.split(/\s+/).filter(Boolean).length;
            this.elements.meta.textContent = `${file.name} converted locally. ${markdown.length.toLocaleString('en-US')} characters · ${wordCount.toLocaleString('en-US')} words.`;
            this.setStatus(`${file.name} converted locally. No upload happened.`, 'good');
            this.elements.copyBtn.disabled = !markdown;
            this.elements.downloadBtn.disabled = !markdown;
        } catch (error) {
            this.setStatus(error.message || 'Conversion failed.', 'danger');
            this.currentMarkdown = '';
            this.renderOutput('');
            this.elements.copyBtn.disabled = true;
            this.elements.downloadBtn.disabled = true;
        } finally {
            this.elements.chooseFileBtn.disabled = false;
            this.elements.fileInput.value = '';
        }
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
        this.elements.viewMarkdown.setAttribute('aria-selected', String(!showPreview));
        this.elements.viewPreview.classList.toggle('converter-view-btn--active', showPreview);
        this.elements.viewPreview.setAttribute('aria-selected', String(showPreview));

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
    new ConverterApp();
});
