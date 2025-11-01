# Coder Implementation Guide - Design Refinement

**Target Audience**: Developer/Coder Agent
**Purpose**: Step-by-step technical implementation of design refinements
**Scope**: HTML/CSS updates for 6+ pages with consistent design system

---

## Quick Start

### Files to Reference
1. **optimizer-mockup.html** → Copy structure to `optimizer.html`
2. **anonymizer-mockup.html** → Copy structure to `anonymizer.html`
3. **homepage-mockup.html** → Copy structure to `index.html`
4. **styles/main.css** & **styles/components.css** → Ensure design tokens are present

### What Changed
- ✅ Button icons updated (Lucide set)
- ✅ "100% Local" badge moved to Processing Mode box (Anonymizer)
- ✅ "Experimental" tag moved to Content Cleaning section (Optimizer)
- ✅ Missing buttons restored to Anonymizer
- ✅ Logo removed from all headers (text-only)
- ✅ Footer standardized across all pages
- ✅ "Made in Switzerland for Privacy" moved to About page

---

## Phase 1: Update Core Pages

### 1.1 Update optimizer.html

**Source**: `design-mockups/optimizer-mockup.html`

#### Key Changes to Implement
1. Remove logo from header
2. Update button icons to Lucide set
3. Move experimental tag to Content Cleaning
4. Expand main container width to 1280px
5. Update page subtitle max-width to 900px

#### Header Code (Remove Icon)
```html
<header>
    <nav>
        <a href="index.html" class="logo-link">
            <span class="logo-text">ASD123.ai</span>
        </a>
        <div class="nav-links">
            <a href="documentation.html" class="nav-link">Documentation</a>
            <a href="about.html" class="nav-link">About</a>
        </div>
    </nav>
</header>
```

#### Button Code with Icons
```html
<div class="button-group">
    <!-- Clean Text Now with Wand Icon -->
    <button class="btn btn-primary">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 4V2"/>
            <path d="M15 16v-2"/>
            <path d="M8 9h2"/>
            <path d="M20 9h2"/>
            <path d="M17.8 11.8 19 13"/>
            <path d="M15 9h0"/>
            <path d="M17.8 6.2 19 5"/>
            <path d="m3 21 9-9"/>
            <path d="M12.2 6.2 11 5"/>
        </svg>
        Clean Text Now
    </button>

    <!-- Copy to Clipboard with Copy Icon -->
    <button class="btn btn-secondary">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        Copy to Clipboard
    </button>

    <!-- Clear Input with X Icon -->
    <button class="btn btn-ghost">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
        </svg>
        Clear Input
    </button>
</div>
```

#### Content Cleaning Section with Experimental Tag
Add the experimental badge to "Remove Citation References" and include "Replace em dash with new sentence":
```html
<div class="toggle-section">
    <div class="section-label">Content Cleaning</div>
    <div class="toggle-list">
        <!-- Remove Citation References with Experimental Tag -->
        <div class="toggle-item">
            <div class="toggle-content">
                <label class="toggle-switch">
                    <input type="checkbox" class="toggle-input">
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">Remove Citation References</span>
                <span class="badge-experimental">Experimental</span>
                <svg class="info-icon">...</svg>
            </div>
        </div>

        <!-- Convert MD to Normal Text -->
        <div class="toggle-item">
            <div class="toggle-content">
                <label class="toggle-switch">
                    <input type="checkbox" class="toggle-input">
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">Convert MD to Normal Text</span>
                <svg class="info-icon">...</svg>
            </div>
        </div>

        <!-- Replace em dash with new sentence -->
        <div class="toggle-item">
            <div class="toggle-content">
                <label class="toggle-switch">
                    <input type="checkbox" class="toggle-input">
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">Replace em dash with new sentence</span>
                <svg class="info-icon">...</svg>
            </div>
        </div>
    </div>
</div>
```

#### CSS Updates
```css
main {
    max-width: 1280px;  /* Increased from 1100px */
}

.page-subtitle {
    max-width: 900px;   /* Increased from 800px */
}
```

#### Checklist for optimizer.html
- [ ] Copy structure from optimizer-mockup.html
- [ ] Remove logo SVG from header
- [ ] Update all button icons to Lucide set
- [ ] Move experimental badge to Content Cleaning section
- [ ] Remove "Experimental Features" section entirely
- [ ] Update CSS container widths
- [ ] Test responsive design
- [ ] Verify form inputs and functionality

---

### 1.2 Update anonymizer.html

**Source**: `design-mockups/anonymizer-mockup.html`

