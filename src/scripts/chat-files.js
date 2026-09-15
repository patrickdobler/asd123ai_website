const TEXT_EXTENSIONS = ['txt', 'md', 'markdown', 'csv', 'json', 'log'];
const SUPPORTED_EXTENSIONS = [...TEXT_EXTENSIONS, 'pdf', 'docx'];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

function createId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }
    return `att-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

class ChatFileProcessor {
    validate(file) {
        if (file.size > MAX_FILE_SIZE) {
            return {
                ok: false,
                error: `${file.name} is larger than 15 MB.`
            };
        }

        const extension = this.extension(file.name);

        if (file.type.startsWith('image/')) {
            return { ok: true };
        }

        if (!SUPPORTED_EXTENSIONS.includes(extension)) {
            return {
                ok: false,
                error: `${file.name} is not supported. Use images, TXT, Markdown, CSV, JSON, LOG, PDF, or DOCX files.`
            };
        }


        return { ok: true };
    }

    async process(file) {
        const validation = this.validate(file);
        if (!validation.ok) {
            throw new Error(validation.error);
        }

        if (file.type.startsWith('image/')) {
            return {
                id: createId(),
                kind: 'image',
                name: file.name,
                mimeType: file.type,
                size: file.size,
                dataUrl: await this.readDataUrl(file)
            };
        }

        const extension = this.extension(file.name);
        let text = '';

        if (TEXT_EXTENSIONS.includes(extension)) {
            text = await file.text();
        } else if (extension === 'pdf') {
            text = await this.extractPdfText(file);
        } else if (extension === 'docx') {
            text = await this.extractDocxText(file);
        }

        return {
            id: createId(),
            kind: 'text',
            name: file.name,
            mimeType: file.type || `application/${extension}`,
            size: file.size,
            text: this.compactText(text)
        };
    }

    extension(name) {
        return String(name || '').split('.').pop().toLowerCase();
    }

    readDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    }

    compactText(text) {
        return String(text || '')
            .replace(/\r\n/g, '\n')
            .replace(/[ \t]+\n/g, '\n')
            .replace(/\n{4,}/g, '\n\n\n')
            .trim();
    }

    async extractPdfText(file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        await this.yieldToBrowser();
        const raw = new TextDecoder('latin1').decode(bytes);
        await this.yieldToBrowser();
        const streamTexts = await this.extractPdfStreamTexts(bytes, raw);
        const streamChunks = streamTexts.flatMap(text => this.extractPdfTextChunks(text));
        const chunks = streamChunks.length ? streamChunks : this.extractPdfTextChunks(raw);

        if (!chunks.length) {
            await this.yieldToBrowser();
            const fallback = raw
                .replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            if (fallback.length > 80) {
                chunks.push(fallback);
            }
        }

        if (!chunks.length) {
            throw new Error('No readable PDF text was found. Scanned or compressed PDFs may need OCR outside the browser.');
        }

        return chunks.join('\n');
    }

    async extractPdfStreamTexts(bytes, raw) {
        const texts = [];
        const streamPattern = /<<(?:.|\n|\r)*?>>\s*stream(?:\r\n|\n|\r)?/g;
        let match;
        let processed = 0;

        while ((match = streamPattern.exec(raw)) !== null) {
            const dictionary = match[0];
            const dataStart = streamPattern.lastIndex;
            const endIndex = raw.indexOf('endstream', dataStart);

            if (endIndex === -1) {
                break;
            }

            let dataEnd = endIndex;
            while (dataEnd > dataStart && (bytes[dataEnd - 1] === 10 || bytes[dataEnd - 1] === 13)) {
                dataEnd--;
            }

            const streamBytes = bytes.slice(dataStart, dataEnd);
            let text = '';

            if (/\/FlateDecode\b/.test(dictionary)) {
                text = await this.inflatePdfStream(streamBytes);
            } else {
                text = raw.slice(dataStart, dataEnd);
            }

            if (text && /(?:\bT[Jj]\b|\bBT\b|\bET\b)/.test(text)) {
                texts.push(text);
            }

            streamPattern.lastIndex = endIndex + 'endstream'.length;
            processed++;
            if (processed % 24 === 0) {
                await this.yieldToBrowser();
            }
        }

        return texts;
    }

    async inflatePdfStream(bytes) {
        if (!('DecompressionStream' in window)) {
            return '';
        }

        for (const format of ['deflate', 'deflate-raw']) {
            try {
                const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
                const buffer = await new Response(stream).arrayBuffer();
                return new TextDecoder('latin1').decode(new Uint8Array(buffer));
            } catch (error) {
                // Some PDFs use zlib-wrapped deflate, others raw deflate.
            }
        }

        return '';
    }

    extractPdfTextChunks(content) {
        const chunks = [];
        const textObjectPattern = /(?:\((?:\\.|[^\\)])*\)|<[\dA-Fa-f\s]+>)\s*Tj|\[(?:.|\n|\r)*?\]\s*TJ/g;
        let match;

        while ((match = textObjectPattern.exec(content)) !== null) {
            const line = this.extractPdfTextTokens(match[0]).join('').replace(/[ \t]{2,}/g, ' ').trim();
            if (line) {
                chunks.push(line);
            }
        }

        return chunks;
    }

    extractPdfTextTokens(value) {
        const tokens = [];
        const tokenPattern = /\((?:\\.|[^\\)])*\)|<([\dA-Fa-f\s]+)>|-?\d+(?:\.\d+)?/g;
        let match;

        while ((match = tokenPattern.exec(value)) !== null) {
            const token = match[0];

            if (token.startsWith('(')) {
                tokens.push(this.decodePdfLiteral(token.slice(1, -1)));
                continue;
            }

            if (token.startsWith('<')) {
                tokens.push(this.decodePdfHexString(token.slice(1, -1)));
                continue;
            }

            const adjustment = Number(token);
            if (Number.isFinite(adjustment) && adjustment < -120 && tokens.at(-1) !== ' ') {
                tokens.push(' ');
            }
        }

        return tokens;
    }

    yieldToBrowser() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    decodePdfLiteral(value) {
        return value
            .replace(/\\\r?\n/g, '')
            .replace(/\\([nrtbf()\\])/g, (_, code) => {
                const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
                return map[code] || code;
            })
            .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
    }

    decodePdfHexString(value) {
        let hex = String(value || '').replace(/\s+/g, '');
        if (!hex) {
            return '';
        }
        if (hex.length % 2) {
            hex += '0';
        }

        const bytes = new Uint8Array(hex.length / 2);
        for (let index = 0; index < hex.length; index += 2) {
            bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16);
        }

        if (bytes[0] === 0xfe && bytes[1] === 0xff) {
            return this.decodeUtf16Be(bytes.slice(2));
        }

        const zeroHighBytes = bytes.reduce((total, byte, index) => total + (index % 2 === 0 && byte === 0 ? 1 : 0), 0);
        if (bytes.length > 3 && zeroHighBytes / Math.ceil(bytes.length / 2) > 0.35) {
            return this.decodeUtf16Be(bytes);
        }

        try {
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        } catch (error) {
            try {
                return new TextDecoder('windows-1252').decode(bytes);
            } catch (fallbackError) {
                return new TextDecoder('latin1').decode(bytes);
            }
        }
    }

    decodeUtf16Be(bytes) {
        let text = '';
        for (let index = 0; index + 1 < bytes.length; index += 2) {
            const code = (bytes[index] << 8) | bytes[index + 1];
            if (code) {
                text += String.fromCharCode(code);
            }
        }
        return text;
    }

    async extractDocxText(file) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const documentXml = await this.readZipEntry(bytes, 'word/document.xml');

        if (!documentXml) {
            throw new Error('Could not find word/document.xml in this DOCX file.');
        }

        return new TextDecoder('utf-8')
            .decode(documentXml)
            .replace(/<w:tab\/>/g, '\t')
            .replace(/<\/w:p>/g, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .trim();
    }

    async readZipEntry(bytes, wantedName) {
        let offset = 0;

        while (offset + 30 < bytes.length) {
            const signature = this.readUint32(bytes, offset);
            if (signature !== 0x04034b50) {
                offset++;
                continue;
            }

            const compression = this.readUint16(bytes, offset + 8);
            const compressedSize = this.readUint32(bytes, offset + 18);
            const uncompressedSize = this.readUint32(bytes, offset + 22);
            const nameLength = this.readUint16(bytes, offset + 26);
            const extraLength = this.readUint16(bytes, offset + 28);
            const nameStart = offset + 30;
            const dataStart = nameStart + nameLength + extraLength;
            const name = new TextDecoder('utf-8').decode(bytes.slice(nameStart, nameStart + nameLength));
            const dataEnd = dataStart + compressedSize;

            if (name === wantedName) {
                const entryBytes = bytes.slice(dataStart, dataEnd);

                if (compression === 0) {
                    return entryBytes;
                }

                if (compression === 8) {
                    return this.inflateRaw(entryBytes, uncompressedSize);
                }

                throw new Error(`Unsupported DOCX compression method ${compression}.`);
            }

            offset = Math.max(dataEnd, offset + 30);
        }

        return null;
    }

    async inflateRaw(bytes, expectedSize) {
        if (!('DecompressionStream' in window)) {
            throw new Error('This browser cannot decompress DOCX files locally.');
        }

        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
        const buffer = await new Response(stream).arrayBuffer();
        const inflated = new Uint8Array(buffer);

        if (expectedSize && inflated.length !== expectedSize) {
            return inflated;
        }

        return inflated;
    }

    readUint16(bytes, offset) {
        return bytes[offset] | (bytes[offset + 1] << 8);
    }

    readUint32(bytes, offset) {
        return ((bytes[offset]) |
            (bytes[offset + 1] << 8) |
            (bytes[offset + 2] << 16) |
            (bytes[offset + 3] << 24)) >>> 0;
    }
}

export { ChatFileProcessor };
