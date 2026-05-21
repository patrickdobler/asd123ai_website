const SITE_ORIGIN = 'https://asd123.ai';

const redirects = {
  '/index.html': '/',
  '/optimizer.html': '/optimizer',
  '/anonymizer.html': '/anonymizer',
  '/chat.html': '/chat',
  '/context.html': '/context',
  '/converter.html': '/converter',
  '/documentation.html': '/documentation',
  '/about.html': '/about',
  '/contact.html': '/contact',
  '/privacy.html': '/privacy',
  '/terms.html': '/terms',
  '/test-optimizer.html': '/test',
  '/anonymizer-guide.html': '/anonymizer-guide',
  '/chat-guide.html': '/chat-guide',
  '/context-guide.html': '/context-guide',
  '/converter-guide.html': '/converter-guide',
  '/optimizer-guide.html': '/optimizer-guide'
};

const cleanUrls = {
  '/optimizer': '/optimizer.html',
  '/anonymizer': '/anonymizer.html',
  '/chat': '/chat.html',
  '/context': '/context.html',
  '/converter': '/converter.html',
  '/documentation': '/documentation.html',
  '/about': '/about.html',
  '/contact': '/contact.html',
  '/privacy': '/privacy.html',
  '/terms': '/terms.html',
  '/test': '/test-optimizer.html',
  '/anonymizer-guide': '/anonymizer-guide.html',
  '/chat-guide': '/chat-guide.html',
  '/context-guide': '/context-guide.html',
  '/converter-guide': '/converter-guide.html',
  '/optimizer-guide': '/optimizer-guide.html'
};

const skillArtifacts = {
  'optimizer': `# ASD123.ai Optimizer

Use this skill when an agent needs to clean, normalize, or standardize text with ASD123.ai in the browser.

## Capabilities

- Remove Markdown formatting from generated text
- Remove citation references
- Normalize fancy Unicode text
- Normalize target line endings for Auto, Windows, Linux, and macOS
- Apply language character mappings for Swiss German, German, French, Italian, English International, and English US
- Remove or reverse German diacritics

## Privacy

All text processing runs locally in the browser. Text is not sent to ASD123.ai servers for processing.
`,
  'anonymizer': `# ASD123.ai Anonymizer

Use this skill when an agent needs to help a user anonymize or redact personally identifiable information in the ASD123.ai browser tool.

## Capabilities

- Regex-based local PII detection
- Optional OpenAI Privacy Filter model loaded through Hugging Face Transformers.js
- Legacy AI4Privacy proof-of-concept models
- Reversible placeholder mappings for deanonymization workflows
- CSV import and export of entity mappings

## Privacy

Text, uploaded files, detected entities, and mappings remain in the local browser session. Optional AI modes download model files, but do not upload the user's text for processing.
`,
  'chat': `# ASD123.ai Local AI Chat

Use this skill when an agent needs to help a user work with the ASD123.ai Local AI Chat browser tool.

## Capabilities

- Browser-based WebGPU chat with supported ONNX models
- Local chat history in IndexedDB
- File and image attachments processed in the browser
- Editable user messages and Markdown export
- Context window and temperature controls

## Privacy

Prompts, uploaded files, chat history, and generated output remain in the user's browser. Online model loading may download model and runtime files, but the user's chat content is not sent to ASD123.ai servers for inference.
`,
  'context': `# ASD123.ai Context Estimator

Use this skill when an agent needs to help a user estimate an AI chat context window for text or local documents.

## Capabilities

- Estimate useful context windows for pasted text
- Extract TXT, DOCX, and PDF text locally in the browser
- Compare 4K, 8K, 16K, 32K, 64K, and 128K context sizes
- Apply lightweight model-family profiles without tokenizer downloads
- Reserve answer and reasoning budget before recommending a window

## Privacy

Pasted text and uploaded file contents remain in the user's browser. The tool does not upload documents or store extracted text in server-side storage.
`,
  'converter': `# ASD123.ai Markdown Converter

Use this skill when an agent needs to help a user convert PDF or DOCX documents to Markdown with the ASD123.ai browser converter.

## Capabilities

- Convert PDF files to Markdown using pdf.js text extraction with font-size heading detection
- Convert DOCX files to Markdown via mammoth.js style mapping
- Preserve bold, italic, links, lists, and tables for DOCX sources
- Toggle heading detection and whitespace collapsing
- Copy or download the resulting Markdown as a .md file

## Privacy

PDF and DOCX files are parsed entirely in the user's browser. Documents and generated Markdown remain on the user's device and are not transmitted to ASD123.ai.
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
    description: name === 'optimizer'
      ? 'Clean and normalize text locally with the ASD123.ai Optimizer.'
      : name === 'chat'
        ? 'Chat with local WebGPU models in the ASD123.ai browser chat tool.'
        : name === 'context'
          ? 'Estimate AI chat context windows locally with the ASD123.ai Context Estimator.'
          : name === 'converter'
            ? 'Convert PDF and DOCX documents to Markdown locally with the ASD123.ai Markdown Converter.'
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
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
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

function assetRequest(request, pathname) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = pathname;
  return new Request(assetUrl.toString(), request);
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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const originalPathname = url.pathname;

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
      return addDiscoveryLinks(negotiated, originalPathname);
    }

    if (url.pathname === '/') {
      const response = await env.ASSETS.fetch(assetRequest(request, '/index.html'));
      const negotiated = await maybeMarkdownResponse(request, response);
      return addDiscoveryLinks(negotiated, originalPathname);
    }

    const response = await env.ASSETS.fetch(request);
    const negotiated = await maybeMarkdownResponse(request, response);
    return addDiscoveryLinks(negotiated, originalPathname);
  }
};
