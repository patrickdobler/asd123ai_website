# ASD123 AI Text Tools Website - Architecture Plan

## Project Overview

**Project Name:** ASD123 AI Text Tools Website  
**Purpose:** Privacy-focused AI text processing web app with client-side processing  
**Design Theme:** Swiss-inspired dark theme with glassmorphism effects  
**Technology Stack:** HTML, CSS, Vanilla JavaScript, Tailwind CSS  

## File Structure

```
asd123ai_website/
├── index.html                          # Homepage
├── optimizer.html                      # Optimizer tool page
├── documentation.html                  # Documentation page
├── about.html                         # About page
├── styles/
│   ├── main.css                       # Base styles, CSS variables, typography
│   ├── components.css                 # Reusable component styles (.liquid-glass, etc.)
│   └── pages.css                      # Page-specific styles
├── scripts/
│   ├── shared.js                      # Shared utilities, navigation
│   ├── optimizer.js                   # Optimizer functionality
│   └── storage.js                     # Local storage management
├── assets/
│   ├── icons/
│   │   └── asd123-logo.svg           # Extracted logo SVG
│   └── images/                        # Future image assets
└── components/
    ├── header.html                    # Shared header template
    └── footer.html                    # Shared footer template
```

## Design System Components

### Existing Reusable Elements
- **Glassmorphism Cards** (`.liquid-glass`): Primary content containers with backdrop blur, hover animations
- **Aurora Background** (`.aurora-bg`): Animated gradient background with rotating radial gradients
- **Typography System**: Inter font with gradient text effects for headings
- **Color System**: CSS custom properties defining dark theme palette
- **Navigation**: Responsive header with logo, nav links, and CTA button

### CSS Variables
```css
:root {
    --bg-color: #1a202c;
    --glass-bg: rgba(45, 55, 72, 0.5);
    --border-color: rgba(255, 255, 255, 0.15);
    --primary-color: #4299e1;
    --secondary-color: #63b3ed;
    --text-primary: #edf2f7;
    --text-secondary: #a0aec0;
}
```

## Page Wireframes

### 1. Homepage (index.html)
```
┌─ Header ─────────────────────────────────────────┐
│ [Logo: ASD123] [Nav: Documentation|About|GitHub] │
└─────────────────────────────────────────────────┘
┌─ Hero Section ──────────────────────────────────┐
│         AI Text Processing [gradient title]      │
│    "Tools to clean and adapt AI-generated..."   │
└─────────────────────────────────────────────────┘
┌─ Feature Cards ─────────────────────────────────┐
│ ┌─ Optimizer Card ──┐ ┌─ Anonymizer Card ────┐  │
│ │  [Available]      │ │  [IN DEVELOPMENT]    │  │
│ │  Click → optimizer│ │  Feature description │  │
│ └───────────────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────┘
┌─ Privacy Statement ─────────────────────────────┐
│    🇨🇭 "Made in Switzerland for Privacy"        │
│    "All processing in-browser..." [glass card]  │
└─────────────────────────────────────────────────┘
┌─ Footer ────────────────────────────────────────┐
│ Privacy|Terms|Contact    [GitHub|X|Bluesky]     │
└─────────────────────────────────────────────────┘
```

### 2. Optimizer Page (optimizer.html)
```
┌─ Header (shared) ───────────────────────────────┐
│ [Logo: ASD123] [Nav: Documentation|About|GitHub] │
└─────────────────────────────────────────────────┘
┌─ Page Title ────────────────────────────────────┐
│            Optimizer [gradient title]            │
│ "Clean up and standardize AI-generated text...  │
│  All processing happens securely in-browser."   │
└─────────────────────────────────────────────────┘
┌─ Controls Panel ────────────────────────────────┐
│ Language Mapping: [Swiss German ▼]              │
│ □ Remove Diacritics [ℹ️] (è → e, ä → ae)       │
│ □ Remove Citation References [ℹ️] (e.g., [1])   │
│ □ Convert MD to Normal Text [ℹ️]                │
│ □ Remove Fancy Text Font [ℹ️]                   │
│ □ Replace em dash with new sentence [ℹ️] (exp)  │
│                           [Clean Now Button]     │
└─────────────────────────────────────────────────┘
┌─ Text Input Area ───────────────────────────────┐
│ ┌─────────────────────────────────────────────┐ │
│ │                                             │ │
│ │        Large expandable textbox             │ │
│ │         (resizable handle ↘️)                │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
┌─ Footer (shared) ───────────────────────────────┐
```

