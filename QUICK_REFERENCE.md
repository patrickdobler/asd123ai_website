# ASD123.ai Design System - Quick Reference

**For Developers**: Quick copy-paste reference for common patterns

---

## CSS Variables (Design Tokens)

```css
/* Copy this entire block to :root in main.css */

:root {
    /* Colors */
    --bg-color: #e4e4dc;
    --text-primary: #0a0a0a;
    --text-secondary: #3a3a3a;
    --border-color: rgba(60, 60, 60, 0.3);

    /* Spacing (use these!) */
    --space-2: 0.5rem;    /* 8px */
    --space-3: 0.75rem;   /* 12px */
    --space-4: 1rem;      /* 16px */
    --space-6: 1.5rem;    /* 24px */
    --space-8: 2rem;      /* 32px */
    --space-12: 3rem;     /* 48px */

    /* Typography */
    --text-sm: 0.875rem;  /* 14px */
    --text-base: 1rem;    /* 16px */
    --text-lg: 1.125rem;  /* 18px */
    --text-xl: 1.25rem;   /* 20px */
    --text-4xl: 2.25rem;  /* 36px */
    --text-5xl: 3rem;     /* 48px */

    /* Font Weights */
    --font-medium: 500;
    --font-semibold: 600;
    --font-bold: 700;
    --font-black: 900;

    /* Shadows */
    --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);
    --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.12);
    --inset-light: inset 0 1px 2px rgba(255, 255, 255, 0.5);

    /* Animation */
    --ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);
    --duration-fast: 200ms;
}
```

---

## Common Icon Patterns

### Decorative Icon (with text)
```html
<button>
    <svg class="btn-icon" aria-hidden="true">...</svg>
    Button Text
</button>
```

### Standalone Icon (no text)
```html
<button aria-label="Copy to clipboard">
    <svg class="icon" aria-hidden="true">...</svg>
</button>
```

### Most Used Lucide Icons

```html
<!-- Wand (Optimizer) -->
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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

<!-- Shield Check (Privacy) -->
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    <path d="m9 12 2 2 4-4"/>
</svg>

<!-- Lock (Privacy) -->
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
</svg>

<!-- Copy -->
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2"/>
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>
</svg>

<!-- X (Close) -->
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 6 6 18"/>
    <path d="m6 6 12 12"/>
</svg>

<!-- Info -->
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 16v-4"/>
    <path d="M12 8h.01"/>
</svg>

<!-- Folder Open -->
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>
</svg>

<!-- Trash -->
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M3 6h18"/>
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
    <line x1="10" x2="10" y1="11" y2="17"/>
    <line x1="14" x2="14" y1="11" y2="17"/>
</svg>

<!-- Download (Save) -->
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="7 10 12 15 17 10"/>
    <line x1="12" x2="12" y1="15" y2="3"/>
</svg>

<!-- Upload (Import) -->
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" x2="12" y1="3" y2="15"/>
</svg>
```

---

## Button Patterns

### Primary Button (CTA)
```html
<button class="btn btn-primary">
    <svg class="btn-icon" aria-hidden="true">...</svg>
    Clean Text Now
</button>
```

```css
.btn-primary {
    padding: var(--space-3) var(--space-6);
    font-weight: var(--font-semibold);
    background: var(--text-primary);
    color: var(--paper-texture);
    border: 2px solid var(--text-primary);
    border-radius: 6px;
    box-shadow: var(--shadow-sm);
    transition: all var(--duration-fast) var(--ease-smooth);
}

.btn-primary:hover {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
}
```

### Secondary Button
```html
<button class="btn btn-secondary">
    <svg class="btn-icon" aria-hidden="true">...</svg>
    Copy to Clipboard
</button>
```

### Tertiary Button
```html
<button class="btn btn-tertiary">
    <svg class="btn-icon" aria-hidden="true">...</svg>
    Clear Input
</button>
```

---

## Card Pattern

```html
<div class="card">
    <h2 class="card-title">Card Title</h2>
    <p>Card content...</p>
</div>
```

