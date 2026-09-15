const SITE_ORIGIN = 'https://asd123.ai';

const redirects = {
  '/index.html': '/',
  '/text-cleaner.html': '/text-cleaner',
  '/anonymizer.html': '/anonymizer',
  '/chat.html': '/chat',
  '/context.html': '/context',
  '/converter.html': '/converter',
  '/tts.html': '/tts',
  '/documentation.html': '/documentation',
  '/about.html': '/about',
  '/contact.html': '/contact',
  '/privacy.html': '/privacy',
  '/terms.html': '/terms',
  '/anonymizer-guide.html': '/anonymizer-guide',
  '/chat-guide.html': '/chat-guide',
  '/context-guide.html': '/context-guide',
  '/converter-guide.html': '/converter-guide',
  '/tts-guide.html': '/tts-guide',
  '/text-cleaner-guide.html': '/text-cleaner-guide',
  '/apps.html': '/apps',
  '/rdp123.html': '/rdp123',
  '/photo-shot.html': '/photo-shot',
  '/rustquit.html': '/rustquit',
  '/convert-pdf-to-markdown.html': '/convert-pdf-to-markdown',
  '/clean-chatgpt-text.html': '/clean-chatgpt-text',
  '/anonymize-text-for-ai.html': '/anonymize-text-for-ai',
  '/count-tokens-offline.html': '/count-tokens-offline',
  '/run-ai-chat-locally.html': '/run-ai-chat-locally',
  '/private-text-to-speech.html': '/private-text-to-speech',
  // The Optimizer was renamed to Text Cleaner. Keep the old URLs redirecting so
  // existing links and search results do not break.
  '/optimizer': '/text-cleaner',
  '/optimizer.html': '/text-cleaner',
  '/optimizer-guide': '/text-cleaner-guide',
  '/optimizer-guide.html': '/text-cleaner-guide'
};

const cleanUrls = {
  '/text-cleaner': '/text-cleaner.html',
  '/anonymizer': '/anonymizer.html',
  '/chat': '/chat.html',
  '/context': '/context.html',
  '/converter': '/converter.html',
  '/tts': '/tts.html',
  '/documentation': '/documentation.html',
  '/about': '/about.html',
  '/contact': '/contact.html',
  '/privacy': '/privacy.html',
  '/terms': '/terms.html',
  '/anonymizer-guide': '/anonymizer-guide.html',
  '/chat-guide': '/chat-guide.html',
  '/context-guide': '/context-guide.html',
  '/converter-guide': '/converter-guide.html',
  '/tts-guide': '/tts-guide.html',
  '/text-cleaner-guide': '/text-cleaner-guide.html',
  '/apps': '/apps.html',
  '/rdp123': '/rdp123.html',
  '/photo-shot': '/photo-shot.html',
  '/rustquit': '/rustquit.html',
  '/convert-pdf-to-markdown': '/convert-pdf-to-markdown.html',
  '/clean-chatgpt-text': '/clean-chatgpt-text.html',
  '/anonymize-text-for-ai': '/anonymize-text-for-ai.html',
  '/count-tokens-offline': '/count-tokens-offline.html',
  '/run-ai-chat-locally': '/run-ai-chat-locally.html',
  '/private-text-to-speech': '/private-text-to-speech.html'
};