#### Key Changes to Implement
1. Remove logo from header
2. Move "100% Local" badge to Processing Mode box (right side)
3. Add "Anonymize" button to Input Text section (next to Load, primary style with plain shield icon)
4. Simplify Anonymized Output section to only show "Anonymize Selected Text" and "Copy" buttons
5. Add Redact Mode, List View/Tiles View, Export, and Import buttons to entities-controls
6. Remove "100% Local" from page title area

#### Header Code (Remove Icon)
```html
<header>
    <nav>
        <a href="index.html" class="logo-link">
            <span class="logo-text">ASD123.ai</span>
        </a>
        <div class="nav-links">
            <a href="documentation.html" class="nav-link">Documentation</a>
            <a href="about.html" class="nav-link">About</a>
        </div>
    </nav>
</header>
```

#### Processing Mode with "100% Local" Badge (Right-aligned)
```html
<div class="model-section">
    <div class="model-card">
        <span class="model-label">Processing Mode:</span>
        <select class="model-select">
            <option value="regex">Quick Scan (Pattern Matching) - FREE</option>
            <option value="ai-english">AI English (Advanced Detection) - PRO</option>
            <option value="ai-multilingual">AI Multilingual (Multiple Languages) - PRO</option>
        </select>
        <span class="title-badge" style="margin-left: auto;">
            <svg class="badge-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            100% Local
        </span>
    </div>
</div>
```

#### Input Text Section Buttons
In the "Input Text" column header:
```html
<div class="button-group">
    <!-- Load Button -->
    <button class="btn btn-secondary btn-small">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
            <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
        </svg>
        Load
    </button>

    <!-- Anonymize Button (PRIMARY with plain shield) -->
    <button class="btn btn-primary btn-small">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
        </svg>
        Anonymize
    </button>

    <!-- Clear Button -->
    <button class="btn btn-secondary btn-small">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18"/>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
        </svg>
        Clear
    </button>
</div>
```

#### Anonymized Output Section Buttons
In the "Anonymized Output" column header:
```html
<div class="button-group">
    <!-- Anonymize Selected Text Button -->
    <button class="btn btn-secondary btn-small">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
        </svg>
        Anonymize Selected Text
    </button>

    <!-- Copy Button -->
    <button class="btn btn-secondary btn-small">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
        </svg>
        Copy
    </button>
</div>
```

#### Detected Entities Section Header
```html
<div class="section-header" style="margin-bottom: var(--space-4);">
    <h3 class="section-title">Detected Entities</h3>
</div>
```

#### Entities Controls Section
```html
<div class="entities-controls">
    <!-- Redact Mode Button -->
    <button class="btn btn-secondary btn-small">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
            <path d="m9 12 2 2 4-4"/>
        </svg>
        Redact Mode
    </button>

    <!-- Export CSV Button -->
    <button class="btn btn-secondary btn-small">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" x2="12" y1="15" y2="3"/>
        </svg>
        Export CSV
    </button>

    <!-- Import Button -->
    <button class="btn btn-secondary btn-small">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" x2="12" y1="3" y2="15"/>
        </svg>
        Import
    </button>

    <!-- List View / Tiles View Toggle Button (Icon-only) -->
    <button class="btn btn-secondary btn-small" title="Toggle between list and tiles view">
        <svg class="btn-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect width="7" height="7" x="3" y="3" rx="1"/>
            <rect width="7" height="7" x="14" y="3" rx="1"/>
            <rect width="7" height="7" x="14" y="14" rx="1"/>
            <rect width="7" height="7" x="3" y="14" rx="1"/>
        </svg>
    </button>

    <!-- Sort Dropdown -->
    <select class="model-select btn-small" style="min-width: 180px;">
        <option>Sort by Appearance</option>
        <option>Sort Alphabetically</option>
    </select>
</div>
```

#### Page Header (Remove "100% Local" Badge)
```html
<div class="page-header">
    <div class="header-top">
        <h1 class="page-title">Anonymizer</h1>
    </div>
    <p class="page-subtitle">
        Safeguard sensitive information locally in your browser. Detect and anonymize PII with pattern matching or AI models. All processing happens <strong>securely in your browser</strong> — no data ever leaves your device.
    </p>
</div>
```

