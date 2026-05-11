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
        const extension = this.extension(file.name);

        if (file.type.startsWith('image/')) {
            return { ok: true };
        }

        if (!SUPPORTED_EXTENSIONS.includes(extension)) {
            return {
                ok: false,
                error: `${file.name} is not supported. Use images, TXT, Markdown, PDF, or DOCX files.`
            };
        }

        if (file.size > MAX_FILE_SIZE) {
            return {
                ok: false,
                error: `${file.name} is larger than 15 MB.`
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
        const chunks = [];
        const textObjectPattern = /\((?:\\.|[^\\)])*\)\s*Tj|\[(?:.|\n|\r)*?\]\s*TJ/g;
        const literalPattern = /\((?:\\.|[^\\)])*\)/g;
        let match;
        let processed = 0;

        while ((match = textObjectPattern.exec(raw)) !== null) {
            const literals = match[0].match(literalPattern) || [];
            const line = literals.map(value => this.decodePdfLiteral(value.slice(1, -1))).join('');
            if (line.trim()) {
                chunks.push(line.trim());
            }

            processed++;
            if (processed % 120 === 0) {
                await this.yieldToBrowser();
            }
        }

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

    yieldToBrowser() {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    decodePdfLiteral(value) {
        return value
            .replace(/\\([nrtbf()\\])/g, (_, code) => {
                const map = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' };
                return map[code] || code;
            })
            .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)));
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
