/**
 * ASD123.ai AI Text Tools - Optimizer Engine
 * Privacy-focused text processing with client-side execution
 */

/**
 * Embedded fallback language mappings to ensure mapping works in file:// contexts
 * These are overridden by fetched JSON if available at runtime.
 */
const EMBEDDED_MAPPINGS = {
    'swiss-german': {
        ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
        '-': '-', '‐': '-', '‑': '-', '–': '-', '—': '-',
        '„': '"', '“': '"', '”': '"',
        '‚': '\'', '‘': '\'', '’': '\'',
        '‹': '\'', '›': '\'',
        '«': '"', '»': '"',
        'ß': 'ss',
        '…': '...', '•': '-', '°': '°', '¨': '', '´': '\'', '×': 'x'
    },
    'german': {
        ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
        '‐': '-', '‑': '-', '–': '-', '—': '-',
        '«': '"', '»': '"',
        '„': '"', '“': '"', '”': '"', '‚': '\'', '‘': '\'', '’': '\'',
        'œ': 'oe', 'Œ': 'Oe',
        'æ': 'ae', 'Æ': 'Ae',
        '…': '...', '•': '-', '°': '°', '¨': '', '´': '\'',
        '×': 'x'
    },
    'french': {
        ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
        '‐': '-', '‑': '-', '–': '-', '—': '-',
        '«': '"', '»': '"',
        '„': '"', '“': '"', '”': '"', '‚': '\'', '‘': '\'', '’': '\'',
        'œ': 'oe', 'Œ': 'Oe',
        'æ': 'ae', 'Æ': 'Ae',
        '…': '...', '•': '-', '°': '°', '¨': '', '´': '\'',
        '×': 'x'
    },
    'italian': {
        ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
        '‐': '-', '‑': '-', '–': '-', '—': '-',
        '«': '"', '»': '"',
        '„': '"', '“': '"', '”': '"', '‚': '\'', '‘': '\'', '’': '\'',
        '…': '...', '•': '-', '°': '°', '¨': '', '´': '\'',
        '×': 'x'
    },
    'english-international': {
        ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
        '‐': '-', '‑': '-', '–': '-', '—': '-',
        '“': '"', '”': '"', '„': '"', '‘': '\'', '’': '\'',
        '«': '"', '»': '"',
        '…': '...', '•': '-', '°': '°', '¨': '', '´': '\'',
        'œ': 'oe', 'Œ': 'Oe', 'æ': 'ae', 'Æ': 'Ae',
        '×': 'x'
    },
    'english-us': {
        ' ': ' ', ' ': ' ', ' ': ' ', ' ': ' ',
        '‐': '-', '‑': '-', '–': '-', '—': '-',
        '“': '"', '”': '"', '‘': '\'', '’': '\'',
        '…': '...', '•': '-', '°': '°', '¨': '', '´': '\'',
        'œ': 'oe', 'Œ': 'Oe', 'æ': 'ae', 'Æ': 'Ae',
        '×': 'x'
    }
};
class TextOptimizer {
    constructor() {
        this.settings = {
            applyLanguageMapping: false,  // New setting for language character replacement
            removeDiacritics: false,
            reverseDiacritics: false,
            removeCitations: false,
            convertMarkdown: false,
            removeFancyFont: false,
            replaceEmDash: false,
            languageMapping: 'swiss-german',
            targetSystem: 'auto',         // 'auto' | 'windows' | 'linux' | 'macos'
            removeLineBreaks: false        // Remove all line breaks (default off)
        };

        this.languageMappings = { ...EMBEDDED_MAPPINGS };
        this.isInitialized = false;

        // Initialize the optimizer
        this.initialize();
    }

    async initialize() {
        try {
            await this.loadLanguageMappings();
            this.isInitialized = true;
            console.log('TextOptimizer initialized successfully');
        } catch (error) {
            console.error('Failed to initialize TextOptimizer:', error);
        }
    }

    async loadLanguageMappings() {
        const languages = [
            'swiss-german',
            'german',
            'french',
            'italian',
            'english-international',
            'english-us'
        ];

        // Start with embedded mappings so this works in file:// context
        this.languageMappings = { ...EMBEDDED_MAPPINGS };

        for (const lang of languages) {
            try {
                // Try relative path first (most common for local files)
                const response = await fetch(`components/mappings/mappings/${lang}.json`);
                if (response.ok) {
                    this.languageMappings[lang] = await response.json();
                    console.log(`✅ Loaded mapping for ${lang}:`, this.languageMappings[lang]);
                } else {
                    console.warn(`❌ Failed to load mapping for ${lang} - Status: ${response.status}`);
                }
            } catch (error) {
                console.error(`❌ Error loading ${lang} mapping:`, error);
            }
        }
        console.log('🔍 All language mappings loaded:', Object.keys(this.languageMappings));
        console.log('📊 Total mappings loaded:', Object.keys(this.languageMappings).length);
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }

    /**
     * Main text processing method
     * @param {string} inputText - The text to process
     * @returns {object} - The processed text and whether changes were made
     */
    processText(inputText) {
        if (!inputText || typeof inputText !== 'string') {
            return { text: '', changed: false };
        }

        let processedText = inputText;
        const originalText = inputText;

        // Cross-platform normalization runs FIRST
        processedText = this.normalizeForTargetSystem(processedText);

        // Apply processing steps in order
        if (this.settings.removeDiacritics) {
            processedText = this.removeDiacritics(processedText);
        } else if (this.settings.reverseDiacritics) {
            // When reverse diacritics is toggled on, convert digraph sequences back to umlauts
            // e.g. ae -> ä, oe -> ö, ue -> ü (case-sensitive)
            processedText = this.invertDiacritics(processedText);
        }

        if (this.settings.removeCitations) {
            processedText = this.removeCitations(processedText);
        }

        if (this.settings.convertMarkdown) {
            processedText = this.convertMarkdown(processedText);
        }

        if (this.settings.removeFancyFont) {
            processedText = this.removeFancyFont(processedText);
        }

        // Apply em dash replacement BEFORE language mapping
        if (this.settings.replaceEmDash) {
            processedText = this.replaceEmDash(processedText);
        }

        // Apply language mapping AFTER em dash replacement
        if (this.settings.applyLanguageMapping) {
            processedText = this.applyLanguageCharacterMapping(processedText);
        }

        // Line break removal runs LAST
        if (this.settings.removeLineBreaks) {
            processedText = this.removeAllLineBreaks(processedText);
        }

        return {
            text: processedText,
            changed: processedText !== originalText
        };
    }

    /**
     * Apply language-specific character mappings (quotes, dashes, etc.)
     * @param {string} text - Input text
     * @returns {string} - Text with language mappings applied
     */
    applyLanguageCharacterMapping(text) {
        const lang = this.settings.languageMapping;
        const mapping = this.languageMappings[lang] || EMBEDDED_MAPPINGS[lang] || {};
        console.log(`🔧 Applying language mapping for: ${lang}`);
        console.log(`📋 Available mappings:`, Object.keys(this.languageMappings));

        if (!mapping || Object.keys(mapping).length === 0) {
            console.warn(`❌ No mapping found for language: ${lang}`);
            return text;
        }

        console.log(`✅ Found mapping with ${Object.keys(mapping).length} rules`);
        // Normalize to ensure composed characters match mapping keys
        let result = (text ?? '').normalize('NFC');
        let changesCount = 0;

        // Use split/join to avoid any RegExp edge cases
        for (const [original, replacement] of Object.entries(mapping)) {
            if (!original) continue;
            if (replacement === undefined || original === replacement) continue;

            const parts = result.split(original);
            const replacements = parts.length - 1;
            if (replacements > 0) {
                result = parts.join(replacement);
                changesCount += replacements;
                console.log(`🔄 Replaced "${original}" → "${replacement}" (${replacements} times)`);
            }
        }

        // Minimal safety net for Swiss German core characters if still unchanged
        if (changesCount === 0 && lang === 'swiss-german') {
            const coreMap = { '—': '-', '«': '"', '»': '"', 'ß': 'ss' };
            for (const [orig, repl] of Object.entries(coreMap)) {
                const parts = result.split(orig);
                const n = parts.length - 1;
                if (n > 0) {
                    result = parts.join(repl);
                    changesCount += n;
                    console.log(`🛡️ Core fallback: "${orig}" → "${repl}" (${n} times)`);
                }
            }
        }

        console.log(`📈 Total character replacements made: ${changesCount}`);
        return result;
    }