### 3. Documentation Page (documentation.html)
```
┌─ Header (shared) ───────────────────────────────┐
┌─ Page Title ────────────────────────────────────┐
│            Documentation [gradient title]        │
└─────────────────────────────────────────────────┘
┌─ Tool Cards ────────────────────────────────────┐
│ ┌─ Optimizer Documentation ─────────────────────┐ │
│ │  Brief summary + "View Full User Guide" →    │ │
│ └───────────────────────────────────────────────┘ │
│ ┌─ Anonymizer Documentation ────────────────────┐ │
│ │  Status + "Detailed Info Coming Soon" →      │ │
│ └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
┌─ Footer (shared) ───────────────────────────────┐
```

### 4. About Page (about.html)
```
┌─ Header (shared) ───────────────────────────────┐
┌─ Page Title ────────────────────────────────────┐
│               About [gradient title]             │
└─────────────────────────────────────────────────┘
┌─ Content Sections ──────────────────────────────┐
│ ┌─ Mission Statement ─────────────────────────┐  │
│ │  [Privacy-focused approach, Swiss values]  │  │
│ └─────────────────────────────────────────────┘  │
│ ┌─ Open Source Philosophy ────────────────────┐  │
│ │  [Project philosophy, community]           │  │
│ └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
┌─ Footer (shared) ───────────────────────────────┐
```

## Navigation & Footer Specifications

### Header Component Structure
```html
<header class="site-header">
  <nav class="main-navigation">
    <div class="nav-brand">
      <svg class="brand-logo">[ASD123 Logo]</svg>
      <h1 class="brand-name">ASD123</h1>
    </div>
    <div class="nav-links">
      <a href="documentation.html">Documentation</a>
      <a href="about.html">About</a>
      <a href="#" class="external-link">GitHub</a>
    </div>
  </nav>
</header>
```

### Footer Component Structure
```html
<footer class="site-footer">
  <div class="footer-content">
    <div class="footer-legal">
      <p class="copyright">© 2024 ASD123. All rights reserved.</p>
      <div class="footer-links">
        <a href="#">Privacy Policy</a>
        <a href="#">Terms of Service</a>
        <a href="#">Contact Us</a>
      </div>
    </div>
    <div class="social-links">
      <a href="#" aria-label="GitHub"><svg>[GitHub Icon]</svg></a>
      <a href="#" aria-label="X.com"><svg>[X Icon]</svg></a>
      <a href="#" aria-label="Bluesky"><svg>[Bluesky Icon]</svg></a>
    </div>
  </div>
</footer>
```

## Responsive Design & Accessibility

### Responsive Breakpoints
- **Mobile**: 320px - 768px (single column, hamburger menu)
- **Tablet**: 768px - 1024px (two-column cards, collapsed nav)
- **Desktop**: 1024px+ (full layout, expanded nav)

### Mobile-First Approach
- Base styles for mobile
- Progressive enhancement using `@media` queries
- Touch-friendly button sizes (min 44px)
- Readable text sizes (min 16px on mobile)

### Accessibility Features
1. **Semantic HTML**: Proper heading hierarchy (h1→h2→h3)
2. **Keyboard Navigation**: Tab order, focus indicators
3. **Screen Reader Support**: 
   - `aria-label` for icon buttons
   - `aria-describedby` for tooltip references
   - `role="button"` for interactive elements
4. **Color Contrast**: WCAG AA compliance (4.5:1 ratio minimum)
5. **Reduced Motion**: `prefers-reduced-motion` media query support

### Form Accessibility (Optimizer Page)
- Labels associated with controls via `for` attribute
- Fieldset grouping for toggle options
- `aria-expanded` for dropdown states
- Error messages with `aria-invalid` and `aria-describedby`

## JavaScript Architecture

### Core Modules

#### 1. Optimizer Engine (optimizer.js)
```javascript
class TextOptimizer {
  constructor() {
    this.settings = {
      removeDiacritics: false,
      removeCitations: false,
      convertMarkdown: false,
      removeFancyFont: false,
      replaceEmDash: false,
      languageMapping: 'swiss-german'
    };
  }

  // Processing methods
  processText(inputText) { /* TODO: Implementation */ }
  removeDiacritics(text) { /* TODO: Swiss-specific character mapping */ }
  removeCitations(text) { /* TODO: Remove [1], (2), etc. */ }
  convertMarkdown(text) { /* TODO: MD to plain text */ }
  removeFancyFont(text) { /* TODO: Unicode normalization */ }
  replaceEmDash(text) { /* TODO: Em dash → period + space */ }
}
```

