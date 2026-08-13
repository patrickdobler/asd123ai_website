# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ASD123.ai** is a privacy-focused AI text processing web application deployed on Cloudflare Workers. All text processing happens client-side in the browser - no data is ever transmitted to servers. The project features two main tools:

1. **Text Cleaner**: Text cleaning and standardization (language-specific character mappings, diacritics removal, citation removal, Markdown conversion, etc.)
2. **Anonymizer**: Privacy-focused PII detection and anonymization with reversible mappings (supports regex-based and AI model-based detection)

## Development Commands

### Essential Commands
```bash
# Install dependencies
npm install

# Start local development server (Cloudflare Workers)
npm run dev
# Access at http://localhost:8787

# Build for production (minifies HTML, CSS, JS)
npm run build

# Deploy to production (Cloudflare Workers)
npm run deploy
```

### Development Notes
- The project uses a dev container setup - see `.devcontainer/README.md` for details
- Development server runs on port 8787 by default
- Source is grouped into `pages/`, `dev/`, `public/`, `scripts/`, `styles/`, `components/`, `vendor/`; build flattens to `dist/` (see **File Structure**)
- The build process minifies HTML, CSS, and JavaScript files using `build.js`

## Architecture Overview

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Deployment**: Cloudflare Workers with static asset serving
- **Build Tools**: Node.js build script with html-minifier-terser, terser, clean-css
- **Design**: Dark theme with glassmorphism effects, mobile-first responsive design

### File Structure
Two top-level ideas: **`src/` + `public/` are what you edit; `dist/` is generated
by the build and is gitignored — never edit `dist/` by hand.** The build copies
`src/` and `public/` into `dist/`, flattening pages and public assets to the
`dist/` root, so runtime URLs and the relative asset paths inside each page stay
the same (e.g. `src/pages/index.html` → `dist/index.html`, served at `/`).
```
/
├── src/                         # ALL editable source
│   ├── index.js                 # Cloudflare Workers entry (routing + Apple-Silicon engine proxy) — wrangler `main`
│   ├── pages/                   # Production HTML pages          → dist/*.html
│   ├── scripts/                 # JavaScript modules             → dist/scripts/
│   └── styles/                  # main.css + components.css      → dist/styles/
├── public/                      # Static assets served as-is     → dist/ (root)
│   ├── vendor/                  # Self-hosted third-party libs (onnxruntime-web, pdf.js, mammoth, lamejs, …)
│   └── favicon.ico, logo.png, og-image.png, robots.txt, fonts/ (self-hosted Inter), …
├── tools/                       # Build + helper scripts (build.js, build-dev.js, make-favicons.py, package-chat-offline.js)
├── docs/                        # Architecture/design notes, mockups, examples (not deployed)
├── dist/                        # BUILD OUTPUT — generated, gitignored, do not edit
├── dev/                         # Dev-only HTML (chat-bench) — gitignored, NOT in production
├── vendor-dev/                  # Dev-only engine for chat-bench — gitignored, NOT deployed
├── offline-chat/                # Generated offline bundle (output of tools/package-chat-offline.js)
├── wrangler.toml, package.json, CLAUDE.md, AGENTS.md, README.md
```

`npm run build` → `tools/build.js`; `npm run dev` → `tools/build-dev.js` (watch) +
`wrangler dev`. Favicons are generated from `public/logo.png` by
`tools/make-favicons.py` (the logo is black-on-transparent, so each favicon is
composited onto a white rounded box to stay visible on dark browser tabs). Re-run
after changing the logo.

### Cloudflare Workers Routing
The `src/index.js` file handles:
- Clean URL redirects (e.g., `/text-cleaner.html` → `/text-cleaner`)
- Static asset serving from `dist/` directory via the `ASSETS` binding
- 301 redirects for .html extensions to clean URLs

Example routes:
- `/` → serves `index.html`
- `/text-cleaner` → serves `text-cleaner.html`
- `/anonymizer-guide` → serves `anonymizer-guide.html`

### Client-Side Architecture

#### Text Cleaner (`scripts/text-cleaner.js`)
- **Language Mappings**: character replacement tables embedded directly in the script (`EMBEDDED_MAPPINGS`); no runtime fetch, works on file://
- **Processing Options**:
  - Language-specific character mapping (Swiss German, German, French, Italian, English variants)
  - Diacritics removal
  - Citation reference removal
  - Markdown to plain text conversion
  - Fancy Unicode font normalization
  - Em dash replacement (experimental)
- **Local Storage**: User preferences persisted across sessions

#### Anonymizer (`scripts/anonymizer-core.js`)
- **Entity Detection Modes**:
  1. Regex-based: Fast pattern matching for common PII types
  2. AI English: HuggingFace transformer model for English text
  3. AI Multilingual: HuggingFace transformer model for multiple languages
