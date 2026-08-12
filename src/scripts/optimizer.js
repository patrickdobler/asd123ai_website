/**
 * ASD123.ai AI Text Tools - Optimizer Engine
 * Privacy-focused text processing with client-side execution
 */

/**
 * Language character mappings (embedded; no runtime fetch, works on file:// too).
 *
 * These tables only handle VISIBLE typography - quotes, dashes, ligatures and
 * the few letters a language spells out differently in plain ASCII. Invisible
 * and zero-width characters used to be buried in here as well; they now live in
 * the separate "Remove Invisible Characters" option (see INVISIBLE_GROUPS
 * below), so nothing is silently duplicated between the two features.
 */

// Typography that normalizes the same way in every language.
const COMMON_TYPOGRAPHY = {
    // Dashes, hyphens and the minus sign -> ASCII hyphen
    '‐': '-', '‑': '-', '‒': '-', '–': '-', '—': '-',
    '―': '-', '−': '-',
    // Ellipsis and leaders
    '…': '...', '‥': '..',
    // Bullets
    '•': '-', '‣': '-', '⁃': '-', '◦': '-', '∙': '-',
    // Symbols with a plain ASCII equivalent
    '×': 'x', '⁄': '/',
    // Primes, spacing accents and modifier letters used in place of quotes
    '′': '\'', '″': '"', '´': '\'', 'ʼ': '\'',
    'ʹ': '\'', 'ʺ': '"',
    // Typographic ligatures - extremely common in text extracted from PDFs
    'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi',
    'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st'
};

// Quotation marks. Every profile flattens them to ASCII " and ' - only the set
// of marks a language actually uses differs.
const QUOTES_CURLY = {
    '“': '"', '”': '"', '‟': '"',
    '‘': '\'', '’': '\'', '‛': '\''
};
const QUOTES_LOW = { '„': '"', '‚': '\'' };   // German-style low quotes
const QUOTES_GUILLEMET = {
    '«': '"', '»': '"', '‹': '\'', '›': '\''
};

// Letters that some languages spell out when reduced to ASCII.
const LIGATURE_LETTERS = {
    'æ': 'ae', 'Æ': 'Ae', 'œ': 'oe', 'Œ': 'Oe'
};

// French typography puts a space inside guillemets and before ; : ! ? - dropping
// it is what makes the ASCII result look right. Multi-character keys are matched
// first (object insertion order), and both the no-break and the plain space
// variant are listed so the profile also works with invisible-character removal
// switched off.
const FRENCH_SPACING = {
    '« ': '"', '« ': '"', '« ': '"',
    ' »': '"', ' »': '"', ' »': '"',
    ' ;': ';', ' ;': ';', ' ;': ';',
    ' :': ':', ' :': ':', ' :': ':',
    ' !': '!', ' !': '!', ' !': '!',
    ' ?': '?', ' ?': '?', ' ?': '?'
};

const EMBEDDED_MAPPINGS = {
    // Punctuation only - never touches letters. For text that must stay
    // readable in its own language but should lose the fancy typography.
    'universal': {
        ...COMMON_TYPOGRAPHY, ...QUOTES_CURLY, ...QUOTES_LOW, ...QUOTES_GUILLEMET
    },
    // Switzerland does not use the sharp s; guillemets are the primary quotes.
    'swiss-german': {
        ...COMMON_TYPOGRAPHY, ...QUOTES_CURLY, ...QUOTES_LOW, ...QUOTES_GUILLEMET,
        ...LIGATURE_LETTERS,
        'ß': 'ss'
    },
    // Germany/Austria keep the sharp s - only the typography is flattened.
    'german': {
        ...COMMON_TYPOGRAPHY, ...QUOTES_CURLY, ...QUOTES_LOW, ...QUOTES_GUILLEMET,
        ...LIGATURE_LETTERS
    },
    'french': {
        ...FRENCH_SPACING,
        ...COMMON_TYPOGRAPHY, ...QUOTES_CURLY, ...QUOTES_LOW, ...QUOTES_GUILLEMET,
        ...LIGATURE_LETTERS
    },
    // Italian has no ae/oe ligatures of its own, so foreign words keep them.
    'italian': {
        ...COMMON_TYPOGRAPHY, ...QUOTES_CURLY, ...QUOTES_LOW, ...QUOTES_GUILLEMET
    },
    'english': {
        ...COMMON_TYPOGRAPHY, ...QUOTES_CURLY, ...QUOTES_LOW, ...QUOTES_GUILLEMET,
        ...LIGATURE_LETTERS
    }
};
// The two English profiles were character-identical; they stay as aliases so
// settings saved by earlier versions keep resolving.
EMBEDDED_MAPPINGS['english-international'] = EMBEDDED_MAPPINGS['english'];
EMBEDDED_MAPPINGS['english-us'] = EMBEDDED_MAPPINGS['english'];