```css
.card {
    background: var(--glass-bg);
    border: 2px solid var(--border-color);
    border-radius: 8px;
    padding: var(--space-8);
    box-shadow: var(--shadow-sm), var(--inset-light);
    transition: all 250ms var(--ease-smooth);
}

.card:hover {
    box-shadow: var(--shadow-md), var(--inset-light);
    border-color: rgba(60, 60, 60, 0.4);
}
```

---

## Toggle Switch Pattern

```html
<label class="toggle-switch">
    <input type="checkbox" checked>
    <span class="toggle-slider"></span>
</label>
```

```css
.toggle-switch {
    position: relative;
    width: 48px;
    height: 28px;
}

.toggle-switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

.toggle-slider {
    position: absolute;
    inset: 0;
    background: rgba(200, 200, 200, 0.6);
    border: 2px solid var(--border-color);
    border-radius: 28px;
    cursor: pointer;
    transition: all 250ms var(--ease-smooth);
}

.toggle-slider::before {
    content: "";
    position: absolute;
    height: 20px;
    width: 20px;
    left: 3px;
    bottom: 3px;
    background: var(--text-secondary);
    border-radius: 50%;
    transition: all 250ms var(--ease-smooth);
}

input:checked + .toggle-slider {
    background: var(--text-primary);
    border-color: var(--text-primary);
}

input:checked + .toggle-slider::before {
    transform: translateX(20px);
    background: var(--paper-texture);
}
```

---

## Form Input Pattern

```html
<label class="form-label" for="input-id">Input Label</label>
<textarea
    class="form-textarea"
    id="input-id"
    aria-describedby="input-help"
    placeholder="Enter text..."
    rows="12"></textarea>
<p id="input-help" class="sr-only">
    Helper text for screen readers
</p>
```

```css
.form-textarea {
    width: 100%;
    min-height: 250px;
    padding: var(--space-4);
    font-family: 'JetBrains Mono', monospace;
    font-size: var(--text-sm);
    background: rgba(255, 255, 255, 0.7);
    border: 2px solid var(--border-color);
    border-radius: 6px;
    transition: all var(--duration-fast) var(--ease-smooth);
}

.form-textarea:focus {
    outline: none;
    background: rgba(255, 255, 255, 0.95);
    border-color: var(--text-primary);
    box-shadow: 0 0 0 3px var(--focus-ring);
}
```

---

## Badge Pattern

```html
<span class="badge">Preview</span>
```

```css
.badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-1);
    padding: var(--space-1) var(--space-3);
    font-size: var(--text-xs);
    font-weight: var(--font-bold);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    background: rgba(10, 10, 10, 0.08);
    color: var(--text-primary);
    border: 2px solid var(--border-color);
    border-radius: 3px;
}
```

---

## Privacy Badge Pattern

```html
<div class="privacy-badge">
    <!-- Lucide: Shield Check -->
    <svg class="privacy-icon" aria-hidden="true">...</svg>
    <span>100% Local Processing</span>
</div>
```

```css
.privacy-badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    padding: var(--space-3) var(--space-5);
    background: rgba(10, 10, 10, 0.06);
    border: 2px solid var(--border-color);
    border-radius: 6px;
    font-size: var(--text-sm);
    font-weight: var(--font-semibold);
    transition: all var(--duration-fast) var(--ease-smooth);
}

.privacy-badge:hover {
    background: rgba(10, 10, 10, 0.08);
    transform: translateY(-1px);
    box-shadow: var(--shadow-sm);
}
```

---

## Page Header Pattern

```html
<div class="page-header">
    <h1 class="page-title">Optimizer</h1>
    <p class="page-subtitle">
        Clean up and standardize AI-generated text...
    </p>
    <div class="privacy-badge">
        <svg class="privacy-icon" aria-hidden="true">...</svg>
        <span>Text never leaves your device</span>
    </div>
</div>
```