const skillArtifacts = {
  'text-cleaner': `# ASD123.ai Text Cleaner

Use this skill when an agent needs to clean, normalize, or standardize text with ASD123.ai in the browser.

## Capabilities

- Remove Markdown formatting from generated text
- Remove citation references
- Normalize fancy Unicode text
- Normalize target line endings for Auto, Windows, Linux, and macOS
- Remove invisible characters and character-based watermarks (4,275 code points: zero-width, bidi controls, tag characters, variation selectors, Unicode noncharacters, reserved default-ignorable ranges, unusual spaces), emoji-safe and script-aware, with space folding separately switchable so French and German typography survives
- Apply character mapping in five switchable groups (hyphens and dashes, quotation marks, apostrophes, bullets/ellipses/symbols, PDF ligatures), plus optional ae/oe spelling, sharp s to ss, and French spacing
- Remove diacritics, with a switch for the ae/oe/ue digraph convention
- One-click presets (ChatGPT/Claude, Perplexity/Research, Swiss Standardization, Paragraph Mode) and undo

## Privacy

All text processing runs locally in the browser. Text is not sent to ASD123.ai servers for processing.
`,
  'anonymizer': `# ASD123.ai Anonymizer

Use this skill when an agent needs to help a user anonymize or redact personally identifiable information in the ASD123.ai browser tool.

## Capabilities

- Regex-based local PII detection
- Optional OpenAI Privacy Filter model loaded through Hugging Face Transformers.js
- Legacy AI4Privacy proof-of-concept models
- Entity category filters, per-entity toggles, and an inline highlight view
- Numbered placeholder mappings for restoration; generic redactions cannot be restored
- Review individual matches and anonymize selected text manually
- CSV import and export of original-value mappings

## Privacy

Text, uploaded files, detected entities, and mappings remain in the local browser session. Optional AI modes download model files, but do not upload the user's text for processing.
`,
  'chat': `# ASD123.ai Local AI Chat

Use this skill when an agent needs to help a user work with the ASD123.ai Local AI Chat browser tool.

## Capabilities

- Browser-based WebGPU chat with supported ONNX models
- Local chat history in IndexedDB with rename and delete
- File and image attachments processed in the browser
- Editable user messages, copy and regenerate replies, Markdown export
- Context window control and graceful stop during generation

## Privacy

Prompts, uploaded files, chat history, and generated output remain in the user's browser. Online model loading may download model and runtime files, but the user's chat content is not sent to ASD123.ai servers for inference.
`,
  'context': `# ASD123.ai Context Estimator

Use this skill when an agent needs to help a user estimate an AI chat context window for text or local documents.

## Capabilities

- Estimate useful context windows for pasted text
- Extract TXT, DOCX, and PDF text locally in the browser
- Compare 4K, 8K, 16K, 32K, 64K, and 128K context sizes
- Apply lightweight model-family profiles instantly, no download needed
- Optional exact token count using the selected model family's real tokenizer
- Reserve answer and reasoning budget before recommending a window

## Privacy

Pasted text and uploaded file contents remain in the user's browser. The tool does not upload documents or store extracted text in server-side storage.
`,
  'converter': `# ASD123.ai Markdown Converter

Use this skill when an agent needs to help a user convert PDF, Word, PowerPoint, Excel, CSV, OpenDocument, RTF, EPUB, HTML, or image files to Markdown with the ASD123.ai browser converter.

## Capabilities

- Convert PDF files to Markdown with pdf-inspector (default, WebAssembly): tables, multi-column reading order, distinct heading levels, and detection of scanned pages that need OCR
- Alternative PDF engines: EdgeParse and LiteParse (both WebAssembly, high accuracy) and pdf.js (lightest, no extra download)
- OCR engine (PP-OCRv6 Tiny on onnxruntime-web) for scanned PDFs and image files (PNG, JPG, WebP, BMP) with no text layer
- Convert DOCX files to Markdown via mammoth.js style mapping
- Convert PPTX slides (including speaker notes), Excel/CSV tables, HTML pages, and plain text
- Optional anydoc engine (WebAssembly) for Office files, and the only path for OpenDocument (.odt/.ods/.odp), RTF, EPUB and legacy binary Office formats (.doc/.ppt/.xls variants). Never used for PDFs.
- Preserve bold, italic, links, lists, and tables for DOCX and HTML sources
- Convert several files at once into one combined Markdown document
- Toggle heading detection and whitespace collapsing
- Copy or download the resulting Markdown as a .md file, or send it to Text to Speech or directly to Anonymizer

## Privacy

PDF, DOCX, and image files are parsed entirely in the user's browser. Documents and generated Markdown remain on the user's device and are not transmitted to ASD123.ai.
`,
  'tts': `# ASD123.ai Text to Speech

Use this skill when an agent needs to help a user turn text into spoken audio with the ASD123.ai browser text-to-speech tool.

## Capabilities

- Generate natural speech from text locally with on-device models, no server inference
- Language-first selection: pick English, German, French, Spanish, or Italian, then a model that supports it (sorted by quality, with download size shown)
- Two models: Kokoro (highest quality; English with American and British voices, plus Spanish, French, and Italian; ~88-310 MB precision options) and Supertonic 3 (fast, multilingual; English, German, French, Spanish, Italian; ~380 MB, official ONNX via onnxruntime-web, language selected with a built-in language tag)
- Kokoro speaks English natively; for Spanish, French, and Italian it uses a one-time eSpeak NG pronunciation pack (~19 MB) to phonemize locally
- Adjust speaking speed before generating, plus a quality (inference steps) control for Supertonic
- Stop long generations at any time
- Play the audio in the browser, change playback speed, and download as WAV or locally encoded MP3

## Privacy

Text is processed entirely in the user's browser. Model files are downloaded from Hugging Face on first use and cached, and MP3 encoding runs locally with a self-hosted encoder, but the user's text and generated audio are not sent to ASD123.ai servers.
`
};