// Values that no longer exist in the dropdown. Without this the <select> would
// silently fall back to an empty value for anyone with older saved settings.
const LEGACY_LANGUAGE_ALIASES = {
    'english-international': 'english',
    'english-us': 'english'
};

/**
 * Invisible, zero-width and format characters.
 *
 * They reach a document through copy-paste from PDFs and web pages, they are
 * used to hide tracking IDs or watermarks inside AI output, and some of them can
 * make text render differently from how it is stored (the bidi "Trojan Source"
 * trick). None of them carry visible meaning in ordinary prose.
 *
 * Grouped by kind so the UI can report WHAT was removed, not just how much.
 */
const INVISIBLE_GROUPS = [
    {
        id: 'zero-width',
        label: 'zero-width character',
        // ZWSP, ZWNJ, ZWJ, word joiner, Mongolian vowel separator, ZWNBSP/BOM
        ranges: [[0x200B, 0x200D], [0x2060, 0x2060], [0x180E, 0x180E], [0xFEFF, 0xFEFF]]
    },
    {
        id: 'bidi',
        label: 'bidi control',
        // ALM, LRM/RLM, LRE/RLE/PDF/LRO/RLO, LRI/RLI/FSI/PDI
        ranges: [[0x061C, 0x061C], [0x200E, 0x200F], [0x202A, 0x202E], [0x2066, 0x2069]]
    },
    {
        id: 'invisible-math',
        label: 'invisible math operator',
        // function application, invisible times / separator / plus
        ranges: [[0x2061, 0x2064]]
    },
    {
        id: 'deprecated-format',
        label: 'deprecated format character',
        // inhibit/activate symmetric swapping and Arabic form shaping
        ranges: [[0x206A, 0x206F]]
    },
    {
        id: 'variation-selector',
        label: 'variation selector',
        // Mongolian FVS 1-3, VS1-16, VS17-256 (a popular steganography carrier)
        ranges: [[0x180B, 0x180D], [0xFE00, 0xFE0F], [0xE0100, 0xE01EF]]
    },
    {
        id: 'tag-char',
        label: 'tag character',
        // Invisible copies of ASCII - an entire hidden message fits in here
        ranges: [[0xE0001, 0xE007F]]
    },
    {
        id: 'hidden-format',
        label: 'hidden format character',
        // soft hyphen, combining grapheme joiner, Hangul fillers, Khmer inherent
        // vowels, halfwidth Hangul filler, interlinear annotation
        ranges: [
            [0x00AD, 0x00AD], [0x034F, 0x034F], [0x115F, 0x1160], [0x17B4, 0x17B5],
            [0x3164, 0x3164], [0xFFA0, 0xFFA0], [0xFFF9, 0xFFFB]
        ]
    }
];

// Spaces that look like (or stand in for) a plain U+0020.
const SPACE_HOMOGLYPH_RANGES = [
    [0x00A0, 0x00A0],   // no-break space
    [0x1680, 0x1680],   // Ogham space mark
    [0x2000, 0x200A],   // en/em quad, en/em space, three-per-em ... hair space
    [0x202F, 0x202F],   // narrow no-break space
    [0x205F, 0x205F],   // medium mathematical space
    [0x3000, 0x3000]    // ideographic space
];

function expandRanges(ranges, visit) {
    for (const [from, to] of ranges) {
        for (let cp = from; cp <= to; cp++) visit(cp);
    }
}