#### 2. UI Controller (shared.js)
```javascript
class OptimizerUI {
  constructor() {
    this.optimizer = new TextOptimizer();
    this.storage = new StorageManager();
    this.initializeEventListeners();
  }

  // Event handlers
  handleToggleChange(toggleId, value) { /* TODO */ }
  handleLanguageChange(language) { /* TODO */ }
  handleTextProcess() { /* TODO */ }
  handleTextAreaResize() { /* TODO */ }
  
  // UI updates
  updatePreview() { /* TODO */ }
  showTooltip(element) { /* TODO */ }
}
```

#### 3. Storage Manager (storage.js)
```javascript
class StorageManager {
  constructor() {
    this.storageKey = 'asd123-optimizer-settings';
  }

  saveSettings(settings) { /* TODO: localStorage */ }
  loadSettings() { /* TODO: localStorage with fallbacks */ }
  clearSettings() { /* TODO: Reset to defaults */ }
}
```

## Component Naming Conventions

### CSS Class Naming (BEM Methodology)

#### Layout Classes
- `.site-header`, `.site-footer`, `.main-content`
- `.container`, `.container--narrow`, `.container--wide`

#### Component Classes
- `.liquid-glass` (existing - glassmorphism cards)
- `.aurora-bg` (existing - animated background)
- `.nav-brand`, `.nav-links`, `.nav-link--active`
- `.feature-card`, `.feature-card--disabled`
- `.control-panel`, `.toggle-group`, `.toggle-item`
- `.text-area`, `.text-area--expandable`
- `.btn`, `.btn--primary`, `.btn--secondary`

#### Utility Classes
- `.text-gradient`, `.text-primary`, `.text-secondary`
- `.sr-only` (screen reader only)
- `.reduced-motion` (respects prefers-reduced-motion)

#### JavaScript Selectors
- `[data-toggle]` for toggle controls
- `[data-tooltip]` for tooltip triggers  
- `[data-storage-key]` for persistent settings
- `#optimizer-textarea` for main text input

### ID Naming
- Page-specific: `#optimizer-page`, `#about-page`
- Unique elements: `#main-textarea`, `#language-select`
- Navigation: `#main-nav`, `#mobile-menu-toggle`

## Local Storage Strategy

### Storage Keys & Data Structure
```javascript
// Storage keys
const STORAGE_KEYS = {
  OPTIMIZER_SETTINGS: 'asd123-optimizer-settings',
  UI_PREFERENCES: 'asd123-ui-preferences',
  PRIVACY_CONSENT: 'asd123-privacy-consent'
};

// Data structures
const DEFAULT_SETTINGS = {
  optimizer: {
    removeDiacritics: false,
    removeCitations: false,
    convertMarkdown: false,
    removeFancyFont: false,
    replaceEmDash: false,
    languageMapping: 'swiss-german'
  },
  ui: {
    textareaHeight: '300px',
    tooltipsEnabled: true,
    reducedMotion: false
  }
};
```

### Storage Implementation
- **Persistence**: Settings saved on every change
- **Fallbacks**: Default values if localStorage unavailable
- **Privacy**: No personal data stored, only preference settings
- **Validation**: Input sanitization before storage
- **Expiration**: Settings persist indefinitely (user-controlled)

### Storage Methods
```javascript
// Automatic save on setting change
function saveOptimizerSettings(settings) { /* TODO */ }

// Load on page initialization
function loadUserPreferences() { /* TODO */ }

// Privacy-conscious: Clear all data option
function clearAllUserData() { /* TODO */ }
```

## Navigation & Routing Strategy

### Multi-Page Architecture
Since this is a static website with 4 distinct pages, we'll use **traditional multi-page navigation** rather than SPA routing:

#### Page Structure
- `index.html` - Homepage (existing)
- `optimizer.html` - Optimizer tool
- `documentation.html` - Documentation
- `about.html` - About page

#### Navigation Implementation
```javascript
// Shared navigation state management
class NavigationManager {
  constructor() {
    this.currentPage = this.detectCurrentPage();
    this.setActiveNavItem();
  }
  
  detectCurrentPage() {
    const path = window.location.pathname;
    const page = path.split('/').pop() || 'index.html';
    return page.replace('.html', '');
  }
  
  setActiveNavItem() {
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('nav-link--active');
    });
    
    const activeLink = document.querySelector(`[href*="${this.currentPage}"]`);
    if (activeLink) {
      activeLink.classList.add('nav-link--active');
    }
  }
}
```

#### URL Structure
- `https://asd123.ai/` - Homepage
- `https://asd123.ai/optimizer.html` - Optimizer tool
- `https://asd123.ai/documentation.html` - Documentation
- `https://asd123.ai/about.html` - About page