#### Checklist for anonymizer.html
- [ ] Copy structure from anonymizer-mockup.html
- [ ] Remove logo SVG from header
- [ ] Move "100% Local" badge to right side of Processing Mode box
- [ ] Remove "100% Local" from page title area
- [ ] Add "Anonymize" button to Input Text section (PRIMARY style, plain shield icon - no checkmark)
- [ ] Add "Anonymize Selected Text" button to Anonymized Output section (SECONDARY style)
- [ ] Keep "Copy" button in Anonymized Output section (SECONDARY style)
- [ ] Add "Redact Mode" button to entities-controls section (first button, with text label)
- [ ] Add "List View / Tiles View" button to entities-controls section (icon-only, no text label, with title tooltip)
- [ ] Add Export CSV and Import buttons to entities-controls section
- [ ] Add "Sort by Appearance..." dropdown to entities-controls section
- [ ] Simplify Detected Entities section header (h3 title only, no buttons in header)
- [ ] Verify all button icons are from Lucide set
- [ ] Test responsive button wrapping
- [ ] Test entity grid functionality

---

### 1.3 Update index.html (Homepage)

**Source**: `design-mockups/homepage-mockup.html`

#### Key Changes
1. Remove logo from header (text only)
2. Use standard footer
3. Keep "Made in Switzerland for Privacy" section (will move to About)
4. Ensure consistent title sizes

#### Header Code
```html
<header>
    <nav>
        <a href="index.html" class="logo-link">
            <span class="logo-text">ASD123.ai</span>
        </a>
        <div class="nav-links">
            <a href="documentation.html" class="nav-link">Documentation</a>
            <a href="about.html" class="nav-link">About</a>
        </div>
    </nav>
</header>
```

#### Footer Code (Standard - Use on All Pages)
```html
<footer role="contentinfo">
    <div class="footer-content">
        <div class="footer-left">
            <p>&copy; 2025 ASD123.ai. All rights reserved.</p>
            <div class="privacy-inline">
                <svg class="privacy-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
                    <path d="m9 12 2 2 4-4"/>
                </svg>
                <span>100% Local Processing</span>
            </div>
        </div>

        <div class="footer-links">
            <a href="privacy.html" class="footer-link">Privacy Policy</a>
            <a href="#" class="footer-link">Terms of Service</a>
            <a href="contact.html" class="footer-link">Contact</a>

            <div class="social-links">
                <a href="https://github.com/patrickdobler/asd123.ai" class="social-link" target="_blank" rel="noopener" aria-label="GitHub">
                    <svg class="social-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.300 24 12c0-6.627-5.373-12-12-12z"/>
                    </svg>
                </a>
                <a href="#" class="social-link" target="_blank" rel="noopener" aria-label="X (Twitter)">
                    <svg class="social-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                </a>
            </div>
        </div>
    </div>
</footer>
```

#### Checklist for index.html
- [ ] Copy structure from homepage-mockup.html
- [ ] Remove logo SVG from header
- [ ] Apply standard footer
- [ ] Ensure all page titles are 56px
- [ ] Update all links to point to correct pages
- [ ] Test responsive design

---

## Phase 2: Create/Update Supporting Pages

### 2.1 Create about.html

#### Structure Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>About - ASD123.ai</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <link href="styles/main.css" rel="stylesheet">
    <link href="styles/components.css" rel="stylesheet">
</head>
<body>
    <div class="aurora-bg"></div>
    <div class="content-wrapper">
        <!-- HEADER -->
        <header>
            <nav>
                <a href="index.html" class="logo-link">
                    <span class="logo-text">ASD123.ai</span>
                </a>
                <div class="nav-links">
                    <a href="documentation.html" class="nav-link">Documentation</a>
                    <a href="about.html" class="nav-link">About</a>
                </div>
            </nav>
        </header>

        <!-- MAIN CONTENT -->
        <main>
            <div class="page-header">
                <h1 class="page-title">About</h1>
                <p class="page-subtitle">Learn about ASD123.ai and our commitment to privacy</p>
            </div>

            <!-- "Made in Switzerland for Privacy" Section (MOVED FROM HOMEPAGE) -->
            <div class="card">
                <div style="display: flex; align-items: center; justify-content: center; margin-bottom: var(--space-6);">
                    <svg class="h-10 w-10 text-primary mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5"/>
                    </svg>
                    <h2 class="text-2xl font-bold">Made in Switzerland for Privacy</h2>
                </div>
                <p class="text-lg text-secondary">
                    Your privacy is our core principle. All data is processed <strong class="text-primary">directly in your browser</strong>. No information ever leaves your device, ensuring complete confidentiality and security. This project is built on the foundation of Swiss privacy standards.
                </p>
            </div>

            <!-- Additional About Sections -->
            <div class="card">
                <h2 class="card-title">Our Mission</h2>
                <p>Description of mission and values...</p>
            </div>

            <!-- Add more sections as needed -->
        </main>

        <!-- FOOTER (STANDARD) -->
        <footer>
            <div class="footer-content">
                <p>&copy; 2025 ASD123.ai. All rights reserved.</p>
                <div class="footer-links">
                    <a href="privacy.html" class="footer-link">Privacy Policy</a>
                    <a href="#" class="footer-link">Terms of Service</a>
                    <a href="contact.html" class="footer-link">Contact</a>
                </div>
            </div>
        </footer>
    </div>