function jsonResponse(body, contentType = 'application/json') {
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'content-type': `${contentType}; charset=utf-8`,
      'cache-control': 'public, max-age=300'
    }
  });
}

function textResponse(body, contentType = 'text/plain') {
  return new Response(body, {
    headers: {
      'content-type': `${contentType}; charset=utf-8`,
      'cache-control': 'public, max-age=300'
    }
  });
}

async function sha256Digest(text) {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return `sha256:${[...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function agentSkillsIndex() {
  const skills = await Promise.all(Object.entries(skillArtifacts).map(async ([name, content]) => ({
    name,
    type: 'skill-md',
    description: name === 'text-cleaner'
      ? 'Clean and normalize text locally with the ASD123.ai Text Cleaner.'
      : name === 'chat'
        ? 'Chat with local WebGPU models in the ASD123.ai browser chat tool.'
        : name === 'context'
          ? 'Estimate AI chat context windows locally with the ASD123.ai Context Estimator.'
          : name === 'converter'
            ? 'Convert PDF, DOCX, PPTX, Excel, CSV, HTML, and image files to Markdown locally with the ASD123.ai Markdown Converter, including OCR for scans.'
            : name === 'tts'
              ? 'Generate natural speech from text locally with the ASD123.ai Text to Speech tool.'
              : 'Anonymize and redact PII locally with the ASD123.ai Anonymizer.',
    url: `${SITE_ORIGIN}/.well-known/agent-skills/${name}/SKILL.md`,
    digest: await sha256Digest(content)
  })));

  return jsonResponse({
    '$schema': 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills
  });
}

function apiCatalog() {
  return jsonResponse({
    linkset: [
      {
        anchor: `${SITE_ORIGIN}/.well-known`,
        'service-desc': [
          {
            href: `${SITE_ORIGIN}/.well-known/openapi.json`,
            type: 'application/vnd.oai.openapi+json'
          }
        ],
        'service-doc': [
          {
            href: `${SITE_ORIGIN}/documentation`,
            type: 'text/html'
          }
        ],
        status: [
          {
            href: `${SITE_ORIGIN}/.well-known/health`,
            type: 'application/json'
          }
        ]
      }
    ]
  }, 'application/linkset+json');
}

function openApiSpec() {
  return jsonResponse({
    openapi: '3.1.0',
    info: {
      title: 'ASD123.ai Discovery API',
      version: '1.0.0',
      description: 'Machine-readable discovery endpoints for ASD123.ai. User text processing remains client-side in the browser.'
    },
    servers: [
      { url: SITE_ORIGIN }
    ],
    paths: {
      '/.well-known/api-catalog': {
        get: {
          summary: 'API catalog',
          responses: {
            '200': {
              description: 'RFC 9727 API catalog',
              content: {
                'application/linkset+json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      },
      '/.well-known/agent-skills/index.json': {
        get: {
          summary: 'Agent skills discovery index',
          responses: {
            '200': {
              description: 'Agent Skills Discovery index',
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      },
      '/.well-known/health': {
        get: {
          summary: 'Health status',
          responses: {
            '200': {
              description: 'Service health',
              content: {
                'application/json': {
                  schema: { type: 'object' }
                }
              }
            }
          }
        }
      }
    }
  }, 'application/vnd.oai.openapi+json');
}

function oauthProtectedResource() {
  return jsonResponse({
    resource: SITE_ORIGIN,
    authorization_servers: [],
    scopes_supported: [],
    bearer_methods_supported: [],
    resource_documentation: `${SITE_ORIGIN}/documentation`,
    note: 'ASD123.ai currently exposes public browser tools and discovery metadata only. There are no protected APIs that require OAuth access tokens.'
  });
}

function oauthAuthorizationServerMetadata() {
  return jsonResponse({
    issuer: SITE_ORIGIN,
    authorization_endpoint: `${SITE_ORIGIN}/oauth/authorize`,
    token_endpoint: `${SITE_ORIGIN}/oauth/token`,
    jwks_uri: `${SITE_ORIGIN}/.well-known/jwks.json`,
    registration_endpoint: `${SITE_ORIGIN}/oauth/register`,
    service_documentation: `${SITE_ORIGIN}/documentation`,
    grant_types_supported: [],
    response_types_supported: [],
    scopes_supported: [],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: [],
    note: 'ASD123.ai currently has no protected APIs and no OAuth login flow. These endpoints are discovery placeholders so agents can determine that authentication is not required for the public browser tools.'
  });
}

function openIdConfiguration() {
  return jsonResponse({
    issuer: SITE_ORIGIN,
    authorization_endpoint: `${SITE_ORIGIN}/oauth/authorize`,
    token_endpoint: `${SITE_ORIGIN}/oauth/token`,
    jwks_uri: `${SITE_ORIGIN}/.well-known/jwks.json`,
    registration_endpoint: `${SITE_ORIGIN}/oauth/register`,
    response_types_supported: [],
    grant_types_supported: [],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: [],
    scopes_supported: [],
    claims_supported: [],
    token_endpoint_auth_methods_supported: ['none'],
    service_documentation: `${SITE_ORIGIN}/documentation`,
    note: 'ASD123.ai currently has no protected APIs and no OpenID Connect login flow. Public browser tools do not require authentication.'
  });
}

function jwks() {
  return jsonResponse({ keys: [] });
}

function mcpServerCard() {
  return jsonResponse({
    serverInfo: {
      name: 'ASD123.ai',
      version: '1.0.0',
      description: 'Privacy-first browser text tools. No remote MCP server is currently operated.'
    },
    transport: {
      type: 'none',
      endpoint: `${SITE_ORIGIN}/mcp`
    },
    capabilities: {
      tools: [],
      resources: [],
      prompts: []
    }
  });
}

// Named HTML entities used across the site, plus the handful every document
// relies on. Numeric entities are handled generically below.
const HTML_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  copy: '\u00A9', reg: '\u00AE', trade: '\u2122', deg: '\u00B0',
  mdash: '\u2014', ndash: '\u2013', minus: '\u2212', hellip: '\u2026',
  laquo: '\u00AB', raquo: '\u00BB', lsaquo: '\u2039', rsaquo: '\u203A',
  ldquo: '\u201C', rdquo: '\u201D', bdquo: '\u201E',
  lsquo: '\u2018', rsquo: '\u2019', sbquo: '\u201A',
  times: '\u00D7', frasl: '\u2044', middot: '\u00B7', bull: '\u2022',
  rarr: '\u2192', larr: '\u2190', harr: '\u2194',
  szlig: '\u00DF', aelig: '\u00E6', AElig: '\u00C6',
  oelig: '\u0153', OElig: '\u0152',
  auml: '\u00E4', ouml: '\u00F6', uuml: '\u00FC',
  Auml: '\u00C4', Ouml: '\u00D6', Uuml: '\u00DC',
  eacute: '\u00E9', egrave: '\u00E8', ecirc: '\u00EA',
  agrave: '\u00E0', ccedil: '\u00E7', ntilde: '\u00F1',
  Atilde: '\u00C3', curren: '\u00A4', sup2: '\u00B2', sup3: '\u00B3',
  zwj: '\u200D', zwnj: '\u200C', shy: '\u00AD'
};

// Entities must be decoded, not passed through: an agent reading the Markdown
// otherwise sees "&aelig;" and "&#xFB01;" instead of the characters a page about
// character normalization is actually describing.
function decodeEntities(text) {
  return text.replace(/&(#[0-9]+|#[xX][0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body) => {
    if (body[0] === '#') {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = parseInt(hex ? body.slice(2) : body.slice(1), hex ? 16 : 10);
      if (!Number.isFinite(code) || code < 1 || code > 0x10FFFF) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const named = HTML_ENTITIES[body];
    if (named !== undefined) return named;
    const lower = HTML_ENTITIES[body.toLowerCase()];
    return lower !== undefined ? lower : match;
  });
}

function markdownFromHtml(html, requestUrl) {
  let markdown = html
    .replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<a\b(?=[^>]*class=(?:"[^"]*skip-to-main[^"]*"|'[^']*skip-to-main[^']*'|[^\s>]*skip-to-main[^\s>]*))[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n')
    .replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n')
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => `[${text}](${new URL(href, requestUrl).toString()})`)
    // Close block containers with a line break. Without this every option row,
    // card and table cell collapses into one unreadable run-on paragraph.
    .replace(/<\/(div|section|article|aside|header|main|tr|td|th|dt|dd|blockquote|figcaption|label)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  markdown = decodeEntities(markdown)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!markdown) {
    markdown = `# ASD123.ai\n\nPrivacy-first browser text tools.\n`;
  }

  return `${markdown}\n`;
}