- **Entity Types**: Names, emails, phone numbers, SSNs, credit cards, IBANs, addresses, dates, URLs, IP addresses, UUIDs, and more
- **Reversible Anonymization**: Entity mapping stored in memory (not localStorage for security)
- **File Support**: .txt, .docx, .pdf via `file-processor.js`
- **Export/Import**: CSV export of entity mappings for deanonymization
- **LLM Integration**: Process LLM outputs with placeholders to restore original values

#### Shared Utilities (`scripts/shared.js`)
- **NavigationManager**: Auto-detects current page and sets active nav state
- **Utilities**: Debouncing, clipboard operations, number formatting
- **CharacterCounter**: Real-time character counting with debouncing
- **PrivacyNotice**: One-time privacy notification system

### Design System

#### CSS Architecture
- **Variables**: Defined in `:root` of `styles/main.css`
  - Colors: Dark theme palette with glass effects
  - Typography: Inter font family
  - Spacing: Consistent sizing system
- **Glassmorphism** (`.liquid-glass`): Backdrop blur, semi-transparent backgrounds, border effects
- **Aurora Background** (`.aurora-bg`): Animated gradient overlays
- **Responsive Breakpoints**: Mobile-first (320px+), tablet (768px+), desktop (1024px+)

#### Component Naming (BEM-style)
- Layout: `.site-header`, `.site-footer`, `.main-content`
- Cards: `.liquid-glass`, `.feature-card`, `.entity-card`
- Navigation: `.nav-brand`, `.nav-links`, `.nav-link--active`
- Controls: `.toggle-group`, `.control-panel`, `.btn--primary`

## Key Implementation Details

### Privacy-First Design Principles
1. **No Server Processing**: All text processing happens in the browser using JavaScript
2. **No Data Transmission**: Files and text never leave the user's device
3. **Minimal Storage**: Only user preferences stored in localStorage (no sensitive data)
4. **Session-Only Entity Storage**: Anonymizer entity mappings cleared on page unload
5. **Transparent Processing**: Clear UI indicators that processing is local

### Build Process (`build.js`)
The build script:
1. Creates `dist/` directory
2. Minifies all HTML files (removes comments, whitespace, minifies inline CSS/JS)
3. Minifies and copies CSS files from `styles/` (excludes `anonymizer.css` which is merged)
4. Minifies and uglifies all JavaScript files from `scripts/`
5. Compiles Tailwind utilities used in `src/pages`/`src/scripts` into `dist/styles/tailwind.css` (via `tools/tailwind.config.js` + `tools/tailwind.input.css`; there is NO runtime Tailwind — pages link the compiled file after `components.css`)
6. Copies static assets (robots.txt, fonts/, public/vendor/)
7. Generates `dist/sitemap.xml` from `src/pages/*.html` with per-page `lastmod` from git history (no hand-maintained sitemap)
8. Console logging for each processed file

**Important**: The build process drops console logs and debugger statements from JavaScript.

### Language Mapping System
The Text Cleaner's character mappings live in `MAPPING_GROUPS` (plus the optional fragments) in `src/scripts/text-cleaner.js` (no JSON files, no fetch — this also keeps file:// usage working):
- Supports: swiss-german, german, french, italian, english-international, english-us
- Mappings replace special characters (quotes, dashes, spaces, ligatures, etc.)
- Diacritic removal is language-aware: German/Swiss German → ae/oe/ue digraphs, all other languages → plain a/o/u

### Entity Detection Patterns
The Anonymizer uses prioritized regex patterns (lower priority = checked first):
- Name patterns: Full names, titles + names
- Identifiers: Email, phone, SSN, credit card, IBAN, passport numbers
- Personal info: Addresses, dates of birth
- Technical: URLs, IP addresses (v4/v6), UUIDs
- Financial: Account numbers, credit cards, bank details

## Common Development Tasks

### Adding a New HTML Page
1. Create `pages/{page-name}.html` (dev/test-only pages go in `dev/` instead)
2. Both `build.js` and `build-dev.js` pick up `src/pages/*.html` automatically —
   there is no page list to edit, and the sitemap entry is generated too.
3. Add routing in `src/index.js`:
   - Redirect: `'/page-name.html': '/page-name'`
   - Clean URL: `'/page-name': '/page-name.html'`
4. Update navigation in shared header component
5. Run `npm run build` to test
6. **Verify mobile (required):** check the page at 375px (and glance at 320px) for
   horizontal overflow — `document.body.scrollWidth` must be `<= viewport width`.
   See **Mobile Responsiveness** below for the recurring gotchas.