</body>
</html>
```

#### Checklist
- [ ] Create about.html
- [ ] Add header with no logo (text only)
- [ ] Add "Made in Switzerland for Privacy" section (moved from homepage)
- [ ] Add additional about content
- [ ] Use standard footer
- [ ] Ensure consistent page title styling
- [ ] Test responsive design

---

### 2.2 Update documentation.html, privacy.html, contact.html, guides

Use the same structure as about.html:
1. Consistent header (no logo)
2. Page title (56px)
3. Page subtitle (18px)
4. Card-based content sections
5. Standard footer
6. Use design system spacing and colors

#### Template for All Pages
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[PAGE TITLE] - ASD123.ai</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">
    <link href="styles/main.css" rel="stylesheet">
    <link href="styles/components.css" rel="stylesheet">
</head>
<body>
    <div class="aurora-bg"></div>
    <div class="content-wrapper">
        <!-- Standard Header -->
        <header>
            <nav>
                <a href="index.html" class="logo-link">
                    <span class="logo-text">ASD123.ai</span>
                </a>
                <div class="nav-links">
                    <a href="documentation.html" class="nav-link">Documentation</a>
                    <a href="about.html" class="nav-link">About</a>
                </div>
            </nav>
        </header>

        <!-- Main Content -->
        <main>
            <div class="page-header">
                <h1 class="page-title">[PAGE TITLE]</h1>
                <p class="page-subtitle">[SUBTITLE]</p>
            </div>

            <!-- Content Cards -->
            <div class="card">
                <h2 class="card-title">Section Title</h2>
                <p>Content here...</p>
            </div>
        </main>

        <!-- Standard Footer -->
        <footer>
            <div class="footer-content">
                <p>&copy; 2025 ASD123.ai. All rights reserved.</p>
                <div class="footer-links">
                    <a href="privacy.html" class="footer-link">Privacy Policy</a>
                    <a href="#" class="footer-link">Terms of Service</a>
                    <a href="contact.html" class="footer-link">Contact</a>
                </div>
            </div>
        </footer>
    </div>
</body>
</html>
```

---

## Phase 3: CSS System Verification

### Ensure main.css Contains

```css
:root {
    /* E-Ink Palette */
    --bg-color: #e4e4dc;
    --paper-texture: #f0f0e8;
    --glass-bg: rgba(240, 240, 232, 0.9);
    --border-color: rgba(60, 60, 60, 0.3);
    --text-primary: #0a0a0a;
    --text-secondary: #3a3a3a;
    --primary-color: #1a1a1a;

    /* Typography Scale */
    --text-xs: 0.75rem;
    --text-sm: 0.875rem;
    --text-base: 1rem;
    --text-lg: 1.125rem;
    --text-xl: 1.25rem;
    --text-2xl: 1.5rem;
    --text-4xl: 2.25rem;
    --text-5xl: 3rem;

    /* Spacing Scale */
    --space-2: 8px;
    --space-3: 12px;
    --space-4: 16px;
    --space-6: 24px;
    --space-8: 32px;
    --space-12: 48px;

    /* Shadows */
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.08);
    --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.12);
}

/* Base Styles */
body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    background-color: var(--bg-color);
    color: var(--text-primary);
    line-height: 1.6;
}

.aurora-bg {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 200vw;
    height: 200vh;
    z-index: 0;
    background-image:
        radial-gradient(circle at 30% 30%, rgba(0, 0, 0, 0.02) 0%, transparent 50%),
        radial-gradient(circle at 70% 70%, rgba(0, 0, 0, 0.015) 0%, transparent 50%);
    filter: blur(40px);
    pointer-events: none;
}

.content-wrapper {
    position: relative;
    z-index: 1;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}
```

### Ensure components.css Contains

