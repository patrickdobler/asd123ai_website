# Character Mappings

This document describes the normalization mappings used by the [ASD123.ai Optimizer](https://asd123.ai/optimizer) to standardize Unicode typography to plain ASCII. It is generated from the tables in `src/scripts/optimizer.js`.

Mappings cover **visible typography only** and run when *Apply Character Mapping* is enabled. Invisible and zero-width characters are handled by the separate *Remove Invisible Characters* option, listed at the end of this document.

The mapping is assembled from five groups covering the 41 base rules, plus three optional switches. All five groups are on by default. Earlier versions offered six named language profiles instead, but four of them held byte-identical tables (Italian == Universal, English == German), because a "language" only ever decided these three yes/no questions.

| Retired profile | Equalled |
|---|---|
| Universal | base only |
| Italian | base only |
| German | base + ae/oe |
| English (US and International) | base + ae/oe |
| Swiss German | base + ae/oe + sharp s |
| French | base + ae/oe + French spacing |

A fourth switch, *Umlauts as ae/oe/ue*, belongs to *Remove Diacritics* rather than to the mapping: on, ae/oe/ue; off, a/o/u.

Legend:

- From: Original character (rendered in code font when printable).
- Unicode: Code point(s) of the character(s).
- To: Replacement character(s).
- Note: Rationale or context.

Placeholders: `(NBSP)` = no-break space U+00A0, `(NNBSP)` = narrow no-break space U+202F, `(space)` = U+0020.

---

## Group: hyphens and dashes

Every dash and the minus sign becomes the ASCII hyphen. Switch it off to keep em dashes as they are. (7 rules.)

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| `‐` | U+2010 | `-` | U+002D | Hyphen to hyphen-minus |
| `‑` | U+2011 | `-` | U+002D | Non-breaking hyphen to hyphen-minus |
| `‒` | U+2012 | `-` | U+002D | Figure dash to hyphen-minus |
| `–` | U+2013 | `-` | U+002D | En dash to hyphen-minus |
| `—` | U+2014 | `-` | U+002D | Em dash to hyphen-minus |
| `―` | U+2015 | `-` | U+002D | Horizontal bar to hyphen-minus |
| `−` | U+2212 | `-` | U+002D | Minus sign to hyphen-minus |

---

## Group: quotation marks

Curly and low double quotes, guillemets and the double prime, flattened to the ASCII quotation mark. (8 rules.)

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| `“` | U+201C | `"` | U+0022 | Left double quote to quotation mark |
| `”` | U+201D | `"` | U+0022 | Right double quote to quotation mark |
| `‟` | U+201F | `"` | U+0022 | Double high-reversed-9 quote to quotation mark |
| `„` | U+201E | `"` | U+0022 | Double low-9 quote to quotation mark |
| `«` | U+00AB | `"` | U+0022 | Guillemet left to quotation mark |
| `»` | U+00BB | `"` | U+0022 | Guillemet right to quotation mark |
| `″` | U+2033 | `"` | U+0022 | Double prime to quotation mark |
| `ʺ` | U+02BA | `"` | U+0022 | Modifier letter double prime |

---

## Group: apostrophes

Single quotes, apostrophes, primes and the spacing accents that get used in their place, flattened to the ASCII apostrophe. (10 rules.)

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| `‘` | U+2018 | `'` | U+0027 | Left single quote to apostrophe |
| `’` | U+2019 | `'` | U+0027 | Right single quote to apostrophe |
| `‛` | U+201B | `'` | U+0027 | Single high-reversed-9 quote to apostrophe |
| `‚` | U+201A | `'` | U+0027 | Single low-9 quote to apostrophe |
| `‹` | U+2039 | `'` | U+0027 | Single left angle quote to apostrophe |
| `›` | U+203A | `'` | U+0027 | Single right angle quote to apostrophe |
| `′` | U+2032 | `'` | U+0027 | Prime to apostrophe |
| `´` | U+00B4 | `'` | U+0027 | Acute accent to apostrophe |
| `ʼ` | U+02BC | `'` | U+0027 | Modifier letter apostrophe |
| `ʹ` | U+02B9 | `'` | U+0027 | Modifier letter prime |

---

## Group: bullets, ellipses and symbols

Ellipsis and two-dot leader spelled out, bullet characters turned into a hyphen, multiplication sign and fraction slash replaced by x and /. (9 rules.)

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| `…` | U+2026 | `...` | U+002E U+002E U+002E | Ellipsis to three dots |
| `‥` | U+2025 | `..` | U+002E U+002E | Two dot leader to two dots |
| `•` | U+2022 | `-` | U+002D | Bullet to hyphen-minus |
| `‣` | U+2023 | `-` | U+002D | Triangular bullet to hyphen-minus |
| `⁃` | U+2043 | `-` | U+002D | Hyphen bullet to hyphen-minus |
| `◦` | U+25E6 | `-` | U+002D | White bullet to hyphen-minus |
| `∙` | U+2219 | `-` | U+002D | Bullet operator to hyphen-minus |
| `×` | U+00D7 | `x` | U+0078 | Multiplication sign to x |
| `⁄` | U+2044 | `/` | U+002F | Fraction slash to solidus |

---

## Group: PDF ligatures

Text extracted from PDFs stores fi and fl as a single glyph; this splits them back apart. (7 rules.)

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| `ﬀ` | U+FB00 | `ff` | U+0066 U+0066 | PDF ligature |
| `ﬁ` | U+FB01 | `fi` | U+0066 U+0069 | PDF ligature |
| `ﬂ` | U+FB02 | `fl` | U+0066 U+006C | PDF ligature |
| `ﬃ` | U+FB03 | `ffi` | U+0066 U+0066 U+0069 | PDF ligature |
| `ﬄ` | U+FB04 | `ffl` | U+0066 U+0066 U+006C | PDF ligature |
| `ﬅ` | U+FB05 | `st` | U+0073 U+0074 | PDF ligature (long s) |
| `ﬆ` | U+FB06 | `st` | U+0073 U+0074 | PDF ligature |

---

## Switch: spell out ae/oe ligatures

German, French and English write these out in ASCII. Leave it off for Italian, which has no ae/oe of its own, so foreign words keep their spelling. (4 rules.)

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| `æ` | U+00E6 | `ae` | U+0061 U+0065 | Spelled out in ASCII |
| `Æ` | U+00C6 | `Ae` | U+0041 U+0065 | Spelled out in ASCII |
| `œ` | U+0153 | `oe` | U+006F U+0065 | Spelled out in ASCII |
| `Œ` | U+0152 | `Oe` | U+004F U+0065 | Spelled out in ASCII |

---

## Switch: convert sharp s to ss

The Swiss convention. Germany and Austria keep the sharp s, so leave it off for German from those countries. (1 rules.)

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| `ß` | U+00DF | `ss` | U+0073 U+0073 | Sharp s to ss (Swiss standard) |

---

## Switch: French spacing rules

French typography places a space inside guillemets and before the semicolon, colon, exclamation and question mark; this removes it. Multi-character keys are matched before single characters, and each rule is listed for the no-break space, the narrow no-break space and the plain space, so it also works when invisible-character removal is switched off. (18 rules.)

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| `«(NBSP)` | U+00AB U+00A0 | `"` | U+0022 | French spacing |
| `«(NNBSP)` | U+00AB U+202F | `"` | U+0022 | French spacing |
| `«(space)` | U+00AB U+0020 | `"` | U+0022 | French spacing |
| `(NBSP)»` | U+00A0 U+00BB | `"` | U+0022 | French spacing |
| `(NNBSP)»` | U+202F U+00BB | `"` | U+0022 | French spacing |
| `(space)»` | U+0020 U+00BB | `"` | U+0022 | French spacing |
| `(NBSP);` | U+00A0 U+003B | `;` | U+003B | French spacing |
| `(NNBSP);` | U+202F U+003B | `;` | U+003B | French spacing |
| `(space);` | U+0020 U+003B | `;` | U+003B | French spacing |
| `(NBSP):` | U+00A0 U+003A | `:` | U+003A | French spacing |
| `(NNBSP):` | U+202F U+003A | `:` | U+003A | French spacing |
| `(space):` | U+0020 U+003A | `:` | U+003A | French spacing |
| `(NBSP)!` | U+00A0 U+0021 | `!` | U+0021 | French spacing |
| `(NNBSP)!` | U+202F U+0021 | `!` | U+0021 | French spacing |
| `(space)!` | U+0020 U+0021 | `!` | U+0021 | French spacing |
| `(NBSP)?` | U+00A0 U+003F | `?` | U+003F | French spacing |
| `(NNBSP)?` | U+202F U+003F | `?` | U+003F | French spacing |
| `(space)?` | U+0020 U+003F | `?` | U+003F | French spacing |

---

## Invisible characters

Not part of the character mapping. These are removed by the separate *Remove Invisible Characters* option, which covers 4,275 code points in total. They carry no visible meaning, but are used to hide tracking IDs and watermarks, and some of them make text render differently from how it is stored.

Most of that total is reserved space listed as ranges, not individual characters:

| Rows | Code points |
|---|---|
| 39 individually listed characters | 39 |
| U+E01F0-E0FFF, reserved default-ignorable | 3600 |
| U+E0100-E01EF, variation selector supplement | 240 |
| U+E0001-E007F, tag characters | 127 |
| U+E0080-E00FF, reserved default-ignorable | 128 |
| U+FDD0-FDEF and U+nFFFE/U+nFFFF, noncharacters | 66 |
| U+13430-1343F, U+1BCA0-1BCA3, U+1D173-1D17A, layout controls | 28 |
| U+FE00-FE0F, variation selectors 1-16 | 16 |
| 16 unusual spaces | 16 |
| U+FFF0-FFF8, U+2065, U+E0000, reserved default-ignorable | 11 |
| U+180B-180D and U+180F, Mongolian free variation selectors | 4 |
| **Total** | **4275** |

Of those 4,275, **440 are assigned characters**. The other 3,835 are Unicode noncharacters and reserved default-ignorable code points: unassigned, rendered invisibly by conformant renderers, and preserved by normalization, which is exactly what makes them covert carriers. Noncharacters can never be assigned; the reserved default-ignorable ranges can, so they need re-checking on a Unicode version bump - U+180F became Mongolian FVS4 in Unicode 14.

Emoji safety: U+200D, U+FE0E and U+FE0F are kept when they hold a composed emoji together and removed when they float in ordinary text.

Script safety: controls that belong to a script - Mongolian free variation selectors, Khmer inherent vowels, Hangul fillers, and the Egyptian quadrat, Duployan and musical layout controls - are kept when they sit next to that script, and removed when they float in unrelated text. Stripping them unconditionally would visibly corrupt correct text in those scripts.

### Removed

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| ZWSP | U+200B |  |  | Zero width space |
| ZWNJ | U+200C |  |  | Zero width non-joiner |
| ZWJ | U+200D |  |  | Zero width joiner - kept when it joins two emoji |
| WJ | U+2060 |  |  | Word joiner |
| MVS | U+180E |  |  | Mongolian vowel separator |
| ZWNBSP | U+FEFF |  |  | Zero width no-break space / BOM |
| ALM | U+061C |  |  | Arabic letter mark |
| LRM | U+200E |  |  | Left-to-right mark |
| RLM | U+200F |  |  | Right-to-left mark |
| LRE | U+202A |  |  | Left-to-right embedding |
| RLE | U+202B |  |  | Right-to-left embedding |
| PDF | U+202C |  |  | Pop directional formatting |
| LRO | U+202D |  |  | Left-to-right override |
| RLO | U+202E |  |  | Right-to-left override - the Trojan Source vector |
| LRI | U+2066 |  |  | Left-to-right isolate |
| RLI | U+2067 |  |  | Right-to-left isolate |
| FSI | U+2068 |  |  | First strong isolate |
| PDI | U+2069 |  |  | Pop directional isolate |
| FA | U+2061 |  |  | Function application |
| IT | U+2062 |  |  | Invisible times |
| IS | U+2063 |  |  | Invisible separator |
| IP | U+2064 |  |  | Invisible plus |
| ISS | U+206A |  |  | Inhibit symmetric swapping - deprecated |
| ASS | U+206B |  |  | Activate symmetric swapping - deprecated |
| IAFS | U+206C |  |  | Inhibit Arabic form shaping - deprecated |
| AAFS | U+206D |  |  | Activate Arabic form shaping - deprecated |
| NADS | U+206E |  |  | National digit shapes - deprecated |
| NODS | U+206F |  |  | Nominal digit shapes - deprecated |
| SHY | U+00AD |  |  | Soft hyphen |
| CGJ | U+034F |  |  | Combining grapheme joiner |
| HCF | U+115F |  |  | Hangul choseong filler |
| HJF | U+1160 |  |  | Hangul jungseong filler |
| KIV-AQ | U+17B4 |  |  | Khmer vowel inherent AQ |
| KIV-AA | U+17B5 |  |  | Khmer vowel inherent AA |
| HF | U+3164 |  |  | Hangul filler |
| HWHF | U+FFA0 |  |  | Halfwidth Hangul filler |
| IAA | U+FFF9 |  |  | Interlinear annotation anchor |
| IAS | U+FFFA |  |  | Interlinear annotation separator |
| IAT | U+FFFB |  |  | Interlinear annotation terminator |
| FVS1-4 | U+180B-180D, U+180F |  |  | Mongolian free variation selectors - kept after a Mongolian letter |
| EGY | U+13430-1343F |  |  | Egyptian hieroglyph quadrat controls - kept inside hieroglyphic text |
| DUP | U+1BCA0-1BCA3 |  |  | Duployan shorthand controls - kept inside Duployan text |
| MUS | U+1D173-1D17A |  |  | Musical beam/tie/slur controls - kept inside musical notation |
| NCHAR | U+FDD0-FDEF |  |  | Unicode noncharacters, 32 code points - banned in interchange |
| NCHAR | U+FFFE-FFFF |  |  | Plane-end noncharacters; the same pair ends all 17 planes, 34 total |
| RSV | U+2065 |  |  | Reserved default-ignorable |
| RSV | U+FFF0-FFF8 |  |  | Reserved default-ignorable |
| RSV | U+E0000 |  |  | Reserved default-ignorable |
| RSV | U+E0080-E00FF |  |  | Reserved default-ignorable, 128 code points |
| RSV | U+E01F0-E0FFF |  |  | Reserved default-ignorable, 3600 code points |
| VS1-16 | U+FE00-FE0F |  |  | Variation selectors - VS15/VS16 kept after an emoji |
| VS17-256 | U+E0100-E01EF |  |  | Variation selector supplement, 240 code points |
| TAG | U+E0001-E007F |  |  | Tag characters, 127 code points - can carry a hidden message |

### Normalized to a plain space

These 16 are the only entries the *Fold unusual spaces* switch controls. With it off they are left untouched and everything above is still removed, so French and German typography that relies on the no-break space survives a clean.

| From | Unicode | To | Unicode | Note |
|---|---|---|---|---|
| (invisible) | U+00A0 | ` ` | U+0020 | No-break space to space |
| (invisible) | U+1680 | ` ` | U+0020 | Ogham space mark to space |
| (invisible) | U+2000 | ` ` | U+0020 | En quad to space |
| (invisible) | U+2001 | ` ` | U+0020 | Em quad to space |
| (invisible) | U+2002 | ` ` | U+0020 | En space to space |
| (invisible) | U+2003 | ` ` | U+0020 | Em space to space |
| (invisible) | U+2004 | ` ` | U+0020 | Three-per-em space to space |
| (invisible) | U+2005 | ` ` | U+0020 | Four-per-em space to space |
| (invisible) | U+2006 | ` ` | U+0020 | Six-per-em space to space |
| (invisible) | U+2007 | ` ` | U+0020 | Figure space to space |
| (invisible) | U+2008 | ` ` | U+0020 | Punctuation space to space |
| (invisible) | U+2009 | ` ` | U+0020 | Thin space to space |
| (invisible) | U+200A | ` ` | U+0020 | Hair space to space |
| (invisible) | U+202F | ` ` | U+0020 | Narrow no-break space to space |
| (invisible) | U+205F | ` ` | U+0020 | Medium mathematical space to space |
| (invisible) | U+3000 | ` ` | U+0020 | Ideographic space to space |