    /**
     * Invert diacritics: convert digraph sequences back to umlauts when removeDiacritics is OFF.
     * e.g. ae -> ä, Ae -> Ä, AE -> Ä, oe -> ö, Oe -> Ö, OE -> Ö, ue -> ü, Ue -> Ü, UE -> Ü
     * Case-sensitive, preserves already-correct characters.
     * @param {string} text - Input text
     * @returns {string} - Text with digraphs replaced by umlauts
     */
    invertDiacritics(text) {
        let result = text;

        // --- Exceptions List ---
        // Patterns and words that should NOT be converted.
        // This list can be expanded as needed!
        const exceptions = [
            // 1. Specific letter patterns for 'ue'
            /([qQ]ue)/g,               // catches Quelle, bequem, Konsequenz, etc.
            /([aAeEiIoOuUäöüÄÖÜ]ue)/g, // catches vowels before 'ue': neue, Bauer, Abenteuer, Reue

            // 2. Words with '-uell' / '-uel'
            /\b([a-zA-Z]*(?:akt|act|man|event|individ|virt|vis|sex|spirit|text|rit|konzept|d|sam|eman)uell?[a-zA-Z]*)\b/gi,

            // 3. Further specific exceptions with 'ue'
            /\b(Statue[n]?)\b/gi,
            /\b(Menuett[e]?)\b/gi,
            /\b(Silhouette[n]?)\b/gi,
            /\b(Pirouette[n]?)\b/gi,

            // 4. Exceptions for 'oe'
            /\b([Pp]oe[st][a-z]*)\b/gi,     // Poet, Poesie
            /\b([Kk]oeffizient[a-z]*)\b/gi, // Koeffizient
            /\b([Aa]loe)\b/gi,              // Aloe

            // 5. Exceptions for 'ae'
            /\b([Mm]ichael|[Rr]a[fp]hael|[Ii]srael)\b/gi, // Names
            /\b([Aa]ero[a-z]*)\b/gi,                      // aerodynamisch, Aerosol
            /\b(Paella)\b/gi                              // Paella
        ];

        // Protect these exceptions by temporarily replacing them with a placeholder
        const protectedWords = [];
        exceptions.forEach((regex) => {
            result = result.replace(regex, (match) => {
                const placeholder = `__PROTECTED_${protectedWords.length}__`;
                protectedWords.push(match);
                return placeholder;
            });
        });

        const invertMap = [
            // ue -> ü
            ['UE', 'Ü'],
            ['Ue', 'Ü'],
            ['ue', 'ü'],
            // oe -> ö
            ['OE', 'Ö'],
            ['Oe', 'Ö'],
            ['oe', 'ö'],
            // ae -> ä
            ['AE', 'Ä'],
            ['Ae', 'Ä'],
            ['ae', 'ä']
            // ss -> ß is intentionally ignored as it is highly context-dependent
        ];

        for (const [digraph, umlaut] of invertMap) {
            result = result.split(digraph).join(umlaut);
        }

        // Restore protected words
        protectedWords.forEach((word, index) => {
            result = result.replace(`__PROTECTED_${index}__`, word);
        });

        return result;
    }

    /**
     * Remove diacritics and apply language-specific character mappings
     * @param {string} text - Input text
     * @returns {string} - Text with diacritics removed
     */
    removeDiacritics(text) {
        let result = text;

        // Comprehensive diacritic removal for common accented characters
        const diacriticMap = {
            'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'ae', 'å': 'a', 'ā': 'a', 'ă': 'a', 'ą': 'a',
            'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'Ae', 'Å': 'A', 'Ā': 'A', 'Ă': 'A', 'Ą': 'A',
            'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ĕ': 'e', 'ė': 'e', 'ę': 'e', 'ě': 'e',
            'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E', 'Ē': 'E', 'Ĕ': 'E', 'Ė': 'E', 'Ę': 'E', 'Ě': 'E',
            'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ĩ': 'i', 'ī': 'i', 'ĭ': 'i', 'į': 'i',
            'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I', 'Ĩ': 'I', 'Ī': 'I', 'Ĭ': 'I', 'Į': 'I',
            'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'oe', 'ø': 'o', 'ō': 'o', 'ŏ': 'o', 'ő': 'o',
            'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'Oe', 'Ø': 'O', 'Ō': 'O', 'Ŏ': 'O', 'Ő': 'O',
            'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'ue', 'ũ': 'u', 'ū': 'u', 'ŭ': 'u', 'ů': 'u', 'ű': 'u', 'ų': 'u',
            'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'Ue', 'Ũ': 'U', 'Ū': 'U', 'Ŭ': 'U', 'Ů': 'U', 'Ű': 'U', 'Ų': 'U',
            'ý': 'y', 'ÿ': 'y', 'ŷ': 'y',
            'Ý': 'Y', 'Ÿ': 'Y', 'Ŷ': 'Y',
            'ñ': 'n', 'ń': 'n', 'ň': 'n', 'ņ': 'n',
            'Ñ': 'N', 'Ń': 'N', 'Ň': 'N', 'Ņ': 'N',
            'ç': 'c', 'ć': 'c', 'ĉ': 'c', 'ċ': 'c', 'č': 'c',
            'Ç': 'C', 'Ć': 'C', 'Ĉ': 'C', 'Ċ': 'C', 'Č': 'C',
            'ß': 'ss',
            'æ': 'ae', 'Æ': 'Ae',
            'œ': 'oe', 'Œ': 'Oe'
        };

        for (const [accented, plain] of Object.entries(diacriticMap)) {
            result = result.replace(new RegExp(this.escapeRegExp(accented), 'g'), plain);
        }

        return result;
    }