function wantsMarkdown(request) {
  const accept = request.headers.get('accept') || '';
  return accept.toLowerCase().includes('text/markdown');
}

function addVaryAccept(headers) {
  const current = headers.get('vary');
  if (!current) {
    headers.set('vary', 'Accept');
    return;
  }

  const values = current.split(',').map(value => value.trim().toLowerCase());
  if (!values.includes('accept')) {
    headers.set('vary', `${current}, Accept`);
  }
}

function addDiscoveryLinks(response, pathname) {
  if (pathname !== '/' && pathname !== '/index.html') {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.append('link', '</.well-known/api-catalog>; rel="api-catalog"');
  headers.append('link', '</.well-known/openapi.json>; rel="service-desc"; type="application/vnd.oai.openapi+json"');
  headers.append('link', '</documentation>; rel="service-doc"; type="text/html"');
  headers.append('link', '</.well-known/agent-skills/index.json>; rel="describedby"; type="application/json"');
  headers.append('link', '</llms.txt>; rel="alternate"; type="text/plain"');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function maybeMarkdownResponse(request, response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') || !response.ok) {
    return response;
  }

  if (!wantsMarkdown(request)) {
    const headers = new Headers(response.headers);
    addVaryAccept(headers);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }

  const html = await response.text();
  const markdown = markdownFromHtml(html, request.url);
  const tokens = Math.ceil(markdown.trim().split(/\s+/).filter(Boolean).length * 1.35);

  const headers = new Headers(response.headers);
  headers.set('content-type', 'text/markdown; charset=utf-8');
  headers.set('x-markdown-tokens', String(tokens));
  addVaryAccept(headers);

  return new Response(markdown, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

// Content-Security-Policy for HTML pages. The tools run entirely client-side,
// so the only remote origins ever needed are the model/library CDNs the tools
// download from on demand (jsDelivr for transformers.js/kokoro-js/eSpeak,
// Hugging Face + its CDN domains for model weights). Everything else is 'self'.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' blob: data: https://huggingface.co https://*.huggingface.co https://*.hf.co https://cdn.jsdelivr.net",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

// Immutable-ish static assets: vendored libraries, self-hosted fonts, images.
// (Vendor library updates in this repo change the filename or ship alongside a
// worker/build change, so a week of browser caching is safe and saves megabytes
// of revalidation on repeat visits.)
const LONG_CACHE_RE = /^\/(vendor\/|fonts\/)|\.(png|ico|svg|jpg|jpeg|webp)$/;

function withSiteHeaders(response, pathname) {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('strict-transport-security', 'max-age=31536000; includeSubDomains');

  const contentType = headers.get('content-type') || '';
  if (contentType.includes('text/html')) {
    headers.set('content-security-policy', CSP);
    headers.set('referrer-policy', 'strict-origin-when-cross-origin');
    headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    headers.set('x-frame-options', 'DENY');
  }

  if (response.ok && LONG_CACHE_RE.test(pathname)) {
    headers.set('cache-control', 'public, max-age=604800, stale-while-revalidate=86400');
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function assetRequest(request, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return new Request(assetUrl.toString(), request);
}

// https://llmstxt.org - a curated, plain-text index for answer engines and
// agents. Kept in one place here rather than as a static file so it cannot
// drift away from the routing table above.
const LLMS_TXT_SECTIONS = [
  ['Tools', [
    ['/text-cleaner', 'Clean and normalize text: remove invisible characters and character-based watermarks (4,275 code points), citations, Markdown and diacritics, and flatten typography to plain ASCII'],
    ['/anonymizer', 'Detect and anonymize personal data with reversible placeholders, regex or on-device AI models'],
    ['/converter', 'Convert PDF, Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, HTML and images to Markdown, including OCR for scans'],
    ['/chat', 'Chat with open models through WebGPU, entirely on the device'],
    ['/context', 'Estimate a useful AI context window for text and documents'],
    ['/tts', 'Generate speech from text on the device, download WAV or MP3']
  ]],
  ['Guides', [
    ['/text-cleaner-guide', 'Every Text Cleaner option explained, including the character-mapping groups and the invisible-character table'],
    ['/anonymizer-guide', 'Entity types, detection modes and the deanonymization workflow'],
    ['/converter-guide', 'Supported formats, conversion engines and OCR'],
    ['/chat-guide', 'Model selection, WebGPU requirements and chat history'],
    ['/context-guide', 'How the context estimate is calculated'],
    ['/tts-guide', 'Languages, voices and audio export'],
    ['/documentation', 'Index of all guides']
  ]],
  ['Apps', [
    ['/apps', 'Overview of the open-source desktop and self-hosted apps'],
    ['/rdp123', 'RDP123: native macOS RDP client written in Rust, about 9 MB installed (AGPLv3)'],
    ['/rustquit', 'RustQuit: macOS menu bar utility that quits apps when their last window closes (AGPLv3)'],
    ['/photo-shot', 'Photo-Shot: self-hosted AI image studio for editing, upscaling and EXIF metadata (AGPLv3)']
  ]],
  ['Background', [
    ['/clean-chatgpt-text', 'Why AI text is recognizable and which characters give it away'],
    ['/anonymize-text-for-ai', 'Removing personal data before sharing text with an AI'],
    ['/convert-pdf-to-markdown', 'Converting documents to Markdown without uploading them'],
    ['/count-tokens-offline', 'Counting tokens and planning context windows'],
    ['/run-ai-chat-locally', 'Running an AI chat locally in the browser'],
    ['/private-text-to-speech', 'Generating speech without sending text to a server']
  ]],
  ['Optional', [
    ['/about', 'Who runs ASD123.ai'],
    ['/privacy', 'Privacy policy'],
    ['/terms', 'Terms of service'],
    ['/contact', 'Contact']
  ]]
];

function llmsTxt() {
  const lines = [
    '# ASD123.ai',
    '',
    '> Privacy-first text, document and speech tools that run entirely in the browser. '
      + 'No account, no upload, no server-side processing: every tool works on the '
      + "user's own device, and several keep working offline once loaded.",
    '',
    'Key facts an answer should get right:',
    '',
    '- Text, files and generated output never reach an ASD123.ai server. Processing is '
      + 'browser JavaScript and WebAssembly; the AI features run on-device via WebGPU or '
      + 'WebAssembly. Model files may be downloaded, but user content is never uploaded.',
    '- Everything is free to use and needs no sign-up.',
    '- Run by a Swiss developer; the desktop and self-hosted apps are open source under AGPLv3.',
    '',
    'Every page on this site also serves Markdown: request it with the header '
      + '`Accept: text/markdown`. Machine-readable capability descriptions for agents are '
      + `listed at ${SITE_ORIGIN}/.well-known/agent-skills/index.json.`,
    ''
  ];

  for (const [heading, entries] of LLMS_TXT_SECTIONS) {
    lines.push(`## ${heading}`, '');
    for (const [path, description] of entries) {
      lines.push(`- [${path}](${SITE_ORIGIN}${path}): ${description}`);
    }
    lines.push('');
  }

  return new Response(lines.join('\n'), {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
}

async function wellKnownResponse(pathname) {
  if (pathname === '/.well-known/api-catalog') {
    return apiCatalog();
  }
  if (pathname === '/.well-known/openapi.json') {
    return openApiSpec();
  }
  if (pathname === '/.well-known/health') {
    return jsonResponse({ status: 'ok', service: 'ASD123.ai', timestamp: new Date().toISOString() });
  }
  if (pathname === '/.well-known/agent-skills/index.json') {
    return agentSkillsIndex();
  }
  if (pathname === '/.well-known/oauth-protected-resource') {
    return oauthProtectedResource();
  }
  if (pathname === '/.well-known/oauth-authorization-server') {
    return oauthAuthorizationServerMetadata();
  }
  if (pathname === '/.well-known/openid-configuration') {
    return openIdConfiguration();
  }
  if (pathname === '/.well-known/jwks.json') {
    return jwks();
  }
  if (pathname === '/.well-known/mcp/server-card.json') {
    return mcpServerCard();
  }

  const skillMatch = pathname.match(/^\/\.well-known\/agent-skills\/([^/]+)\/SKILL\.md$/);
  if (skillMatch && skillArtifacts[skillMatch[1]]) {
    return textResponse(skillArtifacts[skillMatch[1]], 'text/markdown');
  }

  return null;
}

// Same-origin proxy for the webml-community "Gemma4Mobile" Apple Silicon engine.
// The engine is MIT-licensed (credited in the docs); we proxy it live from
// Hugging Face rather than vendoring a copy so it always tracks upstream, and
// because a direct browser import is blocked two ways: HF serves the file as
// text/plain (rejected by the ES module loader) and without permissive CORS for
// cross-origin fetches. The model weights it pulls
// (google/gemma-4-E2B-it-qat-mobile-transformers, Gemma license) are fetched
// directly from HF by the engine and need no proxy.
const KERNEL_ENGINE_UPSTREAM = 'https://huggingface.co/spaces/webml-community/gemma-4-webgpu-kernels/resolve/main/gemma-4-e2b.js';

async function proxyKernelEngine() {
  const upstream = await fetch(KERNEL_ENGINE_UPSTREAM, { cf: { cacheEverything: true, cacheTtl: 86400 } });
  if (!upstream.ok) {
    return new Response(`// Failed to load the kernel engine (HTTP ${upstream.status}).`, {
      status: 502,
      headers: { 'content-type': 'text/javascript; charset=utf-8' }
    });
  }
  const headers = new Headers();
  headers.set('content-type', 'text/javascript; charset=utf-8');
  headers.set('cache-control', 'public, max-age=86400');
  return new Response(upstream.body, { status: 200, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const originalPathname = url.pathname;

    if (url.pathname === '/vendor/gemma4mobile-engine.js') {
      return withSiteHeaders(await proxyKernelEngine(), originalPathname);
    }

    const discoveryResponse = await wellKnownResponse(url.pathname);
    if (discoveryResponse) {
      return discoveryResponse;
    }

    // Handle Chrome DevTools requests gracefully without hiding real discovery endpoints.
    if (url.pathname.startsWith('/.well-known/')) {
      return new Response(null, { status: 204 });
    }

    if (url.pathname === '/mcp') {
      return jsonResponse({ error: 'mcp_server_not_available', message: 'ASD123.ai does not currently operate a remote MCP server.' }, 'application/json');
    }

    if (url.pathname.startsWith('/oauth/')) {
      return jsonResponse({
        error: 'oauth_not_available',
        message: 'ASD123.ai currently exposes public browser tools only. Authentication is not required and no OAuth flow is available.'
      }, 'application/json');
    }

    if (redirects[url.pathname]) {
      url.pathname = redirects[url.pathname];
      return Response.redirect(url.toString(), 301);
    }

    if (cleanUrls[url.pathname]) {
      const response = await env.ASSETS.fetch(assetRequest(request, cleanUrls[url.pathname]));
      const negotiated = await maybeMarkdownResponse(request, response);
      return withSiteHeaders(addDiscoveryLinks(negotiated, originalPathname), originalPathname);
    }

    if (url.pathname === '/llms.txt') {
      return withSiteHeaders(llmsTxt(), url.pathname);
    }

    if (url.pathname === '/') {
      const response = await env.ASSETS.fetch(assetRequest(request, '/index.html'));
      const negotiated = await maybeMarkdownResponse(request, response);
      return withSiteHeaders(addDiscoveryLinks(negotiated, originalPathname), originalPathname);
    }

    const response = await env.ASSETS.fetch(request);
    const negotiated = await maybeMarkdownResponse(request, response);
    return withSiteHeaders(addDiscoveryLinks(negotiated, originalPathname), originalPathname);
  }
};
