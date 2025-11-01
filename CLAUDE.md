# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ASD123.ai** is a privacy-focused AI text processing web application deployed on Cloudflare Workers. All text processing happens client-side in the browser - no data is ever transmitted to servers. The project features two main tools:

1. **Optimizer**: Text cleaning and standardization (language-specific character mappings, diacritics removal, citation removal, Markdown conversion, etc.)
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
- All source files are in the root directory; build outputs to `dist/`
- The build process minifies HTML, CSS, and JavaScript files using `build.js`

## Architecture Overview

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES6 modules), HTML5, CSS3
- **Deployment**: Cloudflare Workers with static asset serving
- **Build Tools**: Node.js build script with html-minifier-terser, terser, clean-css
- **Design**: Dark theme with glassmorphism effects, mobile-first responsive design

### File Structure
```
/
├── src/index.js                 # Cloudflare Workers entry point (routing)
├── build.js                     # Production build script
├── wrangler.toml               # Cloudflare Workers configuration
├── *.html                      # HTML pages (root level)
├── scripts/                    # JavaScript modules
│   ├── shared.js              # Shared utilities, navigation
│   ├── optimizer.js           # Text optimizer engine
│   ├── anonymizer-core.js     # Anonymizer main logic
│   ├── entity-manager.js      # Entity detection and mapping
│   ├── model-loader.js        # AI model loading (transformers.js)
│   ├── file-processor.js      # File upload handling (.txt, .docx, .pdf)
│   └── ui-controller.js       # UI state management
├── styles/
│   ├── main.css               # Base styles and CSS variables
│   └── components.css         # Reusable component styles
├── components/                # Shared HTML components
└── dist/                      # Build output directory
```

### Cloudflare Workers Routing
The `src/index.js` file handles:
- Clean URL redirects (e.g., `/optimizer.html` → `/optimizer`)
- Static asset serving from `dist/` directory via the `ASSETS` binding
- 301 redirects for .html extensions to clean URLs

Example routes:
- `/` → serves `index.html`
- `/optimizer` → serves `optimizer.html`
- `/anonymizer-guide` → serves `anonymizer-guide.html`

### Client-Side Architecture

#### Optimizer (`scripts/optimizer.js`)
- **Language Mappings**: JSON-based character replacement mappings stored in `components/mappings/`
- **Embedded Fallbacks**: Hard-coded mappings in the script for offline/file:// protocol usage
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
5. Copies static assets (sitemap.xml, robots.txt, components/)
6. Console logging for each processed file

**Important**: The build process drops console logs and debugger statements from JavaScript.

### Language Mapping System
The Optimizer loads language-specific character mappings:
- JSON files attempted to load from `components/mappings/{language}.json`
- Falls back to embedded mappings if fetch fails
- Supports: swiss-german, german, french, italian, english-international, english-us
- Mappings replace special characters (quotes, dashes, spaces, ligatures, etc.)

### Entity Detection Patterns
The Anonymizer uses prioritized regex patterns (lower priority = checked first):
- Name patterns: Full names, titles + names
- Identifiers: Email, phone, SSN, credit card, IBAN, passport numbers
- Personal info: Addresses, dates of birth
- Technical: URLs, IP addresses (v4/v6), UUIDs
- Financial: Account numbers, credit cards, bank details

## Common Development Tasks

### Adding a New HTML Page
1. Create `{page-name}.html` in root directory
2. Add to `htmlFiles` array in `build.js`
3. Add routing in `src/index.js`:
   - Redirect: `'/page-name.html': '/page-name'`
   - Clean URL: `'/page-name': '/page-name.html'`
4. Update navigation in shared header component
5. Run `npm run build` to test

### Adding a New Language Mapping
1. Create JSON file in `components/mappings/{language}.json`
2. Add embedded fallback to `EMBEDDED_MAPPINGS` in `scripts/optimizer.js`
3. Add language option to the dropdown in `optimizer.html`
4. Update `loadLanguageMappings()` to include the new language

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
