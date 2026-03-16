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
        pattern: /\b(?:Mr\.?|Mrs\.?|Miss|Ms\.?|Sir|Madam|Dr\.?\s?med\.?|Dr\.?\s?phil\.?|Dr\.?\s?jur\.?|Dr\.?\s?rer\.?\s?nat\.?|Dr\.?|Professor|Prof\.?\s?Dr\.?|Prof\.?|Herr|Frau|lic\.?\s?iur\.?|lic\.?\s?phil\.?|Reverend|Rev\.?|Captain|Capt\.?|Colonel|Col\.?|Lieutenant|Lt\.?|Sergeant|Sgt\.?|Officer|Officer\.?|Judge|Justice|Honorable|Hon\.?|Senator|Sen\.?|Rep\.?|Mayor|President|Pres\.?|Vice President|VP|CEO|CFO|CTO|Director|Officer|Chief)\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]+(?:-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]+)?(?:\s+[A-ZÀ-ÖØ-Þ]\.?)?(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]+(?:-[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿß]+)?)?\b/gi,
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
        pattern: /\b(?:[A-Za-z0-9&.'-]+\s+){0,3}[A-Za-z0-9&.'-]+(?:,?\s*)(?:LLC|L\.L\.C\.|Ltd\.?|Inc\.?|Corp\.?|GmbH|PLC|LP|L\.P\.|LLP|L\.L\.P\.|GP|G\.P\.|DAO|SA|Foundation|Association|Cooperative|Corporation|Incorporated|Limited Company|Financial Group|& Co\.|& Partners|Limited Liability Company|Limited Partnership|Limited Liability Partnership|Sociedad Anonima|S\.A\.|S\.A\.S\.|S\.A\.S\.S\.)\b/gi,
        priority: 32
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
        pattern: /\b[A-HJ-NPR-Z0-9]{17}\b/g,
        priority: 36
    },
    LICENSE: {
        pattern: /\b(?:(?:DL|Driver's?\s+License|License|ID|Identification)\s*:?\s*)?(?:[A-Z]{1,3}\d{6,18}|\d{6,18}|[A-Z]{7}\*\d{3})\b/gi,
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
    MEDICAL_RECORD: {
        pattern: /\b[A-Z]{0,2}\d{6,10}\b/g,
        priority: 40
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
    EMAIL_RFC5322: {
        pattern: /[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+\/=?^_`{|}~-]+)*@(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?/g,
        priority: 47
    },
    EMAIL_SIMPLE: {
        pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
        priority: 48
    },
    IP_ADDRESS_IPV4: {
        pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
        priority: 49
    },
    IP_ADDRESS_IPV6_COMPRESSED: {
        pattern: /\b(?:(?:[A-F0-9]{1,4}:)*)?::(?:(?:[A-F0-9]{1,4}:)*[A-F0-9]{1,4})?\b/gi,
        priority: 50
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

class AnonymizerApp {
    constructor() {
        this.entityManager = new EntityManager();
        this.aiProcessor = new AIModelProcessor();
        this.fileProcessor = new FileProcessor();
        this.uiController = new UIController();
        
        this.currentMode = 'regex';
        this.isProcessing = false;
        this.isRedactMode = false;
        
        this.initializeApp();
    }

    async initializeApp() {
        // Set up event listeners
        this.setupEventListeners();
        
        // Initialize UI
        this.uiController.initialize();
        
        // Set up drag and drop
        this.setupDragAndDrop();
        
        console.log('Anonymizer initialized successfully');
    }

    setupEventListeners() {
        // Model selection
        document.getElementById('modelSelect').addEventListener('change', async (e) => {
            await this.switchModel(e.target.value);
        });

        // Anonymize button
        document.getElementById('anonymizeBtn').addEventListener('click', async () => {
            this.isRedactMode = false;
            await this.anonymizeText();
        });

        // Redact Mode button
        document.getElementById('redactBtn').addEventListener('click', async () => {
            this.isRedactMode = true;
            await this.anonymizeText();
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
        this.currentMode = modelType;
        
        if (modelType !== 'regex') {
            try {
                this.uiController.showLoading(true, `Loading ${modelType} model...`);
                await this.aiProcessor.loadModel(modelType);
                this.uiController.showLoading(false);
                this.uiController.showSuccess('AI model loaded successfully');
            } catch (error) {
                // IMPORTANT: Do NOT silently fall back to regex
                // Show error and reset to regex mode explicitly
                this.uiController.showError('Failed to load AI model. Please try again or use Quick Scan.');
                this.currentMode = 'regex';
                document.getElementById('modelSelect').value = 'regex';
                this.uiController.showLoading(false);
            }
        }
    }

    async anonymizeText() {
        if (this.isProcessing) return;
        
        const inputText = document.getElementById('inputText').value;
        if (!inputText.trim()) {
            this.uiController.showError('Please enter text to anonymize');
            return;
        }

        this.isProcessing = true;
        this.uiController.showProcessing(true);
        this.entityManager.clear();

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
                
                // AI returns pre-masked text and replacements directly
                // The maskedText already contains [PII_N] placeholders
                anonymizedText = aiResult.maskedText;
                
                // Register entities with EntityManager for deanonymization
                this.registerAIEntities(aiResult.replacements);
                
                // Note: No regex fallback - if AI found nothing, that's the result
                if (aiResult.replacements.length === 0) {
                    this.uiController.showInfo('AI model detected no sensitive information in the text');
                }
            }
            
            // Update UI
            document.getElementById('outputText').value = anonymizedText;
            this.uiController.updateEntityList(this.entityManager.exportEntities());
            
            const entityCount = this.entityManager.exportEntities().length;
            this.uiController.showSuccess(`Anonymization complete! Detected ${entityCount} entities`);
            
        } catch (error) {
            console.error('Anonymization error:', error);
            // Do NOT fall back to regex on AI error - show the error clearly
            this.uiController.showError('Anonymization failed: ' + error.message);
        } finally {
            this.isProcessing = false;
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
            // Extract the index from [PII_N] format
            const indexMatch = replacement.placeholder.match(/_(\d+)\]/);
            const index = indexMatch ? parseInt(indexMatch[1]) : 1;
            
            // Register with entity manager
            this.entityManager.entityMap.set(replacement.placeholder, {
                original: replacement.original,
                type: 'PII', // AI model uses generic PII type
                index: index,
                isActive: true,
                confidence: replacement.activation
            });
            this.entityManager.reverseLookup.set(replacement.original, replacement.placeholder);
            
            // Update counter
            if (!this.entityManager.entityCounters['PII']) {
                this.entityManager.entityCounters['PII'] = 0;
            }
            this.entityManager.entityCounters['PII'] = Math.max(
                this.entityManager.entityCounters['PII'],
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
            'Korrekt', 'Abgerechnet'
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
        
        // Helper function to check if a range overlaps with existing ranges
        const hasOverlap = (start, end) => {
            return occupiedRanges.some(range => {
                return !(end <= range.start || start >= range.end);
            });
        };
        
        // Sort patterns by priority
        const sortedPatterns = Object.entries(entityPatterns)
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
                
                allMatches.push({
                    text: cleanText,
                    type: type,
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
                occupiedRanges.push({ start: match.startPos, end: match.endPos });
            }
        }
        
        // Sort final entities by position for correct output order
        entities.sort((a, b) => a.startPos - b.startPos);
        
        return entities;
    }

    applyAnonymization(text, entities) {
        // First, generate placeholders in text order (forward)
        const entityPlaceholders = new Map();
        entities.forEach(entity => {
            let placeholder;
            if (this.isRedactMode) {
                // In redact mode, still generate unique placeholders internally
                // but they will all be replaced with [redacted]
                placeholder = this.entityManager.generatePlaceholder(entity.type, entity.text);
            } else {
                placeholder = this.entityManager.generatePlaceholder(entity.type, entity.text);
            }
            entityPlaceholders.set(entity, placeholder);
        });
        
        // Then sort entities by position (reverse order for replacement to avoid position shifting)
        entities.sort((a, b) => b.startPos - a.startPos);
        
        let result = text;
        for (const entity of entities) {
            const placeholder = entityPlaceholders.get(entity);
            const displayText = this.isRedactMode ? '[redacted]' : placeholder;
            result = result.substring(0, entity.startPos) +
                     displayText +
                     result.substring(entity.endPos);
        }
        
        return result;
    }

    removeEntity(placeholder) {
        const entity = this.entityManager.getEntity(placeholder);
        if (!entity) return;

        // Restore the entity in the output text
        const outputTextArea = document.getElementById('outputText');
        if (outputTextArea.value) {
            const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            outputTextArea.value = outputTextArea.value.replace(regex, entity.original);
        }

        // Remove from entity manager
        this.entityManager.entityMap.delete(placeholder);
        this.entityManager.reverseLookup.delete(entity.original);

        // Update UI
        this.uiController.updateEntityList(this.entityManager.exportEntities());
        this.uiController.showSuccess('Entity removed and restored in output');
    }

    deanonymizeText() {
        const llmInputText = document.getElementById('llmInput').value;
        if (!llmInputText) {
            this.uiController.showError('Please enter LLM output text to deanonymize');
            return;
        }

        let deanonymizedText = llmInputText;
        let replacedCount = 0;
        
        // Replace typed placeholders like [PERSON_1], [EMAIL_2], etc.
        this.entityManager.entityMap.forEach((entity, placeholder) => {
            if (entity.isActive) {
                const regex = new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                const matches = deanonymizedText.match(regex);
                if (matches) {
                    deanonymizedText = deanonymizedText.replace(regex, entity.original);
                    replacedCount += matches.length;
                }
            }
        });
        
        // Handle [redacted] replacements - replace each occurrence with corresponding entity
        if (deanonymizedText.includes('[redacted]')) {
            // Get all active entities in order
            const activeEntities = Array.from(this.entityManager.entityMap.entries())
                .filter(([placeholder, entity]) => entity.isActive)
                .sort((a, b) => {
                    // Sort by placeholder to maintain consistent order
                    return a[0].localeCompare(b[0]);
                });
            
            // Replace [redacted] one by one with corresponding entities
            activeEntities.forEach(([placeholder, entity]) => {
                if (deanonymizedText.includes('[redacted]')) {
                    deanonymizedText = deanonymizedText.replace('[redacted]', entity.original);
                    replacedCount++;
                }
            });
        }
        
        document.getElementById('llmOutput').value = deanonymizedText;
        this.uiController.showSuccess(`Text deanonymized successfully! Replaced ${replacedCount} entities`);
    }

    anonymizeHighlighted() {
        const outputTextArea = document.getElementById('outputText');
        const selectedText = outputTextArea.value.substring(
            outputTextArea.selectionStart,
            outputTextArea.selectionEnd
        );
        
        if (!selectedText) {
            this.uiController.showError('Please select text to anonymize');
            return;
        }

        // Generate placeholder for selected text
        const placeholder = this.entityManager.generatePlaceholder('CUSTOM', selectedText);
        const displayText = this.isRedactMode ? '[redacted]' : placeholder;
        
        // Replace in output
        const newText = outputTextArea.value.substring(0, outputTextArea.selectionStart) +
                       displayText +
                       outputTextArea.value.substring(outputTextArea.selectionEnd);
        
        outputTextArea.value = newText;
        this.uiController.updateEntityList(this.entityManager.exportEntities());
        this.uiController.showSuccess('Selected text ' + (this.isRedactMode ? 'redacted' : 'anonymized'));
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
        
        return [headers, ...rows]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\n');
    }

    async importEntities(file) {
        try {
            this.uiController.showLoading(true, 'Importing entities...');
            const text = await file.text();
            const entities = this.parseCSV(text);
            this.entityManager.importEntities(entities);
            this.uiController.updateEntityList(entities);
            this.uiController.showLoading(false);
            this.uiController.showSuccess(`Imported ${entities.length} entities`);
        } catch (error) {
            this.uiController.showLoading(false);
            this.uiController.showError('Failed to import entities: ' + error.message);
        }
    }

    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        return lines.slice(1)
            .filter(line => line.trim())
            .map(line => {
                const values = line.match(/(".*?"|[^,]+)/g)
                    .map(v => v.replace(/"/g, '').trim());
                
                return {
                    placeholder: values[0],
                    original: values[1],
                    type: values[2],
                    active: values[3] === 'true'
                };
            });
    }

    processLlmOutput() {
        // This method is now deprecated - functionality moved to deanonymizeText()
        // Redirect to deanonymizeText for backward compatibility
        this.deanonymizeText();
    }

    clearInput() {
        document.getElementById('inputText').value = '';
        document.getElementById('outputText').value = '';
        document.getElementById('llmInput').value = '';
        document.getElementById('llmOutput').value = '';
        this.entityManager.clear();
        this.uiController.updateEntityList([]);
        this.uiController.showInfo('All fields cleared');
    }

    copyOutput() {
        const outputText = document.getElementById('outputText');
        if (!outputText.value) {
            this.uiController.showError('No text to copy');
            return;
        }
        
        outputText.select();
        document.execCommand('copy');
        this.uiController.showSuccess('Copied to clipboard');
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new AnonymizerApp();
});