```css
.page-header {
    text-align: center;
    margin-bottom: var(--space-12);
    max-width: 900px;
    margin-left: auto;
    margin-right: auto;
}

.page-title {
    font-size: var(--text-5xl);
    font-weight: var(--font-black);
    line-height: 1.1;
    letter-spacing: -0.02em;
    margin-bottom: var(--space-4);
}

.page-subtitle {
    font-size: var(--text-lg);
    color: var(--text-secondary);
    line-height: 1.75;
    margin-bottom: var(--space-6);
}
```

---

## Accessibility Patterns

### Skip to Main Content
```html
<!-- Add at top of <body> -->
<a href="#main" class="skip-to-main">Skip to main content</a>

<!-- Add to <main> -->
<main id="main" role="main">
```

```css
.skip-to-main {
    position: absolute;
    left: -9999px;
    z-index: 999;
    padding: var(--space-3) var(--space-4);
    background: var(--text-primary);
    color: var(--paper-texture);
}

.skip-to-main:focus {
    left: 50%;
    transform: translateX(-50%);
    top: var(--space-4);
}
```

### Screen Reader Only Text
```html
<p class="sr-only">Text for screen readers only</p>
```

```css
.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
```

### Semantic HTML
```html
<header role="banner">
    <nav role="navigation" aria-label="Main navigation">
        ...
    </nav>
</header>

<main id="main" role="main">
    ...
</main>

<footer role="contentinfo">
    ...
</footer>
```

---

## Responsive Patterns

### Mobile-First Breakpoints
```css
/* Mobile (default) */
.hero-title {
    font-size: var(--text-4xl);
}

/* Tablet (768px+) */
@media (min-width: 768px) {
    .hero-title {
        font-size: var(--text-6xl);
    }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
    .hero-title {
        font-size: var(--text-7xl);
    }
}
```

### Touch Targets (Mobile)
```css
/* Minimum 44x44px for touch */
.btn {
    min-height: 44px;
    min-width: 44px;
}
```

---

## Animation Patterns

### Hover Lift
```css
.card:hover {
    transform: translateY(-2px);
    transition: all 250ms var(--ease-smooth);
}
```

### Button Press
```css
.btn:active {
    transform: translateY(0) scale(0.98);
}
```

### Icon Scale
```css
.icon:hover {
    transform: scale(1.1);
    transition: transform var(--duration-fast) var(--ease-smooth);
}
```

---

## Common Mistakes to Avoid

1. **Don't hardcode spacing**
   - ❌ `padding: 12px;`
   - ✅ `padding: var(--space-3);`

2. **Don't use arbitrary colors**
   - ❌ `color: #333;`
   - ✅ `color: var(--text-secondary);`

3. **Don't forget focus states**
   - ❌ `outline: none;` (without replacement)
   - ✅ Add visible focus ring

4. **Don't skip ARIA labels**
   - ❌ `<button><svg>...</svg></button>`
   - ✅ `<button aria-label="Copy"><svg aria-hidden="true">...</svg></button>`

5. **Don't use px for typography**
   - ❌ `font-size: 18px;`
   - ✅ `font-size: var(--text-lg);`

---

## Testing Checklist

Quick things to verify:

- [ ] All spacing uses CSS variables
- [ ] All colors use CSS variables
- [ ] Focus indicators visible (2px minimum)
- [ ] Touch targets 44×44px minimum
- [ ] Icons have proper aria attributes
- [ ] Buttons have clear labels
- [ ] Forms have associated labels
- [ ] Keyboard navigation works
- [ ] Responsive on mobile
- [ ] No console errors

---

## Resources

- **Full Design System**: `/workspace/design-recommendations.md`
- **Implementation Guide**: `/workspace/implementation-guide.md`
- **Mockups**: `/workspace/design-mockups/`
- **Lucide Icons**: https://lucide.dev/icons/
- **WCAG Guidelines**: https://www.w3.org/WAI/WCAG21/quickref/

---

**Last Updated**: November 1, 2025
**Version**: 2.0
