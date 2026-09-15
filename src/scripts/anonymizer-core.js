import { receiveToolText } from './tool-transfer.js';
// Anonymizer Core - Main application logic
// Part of ASD123.ai Anonymizer - Privacy-First Text Protection

import { EntityManager } from './entity-manager.js';
import { AIModelProcessor } from './model-loader.js';
import { FileProcessor } from './file-processor.js';
import { UIController } from './ui-controller.js';

// Entity patterns for regex-based detection
// Comprehensive pattern definitions from internet sources
const entityPatterns = {
    PERSON_NAME: {
        pattern: /\b([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]{2,}(?:-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]{2,})? ){1,3}[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]{2,}(?:-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]{2,})?\b/g,
        priority: 80
    },
    PERSON_FULL: {
        pattern: /\b[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]{2,}(?:-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]{2,})?(?:\s+[A-ZÀ-ÖØ-Þ]\.?\s+)?[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]{2,}(?:-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]{2,})?\b/g,
        priority: 81
    },
    PERSON_TITLE: {
        // The title itself stays in the text (a lookbehind, not part of the
        // match); only the NAME is captured. That way "Dr. Anna Keller" and a
        // later plain "Anna Keller" share one placeholder via dedup.
        pattern: /(?<=\b(?:Mr\.?|Mrs\.?|Miss|Ms\.?|Sir|Madam|Dr\.?\s?med\.?|Dr\.?\s?phil\.?|Dr\.?\s?jur\.?|Dr\.?\s?rer\.?\s?nat\.?|Dr\.?|Professor|Prof\.?\s?Dr\.?|Prof\.?|Herr|Frau|lic\.?\s?iur\.?|lic\.?\s?phil\.?|Reverend|Rev\.?|Captain|Capt\.?|Colonel|Col\.?|Lieutenant|Lt\.?|Sergeant|Sgt\.?|Judge|Justice|Honorable|Hon\.?|Senator|Sen\.?|Rep\.?|Mayor|President|Pres\.?|Vice President|VP|CEO|CFO|CTO|Director|Chief)\s+)[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]+(?:-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]+)?(?:\s+[A-ZÀ-ÖØ-Þ]\.?)?(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]+(?:-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]+)?)?\b/g,
        priority: 3
    },
    EMAIL: {
        pattern: /[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?/g,
        priority: 4
    },
    PHONE: {
        pattern: /(?:^|\s|\b)(?:\+?1?[-\s.]?)?(?:\(?\d{3}\)?[-\s.]?)?\d{3}[-\s.]\d{4}\b/g,
        priority: 5
    },
    SSN: {
        pattern: /\b(?!000|666|9\d{2})([0-8]\d{2}|7([0-6]\d))([-]?)(?!00)\d{2}\2(?!0000)\d{4}\b/g,
        priority: 6
    },
    CREDIT_CARD: {
        pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11}|(?:\d{4}[-\s]?){3}\d{4})\b/g,
        priority: 7
    },
    IBAN: {
        pattern: /\b[A-Z]{2}\d{2}[A-Z0-9]{4}\d{7}([A-Z0-9]?){0,16}\b/g,
        priority: 8
    },
    US_PASSPORT: {
        pattern: /\b[A-Z][0-9]{8}\b/g,
        priority: 9
    },
    UK_NINO: {
        pattern: /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-Z]\b/g,
        priority: 10
    },
    UK_NHS: {
        pattern: /\b\d{3}\s?\d{3}\s?\d{4}\b/g,
        priority: 11
    },
    CA_SIN: {
        pattern: /\b\d{3}[-.\\s]?\d{3}[-.\\s]?\d{3}\b/g,
        priority: 12
    },
    AU_MEDICARE: {
        pattern: /\b\d{4}\s?\d{5}\s?\d\b/g,
        priority: 13
    },
    AU_TFN: {
        pattern: /\b\d{3}\s?\d{3}\s?\d{3}\b/g,
        priority: 14
    },
    ADDRESS: {
        pattern: /\d{1,5}\s+[\w\s]{1,50}\s+(Street|St\.|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Plaza|Pl)\b/gi,
        priority: 15
    },
    STREET_ADDRESS: {
        pattern: /\b\d{1,5}\s+(?:(?:N\.?|S\.?|E\.?|W\.?|North|South|East|West|NE\.?|NW\.?|SE\.?|SW\.?|Northeast|Northwest|Southeast|Southwest)\s+)?[A-Za-z0-9.'-]{1,30}(?:\s+[A-Za-z0-9.'-]{1,30})?\s+(Street|Avenue|Lane|Road|Boulevard|Circle|Court|Drive|Square|Place|Alley|Ave\.?|Rd\.?|Blvd\.?|Ln\.?|Dr\.?|Way\.?|Pl\.?|Dr\.?|Cir\.?|Ct\.?|Sq\.?|Pkwy\.?|Hwy\.?|St\.?|Ter\.?|Trl\.?|Pass\.?|Loop\.?|Pike\.?)(?:\b|\.)/gi,
        priority: 16
    },
    DATE: {
        pattern: /\b(?:(?:\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})|(?:\d{4}[-\/]\d{1,2}[-\/]\d{1,2})|(?:\d{1,2}\.\d{1,2}\.\d{2,4})|(?:\d{4}\.\d{1,2}\.\d{1,2})|(?:\d{1,2}\s+\d{1,2}\s+\d{2,4})|(?:\d{4}\s+\d{1,2}\s+\d{1,2})|(?:(?:Jan\.?(?:uary)?|Feb\.?(?:ruary)?|Mar\.?(?:ch)?|Apr\.?(?:il)?|May\.?|Jun\.?(?:e)?|Jul\.?(?:y)?|Aug\.?(?:ust)?|Sep\.?(?:tember)?|Oct\.?(?:ober)?|Nov\.?(?:ember)?|Dec\.?(?:ember)?|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+\d{1,2}(?:st|nd|rd|th)?,?\s+\d{4})|(?:\d{1,2}(?:st|nd|rd|th)?\.?\s+(?:Jan\.?(?:uary)?|Feb\.?(?:ruary)?|Mar\.?(?:ch)?|Apr\.?(?:il)?|May\.?|Jun\.?(?:e)?|Jul\.?(?:y)?|Aug\.?(?:ust)?|Sep\.?(?:tember)?|Oct\.?(?:ober)?|Nov\.?(?:ember)?|Dec\.?(?:ember)?|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\.?,?\s+\d{4}))\b/gi,
        priority: 17
    },
    URL: {
        pattern: /(https?:\/\/[^\s\)]+)|(www\.[^\s\)]+)|(?:^|[\s\(\[])((?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+(?:com|org|net|edu|gov|mil|int|eth|co|io|ai|sol|btc|money|ly|me|tv|cc|tk|ml|ga|cf|biz|info|name|pro|app|dev|tech|blog|site|online|store|shop|news|media|chat|email|cloud|data|finance|legal|plus|pro|premium|vip|max|mini|uk|eu|de|fr|es|it|nl|se|no|fi|ru|cn|jp|kr|in|au|ca|us|za|ch|at|be|pl|cz|sk|hu|ro|tr|gr|pt|dk|ie|il|hk|sg|nz|mx|ar|cl|co|pe|ve|sa|ae|qa|eg|ng|ke|tz|ug|gh|pk|bd|lk|my|th|ph|vn|id|tw|si|hr|lt|lv|ee|bg|rs|ua|by|kz|ge|az|am|md|al|ba|mk|me|lu|li|mc|sm|ad|fo|gl|gi|je|gg|im|re|yt|pm|wf|tf|pf|nc|bl|mf|gp|mq|gf|sr|aw|cw|sx|bq|ai|ag|dm|gd|lc|ms|kn|vc|bb|bm|ky|tc|vg|vi|jm|tt|bs|bz|cr|sv|gt|hn|ni|pa|do|ht|pr|bo|ec|gy|py|sr|uy|fk|aq|bv|io|sh|gs|hm|tf|um|wf|yt|asia|africa|america|antarctica|oceania))(?=[\s\.\,\;\:\!\?\)\]\}]|$)/gi,
        priority: 18
    },
    IP_ADDRESS: {
        pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
        priority: 19
    },
    IP_ADDRESS_IPV6: {
        pattern: /\b(?:(?:[A-F0-9]{1,4}:){7}[A-F0-9]{1,4}|(?:(?:[A-F0-9]{1,4}:)*)?::(?:(?:[A-F0-9]{1,4}:)*[A-F0-9]{1,4})?)\b/gi,
        priority: 20
    },
    UUID: {
        pattern: /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g,
        priority: 21
    },
    ACCOUNT: {
        pattern: /\b(?:Account\s*:?|No\.?|Number\s*:?)[ ]*\d{4,}\b/gi,
        priority: 22
    },
    PIN: {
        pattern: /\bPIN:?\s*\d{4,6}\b/gi,
        priority: 23
    },
    HANDLE: {
        pattern: /@[^\s]{3,32}\b/g,
        priority: 24
    },
    EURO: {
        pattern: /\b\d{1,3}(?:[., ]\d{3})*(?:[.,]\d{2})?\s?\u20ac\b|\u20ac\s?\d{1,3}(?:[., ]\d{3})*(?:[.,]\d{2})?\b/gi,
        priority: 25
    },
    POUND: {
        pattern: /\b\d{1,3}(?:[., ]\d{3})*(?:[.,]\d{2})?\s?\u00a3\b|\u00a3\s?\d{1,3}(?:[., ]\d{3})*(?:[.,]\d{2})?\b/gi,
        priority: 26
    },
    YEN: {
        pattern: /\b\d{1,3}(?:[., ]\d{3})*(?:[.,]\d{2})?\s?\u00a5\b|\u00a5\s?\d{1,3}(?:[., ]\d{3})*(?:[.,]\d{2})?\b/gi,
        priority: 27
    },
    MONEY: {
        pattern: /(?:(?:US\$|\$|USD\$)\s?\d{1,3}(?:[, ]?\d{3})*(?:\.\d{2})?|\b\d{1,3}(?:[, ]?\d{3})*(?:\.\d{2})?(?:\s+(?:US |United States )?Dollars?|\s+euros?|\s+yen\b)|[\u20ac\u00a3\u00a5\u20bf\u039e\u00a2\u20b9]\s?\d{1,3}(?:[, ]?\d{3})*(?:\.\d{2})?)/gi,
        priority: 28
    },
    MONEY_CRYPTO: {
        pattern: /\b\d+(?:\.\d+)?\s?(BTC|ETH|XRP|XMR|BNB|SOL|USDT|USDC|LTC|TRX|ADA|XLM)\b/gi,
        priority: 29
    },
    CRYPTO_ADDRESS: {
        pattern: /\b(?:0x[a-fA-F0-9]{40}|(?:bc1|[13])[a-zA-HJ-NP-Z0-9]{25,39}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/g,
        priority: 30
    },
    FILE: {
        pattern: /(?:[A-Za-z]{1,4}:)?[^\r\n]+\.(?:pdf|docx?|xlsx?|csv|txt|rtf|pages|mp4|png|jpe?g|gif|svg|zip|rar|7z|tar|gz|mp3|wav|mov|avi|mkv|ppt|pptx|html?|css|js|json|xml|md|py|java|cpp|h|sql|php|rb|go|rs|bin|dat|img|ts)\b/gi,
        priority: 31
    },
    COMPANY: {
        pattern: /\b(?:[A-Za-z0-9&.'-]+\s+){0,3}[A-Za-z0-9&.'-]+(?:,?\s*)(?:LLC|L\.L\.C\.|Ltd\.?|Inc\.?|Corp\.?|GmbH|AG|S\.?à\.?\s?r\.?l\.?|Sàrl|KG|OHG|e\.V\.|UG|PLC|LP|L\.P\.|LLP|L\.L\.P\.|GP|G\.P\.|DAO|SA|Foundation|Association|Cooperative|Corporation|Incorporated|Limited Company|Financial Group|& Co\.|& Partners|Limited Liability Company|Limited Partnership|Limited Liability Partnership|Sociedad Anonima|S\.A\.|S\.A\.S\.|S\.A\.S\.S\.)\b/g,
        priority: 32
    },
    ID_CODE: {
        // Hyphenated reference codes such as KD-2026-88421 or CUST-88421
        pattern: /\b[A-Z]{1,5}-\d[A-Z0-9]*(?:-[A-Z0-9]{2,12}){0,3}\b/g,
        priority: 34
    },
    PASSPORT: {
        pattern: /\b(?:[A-Z]{2}\d{6,8}|[A-Z]\d{8})\b/gi,
        priority: 33
    },
    MAC_ADDRESS: {
        pattern: /\b([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})\b/g,
        priority: 35
    },
    VIN: {
        // 17-char VIN; must contain at least one letter (pure digit runs are
        // handled by NUMBER_ID instead of being mislabeled as a VIN)
        pattern: /\b(?=[A-HJ-NPR-Z0-9]{17}\b)(?![0-9]{17})[A-HJ-NPR-Z0-9]{17}\b/g,
        priority: 36
    },
    LICENSE: {
        // Label required — an unlabeled digit run is not a "license"
        pattern: /\b(?:DL|Driver'?s?\s+Licen[cs]e|Licen[cs]e|Identification)\s*(?:No\.?|Number|Nr\.?)?\s*[:#]?\s*(?:[A-Z]{1,3}\d{6,18}|\d{6,18}|[A-Z]{7}\*\d{3})\b/gi,
        priority: 37
    },
    GPS: {
        pattern: /\b(?:[\(\[]\s*(?:[NS]\s*)?[+-]?(?:90(?:\.0+)?|[1-8]?\d(?:\.\d+)?)\s*(?:\u00b0|deg(?:rees)?)?(?:\s*[NS])?\s*[\s,;]\s*(?:[EW]\s*)?[+-]?(?:180(?:\.0+)?|(?:1[0-7]\d|[1-9]?\d)(?:\.\d+)?)\s*(?:\u00b0|deg(?:rees)?)?(?:\s*[EW])?\s*[\)\]]|(?:[NS]\s*)?[+-]?(?:90(?:\.0+)?|[1-8]?\d(?:\.\d+)?)\s*(?:\u00b0|deg(?:rees)?)?(?:\s*[NS])?\s*[\s,;]\s*(?:[EW]\s*)?[+-]?(?:180(?:\.0+)?|(?:1[0-7]\d|[1-9]?\d)(?:\.\d+)?)\s*(?:\u00b0|deg(?:rees)?)?(?:\s*[EW])?|@\s*[+-]?(?:90(?:\.0+)?|[1-8]?\d(?:\.\d+)?)\s*[\s,;]\s*[+-]?(?:180(?:\.0+)?|(?:1[0-7]\d|[1-9]?\d)(?:\.\d+)?)|(?:Lat(?:itude)?[\s:=-]*)?\s*(?:[NS]\s*)?(?:[0-8]?\d|90)\u00b0?\s*[0-5]?\d['"\u2032]\s*[0-5]?\d(?:\.\d+)?['"\u2033]?\s*(?:[NS])?\s*[\s,;]\s*(?:Long?(?:itude)?[\s:=-]*)?\s*(?:[EW]\s*)?(?:[0-1]?[0-7]?\d|180)\u00b0?\s*[0-5]?\d['"\u2032]\s*[0-5]?\d(?:\.\d+)?['"\u2033]?\s*(?:[EW])?|(?:[NS]\s*)?(?:[0-8]?\d|90)\u00b0?\s*[0-5]?\d(?:\.\d+)?['"\u2032]\s*(?:[NS])?\s*[\s,;]\s*(?:[EW]\s*)?(?:[0-1]?[0-7]?\d|180)\u00b0?\s*[0-5]?\d(?:\.\d+)?['"\u2032]\s*(?:[EW])?|(?:UTM\s*)?(?:[1-6][0-9]|[0-9])[A-HJ-NP-Z]\s*[0-9]{6}(?:\.\d+)?\s*[mE]?\s*[0-9]{7}(?:\.\d+)?\s*[mN]?|(?:UTM\s*)?(?:[1-6][0-9]|[0-9])[A-HJ-NP-Z]\s*(?:E|Easting|East)?\s*[0-9]{6}(?:\.\d+)?\s*[mE]?\s*(?:N|Northing|North)?\s*[0-9]{7}(?:\.\d+)?\s*[mN]?)\b/gi,
        priority: 38
    },
    MEDICARE_ID: {
        pattern: /\b[0-9][ACDEFGHJKMNPQRTUVWXY][ACDEFGHJKMNPQRTUVWXY][0-9](?:[-\s]?)[ACDEFGHJKMNPQRTUVWXY][ACDEFGHJKMNPQRTUVWXY][0-9](?:[-\s]?)[ACDEFGHJKMNPQRTUVWXY][ACDEFGHJKMNPQRTUVWXY][0-9][0-9]\b/g,
        priority: 39
    },
    TRADEMARK: {
        pattern: /\b[A-Z][a-zA-Z0-9]*(?:\u2122|\u00ae|\(TM\)|\(R\)|\(tm\)|\(r\))/g,
        priority: 41
    },
    AGE: {
        pattern: /\b\d{1,3}\s?(?:years?\s?old|y\.?o\.?)\b/gi,
        priority: 42
    },
    ZIP: {
        pattern: /\b(?:P\.?\s?O\.?\s?Box\s?\d{1,6}|[A-Z]{2}\s+\d{5}(?:-\d{4})?|\d{5}(?:-\d{4})?)\b/g,
        priority: 43
    },
    ZIP_US: {
        pattern: /(?:^|\s)\d{5}(?:-\d{4})?(?=\s|$)/g,
        priority: 85
    },
    ZIP_UK: {
        pattern: /\b[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}\b/gi,
        priority: 45
    },
    ZIP_CA: {
        pattern: /\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/gi,
        priority: 46
    },
    NUMBER_ID: {
        // Honest last-resort label for any long digit run (order numbers,
        // account-like numbers, ...). Runs after every specific pattern.
        pattern: /\b\d{6,}\b/g,
        priority: 95
    },
    CH_PHONE_MOBILE: {
        pattern: /(?:^|[\s(])(?:\+41|0041|0)\s?7[5-9]\s?\d\s?\d{2,3}\s?\d{2}\s?\d{2}\b/g,
        priority: 2
    },
    CH_PHONE_LANDLINE: {
        pattern: /(?:^|[\s(])(?:\+41|0041|0)\s?(?:[1-9]\d{1})\s?\d{3}\s?\d{2}\s?\d{2}\b/g,
        priority: 2
    },
    CH_PASSPORT_NUMBER: {
        pattern: /\b[A-Z]\d{7}\b/g,
        priority: 53
    },
    CH_DATE_DDMMYYYY: {
        pattern: /\b(?:0?[1-9]|[12]\d|3[01])\.(?:0?[1-9]|1[0-2])\.(?:\d{2}|\d{4})\b/g,
        priority: 54
    },
    CH_POSTAL_CODE: {
        pattern: /(?:^|[,\s])(?:CH-)?[1-9]\d{3}(?=\s+[A-ZÀ-ÖØ-Þa-zà-öø-ÿ])/g,
        priority: 90
    },
    CH_TAX_AHV_NUMBER: {
        pattern: /\b756(?:\.\d{4}){2}\.\d{2}\b|\b756\d{10}\b/g,
        priority: 1
    },
    CH_SOCIAL_SECURITY_OASI: {
        pattern: /(?:AHV|AVS|OASI)\s*(?:Nr\.?|Number|Nummer)?\s*[:#]?\s*(?:756(?:\.\d{4}){2}\.\d{2}|756\d{10})/gi,
        priority: 57
    },
    CH_BANK_IBAN: {
        pattern: /\bCH\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{1}\b|\bCH\d{2}[0-9A-Z]{17}\b/g,
        priority: 2
    },
    CH_DRIVER_LICENSE: {
        pattern: /(?:Führerausweis|Fuehrerausweis|Permis de conduire|Licenza di condurre)\s*[:#]?\s*[A-Z0-9]{6,10}\b/gi,
        priority: 59
    },
    CH_NATIONAL_ID_CARD: {
        pattern: /(?:Identitätskarte|Identitaetskarte|Carte d(?:'|\u2019)?identit(?:e|\u00e9)|Carta d(?:'|\u2019)?identit(?:a|\u00e0)|ID(?:-?Card)?)\s*[:#]?\s*[A-Z]\s?\d{7}\b/gi,
        priority: 60
    },
    CH_VAT_UID: {
        pattern: /\bCHE[-\s]?\d{3}\.\d{3}\.\d{3}(?:\s*(?:MWST|TVA|IVA))?\b|\bCHE\d{9}(?:MWST|TVA|IVA)?\b/gi,
        priority: 61
    },
    CH_HEALTH_INSURANCE_NUMBER: {
        pattern: /(?:Krankenkasse|Versichertennummer|Assurance maladie|Numero assicurazione)\s*[:#]?\s*\d{3}\.\d{4}\.\d{4}\.\d{2}\b/gi,
        priority: 62
    },
    DE_PHONE_MOBILE: {
        pattern: /\b(?:\+49|0049|0)\s?1[5-7]\d(?:\s?\d{2,4}){2,3}\b/g,
        priority: 63
    },
    DE_PHONE_LANDLINE: {
        pattern: /\b(?:\+49|0049|0)\s?(?:[2-9]\d{1,4})\s?\d{3,8}\b/g,
        priority: 64
    },
    DE_PASSPORT_NUMBER: {
        pattern: /\b[CFGHJKLMNPRTVWXYZ]\d{8}\b/g,
        priority: 65
    },
    DE_REISEPASS_LABELLED: {
        pattern: /(?:Reisepass(?:nummer)?|Pass-Nr\.?|Passnummer)\s*[:#]?\s*[CFGHJKLMNPRTVWXYZ]\d{8}\b/gi,
        priority: 66
    },
    DE_DATE_DDMMYYYY: {
        pattern: /\b(?:0?[1-9]|[12]\d|3[01])[.\\/-](?:0?[1-9]|1[0-2])[.\\/-](?:\d{2}|\d{4})\b/g,
        priority: 67
    },
    DE_POSTAL_CODE: {
        pattern: /(?:^|\s)(?:D-)?\d{5}(?=\s|$)/g,
        priority: 91
    },
    DE_TAX_ID: {
        pattern: /(?:Steuer(?:identifikationsnummer|[-\s]?ID(?:Nr\.\s*)?)|steuerliche\s+Identifikationsnummer)\s*[:#]?\s*\d{2}\s?\d{3}\s?\d{3}\s?\d{2}\b/gi,
        priority: 69
    },
    DE_SOCIAL_SECURITY_NUMBER: {
        pattern: /\b\d{2}\s?\d{2}\s?\d{2}\s?[A-Z]\s?\d{3}\b/g,
        priority: 70
    },
    DE_BANK_IBAN: {
        pattern: /\bDE\d{20}\b/g,
        priority: 71
    },
    DE_DRIVER_LICENSE: {
        pattern: /(?:Führerscheinnummer|Führerschein-Nr\.?|Fuehrerschein(?:nummer)?|FSNR|Fahrerlaubnisnummer)\s*[:#]?\s*[A-Z0-9]{5,15}\b/gi,
        priority: 72
    },
    DE_NATIONAL_ID_CARD: {
        pattern: /(?:Personalausweis(?:nummer)?|PA(?:-?Nr\.?|-?Nummer)?)\s*[:#]?\s*(?:[CFGHJKLMNPRTVWXYZ]\d{8}|(?:[A-Z]\d{2}){3})\b/gi,
        priority: 73
    },
    DE_VAT_UST_ID: {
        pattern: /(?:USt-IdNr\.?|Umsatzsteuer-Identifikationsnummer)\s*[:#]?\s*DE\s?\d{9}\b|\bDE\s?\d{9}\b/gi,
        priority: 74
    },
    DE_HEALTH_INSURANCE_NUMBER: {
        pattern: /(?:Versichertennummer|Gesundheitskarte|Krankenversicherungsnummer)\s*[:#]?\s*[A-Z]\d{9}[A-Z]\b/gi,
        priority: 75
    },
    DE_CH_ADDRESS: {
        pattern: /\b[A-ZÀ-ÖØ-Þa-zà-öø-ÿß]+(?:strasse|straße|str\.|gasse|weg|platz|allee|ring|damm|ufer|steig|pfad|rain|graben)\s+\d{1,5}[a-zA-Z]?\b/gi,
        priority: 2
    },
    CH_LICENSE_PLATE: {
        pattern: /\b(?:AG|AI|AR|BE|BL|BS|FR|GE|GL|GR|JU|LU|NE|NW|OW|SG|SH|SO|SZ|TG|TI|UR|VD|VS|ZG|ZH)\s?\d{1,3}\s?\d{3}\b/g,
        priority: 2
    },
    CH_INSURANCE_NUMBER: {
        pattern: /(?:Versicherungsnummer|Policen?(?:-?Nr\.?|-?nummer)?|Police\s*Nr\.?)\s*(?:[:.]|\s|lautet)\s*[\w\d][\w\d-]{3,20}\b|\b\d{4}-CH-\d{4}\b/gi,
        priority: 2
    }
};

// Detection categories: every pattern belongs to exactly one category so the
// UI can offer coarse on/off switches instead of all-or-nothing detection.
const CATEGORY_LABELS = {
    people: 'People & Companies',
    contact: 'Contact',
    financial: 'Financial',
    ids: 'IDs & Numbers',
    addresses: 'Addresses & Locations',
    dates: 'Dates & Age',
    tech: 'Web & Tech'
};

const ENTITY_CATEGORIES = {
    PERSON_NAME: 'people', PERSON_FULL: 'people', PERSON_TITLE: 'people', COMPANY: 'people', TRADEMARK: 'people',
    EMAIL: 'contact', PHONE: 'contact', HANDLE: 'contact',
    CH_PHONE_MOBILE: 'contact', CH_PHONE_LANDLINE: 'contact', DE_PHONE_MOBILE: 'contact', DE_PHONE_LANDLINE: 'contact',
    CREDIT_CARD: 'financial', IBAN: 'financial', CH_BANK_IBAN: 'financial', DE_BANK_IBAN: 'financial',
    ACCOUNT: 'financial', PIN: 'financial', EURO: 'financial', POUND: 'financial', YEN: 'financial',
    MONEY: 'financial', MONEY_CRYPTO: 'financial', CRYPTO_ADDRESS: 'financial',
    SSN: 'ids', US_PASSPORT: 'ids', UK_NINO: 'ids', UK_NHS: 'ids', CA_SIN: 'ids', AU_MEDICARE: 'ids', AU_TFN: 'ids',
    PASSPORT: 'ids', LICENSE: 'ids', VIN: 'ids', MEDICARE_ID: 'ids', ID_CODE: 'ids', NUMBER_ID: 'ids',
    CH_PASSPORT_NUMBER: 'ids', CH_TAX_AHV_NUMBER: 'ids', CH_SOCIAL_SECURITY_OASI: 'ids', CH_DRIVER_LICENSE: 'ids',
    CH_NATIONAL_ID_CARD: 'ids', CH_VAT_UID: 'ids', CH_HEALTH_INSURANCE_NUMBER: 'ids', CH_INSURANCE_NUMBER: 'ids',
    CH_LICENSE_PLATE: 'ids', DE_PASSPORT_NUMBER: 'ids', DE_REISEPASS_LABELLED: 'ids', DE_TAX_ID: 'ids',
    DE_SOCIAL_SECURITY_NUMBER: 'ids', DE_DRIVER_LICENSE: 'ids', DE_NATIONAL_ID_CARD: 'ids', DE_VAT_UST_ID: 'ids',
    DE_HEALTH_INSURANCE_NUMBER: 'ids',
    ADDRESS: 'addresses', STREET_ADDRESS: 'addresses', DE_CH_ADDRESS: 'addresses', GPS: 'addresses',
    ZIP: 'addresses', ZIP_US: 'addresses', ZIP_UK: 'addresses', ZIP_CA: 'addresses',
    CH_POSTAL_CODE: 'addresses', DE_POSTAL_CODE: 'addresses',
    DATE: 'dates', CH_DATE_DDMMYYYY: 'dates', DE_DATE_DDMMYYYY: 'dates', AGE: 'dates',
    URL: 'tech', IP_ADDRESS: 'tech', IP_ADDRESS_IPV6: 'tech', UUID: 'tech', MAC_ADDRESS: 'tech', FILE: 'tech'
};

// Organization keywords: a "person name" containing one of these is really an
// organization (Zürcher Kantonalbank, Praxis Sonnenhof, ...) — retype it.
const ORG_KEYWORD_RE = /(bank|versicherung|kasse|praxis|klinik|spital|hospital|apotheke|amt|verband|verein|stiftung|agentur|kanzlei|institut|zentrum|center|clinic|insurance|agency|foundation)/i;

class AnonymizerApp {
    constructor() {
        this.entityManager = new EntityManager();
        this.aiProcessor = new AIModelProcessor();
        this.fileProcessor = new FileProcessor();
        this.uiController = new UIController();
        
        this.currentMode = 'regex';
        this.isProcessing = false;
        this.isRedactMode = false;
        this.placeholderText = '';
        this.sourceText = '';
        this.runVersion = (this.runVersion || 0) + 1;
        // Category toggles (non-sensitive preference, persisted locally)
        this.enabledCategories = this.loadCategoryPrefs();
        this.highlightViewActive = false;

        this.initializeApp();
    }

    loadCategoryPrefs() {
        try {
            const stored = JSON.parse(localStorage.getItem('asd123-anonymizer-categories') || '{}');
            return { ...stored };
        } catch (e) {
            return {};
        }
    }

    saveCategoryPrefs() {
        try {
            localStorage.setItem('asd123-anonymizer-categories', JSON.stringify(this.enabledCategories));
        } catch (e) { /* preferences only — safe to ignore */ }
    }

    async initializeApp() {
        // Set up event listeners
        this.setupEventListeners();

        // Initialize UI
        this.uiController.initialize();

        // Set up drag and drop
        this.setupDragAndDrop();

        // Category checkboxes + highlight view
        this.setupCategoryControls();
        this.setupHighlightView();
        document.getElementById('placeholderModeBtn').addEventListener('click', () => {
            this.isRedactMode = false;
            this.renderOutput();
        });
        document.getElementById('inputText').addEventListener('input', () => this.updateInputState());
        window.addEventListener('pagehide', () => this.clearSession());
        receiveToolText(text => {
            document.getElementById('inputText').value = text;
            document.getElementById('inputText').focus();
            this.uiController.showInfo('Text received from Markdown Converter. Anonymize, then review the result.');
        });

    }

    updateInputState() {
        const stale = document.getElementById('inputText').value !== this.sourceText;
        document.getElementById('copyOutputBtn').disabled = this.isProcessing || !this.placeholderText || stale;
        if (stale && this.placeholderText) {
            document.getElementById('outputState').textContent = 'Input changed. Run Anonymize again to update the result.';
        } else if (this.placeholderText) {
            document.getElementById('outputState').textContent = this.isRedactMode ? 'Redacted output cannot be restored automatically. Review it before copying.' : 'Review the result before copying. Only numbered placeholders can be restored.';
        }
    }

    setupCategoryControls() {
        const container = document.getElementById('categoryFilters');
        if (!container) return;
        Object.entries(CATEGORY_LABELS).forEach(([key, label]) => {
            const wrapper = document.createElement('label');
            wrapper.className = 'category-filter';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = this.enabledCategories[key] !== false;
            checkbox.addEventListener('change', () => {
                this.enabledCategories[key] = checkbox.checked;
                this.saveCategoryPrefs();
            });
            wrapper.appendChild(checkbox);
            wrapper.appendChild(document.createTextNode(' ' + label));
            container.appendChild(wrapper);
        });
    }

    setupEventListeners() {
        // Model selection
        document.getElementById('modelSelect').addEventListener('change', async (e) => {
            await this.switchModel(e.target.value);
        });

        document.getElementById('loadGermanSampleBtn').addEventListener('click', () => {
            this.loadSampleText('de');
        });

        document.getElementById('loadEnglishSampleBtn').addEventListener('click', () => {
            this.loadSampleText('en');
        });

        // Anonymize button
        document.getElementById('anonymizeBtn').addEventListener('click', async () => {
            this.isRedactMode = false;
            await this.anonymizeText();
        });

        // Redact Mode button
        document.getElementById('redactBtn').addEventListener('click', async () => {
            this.isRedactMode = true;
            if (this.placeholderText) this.renderOutput();
            else await this.anonymizeText();
        });

        // Deanonymize button
        document.getElementById('deanonymizeBtn').addEventListener('click', () => {
            this.deanonymizeText();
        });

        // File load
        document.getElementById('loadFileBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });

        document.getElementById('fileInput').addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await this.loadFile(e.target.files[0]);
            }
        });

        // Highlight anonymization
        document.getElementById('anonymizeHighlightBtn').addEventListener('click', () => {
            this.anonymizeHighlighted();
        });

        // View and sort change events
        document.addEventListener('viewChanged', () => {
            this.uiController.updateEntityList(this.entityManager.exportEntities());
        });

        document.addEventListener('sortChanged', () => {
            this.uiController.updateEntityList(this.entityManager.exportEntities());
        });

        // Entity export/import
        document.getElementById('exportEntitiesBtn').addEventListener('click', () => {
            this.exportEntities();
        });

        document.getElementById('importEntitiesBtn').addEventListener('click', () => {
            document.getElementById('entitiesFileInput').click();
        });

        document.getElementById('entitiesFileInput').addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                await this.importEntities(e.target.files[0]);
            }
        });

        // LLM processing (optional - button may not exist)
        const processLlmBtn = document.getElementById('processLlmBtn');
        if (processLlmBtn) {
            processLlmBtn.addEventListener('click', () => {
                this.processLlmOutput();
            });
        }

        // Clear input
        document.getElementById('clearInputBtn').addEventListener('click', () => {
            this.clearInput();
        });

        // Copy output
        document.getElementById('copyOutputBtn').addEventListener('click', () => {
            this.copyOutput();
        });

        // Entity removal event
        document.addEventListener('entityRemove', (e) => {
            this.removeEntity(e.detail.placeholder);
        });

    }

    /**
     * Toggle an entity between anonymized (active) and restored (inactive).
     * Active -> inactive: the placeholder in the output is replaced by the
     * original text. Inactive -> active: the original text is re-replaced.
     */
    toggleEntity(placeholder) {
        if (!this.entityManager.getEntity(placeholder)) return;
        this.entityManager.toggleEntity(placeholder);
        this.renderOutput();
        document.querySelector(`[data-ph="${CSS.escape(placeholder)}"]`)?.focus();
    }

    renderOutput() {
        const entries = this.entityManager.entityMap;
        document.getElementById('outputText').value = this.placeholderText.replace(/\[[A-Z][A-Z0-9_]*_\d+\]/g, token => {
            const entity = entries.get(token);
            if (!entity) return token;
            if (!entity.isActive) return entity.original;
            return this.isRedactMode ? '[redacted]' : token;
        });
        document.getElementById('copyOutputBtn').disabled = this.isProcessing || !this.placeholderText || document.getElementById('inputText').value !== this.sourceText;
        document.getElementById('outputState').textContent = this.isRedactMode
            ? 'Redacted output cannot be restored automatically. Review it before copying.'
            : 'Review the result for missed details. Only numbered placeholders can be restored.';
        document.getElementById('placeholderModeBtn').setAttribute('aria-pressed', String(!this.isRedactMode));
        document.getElementById('redactBtn').setAttribute('aria-pressed', String(this.isRedactMode));
        this.uiController.updateEntityList(this.entityManager.exportEntities());
        this.refreshHighlightView();
    }

    clearSession() {
        this.runVersion++;
        this.entityManager.clear();
        this.placeholderText = '';
        this.sourceText = '';
        for (const id of ['inputText', 'outputText', 'llmInput', 'llmOutput']) {
            const field = document.getElementById(id);
            if (field) field.value = '';
        }
        document.getElementById('entitiesList').replaceChildren();
        document.getElementById('outputHighlight').replaceChildren();
        document.getElementById('copyOutputBtn').disabled = true;
        document.getElementById('reviewSection').hidden = false;
        document.getElementById('outputState').textContent = 'Anonymize to create a result.';
    }

    /**
     * Highlight view: renders the anonymized output as read-only rich text
     * where every entity is a clickable chip (click = toggle on/off).
     */
    setupHighlightView() {
        const btn = document.getElementById('highlightViewBtn');
        const container = document.getElementById('outputHighlight');
        if (!btn || !container) return;

        btn.addEventListener('click', () => {
            this.highlightViewActive = !this.highlightViewActive;
            btn.classList.toggle('btn-primary', this.highlightViewActive);
            btn.classList.toggle('btn-secondary', !this.highlightViewActive);
            this.refreshHighlightView();
        });

        container.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-ph]');
            if (chip) this.toggleEntity(chip.dataset.ph);
        });
    }

    refreshHighlightView() {
        const container = document.getElementById('outputHighlight');
        const field = document.getElementById('outputText');
        if (!container || !field) return;
        container.style.display = this.highlightViewActive ? 'block' : 'none';
        field.style.display = this.highlightViewActive ? 'none' : '';
        container.replaceChildren();
        if (!this.highlightViewActive) return;
        for (const part of this.placeholderText.split(/(\[[A-Z][A-Z0-9_]*_\d+\])/g)) {
            const entity = this.entityManager.getEntity(part);
            if (!entity) {
                container.append(document.createTextNode(part));
                continue;
            }
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = entity.isActive ? 'entity-chip' : 'entity-chip entity-chip--inactive';
            chip.dataset.ph = part;
            chip.textContent = !entity.isActive ? entity.original : this.isRedactMode ? '[redacted]' : part;
            chip.setAttribute('aria-pressed', String(entity.isActive));
            chip.setAttribute('aria-label', `${entity.isActive ? 'Show' : 'Hide'} ${entity.original}`);
            container.append(chip);
        }
    }

    setupDragAndDrop() {
        const inputArea = document.getElementById('inputText');
        
        inputArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            inputArea.classList.add('drag-over');
        });

        inputArea.addEventListener('dragleave', () => {
            inputArea.classList.remove('drag-over');
        });

        inputArea.addEventListener('drop', async (e) => {
            e.preventDefault();
            inputArea.classList.remove('drag-over');
            
            const file = e.dataTransfer.files[0];
            if (file) {
                await this.loadFile(file);
            }
        });
    }

    async switchModel(modelType) {
        if (this.isProcessing) {
            document.getElementById('modelSelect').value = this.currentMode;
            this.uiController.showInfo('Wait for processing to finish before changing the model.');
            return;
        }
        this.currentMode = modelType;
        
        if (modelType !== 'regex') {
            document.getElementById('modelSelect').disabled = true;
            document.getElementById('anonymizeBtn').disabled = true;
            try {
                const models = AIModelProcessor.getAvailableModels();
                const modelLabel = models[modelType]?.description || modelType;
                this.uiController.showLoading(true, 'Loading...');
                await this.aiProcessor.loadModel(modelType);
                this.uiController.showSuccess(`${modelLabel} loaded successfully`);
            } catch (error) {
                // IMPORTANT: Do NOT silently fall back to regex
                // Show error and reset to regex mode explicitly
                this.uiController.showError(`Failed to load AI model: ${error.message}`);
                this.currentMode = 'regex';
                document.getElementById('modelSelect').value = 'regex';
                this.uiController.showLoading(false);
            } finally {
                document.getElementById('modelSelect').disabled = false;
                document.getElementById('anonymizeBtn').disabled = false;
            }
        } else {
            this.aiProcessor.unload();
        }
    }

    loadSampleText(language) {
        const samples = {
            de: `Sehr geehrte Damen und Herren

Mein Name ist Dr. Anna Keller, geboren am 14. März 1987 in Zürich. Ich wohne an der Bahnhofstrasse 42, 8001 Zürich, Schweiz.

Bitte kontaktieren Sie mich unter anna.keller@example.ch oder telefonisch unter +41 79 234 56 78. Meine Kundennummer lautet KD-2026-88421 und meine Versicherungsnummer ist 756.9217.0769.85.

Für die Rückerstattung können Sie mein Konto verwenden: IBAN CH93 0076 2011 6238 5295 7 bei der Zürcher Kantonalbank.

Mein Hausarzt ist Dr. Markus Meier, Praxis Sonnenhof, Seefeldstrasse 118, 8008 Zürich. Die letzte Behandlung fand am 22. April 2026 statt.

Freundliche Grüsse
Anna Keller`,
            en: `Hello Support Team,

My name is Michael Turner and I live at 221B Baker Street, London NW1 6XE, United Kingdom. I was born on September 18, 1982.

You can reach me at michael.turner@example.com or +44 7700 900123. My customer ID is CUST-88421 and my account number is 9827346501.

For the refund, please use IBAN GB29 NWBK 6016 1331 9268 19. My appointment with Dr. Sarah Collins at Northside Clinic took place on April 22, 2026.

Best regards,
Michael Turner`
        };

        const inputText = document.getElementById('inputText');
        inputText.value = samples[language] || samples.de;
        this.updateInputState();
        inputText.focus();
        this.uiController.showInfo('Example text loaded');
    }

    async anonymizeText() {
        if (this.isProcessing) return;
        
        const inputText = document.getElementById('inputText').value;
        if (/\[[A-Z][A-Z0-9_]*_\d+\]/.test(inputText)) {
            this.uiController.showInfo('This text already contains numbered placeholders. Use Restore original values below, or remove the existing placeholders first.');
            return;
        }
        if (!inputText.trim()) {
            this.uiController.showError('Please enter text to anonymize');
            return;
        }

        const runVersion = ++this.runVersion;
        this.sourceText = inputText;
        this.isProcessing = true;
        this.updateInputState();
        this.uiController.showProcessing(true);
        this.entityManager.clear();
        this.placeholderText = '';

        try {
            let anonymizedText = inputText;

            if (this.currentMode === 'regex') {
                // ===== QUICK SCAN MODE: Regex-based processing =====
                const detectedEntities = this.processWithRegex(inputText);
                // Apply anonymization using entity positions
                anonymizedText = this.applyAnonymization(inputText, detectedEntities);
            } else {
                // ===== AI MODE: Token classification (COMPLETELY DIFFERENT) =====
                // DO NOT fall back to regex - AI mode must use AI only
                const aiResult = await this.aiProcessor.processText(inputText);
                if (runVersion !== this.runVersion) return;
                
                // AI returns pre-masked text and replacements directly
                // The maskedText already contains placeholders
                anonymizedText = aiResult.maskedText;
                
                // Register entities with EntityManager for deanonymization
                this.registerAIEntities(aiResult.replacements);
                
                // Note: No regex fallback - if AI found nothing, that's the result
                if (aiResult.replacements.length === 0) {
                    this.uiController.showInfo('AI model detected no sensitive information in the text');
                }
            }
            
            // Update UI
            this.placeholderText = anonymizedText;
            this.renderOutput();
            document.getElementById('reviewSection').hidden = false;
            
            const entityCount = this.entityManager.exportEntities().length;
            this.uiController.showSuccess(`Found ${entityCount} unique details. Review the result before sharing.`);
            
        } catch (error) {
            console.error('Anonymization error:', error);
            // Do NOT fall back to regex on AI error - show the error clearly
            if (runVersion !== this.runVersion) return;
            this.placeholderText = '';
            document.getElementById('outputText').value = '';
            document.getElementById('copyOutputBtn').disabled = true;
            this.uiController.showError('Detection failed. Your input is unchanged. Retry or use Quick scan: ' + error.message);
        } finally {
            this.isProcessing = false;
            this.updateInputState();
            this.uiController.showProcessing(false);
        }
    }

    /**
     * Register AI-detected entities with the EntityManager
     * This bridges the AI model output format to the existing entity management system
     *
     * @param {Array} replacements - Array of {original, placeholder, activation} from AI
     */
    registerAIEntities(replacements) {
        replacements.forEach(replacement => {
            // Extract the index from typed placeholders such as [EMAIL_1] or [PII_1]
            const indexMatch = replacement.placeholder.match(/_(\d+)\]/);
            const index = indexMatch ? parseInt(indexMatch[1]) : 1;
            const entityType = replacement.type || 'PII';
            
            // Register with entity manager
            this.entityManager.entityMap.set(replacement.placeholder, {
                original: replacement.original,
                type: entityType,
                index: index,
                isActive: true,
                confidence: replacement.activation
            });
            this.entityManager.reverseLookup.set(replacement.original, replacement.placeholder);
            
            // Update counter
            if (!this.entityManager.entityCounters[entityType]) {
                this.entityManager.entityCounters[entityType] = 0;
            }
            this.entityManager.entityCounters[entityType] = Math.max(
                this.entityManager.entityCounters[entityType],
                index
            );
        });
    }



    processWithRegex(text) {
        const allMatches = [];
        const occupiedRanges = [];
        
        // German/French stopwords that commonly start with capital letters
        // and should NOT be detected as person names
        const germanStopwords = new Set([
            'Ich', 'Du', 'Er', 'Sie', 'Es', 'Wir', 'Ihr', 'Mein', 'Meine', 'Meiner', 'Meinem', 'Meinen',
            'Dein', 'Deine', 'Deiner', 'Deinem', 'Deinen', 'Sein', 'Seine', 'Seiner', 'Seinem', 'Seinen',
            'Ihre', 'Ihrer', 'Ihrem', 'Ihren', 'Unser', 'Unsere', 'Unserer', 'Unserem', 'Unseren',
            'Euer', 'Eure', 'Eurer', 'Eurem', 'Euren', 'Dieser', 'Diese', 'Dieses', 'Diesem', 'Diesen',
            'Jener', 'Jene', 'Jenes', 'Jenem', 'Jenen', 'Welcher', 'Welche', 'Welches', 'Welchem', 'Welchen',
            'Der', 'Die', 'Das', 'Dem', 'Den', 'Des', 'Ein', 'Eine', 'Eines', 'Einem', 'Einen', 'Einer',
            'Und', 'Oder', 'Aber', 'Denn', 'Weil', 'Wenn', 'Dass', 'Ob', 'Als', 'Wie', 'Bis', 'Seit',
            'Vor', 'Nach', 'Für', 'Mit', 'Von', 'Aus', 'Bei', 'Über', 'Unter', 'Zwischen', 'Neben',
            'Sehr', 'Viel', 'Mehr', 'Noch', 'Schon', 'Auch', 'Nur', 'Nicht', 'Kein', 'Keine', 'Keiner',
            'Hier', 'Dort', 'Heute', 'Morgen', 'Gestern', 'Jetzt', 'Dann', 'Bitte', 'Danke',
            'Bitte', 'Guten', 'Gute', 'Guter', 'Gutem', 'Gutes',
            'Jahren', 'Jahr', 'Tage', 'Tagen', 'Wochen', 'Monate', 'Monaten',
            'Kunde', 'Kunden', 'Konto', 'Konten', 'Rechnung', 'Rechnungen',
            'Fahrzeug', 'Fahrzeuge', 'Fahrzeugen', 'Auto', 'Autos',
            'Diabetes', 'Krebs', 'Asthma', 'Allergie', 'Typ',
            'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag',
            'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
            'Anfrage', 'Betreff', 'Datum', 'Anhang', 'Absender', 'Empfänger',
            'Kundendienst', 'Support', 'Versicherung', 'Versicherungsnummer',
            'Versandapotheke', 'Apotheke', 'Lieferung', 'Präparate', 'Verordnung',
            'Kostengutsprache', 'Abrechnung', 'Prämie',
            'Mobiltelefon', 'Telefon', 'Geschäftsnummer', 'Rückruf', 'Rückfragen',
            'Buchhalter', 'Sitzungen', 'Arbeit',
            'Kennzeichen', 'Zusatzversichert',
            'Freundliche', 'Grüsse', 'Grüße',
            'Enthaltene', 'Kategorien',
            'Drittperson', 'Ärztin', 'Arzt',
            'Krankenversicherungspolice', 'Krankenversicherung', 'Krankenkasse',
            'Unstimmigkeit', 'Angelegenheit',
            'Name', 'Geburtsdatum', 'Geburtsort', 'Adresse', 'Beruf', 'Arbeitgeber',
            'Gesundheitsdaten', 'Telefonnummer',
            'Text', 'Textil', 'Behandelnder',
            'Allerdings', 'Alternativ', 'Ebenfalls', 'Gleichzeitig', 'Baldmöglichst',
            'Damen', 'Herren', 'Herrn',
            'Leitender', 'Leitende',
            'Tagsüber', 'Deshalb',
            'Enthielt', 'Erhalten', 'Erreichbar',
            'Jedoch', 'Regelmässig', 'Regelmäßig',
            'Vollständige', 'Vollständig',
            'Bereits', 'Darüber', 'Ausgestellt', 'Nachreichen',
            'Prüfen', 'Kontaktieren',
            'Korrekt', 'Abgerechnet',
            'Kundennummer', 'Vertragsnummer', 'Referenznummer', 'Rechnungsnummer', 'Policennummer',
            'Hausarzt', 'Hausärztin', 'Zahnarzt', 'Zahnärztin', 'Facharzt', 'Fachärztin',
            'Praxis', 'Klinik', 'Spital', 'Krankenhaus', 'Postfach',
            'Geehrte', 'Geehrter', 'Geehrtes', 'Betreffend', 'Anbei', 'Beiliegend', 'Hiermit',
            'Vielen', 'Herzliche', 'Herzlichen', 'Beste', 'Besten', 'Liebe', 'Lieber',
            'Rückerstattung', 'Behandlung', 'Termin', 'Unterlagen', 'Dokumente'
        ]);
        
        // Helper function to check if a PERSON_NAME match is likely a false positive
        const isNameFalsePositive = (matchText) => {
            const words = matchText.trim().split(/\s+/);
            // If all words in the match are stopwords, it's a false positive
            return words.every(word => {
                // Also check hyphenated parts
                const parts = word.split('-');
                return parts.every(part => germanStopwords.has(part));
            });
        };
        
        // Overlap check against accepted ranges, kept sorted by start position
        // so a binary search replaces the former O(n^2) linear scan.
        const findInsertIndex = (start) => {
            let lo = 0, hi = occupiedRanges.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                if (occupiedRanges[mid].start < start) lo = mid + 1;
                else hi = mid;
            }
            return lo;
        };
        const hasOverlap = (start, end) => {
            const idx = findInsertIndex(start);
            // Neighbor on the left may reach into [start, end); neighbor on the
            // right may begin before end.
            if (idx > 0 && occupiedRanges[idx - 1].end > start) return true;
            if (idx < occupiedRanges.length && occupiedRanges[idx].start < end) return true;
            return false;
        };
        const occupy = (start, end) => {
            occupiedRanges.splice(findInsertIndex(start), 0, { start, end });
        };

        // Sort patterns by priority, skipping disabled categories
        const sortedPatterns = Object.entries(entityPatterns)
            .filter(([type]) => this.isCategoryEnabled(ENTITY_CATEGORIES[type]))
            .sort((a, b) => a[1].priority - b[1].priority);

        // First pass: collect ALL matches from all patterns
        for (const [type, config] of sortedPatterns) {
            const matches = [...text.matchAll(config.pattern)];

            for (const match of matches) {
                const matchText = match[0];

                // Filter out false positive person names
                if ((type === 'PERSON_NAME' || type === 'PERSON_FULL') && isNameFalsePositive(matchText)) {
                    continue;
                }

                // For patterns that use leading whitespace/punctuation in lookahead,
                // trim leading whitespace from the match for cleaner output
                let startPos = match.index;
                let cleanText = matchText;
                if (type === 'CH_PHONE_MOBILE' || type === 'CH_PHONE_LANDLINE' || type === 'CH_POSTAL_CODE') {
                    const leadingWhitespace = cleanText.match(/^[\s,(]+/);
                    if (leadingWhitespace) {
                        startPos += leadingWhitespace[0].length;
                        cleanText = cleanText.substring(leadingWhitespace[0].length);
                    }
                }

                // A "person" containing an organization keyword is a company
                // (Zürcher Kantonalbank, Praxis Sonnenhof, ...): fix the label.
                let finalType = type;
                if ((type === 'PERSON_NAME' || type === 'PERSON_FULL' || type === 'PERSON_TITLE') &&
                    ORG_KEYWORD_RE.test(cleanText)) {
                    finalType = 'COMPANY';
                }

                allMatches.push({
                    text: cleanText,
                    type: finalType,
                    startPos: startPos,
                    endPos: startPos + cleanText.length,
                    priority: config.priority
                });
            }
        }

        // Sort all matches by priority first (lower = higher priority), then by position
        allMatches.sort((a, b) => a.priority - b.priority || a.startPos - b.startPos);

        // Second pass: process matches in priority order, checking for overlaps
        const entities = [];
        for (const match of allMatches) {
            // Check if this position overlaps with already accepted entities
            if (!hasOverlap(match.startPos, match.endPos)) {
                entities.push({
                    text: match.text,
                    type: match.type,
                    startPos: match.startPos,
                    endPos: match.endPos
                });

                // Mark this range as occupied
                occupy(match.startPos, match.endPos);
            }
        }

        // Sort final entities by position for correct output order
        entities.sort((a, b) => a.startPos - b.startPos);

        return entities;
    }

    isCategoryEnabled(category) {
        if (!category) return true;
        return this.enabledCategories[category] !== false;
    }

    applyAnonymization(text, entities) {
        // First, generate placeholders in text order (forward)
        const entityPlaceholders = new Map();
        entities.forEach(entity => {
            const placeholder = this.entityManager.generatePlaceholder(entity.type, entity.text);
            entityPlaceholders.set(entity, placeholder);
        });

        // Then sort entities by position (reverse order for replacement to avoid position shifting)
        entities.sort((a, b) => b.startPos - a.startPos);

        let result = text;
        for (const entity of entities) {
            const placeholder = entityPlaceholders.get(entity);
            const displayText = placeholder;
            result = result.substring(0, entity.startPos) +
                     displayText +
                     result.substring(entity.endPos);
        }

        return result;
    }

    removeEntity(placeholder) {
        const entity = this.entityManager.getEntity(placeholder);
        if (!entity) return;
        this.placeholderText = this.placeholderText.split(placeholder).join(entity.original);
        this.entityManager.entityMap.delete(placeholder);
        this.entityManager.reverseLookup.delete(entity.original);
        this.renderOutput();
        this.uiController.showInfo('Removed this match. Its original text is visible again.');
    }

    deanonymizeText() {
        const llmInputText = document.getElementById('llmInput').value;
        if (!llmInputText) {
            this.uiController.showError('Please enter LLM output text to deanonymize');
            return;
        }

        let deanonymizedText = llmInputText;
        let replacedCount = 0;

        // Replace typed placeholders like [PERSON_1], [EMAIL_2] in ONE pass
        // with a combined alternation regex (instead of one scan per entity).
        const activeEntries = Array.from(this.entityManager.entityMap.entries())
            .filter(([, entity]) => entity.isActive);
        if (activeEntries.length > 0) {
            const lookup = new Map(activeEntries.map(([ph, entity]) => [ph, entity.original]));
            const combined = new RegExp(
                activeEntries
                    .map(([ph]) => ph.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
                    .join('|'),
                'g'
            );
            deanonymizedText = deanonymizedText.replace(combined, match => {
                replacedCount++;
                return lookup.get(match);
            });
        }

        document.getElementById('llmOutput').value = deanonymizedText;
        const unresolved = (llmInputText.match(/\[redacted\]|\[[A-Z][A-Z0-9_]*_\d+\]/g) || []).filter(token => token === '[redacted]' || !activeEntries.some(([key]) => key === token)).length;
        if (unresolved) this.uiController.showInfo(`Restored ${replacedCount} value(s). ${unresolved} unresolved marker(s) left unchanged. Generic redactions cannot be restored.`);
        else if (replacedCount) this.uiController.showSuccess(`Restored ${replacedCount} value(s).`);
        else this.uiController.showInfo('No matching placeholders found. Import the original mapping if needed.');
    }

    anonymizeHighlighted() {
        const field = document.getElementById('outputText');
        const start = field.selectionStart;
        const end = field.selectionEnd;
        if (this.isProcessing || document.getElementById('inputText').value !== this.sourceText) {
            this.uiController.showInfo('Run Anonymize again before selecting text.');
            return;
        }
        if (start === end) {
            this.uiController.showInfo('Please select text to anonymize.');
            return;
        }

        // Display offsets differ from stored offsets in redacted and unchecked text.
        let displayOffset = 0;
        let sourceOffset = 0;
        for (const part of this.placeholderText.split(/(\[[A-Z][A-Z0-9_]*_\d+\])/g)) {
            const entity = this.entityManager.getEntity(part);
            const isPlaceholder = /^\[[A-Z][A-Z0-9_]*_\d+\]$/.test(part);
            const displayed = entity ? (!entity.isActive ? entity.original : this.isRedactMode ? '[redacted]' : part) : part;
            if (!isPlaceholder && start >= displayOffset && end <= displayOffset + displayed.length) {
                const selected = displayed.slice(start - displayOffset, end - displayOffset);
                const token = this.entityManager.generatePlaceholder('CUSTOM', selected);
                this.entityManager.getEntity(token).isActive = true;
                const sourceStart = sourceOffset + start - displayOffset;
                const sourceEnd = sourceOffset + end - displayOffset;
                this.placeholderText = this.placeholderText.slice(0, sourceStart) + token + this.placeholderText.slice(sourceEnd);
                this.renderOutput();
                this.uiController.showSuccess('Selected text anonymized.');
                return;
            }
            displayOffset += displayed.length;
            sourceOffset += part.length;
        }
        this.uiController.showInfo('Select text outside existing placeholders. Use the trash icon to remove an existing match.');
    }

    async loadFile(file) {
        // Validate file
        const validation = this.fileProcessor.validateFile(file);
        if (!validation.isValid) {
            this.uiController.showError(validation.error);
            return;
        }

        try {
            this.uiController.showLoading(true, 'Loading file...');
            const text = await this.fileProcessor.processFile(file);
            document.getElementById('inputText').value = text;
            this.updateInputState();
            this.uiController.showLoading(false);
            this.uiController.showSuccess(`File loaded successfully: ${file.name}`);
        } catch (error) {
            this.uiController.showLoading(false);
            this.uiController.showError(`Failed to load file: ${error.message}`);
        }
    }

    exportEntities() {
        const entities = this.entityManager.exportEntities();
        
        if (entities.length === 0) {
            this.uiController.showError('No entities to export');
            return;
        }

        const csv = this.convertToCSV(entities);
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anonymizer_entities_${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.uiController.showSuccess('Entities exported successfully');
    }

    convertToCSV(entities) {
        const headers = ['Placeholder', 'Original', 'Type', 'Active'];
        const rows = entities.map(e => [
            e.placeholder,
            e.original,
            e.type,
            e.active
        ]);

        // RFC 4180: double inner quotes; values may contain commas/newlines.
        // Cells starting with =+-@ get a leading apostrophe so spreadsheet apps
        // don't execute them as formulas (stripped again on import).
        const escapeCell = (cell) => {
            let value = String(cell);
            if (/^[=+\-@]/.test(value)) value = "'" + value;
            return '"' + value.replace(/"/g, '""') + '"';
        };

        return [headers, ...rows]
            .map(row => row.map(escapeCell).join(','))
            .join('\n');
    }

    async importEntities(file) {
        try {
            this.uiController.showLoading(true, 'Importing entities...');
            const text = await file.text();
            const entities = this.parseCSV(text);
            this.entityManager.importEntities(entities);
            this.placeholderText = '';
            document.getElementById('outputText').value = '';
            document.getElementById('copyOutputBtn').disabled = true;
            document.getElementById('restoreDetails').scrollIntoView({ block: 'start' });
            this.uiController.updateEntityList(entities);
            this.uiController.showLoading(false);
            this.uiController.showSuccess(`Imported ${entities.length} entities`);
        } catch (error) {
            this.uiController.showLoading(false);
            this.uiController.showError('Failed to import entities: ' + error.message);
        }
    }

    parseCSV(csvText) {
        // Full RFC 4180 parser: handles "" escapes and commas/newlines inside
        // quoted fields (the old regex parser corrupted such values).
        const rows = [];
        let row = [];
        let field = '';
        let inQuotes = false;

        for (let i = 0; i < csvText.length; i++) {
            const char = csvText[i];
            if (inQuotes) {
                if (char === '"') {
                    if (csvText[i + 1] === '"') { field += '"'; i++; }
                    else inQuotes = false;
                } else {
                    field += char;
                }
            } else if (char === '"') {
                inQuotes = true;
            } else if (char === ',') {
                row.push(field);
                field = '';
            } else if (char === '\n' || char === '\r') {
                if (char === '\r' && csvText[i + 1] === '\n') i++;
                row.push(field);
                field = '';
                if (row.length > 1 || row[0] !== '') rows.push(row);
                row = [];
            } else {
                field += char;
            }
        }
        row.push(field);
        if (row.length > 1 || row[0] !== '') rows.push(row);

        // Strip the formula-injection guard added on export
        const unguard = value => value.replace(/^'(?=[=+\-@])/, '');

        return rows.slice(1)
            .filter(values => values.length >= 4 && /^\[.+_\d+\]$/.test(values[0].trim()))
            .map(values => ({
                placeholder: values[0].trim(),
                original: unguard(values[1]),
                type: values[2].trim(),
                active: values[3].trim() === 'true'
            }));
    }

    processLlmOutput() {
        // This method is now deprecated - functionality moved to deanonymizeText()
        // Redirect to deanonymizeText for backward compatibility
        this.deanonymizeText();
    }

    clearInput() {
        this.runVersion++;
        document.getElementById('inputText').value = '';
        document.getElementById('outputText').value = '';
        document.getElementById('llmInput').value = '';
        document.getElementById('llmOutput').value = '';
        this.entityManager.clear();
        this.placeholderText = '';
        this.uiController.updateEntityList([]);
        this.refreshHighlightView();
        this.sourceText = '';
        document.getElementById('reviewSection').hidden = false;
        document.getElementById('copyOutputBtn').disabled = true;
        this.uiController.showInfo('All fields cleared');
    }

    async copyOutput() {
        if (this.isProcessing || document.getElementById('inputText').value !== this.sourceText) {
            this.uiController.showInfo('Run Anonymize again before copying the updated text.');
            return;
        }
        const outputText = document.getElementById('outputText');
        if (!outputText.value) {
            this.uiController.showError('No text to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(outputText.value);
        } catch (error) {
            // Fallback for older browsers / denied permission
            outputText.select();
            document.execCommand('copy');
        }
        this.uiController.showSuccess('Copied to clipboard');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AnonymizerApp();
});