// codepoint -> group id, built once at load.
const INVISIBLE_LOOKUP = new Map();
for (const group of INVISIBLE_GROUPS) {
    expandRanges(group.ranges, cp => INVISIBLE_LOOKUP.set(cp, group.id));
}
const INVISIBLE_LABELS = new Map(INVISIBLE_GROUPS.map(g => [g.id, g.label]));
INVISIBLE_LABELS.set('space', 'unusual space');

const SPACE_HOMOGLYPHS = new Set();
expandRanges(SPACE_HOMOGLYPH_RANGES, cp => SPACE_HOMOGLYPHS.add(cp));

// Advertised coverage. Derived, never hand-counted, and written into the page so
// the option label can never drift away from what the code actually does.
const INVISIBLE_CODEPOINT_COUNT = INVISIBLE_LOOKUP.size + SPACE_HOMOGLYPHS.size;

// Cheap pre-check so clean text skips the per-codepoint scan entirely.
const INVISIBLE_DETECT_RE = new RegExp(
    '[' + [...INVISIBLE_GROUPS.map(g => g.ranges), SPACE_HOMOGLYPH_RANGES]
        .flat()
        .map(([from, to]) => {
            const esc = cp => '\\u{' + cp.toString(16).toUpperCase() + '}';
            return from === to ? esc(from) : esc(from) + '-' + esc(to);
        })
        .join('') + ']',
    'u'
);

// U+200D and the variation selectors are genuine formatting inside emoji
// sequences, so they are kept whenever they hold an emoji together.
const PICTOGRAPH_RE = /\p{Extended_Pictographic}/u;
const EMOJI_BASE_RE = /[\p{Extended_Pictographic}0-9#*]/u;
// Skipped when looking back for the character an emoji modifier belongs to.
const EMOJI_MODIFIER_RE = /[\uFE0E\uFE0F\u{1F3FB}-\u{1F3FF}]/u;

/**
 * Remove invisible, zero-width and format characters, and fold unusual spaces
 * back to a plain U+0020.
 *
 * Emoji-safe: U+200D (zero width joiner) and the U+FE0E/U+FE0F variation
 * selectors are the only members of the set that can be legitimate content.
 * They are kept when they actually join or style an emoji, so a family emoji
 * stays a family and a flag stays a flag.
 *
 * @param {string} text - Input text
 * @returns {{text: string, removed: number, replaced: number, total: number,
 *            byGroup: Object<string, number>}} Cleaned text plus a breakdown
 *          of what was touched, so the UI can name it instead of just counting.
 */
function removeInvisibleCharacters(text) {
    const empty = { text, removed: 0, replaced: 0, total: 0, byGroup: {} };
    if (!text || !INVISIBLE_DETECT_RE.test(text)) return empty;

    const chars = Array.from(text);   // code-point aware
    const out = [];
    const byGroup = {};
    let removed = 0;
    let replaced = 0;
    const count = id => { byGroup[id] = (byGroup[id] || 0) + 1; };

    // The last emitted character that an emoji modifier could attach to,
    // looking past selectors and skin-tone modifiers already emitted.
    const lastBase = () => {
        for (let k = out.length - 1; k >= 0; k--) {
            if (EMOJI_MODIFIER_RE.test(out[k])) continue;
            return out[k];
        }
        return '';
    };

    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        const cp = ch.codePointAt(0);

        if (cp === 0x200D) {
            // Joins two pictographs (family, rainbow flag, profession emoji)?
            if (PICTOGRAPH_RE.test(lastBase()) && PICTOGRAPH_RE.test(chars[i + 1] || '')) {
                out.push(ch);
                continue;
            }
        } else if (cp === 0xFE0E || cp === 0xFE0F) {
            // Selects the text/emoji presentation of the character before it.
            if (EMOJI_BASE_RE.test(lastBase())) {
                out.push(ch);
                continue;
            }
        }

        if (SPACE_HOMOGLYPHS.has(cp)) {
            out.push(' ');
            replaced++;
            count('space');
            continue;
        }

        const group = INVISIBLE_LOOKUP.get(cp);
        if (group !== undefined) {
            removed++;
            count(group);
            continue;
        }

        out.push(ch);
    }

    return {
        text: out.join(''),
        removed,
        replaced,
        total: removed + replaced,
        byGroup
    };
}