#### External Links
- GitHub: Opens in new tab with `target="_blank" rel="noopener"`
- Social links: Same treatment for security

## Implementation Roadmap

### Phase 1: Foundation (High Priority)
1. **Extract shared CSS** to `styles/main.css`, `styles/components.css` - TODO
2. **Create header/footer components** in `components/` directory - TODO
3. ✅ **Update `index.html`** with new navigation (Documentation | About | GitHub)
4. ✅ **Create Optimizer page** (`optimizer.html`) with full functionality
5. **Create page templates** for `documentation.html`, `about.html` - TODO

### Phase 2: Core Functionality (Medium Priority)
5. ✅ **Implement Optimizer UI** with all toggles, dropdowns, and text area
6. **Add JavaScript functionality** for text processing (placeholder TODOs)
7. **Implement local storage** for user preferences
8. **Add responsive breakpoints** and mobile navigation

### Phase 3: Polish (Lower Priority)  
9. **Add accessibility features** (ARIA labels, keyboard navigation)
10. **Implement tooltips** for toggle options
11. **Add loading states** and user feedback
12. **Performance optimization** and testing

### Key Architecture Decisions
- ✅ **Modular CSS structure** with external stylesheets
- ✅ **Component-based HTML** with shared header/footer
- ✅ **Vanilla JS classes** for maintainability  
- ✅ **Multi-page navigation** (not SPA)
- ✅ **Privacy-first local storage** approach
- ✅ **Mobile-first responsive design**

### File Generation Order
1. Create CSS structure (`styles/` directory)
2. Extract shared components (`components/` directory) 
3. Update existing `index.html`
4. Generate new HTML pages
5. Add JavaScript functionality (`scripts/` directory)

### Quality Assurance
- **Accessibility audit** with screen readers
- **Cross-browser testing** (Chrome, Firefox, Safari, Edge)
- **Mobile device testing** (iOS/Android)
- **Performance testing** (Lighthouse audit)

## Privacy & Security Considerations

- **Client-side processing**: All text processing happens in browser
- **No data transmission**: No information ever leaves user's device
- **Minimal data collection**: Only user preferences stored locally
- **Swiss privacy standards**: Built with European privacy regulations in mind
- **Secure external links**: `rel="noopener"` for security
- **Content Security Policy**: Consider implementing for production

## Implementation Status

### ✅ Completed Features (Optimizer Page)
- **Complete Optimizer UI** with glassmorphism design matching homepage
- **Language Mapping dropdown** with Swiss German, German, French, Italian, English options
- **Toggle switches** for all 5 text processing options with hover tooltips:
  - Remove Diacritics (è → e, ä → ae)
  - Remove Citation References (removes [1], (Source:), etc.)
  - Convert MD to Normal Text (removes Markdown formatting)
  - Remove Fancy Text Font (normalizes Unicode styling)
  - Replace em dash with new sentence (experimental feature)
- **Expandable textarea** with character counter and privacy messaging
- **Responsive design** optimized for mobile, tablet, and desktop
- **Accessibility features** with proper labels, ARIA attributes, and keyboard navigation
- **Navigation integration** with updated homepage linking to Optimizer
- **Consistent styling** using existing CSS variables and glassmorphism effects
- **JavaScript hooks** for future text processing implementation

### ✅ Recently Completed Features (Optimizer Logic)
- **Complete Text Processing Engine** with all 5 processing options:
  - Remove Diacritics with language-specific mappings (Swiss German, German, French, Italian, English variants)
  - Remove Citation References ([1], (Source:), superscripts, etc.)
  - Convert Markdown to Plain Text (headers, bold, italic, links, code blocks, etc.)
  - Remove Fancy Unicode Text (mathematical bold, italic, monospace styles)
  - Replace Em Dash with New Sentence (experimental feature with sentence capitalization)
- **Language Mapping System** using JSON files for character replacements
- **Local Storage Integration** for persistent user preferences
- **Real-time Character Counter** with auto-resizing textarea
- **Toast Notifications** for user feedback (success, error, warning messages)
- **Asynchronous Processing** with loading states and error handling
- **Settings Persistence** across browser sessions
- **Privacy-First Architecture** with client-side only processing

### 🔄 Next Implementation Steps
1. Create `documentation.html` and `about.html` pages
2. Extract shared CSS to separate files
3. ✅ ~~Implement actual text processing functionality~~ **COMPLETED**
4. ✅ ~~Add local storage for user preferences~~ **COMPLETED**
5. Create mobile hamburger menu
6. ✅ ~~Add loading states and user feedback~~ **COMPLETED**