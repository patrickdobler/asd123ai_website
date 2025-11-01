# Command for Coder Agent - ASD123.ai Design Implementation

## Single Command to Run Everything

Use this exact command when invoking a coder agent to implement all design refinements:

```
Implement the ASD123.ai design refinements as specified in /workspace/CODER_IMPLEMENTATION_GUIDE.md

Reference materials:
- Base mockups: /workspace/design-mockups/
  - optimizer-mockup.html (for optimizer.html)
  - anonymizer-mockup.html (for anonymizer.html)
  - homepage-mockup.html (for index.html)

Detailed implementation guide: /workspace/CODER_IMPLEMENTATION_GUIDE.md

Key changes to implement:

### Optimizer Page (optimizer.html)
1. Copy structure from optimizer-mockup.html
2. Update buttons with Lucide icons (Wand, Copy, X)
3. Add "Replace em dash with new sentence" to Content Cleaning section
4. Add experimental badge to "Remove Citation References"
5. Update footer to match homepage-mockup.html footer
6. Remove logo from header (text-only)

### Anonymizer Page (anonymizer.html)
1. Copy structure from anonymizer-mockup.html
2. Move "Anonymize Selected Text" button to Anonymized Output column header
3. Place Redact Mode and List View/Tiles View buttons in section header (icon-only)
4. Export CSV and Import buttons in entities-controls section
5. Update footer to match homepage-mockup.html footer
6. Remove logo from header (text-only)

### Homepage (index.html)
1. Copy structure from homepage-mockup.html
2. Ensure footer matches homepage-mockup.html
3. Remove logo from header (text-only)

### Supporting Pages
1. Create about.html with consistent header, footer, and "Made in Switzerland for Privacy" section
2. Update documentation.html, privacy.html, contact.html with consistent header and footer
3. All pages should use standard footer (from homepage-mockup.html)
4. All page titles should be 56px (--text-5xl)

### CSS System
Verify main.css and components.css contain:
- All design system variables (colors, typography, spacing)
- .footer-left, .footer-links, .privacy-inline styles
- .social-links and .social-icon styles

### Testing
After implementation:
1. Test responsive design: 320px, 768px, 1280px+
2. Test cross-browser: Chrome, Firefox, Safari, Edge
3. Test accessibility: keyboard navigation, screen readers
4. Test all links and buttons
5. Run build: npm run build
6. Test production build: npm run dev

Complete implementation instructions available in CODER_IMPLEMENTATION_GUIDE.md
```

---

## Quick Reference: Key Fixes Applied

| Issue | Fix | File |
|-------|-----|------|
| Optimizer buttons | Updated icons + removed experimental section | optimizer-mockup.html ✅ |
| Experimental tag | Moved to Content Cleaning (kept function) | optimizer-mockup.html ✅ |
| em dash function | Added back to Content Cleaning | optimizer-mockup.html ✅ |
| Anonymize button | Moved to Anonymized Output section | anonymizer-mockup.html ✅ |
| Redact/List View buttons | Moved to section header (icon-only) | anonymizer-mockup.html ✅ |
| Footer | Standardized with privacy message & social links | Both pages ✅ |

---

## Files Status

### Mockup Files (Ready to Use)
- ✅ `/workspace/design-mockups/optimizer-mockup.html` - All fixes applied
- ✅ `/workspace/design-mockups/anonymizer-mockup.html` - All fixes applied
- ✅ `/workspace/design-mockups/homepage-mockup.html` - Reference for footer structure

### Documentation Files
- ✅ `/workspace/CODER_IMPLEMENTATION_GUIDE.md` - Updated with all fixes
- ✅ `/workspace/DESIGN_REFINEMENT_GUIDE.md` - Design system specs
- ✅ `/workspace/REFINEMENT_SUMMARY.md` - Project summary

### Production Files to Update
- `optimizer.html`
- `anonymizer.html`
- `index.html`
- `about.html` (create new)
- `documentation.html`
- `privacy.html`
- `contact.html`
- `styles/main.css` (verify)
- `styles/components.css` (verify)

---

## What the Coder Agent Should Know

1. **All mockups have been corrected** - They now have all the required fixes
2. **Documentation is complete** - CODER_IMPLEMENTATION_GUIDE.md has all code snippets
3. **Footer is standardized** - Same footer on all pages (see homepage-mockup.html)
4. **No logos in headers** - All headers display text-only branding
5. **Design system is documented** - CSS variables and spacing defined in main.css

---

## Expected Outcomes

After implementation:
- ✅ All 3 core pages updated (Optimizer, Anonymizer, Homepage)
- ✅ All supporting pages created/updated (About, Docs, Privacy, Contact)
- ✅ Consistent footer across all pages
- ✅ Consistent header styling (text-only, no logos)
- ✅ Responsive design working (mobile, tablet, desktop)
- ✅ Accessible (WCAG 2.1 AA target)
- ✅ Cross-browser compatible
- ✅ Build process working (`npm run build`)
- ✅ Ready for deployment (`npm run deploy`)

---

## Support Resources for Coder Agent

1. **CODER_IMPLEMENTATION_GUIDE.md** - Main technical guide with all code
2. **DESIGN_REFINEMENT_GUIDE.md** - Design system and specifications
3. **Design Mockups** - Visual references in `/workspace/design-mockups/`
4. **CLAUDE.md** - Project architecture and setup
5. **Implementation Checklists** - In CODER_IMPLEMENTATION_GUIDE.md (Phase 1-5)

---

## Key Code Snippets Available

The CODER_IMPLEMENTATION_GUIDE.md includes complete code for:
- Button code with all Lucide icons
- Content Cleaning section with all 3 items
- Anonymizer layout with button placement
- Standard footer with privacy message + social links
- Page header templates
- CSS design system reference

---

**Status**: ✅ Ready for Coder Agent Implementation
**Last Updated**: November 2024
**All Corrections**: Applied and Documented