/**
 * Turn the byGroup breakdown into readable text, e.g.
 * "9 tag characters, 3 zero-width, 2 bidi controls".
 * @param {Object<string, number>} byGroup
 * @returns {string}
 */
function describeInvisibleGroups(byGroup) {
    return Object.entries(byGroup)
        .sort((a, b) => b[1] - a[1])
        .map(([id, n]) => {
            const label = INVISIBLE_LABELS.get(id) || id;
            return `${n} ${label}${n === 1 ? '' : 's'}`;
        })
        .join(', ');
}

/**
 * Precompiled single-pass replacement tables. Building one regex per feature
 * (instead of one full-text scan per mapping entry) keeps large inputs fast.
 */

// Diacritic removal. The base table maps every accented character to its plain
// ASCII form; for German/Swiss German the umlauts use the ae/oe/ue digraph
// convention instead. ß→ss and the æ/œ ligatures apply to every language.
const DIACRITIC_BASE_MAP = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ā': 'a', 'ă': 'a', 'ą': 'a',
    'À': 'A', 'Á': 'A', 'Â': 'A', 'Ã': 'A', 'Ä': 'A', 'Å': 'A', 'Ā': 'A', 'Ă': 'A', 'Ą': 'A',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ĕ': 'e', 'ė': 'e', 'ę': 'e', 'ě': 'e',
    'È': 'E', 'É': 'E', 'Ê': 'E', 'Ë': 'E', 'Ē': 'E', 'Ĕ': 'E', 'Ė': 'E', 'Ę': 'E', 'Ě': 'E',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ĩ': 'i', 'ī': 'i', 'ĭ': 'i', 'į': 'i',
    'Ì': 'I', 'Í': 'I', 'Î': 'I', 'Ï': 'I', 'Ĩ': 'I', 'Ī': 'I', 'Ĭ': 'I', 'Į': 'I',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ø': 'o', 'ō': 'o', 'ŏ': 'o', 'ő': 'o',
    'Ò': 'O', 'Ó': 'O', 'Ô': 'O', 'Õ': 'O', 'Ö': 'O', 'Ø': 'O', 'Ō': 'O', 'Ŏ': 'O', 'Ő': 'O',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ũ': 'u', 'ū': 'u', 'ŭ': 'u', 'ů': 'u', 'ű': 'u', 'ų': 'u',
    'Ù': 'U', 'Ú': 'U', 'Û': 'U', 'Ü': 'U', 'Ũ': 'U', 'Ū': 'U', 'Ŭ': 'U', 'Ů': 'U', 'Ű': 'U', 'Ų': 'U',
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
const DIACRITIC_GERMAN_MAP = {
    ...DIACRITIC_BASE_MAP,
    'ä': 'ae', 'Ä': 'Ae', 'ö': 'oe', 'Ö': 'Oe', 'ü': 'ue', 'Ü': 'Ue'
};
function compileCharMap(map) {
    return { re: new RegExp(`[${Object.keys(map).join('')}]`, 'g'), map };
}
const DIACRITICS_PLAIN = compileCharMap(DIACRITIC_BASE_MAP);
const DIACRITICS_GERMAN = compileCharMap(DIACRITIC_GERMAN_MAP);