### Adding a New Language Mapping
1. Add the mapping table to `MAPPING_GROUPS` in `src/scripts/text-cleaner.js`
2. Add the language option to the dropdown in `src/pages/text-cleaner.html`

### Modifying Entity Detection
1. Edit `entityPatterns` object in `scripts/anonymizer-core.js`
2. Add pattern with unique key, regex, and priority number
3. Lower priority numbers are processed first (to catch broader patterns)
4. Test thoroughly - overlapping patterns may cause issues

### Testing Locally
```bash
npm run dev
# Visit http://localhost:8787
# Test privacy by checking Network tab (no external requests)
# Test file upload with sample .txt, .docx, .pdf files
# Verify localStorage persistence across page reloads
```

### Debugging Build Issues
- Check console output from `build.js` for minification errors
- Test individual file minification by running terser/html-minifier directly
- Verify `dist/` directory structure matches source structure
- Check Cloudflare Workers logs for deployment issues

## Architecture Documents

For deeper architectural understanding, see:
- `ARCHITECTURE_PLAN.md`: Original website architecture and design system
- `ARCHITECTURE_ANON.md`: Detailed anonymizer feature specification and implementation guide
- `IMPLEMENTATION_SUMMARY.md`: Summary of completed features
- `.devcontainer/README.md`: Dev container setup and usage

## Important Constraints

### Privacy Constraints
- Fonts and all page assets are self-hosted (NO Google Fonts / third-party CDNs for page delivery — this is a stated Privacy Policy promise)
- `src/index.js` sets a CSP on every HTML response; if a tool needs a new remote origin (model CDN etc.), extend the CSP there or the browser will block it
- Never add server-side processing for user text/files
- Never send analytics data containing user text
- Keep entity mappings in memory only (not localStorage)
- Clear sensitive data on page unload

### Performance Constraints
- AI models can be large (100MB+) - show loading indicators
- Use Web Workers for heavy processing if needed
- Debounce expensive operations (entity list updates, etc.)
- Lazy load file processing libraries (PDF.js, Mammoth.js)

### Browser Support
- Modern browsers with ES6 module support
- Cloudflare Workers edge runtime
- Local file:// protocol support (embedded fallbacks)

### Mobile Responsiveness (required for every page)
Every page MUST be verified at **375px** (primary) and degrade gracefully down to
**320px** before it is considered done. The test is objective: at a given viewport,
`document.body.scrollWidth` must be `<=` the viewport width (no horizontal scroll).
Quick check in the browser/preview:
```js
({ vw: innerWidth, scrollW: document.body.scrollWidth, ok: document.body.scrollWidth <= innerWidth + 1 })
```

Recurring gotchas that have bitten this codebase (check these first when a page overflows):
- **CSS grid blowout — use `minmax(0, 1fr)`, never a bare `1fr`, for single-column
  mobile grids.** A bare `1fr` resolves to `minmax(auto, 1fr)`, whose `auto` floor is
  the content's *min-content* width (e.g. a `<textarea>` or a long word). On a narrow
  screen that floor can exceed the container, so the grid track — and the card inside
  it — overflow the right edge. This is why `.doc-card-grid`, `.features-grid`, and
  `.content-grid` all use `minmax(0, 1fr)`. (Watch for duplicate later-in-file rules
  re-introducing `1fr` and overriding the fix.)
- **`main#main` is a centered flex column** (built for the homepage hero:
  `display:flex; align-items:center`). Content pages reuse `id="main"` and wrap their
  body in a Tailwind max-width container (e.g. `.max-w-6xl`). Under `align-items:center`
  such a child shrinks-to-content and can grow *wider* than the viewport on mobile, and
  — lacking a definite width — it breaks inner `overflow-x:auto` scrollers (tables).
  A safety-net rule (`main#main > [class*="max-w-"] { width: 100% }`) handles this, but
  if a new wrapper isn't a direct child of `main#main`, give it `w-full` explicitly.
- **Wrap wide tables in a `overflow-x-auto` container** so they scroll inside their box
  instead of pushing the page wide. (This only works once the wrapper has a definite
  width — see the `main#main` point above.)
- **Shared header:** the logo + four nav links (Tools, Apps, Documentation, About) are
  tight at ≤375px; `.logo-text` and `.nav-links` gap are shrunk in the
  `@media (max-width: 768px)` block (where "Documentation" also switches to the short
  "Docs" label via `.nav-label-full`/`.nav-label-short` spans), with a further
  `@media (max-width: 345px)` step for very small phones. Adding nav links risks
  re-breaking this — re-verify the header at 375px and 320px.

All page-level responsive rules live in `styles/components.css` (search for
`@media (max-width:` — breakpoints at 1024px, 768px, and 345px).