```css
/* Header */
header {
    padding: var(--space-6) var(--space-8);
    max-width: 1280px;
    margin: 0 auto;
    width: 100%;
}

nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.logo-link {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    text-decoration: none;
}

.logo-text {
    font-size: 24px;
    font-weight: 900;
    color: var(--text-primary);
}

/* Main Content */
main {
    flex: 1;
    padding: var(--space-12) var(--space-8);
    max-width: 1280px;
    margin: 0 auto;
    width: 100%;
}

/* Typography */
.page-title {
    font-size: var(--text-5xl);
    font-weight: 900;
    letter-spacing: -0.02em;
    margin-bottom: var(--space-4);
}

.page-subtitle {
    font-size: var(--text-lg);
    color: var(--text-secondary);
    line-height: 1.6;
    max-width: 900px;
    margin: 0 auto var(--space-12);
}

/* Cards */
.card {
    background: var(--glass-bg);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: var(--space-8);
    box-shadow: var(--shadow-sm);
    margin-bottom: var(--space-8);
}

.card-title {
    font-size: var(--text-xl);
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: var(--space-4);
}

/* Buttons */
.btn {
    padding: var(--space-3) var(--space-6);
    border-radius: 6px;
    font-weight: 600;
    border: 2px solid var(--border-color);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    transition: all 200ms ease;
}

.btn-primary {
    background: var(--text-primary);
    color: var(--paper-texture);
    border-color: var(--text-primary);
}

.btn-primary:hover {
    background: #000;
    transform: translateY(-1px);
    box-shadow: var(--shadow-md);
}

.btn-secondary {
    background: var(--glass-bg);
    color: var(--text-primary);
}

.btn-secondary:hover {
    background: rgba(255, 255, 255, 0.9);
}

/* Footer */
footer {
    border-top: 2px solid var(--border-color);
    padding: var(--space-8);
    max-width: 1280px;
    margin: 0 auto;
    width: 100%;
}

.footer-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--space-6);
    font-size: var(--text-sm);
    color: var(--text-secondary);
}

.footer-links {
    display: flex;
    gap: var(--space-6);
}

.footer-link {
    color: var(--text-secondary);
    text-decoration: none;
    transition: color 200ms ease;
}

.footer-link:hover {
    color: var(--text-primary);
}

/* Responsive */
@media (max-width: 768px) {
    main { padding: var(--space-8) var(--space-4); }
    .page-title { font-size: 40px; }
    .button-group { flex-direction: column; }
    .btn { width: 100%; justify-content: center; }
    .footer-content { flex-direction: column; text-align: center; }
}
```

---

## Phase 4: Testing Checklist

### Visual Testing
- [ ] All page titles are 56px
- [ ] All page subtitles are 18px
- [ ] Colors match design system
- [ ] Spacing follows scale (8px, 12px, 16px, 24px, 32px, 48px)
- [ ] Cards have proper borders and shadows
- [ ] Buttons have hover states

### Responsive Testing
- [ ] Mobile (320px): Single column, stacked buttons
- [ ] Tablet (768px): 2-column layout where applicable
- [ ] Desktop (1280px): Full layout, proper spacing
- [ ] Navigation works on all sizes
- [ ] Footer displays correctly on all sizes

### Functionality Testing
- [ ] All internal links work (index, optimizer, anonymizer, about, documentation, privacy, contact)
- [ ] Buttons are clickable and have proper hover states
- [ ] Form inputs work (textarea, select)
- [ ] Footer links work

### Cross-Browser Testing
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Accessibility Testing
- [ ] Tab navigation works
- [ ] Focus indicators visible
- [ ] Alt text on icons (aria-hidden="true" for decorative SVGs)
- [ ] Color contrast acceptable (4.5:1 minimum)
- [ ] Screen reader friendly

---

## Build and Deployment

### Local Testing
```bash
# Install dependencies (if needed)
npm install

# Build for production
npm run build

# Start dev server for testing
npm run dev
```

### File Generation Order
1. Update optimizer.html
2. Update anonymizer.html
3. Update index.html
4. Create about.html
5. Update documentation.html (or create if missing)
6. Update privacy.html (or create if missing)
7. Update contact.html (or create if missing)
8. Update any guide pages
9. Run build: `npm run build`
10. Test in browser: `npm run dev`

### Deployment
```bash
npm run deploy
```

---

## Common Issues & Solutions

### Issue: Buttons not wrapping properly on mobile
**Solution**: Ensure `.button-group` has `flex-direction: column` on mobile breakpoint

### Issue: Footer not sticking to bottom
**Solution**: Ensure `.content-wrapper` has `display: flex; flex-direction: column;` and main has `flex: 1`

### Issue: Icon colors not showing
**Solution**: Ensure SVG has `stroke="currentColor"` to inherit text color

### Issue: Cards not aligned properly
**Solution**: Verify `main` has `max-width: 1280px; margin: 0 auto;`

---

## References

- **DESIGN_REFINEMENT_GUIDE.md** - Complete design documentation
- **CLAUDE.md** - Project architecture and common commands
- **design-mockups/** - Reference mockup files
- **styles/main.css** - Design tokens and base styles
- **styles/components.css** - Component styles

---

**Status**: Ready for Implementation
**Last Updated**: November 2024