// CP-1252/Latin-1 mojibake repair (UTF-8 read with the wrong encoding).
// Compiled once into a single alternation regex + lookup for a one-pass fix.
const MOJIBAKE_PAIRS = [
    ['\u00C3\u00A4', '\u00E4'],   // a-umlaut
    ['\u00C3\u00B6', '\u00F6'],   // o-umlaut
    ['\u00C3\u00BC', '\u00FC'],   // u-umlaut
    ['\u00C3\u0084', '\u00C4'],   // A-umlaut
    ['\u00C3\u0096', '\u00D6'],   // O-umlaut
    ['\u00C3\u009C', '\u00DC'],   // U-umlaut
    ['\u00C3\u00A9', '\u00E9'],   // e-acute
    ['\u00C3\u00A8', '\u00E8'],   // e-grave
    ['\u00C3\u00AA', '\u00EA'],   // e-circumflex
    ['\u00C3\u00AB', '\u00EB'],   // e-diaeresis
    ['\u00C3\u00A0', '\u00E0'],   // a-grave
    ['\u00C3\u00A1', '\u00E1'],   // a-acute
    ['\u00C3\u00A2', '\u00E2'],   // a-circumflex
    ['\u00C3\u00A3', '\u00E3'],   // a-tilde
    ['\u00C3\u00A5', '\u00E5'],   // a-ring
    ['\u00C3\u00AD', '\u00ED'],   // i-acute
    ['\u00C3\u00AC', '\u00EC'],   // i-grave
    ['\u00C3\u00AE', '\u00EE'],   // i-circumflex
    ['\u00C3\u00AF', '\u00EF'],   // i-diaeresis
    ['\u00C3\u00B3', '\u00F3'],   // o-acute
    ['\u00C3\u00B2', '\u00F2'],   // o-grave
    ['\u00C3\u00B4', '\u00F4'],   // o-circumflex
    ['\u00C3\u00B5', '\u00F5'],   // o-tilde
    ['\u00C3\u00BA', '\u00FA'],   // u-acute
    ['\u00C3\u00B9', '\u00F9'],   // u-grave
    ['\u00C3\u00BB', '\u00FB'],   // u-circumflex
    ['\u00C3\u00B1', '\u00F1'],   // n-tilde
    ['\u00C3\u0091', '\u00D1'],   // N-tilde
    ['\u00C3\u00A7', '\u00E7'],   // c-cedilla
    ['\u00C3\u0087', '\u00C7'],   // C-cedilla
    ['\u00C3\u009F', '\u00DF'],   // sharp s (Latin-1 interpretation)
    ['\u00C3\u0178', '\u00DF'],   // sharp s (CP-1252 interpretation)
    ['\u00C3\u00A6', '\u00E6'],   // ae ligature
    ['\u00C3\u0086', '\u00C6'],   // AE ligature
    ['\u00C2\u00AB', '\u00AB'],   // left guillemet
    ['\u00C2\u00BB', '\u00BB'],   // right guillemet
    ['\u00C2\u00B0', '\u00B0'],   // degree sign
    ['\u00C2\u00A7', '\u00A7'],   // section sign
    ['\u00C2\u00A9', '\u00A9'],   // copyright
    ['\u00C2\u00AE', '\u00AE'],   // registered
    ['\u00C2\u00B2', '\u00B2'],   // superscript two
    ['\u00C2\u00B3', '\u00B3'],   // superscript three
    ['\u00C2\u00BD', '\u00BD'],   // one half
    ['\u00C2\u00BC', '\u00BC'],   // one quarter
    ['\u00C2\u00BE', '\u00BE'],   // three quarters
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
const MOJIBAKE_LOOKUP = new Map(MOJIBAKE_PAIRS);
const MOJIBAKE_RE = new RegExp(
    MOJIBAKE_PAIRS
        .map(([garbled]) => garbled)
        .sort((a, b) => b.length - a.length)
        .map(seq => seq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|'),
    'g'
);

class TextOptimizer {
    constructor() {
        this.settings = {
            applyLanguageMapping: false,  // New setting for language character replacement
            removeInvisibleChars: true,   // Invisible/zero-width/format characters (baseline hygiene)
            removeDiacritics: false,
            removeCitations: false,
            convertMarkdown: false,
            removeFancyFont: false,
            replaceEmDash: false,
            languageMapping: 'swiss-german',
            targetSystem: 'auto',         // 'auto' | 'windows' | 'linux' | 'macos'
            removeLineBreaks: false        // Remove all line breaks (default off)
        };

        // Mappings are embedded; no network fetch needed (works on file:// too).
        this.languageMappings = EMBEDDED_MAPPINGS;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        const alias = LEGACY_LANGUAGE_ALIASES[this.settings.languageMapping];
        if (alias) this.settings.languageMapping = alias;
    }

    /**
     * Main text processing method
     * @param {string} inputText - The text to process
     * @returns {object} - The processed text and whether changes were made
     */
    processText(inputText) {
        if (!inputText || typeof inputText !== 'string') {
            return { text: '', changed: false, applied: [], invisible: null };
        }

        const originalText = inputText;
        let processedText = inputText;
        // Track which steps actually altered the text so the UI can report
        // what happened instead of a generic "processed" message.
        const applied = [];
        const run = (label, fn) => {
            const before = processedText;
            processedText = fn(before);
            if (processedText !== before) applied.push(label);
        };

        // Encoding and line-ending normalization runs FIRST (always on)
        run('encoding & line endings', t => this.normalizeForTargetSystem(t));

        // Invisible characters go next, so every later step sees clean input.
        let invisible = null;
        if (this.settings.removeInvisibleChars) {
            const report = removeInvisibleCharacters(processedText);
            if (report.total > 0) {
                processedText = report.text;
                invisible = report;
                applied.push('invisible characters');
            }
        }

        if (this.settings.removeDiacritics) {
            run('diacritics', t => this.removeDiacritics(t));
        }

        if (this.settings.removeCitations) {
            run('citations', t => this.removeCitations(t));
        }

        if (this.settings.convertMarkdown) {
            run('Markdown', t => this.convertMarkdown(t));
        }

        if (this.settings.removeFancyFont) {
            run('fancy font', t => this.removeFancyFont(t));
        }

        // Apply em dash replacement BEFORE language mapping
        if (this.settings.replaceEmDash) {
            run('em dashes', t => this.replaceEmDash(t));
        }

        // Apply language mapping AFTER em dash replacement
        if (this.settings.applyLanguageMapping) {
            run('language mapping', t => this.applyLanguageCharacterMapping(t));
        }

        // Line break removal runs LAST
        if (this.settings.removeLineBreaks) {
            run('line breaks', t => this.removeAllLineBreaks(t));
        }

        return {
            text: processedText,
            changed: processedText !== originalText,
            applied,
            invisible
        };
    }

    /**
     * Apply language-specific character mappings (quotes, dashes, etc.)
     * @param {string} text - Input text
     * @returns {string} - Text with language mappings applied
     */
    applyLanguageCharacterMapping(text) {
        const mapping = this.languageMappings[this.settings.languageMapping];
        if (!mapping) return text;

        // Normalize to ensure composed characters match mapping keys
        let result = (text ?? '').normalize('NFC');

        // Use split/join to avoid any RegExp edge cases
        for (const [original, replacement] of Object.entries(mapping)) {
            if (!original) continue;
            if (replacement === undefined || original === replacement) continue;
            result = result.split(original).join(replacement);
        }

        return result;
    }

    /**
     * Remove diacritics, respecting the selected language convention:
     * German/Swiss German turn umlauts into digraphs (ä→ae); every other
     * language gets the plain letter (ä→a). Single regex pass.
     * @param {string} text - Input text
     * @returns {string} - Text with diacritics removed
     */
    removeDiacritics(text) {
        const lang = this.settings.languageMapping;
        const useGermanDigraphs = lang === 'swiss-german' || lang === 'german';
        const { re, map } = useGermanDigraphs ? DIACRITICS_GERMAN : DIACRITICS_PLAIN;
        return text.normalize('NFC').replace(re, ch => map[ch]);
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

            // Markdown links: remove citation-style ones entirely (label is a
            // bare domain or a number); real links keep their visible text.
            result = result.replace(/\[([^\]]*)\]\([^)]*\)/g, (match, label) => {
                const trimmed = label.trim();
                if (!trimmed) return '';
                if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(trimmed)) return '';
                if (/^\d+$/.test(trimmed)) return '';
                return trimmed;
            });

            // Remove standalone bracketed domains or sources: e.g. [business.uq.edu]
            result = result.replace(/\[[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\]/g, '');

            // Remove numbered citations: [1], [2], [123], also with superscript
            // digits like [¹]. Parenthetical (1), (2) are left alone — they are
            // usually enumerations.
            result = result.replace(/\[[\d¹²³\u2070-\u207F]+\]/g, '');

            // Remove source citations: (Source: XYZ), (Quelle: ABC), etc.
            result = result.replace(/\((Source|Quelle|Fonte|Fuente|Ref\.?|Reference):\s*[^)]+\)/gi, '');

            // Remove URL citations in parentheses: (https://example.com)
            result = result.replace(/\(https?:\/\/[^)]+\)/g, '');

            // Remove superscript reference markers: ¹ ² ³ and U+2070–207F.
            // Subscripts (U+2080 and up, e.g. H₂O, CO₂) stay untouched.
            result = result.replace(/[¹²³]|[\u2070-\u207F]/g, '');

            // Clean up extra spaces left by removed citations, preserving indentation
            result = result.replace(/(\S)[ \t]{2,}/g, '$1 ');
            result = result.replace(/[ \t]+([.!?])/g, '$1');

            return result.replace(/[ \t]+$/, '');
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
     * Remove fancy Unicode text styles (bold, italic, script, double-struck,
     * sans-serif, monospace, fullwidth, circled, ...).
     * Unicode compatibility normalization (NFKC) folds every stylized alphabet
     * back to plain characters in a single pass - no lookup table needed.
     * @param {string} text - Input text with fancy Unicode
     * @returns {string} - Plain text with normal characters
     */
    removeFancyFont(text) {
        return text.normalize('NFKC');
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
            // Turn each em-dash break into a sentence break and capitalize ONLY
            // the letter that directly follows it. Everything else on the line
            // (ellipses, abbreviations like "z. B.", other periods) is untouched.
            let result = line.replace(/\s*—\s*(\p{Ll})?/gu, (match, letter) =>
                letter ? '. ' + letter.toUpperCase() : '. '
            );

            // Tidy doubled spaces introduced by the replacement and trailing ". "
            result = result.replace(/(\S)[ \t]{2,}/g, '$1 ');
            return result.replace(/[ \t]+$/, '');
        });

        return processedLines.join('\n');
    }

    /**
     * Normalize encoding and line endings for cross-platform compatibility.
     * Fixes the leading BOM, mojibake (CP-1252 read as UTF-8) and line endings.
     * Invisible characters are NOT handled here any more - they are their own
     * option (see removeInvisibleCharacters) so users can switch them off.
     * @param {string} text - Input text
     * @returns {string} - Normalized text
     */
    normalizeForTargetSystem(text) {
        let result = text;

        // 1. Drop the leading BOM (an encoding artefact, not content). A U+FEFF
        //    anywhere else is a zero-width character and belongs to that option.
        result = result.replace(/^\uFEFF/, '');

        // 2. Fix common CP-1252 to UTF-8 mojibake patterns in one pass
        // (see MOJIBAKE_PAIRS at module level)
        result = result.replace(MOJIBAKE_RE, seq => MOJIBAKE_LOOKUP.get(seq));

        // 3. Normalize line endings based on target system
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
 * Quick presets: each maps to a full set of processing toggles. Applying a
 * preset first resets every toggle, so presets are deterministic.
 */
const OPTIMIZER_PRESETS = {
    'chatgpt': {
        label: 'ChatGPT / Claude output',
        settings: { convertMarkdown: true, removeCitations: true, removeFancyFont: true }
    },
    'research': {
        label: 'Perplexity / research output',
        settings: { convertMarkdown: true, removeCitations: true }
    },
    'swiss': {
        label: 'Swiss standardization',
        settings: { applyLanguageMapping: true, removeFancyFont: true, removeCitations: true, replaceEmDash: true, languageMapping: 'swiss-german' }
    },
    'paragraph': {
        label: 'Paragraph cleanup',
        settings: { removeLineBreaks: true }
    }
};

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
        this.undoButton = null;
        this.undoSnapshot = null;

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
        this.publishInvisibleCoverage();
    }

    /**
     * Keep the number advertised in the option label tied to the table the code
     * actually uses, so extending INVISIBLE_GROUPS can never leave a stale claim
     * on the page.
     */
    publishInvisibleCoverage() {
        document.querySelectorAll('[data-invisible-count]').forEach(el => {
            el.textContent = INVISIBLE_CODEPOINT_COUNT.toLocaleString('en-US');
        });
    }

    setupElements() {
        this.textarea = document.getElementById('optimizer-textarea');
        this.charCount = document.getElementById('char-count');
        this.cleanButton = document.getElementById('clean-text-btn');
        this.copyButton = document.getElementById('copy-text-btn');
        this.clearButton = document.getElementById('clear-text-btn');
        this.undoButton = document.getElementById('undo-text-btn');
        this.languageSelect = document.getElementById('language-select');
        this.targetSystemButtons = document.querySelectorAll('#target-system-buttons button');
        this.presetButtons = document.querySelectorAll('[data-preset]');
    }

    setupEventListeners() {
        if (!this.textarea || !this.cleanButton) {
            console.error('Required elements not found');
            return;
        }

        // Typing updates the counter via the shared CharacterCounter
        // (shared.js); this class refreshes it only after programmatic
        // changes (process/undo/clear) that fire no input event.

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

        // Undo (restores the input as it was before the last clean)
        if (this.undoButton) {
            this.undoButton.addEventListener('click', () => this.handleUndo());
        }

        // Preset buttons
        if (this.presetButtons) {
            this.presetButtons.forEach(btn => {
                btn.addEventListener('click', (e) => this.applyPreset(e.currentTarget.dataset.preset));
            });
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

    applyPreset(presetKey) {
        const preset = OPTIMIZER_PRESETS[presetKey];
        if (!preset) return;

        // Reset all processing toggles, then apply the preset on top.
        // Invisible-character removal is baseline hygiene rather than a style
        // choice, so it stays on unless a preset switches it off explicitly.
        this.optimizer.updateSettings({
            applyLanguageMapping: false,
            removeInvisibleChars: true,
            removeDiacritics: false,
            removeCitations: false,
            convertMarkdown: false,
            removeFancyFont: false,
            replaceEmDash: false,
            removeLineBreaks: false,
            ...preset.settings
        });
        this.applySettingsToUI(this.optimizer.settings);
        this.saveUserSettings();
        this.showMessage(`Preset applied: ${preset.label}.`, 'info');
    }

    handleUndo() {
        if (this.undoSnapshot === null || !this.textarea) return;
        this.textarea.value = this.undoSnapshot;
        this.undoSnapshot = null;
        this.undoButton.disabled = true;
        this.updateCharCount();
        this.autoResizeTextarea();
        this.showMessage('Original text restored.', 'info');
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
            'remove-invisible-chars': 'removeInvisibleChars',
            'remove-diacritics': 'removeDiacritics',
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

    handleTextProcess() {
        if (!this.textarea) return;

        const inputText = this.textarea.value;
        if (!inputText.trim()) {
            this.showMessage('Please enter some text to process.', 'warning');
            return;
        }

        try {
            const result = this.optimizer.processText(inputText);

            if (result.changed) {
                // Keep the pre-processing text so the user can undo.
                this.undoSnapshot = inputText;
                if (this.undoButton) this.undoButton.disabled = false;

                this.textarea.value = result.text;
                this.updateCharCount();
                this.autoResizeTextarea();
                const summary = result.applied.length
                    ? ` Applied: ${result.applied.join(', ')}.`
                    : '';
                // Invisible characters leave no visible trace, so spell out what
                // was found - otherwise the user cannot tell it happened at all.
                const hidden = result.invisible
                    ? ` Found ${result.invisible.total} hidden character` +
                      `${result.invisible.total === 1 ? '' : 's'}: ` +
                      `${describeInvisibleGroups(result.invisible.byGroup)}.`
                    : '';
                this.showMessage(`Text processed.${summary}${hidden}`, 'success');
            } else {
                this.showMessage('No changes were made to the text.', 'info');
            }
        } catch (error) {
            console.error('Error processing text:', error);
            this.showMessage('An error occurred while processing the text.', 'error');
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
            setTimeout(() => toast.remove(), 300);
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
            // Reflect the normalized settings, not the raw stored ones, so
            // retired language values resolve to their replacement in the UI.
            this.applySettingsToUI(this.optimizer.settings);
        }
        if (settings.ui && settings.ui.textareaHeight && this.textarea) {
            this.textarea.style.height = settings.ui.textareaHeight;
        }
    }

    applySettingsToUI(settings) {
        // Apply toggle states
        const toggleMap = {
            'applyLanguageMapping': 'apply-language-mapping',
            'removeInvisibleChars': 'remove-invisible-chars',
            'removeDiacritics': 'remove-diacritics',
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
                removeInvisibleChars: true,
                removeDiacritics: false,
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