    /**
     * Remove citation references like [1], (2), (Source: XYZ), etc.
     * Preserves line breaks
     * @param {string} text - Input text
     * @returns {string} - Text with citations removed
     */
    removeCitations(text) {
        // Split by lines to preserve line breaks
        const lines = text.split('\n');

        const processedLines = lines.map(line => {
            let result = line;

            // Remove full markdown-style citation links: [label](url) -> completely removed
            // This handles cases like [business.uq.edu](https://business.uq.edu.au/...)
            result = result.replace(/\[[^\]]*\]\(https?:\/\/[^)]*\)/g, '');

            // Remove markdown-style links where URL is not http (e.g. [text](path))
            // Only if it looks like a citation (label contains a dot or is short)
            result = result.replace(/\[[^\]]*\]\([^)]*\)/g, '');

            // Remove standalone bracketed domains or sources: e.g. [business.uq.edu]
            result = result.replace(/\[[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\]/g, '');

            // Remove numbered citations: [1], [2], [123], etc.
            result = result.replace(/\[\d+\]/g, '');

            // Remove parenthetical citations: (1), (2), (123), etc.
            result = result.replace(/\(\d+\)/g, '');

            // Remove source citations: (Source: XYZ), (Quelle: ABC), etc.
            result = result.replace(/\((Source|Quelle|Fonte|Fuente):\s*[^)]+\)/gi, '');

            // Remove URL citations in parentheses: (https://example.com)
            result = result.replace(/\(https?:\/\/[^)]+\)/g, '');

            // Remove reference markers: ¹, ², ³, etc.
            result = result.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]/g, '');

            // Remove superscript numbers (Unicode superscripts)
            result = result.replace(/[\u2070-\u209F]/g, '');

            // Clean up extra spaces left by removed citations (within the line only)
            result = result.replace(/\s{2,}/g, ' ');
            result = result.replace(/\s+([.!?])/g, '$1');

            return result.trim();
        });

        return processedLines.join('\n');
    }

    /**
     * Convert Markdown formatting to plain text
     * Preserves line breaks
     * @param {string} text - Input text with Markdown
     * @returns {string} - Plain text without Markdown formatting
     */
    convertMarkdown(text) {
        let result = text;

        // Remove headers: # ## ### #### ##### ######
        result = result.replace(/^#{1,6}\s+(.+)$/gm, '$1');

        // Remove bold: **text** or __text__
        result = result.replace(/\*\*([^*]+)\*\*/g, '$1');
        result = result.replace(/__([^_]+)__/g, '$1');

        // Remove italic: *text* or _text_ (be careful not to match list items)
        result = result.replace(/(?<!\n)\*([^*\n]+)\*/g, '$1');
        result = result.replace(/(?<!\n)_([^_\n]+)_/g, '$1');

        // Remove strikethrough: ~~text~~
        result = result.replace(/~~([^~]+)~~/g, '$1');

        // Remove code blocks: ```code```
        result = result.replace(/```[\s\S]*?```/g, '');

        // Remove inline code: `code`
        result = result.replace(/`([^`]+)`/g, '$1');

        // Remove links: [text](url) -> text
        result = result.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

        // Remove reference-style links: [text][ref] -> text
        result = result.replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1');

        // Remove images: ![alt](url) -> alt
        result = result.replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');

        // Remove horizontal rules: --- or ***
        result = result.replace(/^[-*]{3,}$/gm, '');

        // Remove blockquotes: > text
        result = result.replace(/^>\s*(.+)$/gm, '$1');

        // Remove list markers: - item, * item, + item, 1. item
        result = result.replace(/^[\s]*[-*+]\s+(.+)$/gm, '$1');
        result = result.replace(/^[\s]*\d+\.\s+(.+)$/gm, '$1');

        // Clean up extra blank lines (but preserve intentional line breaks)
        result = result.replace(/\n{3,}/g, '\n\n');

        // Clean up spaces within lines only
        const lines = result.split('\n');
        const cleanedLines = lines.map(line => line.replace(/\s{2,}/g, ' ').trim());

        return cleanedLines.join('\n');
    }

    /**
     * Remove fancy Unicode text styles (bold, italic, monospace, etc.)
     * @param {string} text - Input text with fancy Unicode
     * @returns {string} - Plain text with normal characters
     */
    removeFancyFont(text) {
        let result = text;

        // Extended Unicode character mappings for fancy text styles
        const fancyMappings = {
            // Mathematical Bold
            '𝐀': 'A', '𝐁': 'B', '𝐂': 'C', '𝐃': 'D', '𝐄': 'E', '𝐅': 'F', '𝐆': 'G', '𝐇': 'H', '𝐈': 'I', '𝐉': 'J',
            '𝐊': 'K', '𝐋': 'L', '𝐌': 'M', '𝐍': 'N', '𝐎': 'O', '𝐏': 'P', '𝐐': 'Q', '𝐑': 'R', '𝐒': 'S', '𝐓': 'T',
            '𝐔': 'U', '𝐕': 'V', '𝐖': 'W', '𝐗': 'X', '𝐘': 'Y', '𝐙': 'Z',
            '𝐚': 'a', '𝐛': 'b', '𝐜': 'c', '𝐝': 'd', '𝐞': 'e', '𝐟': 'f', '𝐠': 'g', '𝐡': 'h', '𝐢': 'i', '𝐣': 'j',
            '𝐤': 'k', '𝐥': 'l', '𝐦': 'm', '𝐧': 'n', '𝐨': 'o', '𝐩': 'p', '𝐪': 'q', '𝐫': 'r', '𝐬': 's', '𝐭': 't',
            '𝐮': 'u', '𝐯': 'v', '𝐰': 'w', '𝐱': 'x', '𝐲': 'y', '𝐳': 'z',

            // Mathematical Italic
            '𝐴': 'A', '𝐵': 'B', '𝐶': 'C', '𝐷': 'D', '𝐸': 'E', '𝐹': 'F', '𝐺': 'G', '𝐻': 'H', '𝐼': 'I', '𝐽': 'J',
            '𝐾': 'K', '𝐿': 'L', '𝑀': 'M', '𝑁': 'N', '𝑂': 'O', '𝑃': 'P', '𝑄': 'Q', '𝑅': 'R', '𝑆': 'S', '𝑇': 'T',
            '𝑈': 'U', '𝑉': 'V', '𝑊': 'W', '𝑋': 'X', '𝑌': 'Y', '𝑍': 'Z',
            '𝑎': 'a', '𝑏': 'b', '𝑐': 'c', '𝑑': 'd', '𝑒': 'e', '𝑓': 'f', '𝑔': 'g', 'ℎ': 'h', '𝑖': 'i', '𝑗': 'j', '𝑘': 'k',
            '𝑙': 'l', '𝑚': 'm', '𝑛': 'n', '𝑜': 'o', '𝑝': 'p', '𝑞': 'q', '𝑟': 'r', '𝑠': 's', '𝑡': 't',
            '𝑢': 'u', '𝑣': 'v', '𝑤': 'w', '𝑥': 'x', '𝑦': 'y', '𝑧': 'z',

            // Mathematical Monospace
            '𝙰': 'A', '𝙱': 'B', '𝙲': 'C', '𝙳': 'D', '𝙴': 'E', '𝙵': 'F', '𝙶': 'G', '𝙷': 'H', '𝙸': 'I', '𝙹': 'J',
            '𝙺': 'K', '𝙻': 'L', '𝙼': 'M', '𝙽': 'N', '𝙾': 'O', '𝙿': 'P', '𝚀': 'Q', '𝚁': 'R', '𝚂': 'S', '𝚃': 'T',
            '𝚄': 'U', '𝚅': 'V', '𝚆': 'W', '𝚇': 'X', '𝚈': 'Y', '𝚉': 'Z',
            '𝚊': 'a', '𝚋': 'b', '𝚌': 'c', '𝚍': 'd', '𝚎': 'e', '𝚏': 'f', '𝚐': 'g', '𝚑': 'h', '𝚒': 'i', '𝚓': 'j',
            '𝚔': 'k', '𝚕': 'l', '𝚖': 'm', '𝚗': 'n', '𝚘': 'o', '𝚙': 'p', '𝚚': 'q', '𝚛': 'r', '𝚜': 's', '𝚝': 't',
            '𝚞': 'u', '𝚟': 'v', '𝚠': 'w', '𝚡': 'x', '𝚢': 'y', '𝚣': 'z',

            // Additional special characters
            'ℎ': 'h'  // Special mathematical h
        };

        for (const [fancy, normal] of Object.entries(fancyMappings)) {
            result = result.replace(new RegExp(this.escapeRegExp(fancy), 'g'), normal);
        }

        return result;
    }

    /**
     * Replace em dashes with periods and start new sentences (experimental)
     * Fixed to not have leading space before period and preserve line breaks
     * @param {string} text - Input text
     * @returns {string} - Text with em dashes replaced
     */
    replaceEmDash(text) {
        // Process line by line to preserve line breaks
        const lines = text.split('\n');

        const processedLines = lines.map(line => {
            let result = line;

            // Replace em dash with period (no space before the period)
            result = result.replace(/\s*—\s*/g, '. ');

            // Clean up any double spaces (but only within the line)
            result = result.replace(/\s{2,}/g, ' ');

            // Clean up double periods (except ellipsis)
            result = result.replace(/\.{2}(?!\.)/g, '.');

            // Capitalize first letter after periods (basic sentence case)
            result = result.replace(/\.\s+([a-z])/g, (match, letter) => '. ' + letter.toUpperCase());

            // Clean up any space before punctuation
            result = result.replace(/\s+([.!?,;:])/g, '$1');

            return result;
        });

        return processedLines.join('\n');
    }

    /**
     * Normalize text for cross-platform compatibility.
     * Fixes BOM, line endings, mojibake (CP-1252 to UTF-8), invisible characters,
     * and non-breaking spaces.
     * @param {string} text - Input text
     * @returns {string} - Normalized text
     */
    normalizeForTargetSystem(text) {
        let result = text;

        // 1. Remove BOM (Byte Order Mark) from start and mid-text
        result = result.replace(/\uFEFF/g, '');

        // 2. Fix common CP-1252 to UTF-8 mojibake patterns
        // These occur when text encoded as UTF-8 is misinterpreted as CP-1252
        const mojibakeMap = [
            ['\u00C3\u00A4', '\u00E4'],   // ä
            ['\u00C3\u00B6', '\u00F6'],   // ö
            ['\u00C3\u00BC', '\u00FC'],   // ü
            ['\u00C3\u0084', '\u00C4'],   // Ä
            ['\u00C3\u0096', '\u00D6'],   // Ö
            ['\u00C3\u009C', '\u00DC'],   // Ü
            ['\u00C3\u00A9', '\u00E9'],   // é
            ['\u00C3\u00A8', '\u00E8'],   // è
            ['\u00C3\u00AA', '\u00EA'],   // ê
            ['\u00C3\u00AB', '\u00EB'],   // ë
            ['\u00C3\u00A0', '\u00E0'],   // à
            ['\u00C3\u00A1', '\u00E1'],   // á
            ['\u00C3\u00A2', '\u00E2'],   // â
            ['\u00C3\u00A3', '\u00E3'],   // ã
            ['\u00C3\u00A5', '\u00E5'],   // å
            ['\u00C3\u00AD', '\u00ED'],   // í
            ['\u00C3\u00AC', '\u00EC'],   // ì
            ['\u00C3\u00AE', '\u00EE'],   // î
            ['\u00C3\u00AF', '\u00EF'],   // ï
            ['\u00C3\u00B3', '\u00F3'],   // ó
            ['\u00C3\u00B2', '\u00F2'],   // ò
            ['\u00C3\u00B4', '\u00F4'],   // ô
            ['\u00C3\u00B5', '\u00F5'],   // õ
            ['\u00C3\u00BA', '\u00FA'],   // ú
            ['\u00C3\u00B9', '\u00F9'],   // ù
            ['\u00C3\u00BB', '\u00FB'],   // û
            ['\u00C3\u00B1', '\u00F1'],   // ñ
            ['\u00C3\u0091', '\u00D1'],   // Ñ
            ['\u00C3\u00A7', '\u00E7'],   // ç
            ['\u00C3\u0087', '\u00C7'],   // Ç
            ['\u00C3\u009F', '\u00DF'],   // ß (Latin-1/ISO-8859-1 interpretation)
            ['\u00C3\u0178', '\u00DF'],   // ß (CP-1252 interpretation where 0x9F → Ÿ)
            ['\u00C3\u00A6', '\u00E6'],   // æ
            ['\u00C3\u0086', '\u00C6'],   // Æ
            ['\u00C2\u00AB', '\u00AB'],   // «
            ['\u00C2\u00BB', '\u00BB'],   // »
            ['\u00C2\u00B0', '\u00B0'],   // °
            ['\u00C2\u00A7', '\u00A7'],   // §
            ['\u00C2\u00A9', '\u00A9'],   // ©
            ['\u00C2\u00AE', '\u00AE'],   // ®
            ['\u00C2\u00B2', '\u00B2'],   // ²
            ['\u00C2\u00B3', '\u00B3'],   // ³
            ['\u00C2\u00BD', '\u00BD'],   // ½
            ['\u00C2\u00BC', '\u00BC'],   // ¼
            ['\u00C2\u00BE', '\u00BE'],   // ¾
            ['\u00C2\u00AD', ''],          // soft hyphen mojibake (remove)
            ['\u00C2\u00A0', ' '],         // non-breaking space mojibake
            ['\u00E2\u0080\u0093', '\u2013'],  // en-dash
            ['\u00E2\u0080\u0094', '\u2014'],  // em-dash
            ['\u00E2\u0080\u009C', '\u201C'],  // left double quote
            ['\u00E2\u0080\u009D', '\u201D'],  // right double quote
            ['\u00E2\u0080\u0098', '\u2018'],  // left single quote
            ['\u00E2\u0080\u0099', '\u2019'],  // right single quote
            ['\u00E2\u0080\u00A6', '\u2026'],  // ellipsis
            ['\u00E2\u0080\u00A2', '\u2022'],  // bullet
        ];

        for (const [garbled, correct] of mojibakeMap) {
            if (!garbled) continue;
            const parts = result.split(garbled);
            if (parts.length > 1) {
                result = parts.join(correct);
            }
        }

        // 3. Remove invisible/zero-width characters
        result = result.replace(/[\u200B\u200C\u200D]/g, '');  // Zero-width space/joiner/non-joiner
        result = result.replace(/\u00AD/g, '');                 // Soft hyphen

        // 4. Replace non-breaking spaces with regular spaces
        result = result.replace(/\u00A0/g, ' ');

        // 5. Replace other unusual whitespace with normal space
        // Thin space, hair space, en space, em space, figure space, narrow no-break space
        result = result.replace(/[\u2000-\u200A\u202F\u205F]/g, ' ');

        // 6. Normalize line endings based on target system
        const target = this.settings.targetSystem;
        // First, normalize all line endings to LF
        result = result.replace(/\r\n/g, '\n');
        result = result.replace(/\r/g, '\n');

        if (target === 'windows') {
            // Convert LF to CRLF for Windows
            result = result.replace(/\n/g, '\r\n');
        }
        // 'linux', 'macos', and 'auto' all use LF — already done

        return result;
    }

    /**
     * Remove all line breaks from text, joining into a single paragraph.
     * @param {string} text - Input text
     * @returns {string} - Text with line breaks removed
     */
    removeAllLineBreaks(text) {
        let result = text;

        // Normalize line breaks to \n for easier processing
        result = result.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // If there's 1 line break, replace with space
        // If there are multiple, remove one line break (e.g. \n\n becomes \n)
        result = result.replace(/\n+/g, (match) => {
            if (match.length === 1) return ' ';
            return '\n'.repeat(match.length - 1);
        });

        // Collapse multiple spaces into one
        result = result.replace(/ {2,}/g, ' ');

        // If target system is Windows, restore \r\n
        if (this.settings && this.settings.targetSystem === 'windows') {
            result = result.replace(/\n/g, '\r\n');
        }

        return result.trim();
    }

    /**
     * Escape special regex characters
     * @param {string} string - String to escape
     * @returns {string} - Escaped string
     */
    escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

/**
 * UI Controller for the Optimizer page
 */
class OptimizerUI {
    constructor() {
        this.optimizer = new TextOptimizer();
        this.storage = new StorageManager();
        this.textarea = null;
        this.charCount = null;
        this.cleanButton = null;
        this.copyButton = null;
        this.clearButton = null;

        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        this.setupElements();
        this.setupEventListeners();
        this.loadUserSettings();
        console.log('OptimizerUI initialized');
    }

    setupElements() {
        this.textarea = document.getElementById('optimizer-textarea');
        this.charCount = document.getElementById('char-count');
        this.cleanButton = document.getElementById('clean-text-btn');
        this.copyButton = document.getElementById('copy-text-btn');
        this.clearButton = document.getElementById('clear-text-btn');
        this.languageSelect = document.getElementById('language-select');
        this.targetSystemButtons = document.querySelectorAll('#target-system-buttons button');
    }

    setupEventListeners() {
        if (!this.textarea || !this.cleanButton) {
            console.error('Required elements not found');
            return;
        }

        // Character counter
        this.textarea.addEventListener('input', () => this.updateCharCount());

        // Clean text button
        this.cleanButton.addEventListener('click', () => this.handleTextProcess());

        // Copy text button
        if (this.copyButton) {
            this.copyButton.addEventListener('click', () => this.handleCopyText());
        }

        // Clear text button
        if (this.clearButton) {
            this.clearButton.addEventListener('click', () => this.handleClearText());
        }

        // Language selection
        if (this.languageSelect) {
            this.languageSelect.addEventListener('change', (e) => this.handleLanguageChange(e.target.value));
        }

        // Target system selection
        if (this.targetSystemButtons) {
            this.targetSystemButtons.forEach(btn => {
                btn.addEventListener('click', (e) => this.handleTargetSystemChange(e.currentTarget.dataset.system));
            });
        }

        // Toggle switches
        document.querySelectorAll('[data-toggle]').forEach(toggle => {
            toggle.addEventListener('change', (e) => this.handleToggleChange(e.target.dataset.toggle, e.target.checked));
        });

        // Auto-resize textarea
        this.textarea.addEventListener('input', () => this.autoResizeTextarea());
    }

    updateCharCount() {
        if (this.textarea && this.charCount) {
            const count = this.textarea.value.length;
            this.charCount.textContent = `${count.toLocaleString()} characters`;
        }
    }

    autoResizeTextarea() {
        if (this.textarea) {
            this.textarea.style.height = 'auto';
            this.textarea.style.height = Math.max(300, this.textarea.scrollHeight) + 'px';
        }
    }

    handleToggleChange(toggleId, value) {
        const settingMap = {
            'apply-language-mapping': 'applyLanguageMapping',
            'remove-diacritics': 'removeDiacritics',
            'reverse-diacritics': 'reverseDiacritics',
            'remove-citations': 'removeCitations',
            'convert-markdown': 'convertMarkdown',
            'remove-fancy-font': 'removeFancyFont',
            'replace-em-dash': 'replaceEmDash',
            'remove-line-breaks': 'removeLineBreaks'
        };

        const settingKey = settingMap[toggleId];
        if (settingKey) {
            this.optimizer.updateSettings({ [settingKey]: value });
            this.saveUserSettings();
        }
    }

    handleLanguageChange(language) {
        this.optimizer.updateSettings({ languageMapping: language });
        this.saveUserSettings();
    }

    handleTargetSystemChange(targetSystem) {
        this.optimizer.updateSettings({ targetSystem: targetSystem });
        this.updateTargetSystemUI(targetSystem);
        this.saveUserSettings();
    }

    updateTargetSystemUI(targetSystem) {
        if (!this.targetSystemButtons) return;
        this.targetSystemButtons.forEach(btn => {
            if (btn.dataset.system === targetSystem) {
                btn.className = 'btn btn-primary';
                btn.style.padding = '10px 20px';
            } else {
                btn.className = 'btn btn-secondary';
                btn.style.padding = '10px 20px';
            }
        });
    }

    async handleTextProcess() {
        if (!this.textarea) return;

        const inputText = this.textarea.value;
        if (!inputText.trim()) {
            this.showMessage('Please enter some text to process.', 'warning');
            return;
        }

        // Show processing state
        this.cleanButton.disabled = true;
        this.cleanButton.textContent = 'Processing...';

        try {
            // Wait for optimizer to be initialized
            if (!this.optimizer.isInitialized) {
                await new Promise(resolve => {
                    const checkInit = () => {
                        if (this.optimizer.isInitialized) {
                            resolve();
                        } else {
                            setTimeout(checkInit, 100);
                        }
                    };
                    checkInit();
                });
            }

            const result = this.optimizer.processText(inputText);

            if (result.changed) {
                this.textarea.value = result.text;
                this.updateCharCount();
                this.autoResizeTextarea();
                this.showMessage('Text processed successfully!', 'success');
            } else {
                this.showMessage('No changes were made to the text.', 'info');
            }
        } catch (error) {
            console.error('Error processing text:', error);
            this.showMessage('An error occurred while processing the text.', 'error');
        } finally {
            // Reset button state
            this.cleanButton.disabled = false;
            this.cleanButton.textContent = 'Clean Text Now';
        }
    }

    async handleCopyText() {
        if (!this.textarea || !this.textarea.value.trim()) {
            this.showMessage('No text to copy.', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(this.textarea.value);
            this.showMessage('Text copied to clipboard!', 'success');
        } catch (error) {
            console.error('Failed to copy text:', error);
            this.showMessage('Failed to copy text to clipboard.', 'error');
        }
    }

    handleClearText() {
        if (!this.textarea) return;

        if (this.textarea.value.trim()) {
            this.textarea.value = '';
            this.updateCharCount();
            this.autoResizeTextarea();
            this.showMessage('Text cleared.', 'info');
        }
    }

    showMessage(message, type = 'info') {
        // Create a simple toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 1000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;

        // Set background color based on type
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#3b82f6'
        };
        toast.style.backgroundColor = colors[type] || colors.info;

        document.body.appendChild(toast);

        // Animate in
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    saveUserSettings() {
        const settings = {
            optimizer: this.optimizer.settings,
            ui: {
                textareaHeight: this.textarea ? this.textarea.style.height : '300px'
            }
        };
        this.storage.saveSettings(settings);
    }

    loadUserSettings() {
        const settings = this.storage.loadSettings();
        if (settings.optimizer) {
            this.optimizer.updateSettings(settings.optimizer);
            this.applySettingsToUI(settings.optimizer);
        }
        if (settings.ui && settings.ui.textareaHeight && this.textarea) {
            this.textarea.style.height = settings.ui.textareaHeight;
        }
    }

    applySettingsToUI(settings) {
        // Apply toggle states
        const toggleMap = {
            'applyLanguageMapping': 'apply-language-mapping',
            'removeDiacritics': 'remove-diacritics',
            'reverseDiacritics': 'reverse-diacritics',
            'removeCitations': 'remove-citations',
            'convertMarkdown': 'convert-markdown',
            'removeFancyFont': 'remove-fancy-font',
            'replaceEmDash': 'replace-em-dash',
            'removeLineBreaks': 'remove-line-breaks'
        };

        for (const [settingKey, toggleId] of Object.entries(toggleMap)) {
            const toggle = document.querySelector(`[data-toggle="${toggleId}"]`);
            if (toggle && settings[settingKey] !== undefined) {
                toggle.checked = settings[settingKey];
            }
        }

        // Apply language selection
        if (this.languageSelect && settings.languageMapping) {
            this.languageSelect.value = settings.languageMapping;
        }

        // Apply target system selection
        if (this.targetSystemButtons && settings.targetSystem) {
            this.updateTargetSystemUI(settings.targetSystem);
        }
    }
}

/**
 * Storage Manager for user preferences
 */
class StorageManager {
    constructor() {
        this.storageKey = 'asd123-optimizer-settings';
        this.defaultSettings = {
            optimizer: {
                applyLanguageMapping: false,
                removeDiacritics: false,
                reverseDiacritics: false,
                removeCitations: false,
                convertMarkdown: false,
                removeFancyFont: false,
                replaceEmDash: false,
                languageMapping: 'swiss-german',
                targetSystem: 'auto',
                removeLineBreaks: false
            },
            ui: {
                textareaHeight: '300px'
            }
        };
    }

    saveSettings(settings) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save settings to localStorage:', error);
        }
    }

    loadSettings() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...this.defaultSettings, ...parsed };
            }
        } catch (error) {
            console.warn('Failed to load settings from localStorage:', error);
        }
        return this.defaultSettings;
    }

    clearSettings() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.warn('Failed to clear settings from localStorage:', error);
        }
    }
}

// Initialize the optimizer UI when the script loads
if (typeof window !== 'undefined') {
    window.optimizerUI = new OptimizerUI();
}