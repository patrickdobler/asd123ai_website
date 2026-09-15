# ASD123.ai

Privacy-first AI text tools that run **100% in the browser** (no server-side
processing of user text). Deployed on Cloudflare Workers as a static site.

## Develop

```bash
npm install
npm run dev      # build-dev (watch) + wrangler dev  →  http://localhost:8787
npm test         # focused workflow regressions
npm run build    # production build into dist/
npm run deploy   # build + deploy to Cloudflare (wrangler)
```

## Project layout

You edit **`src/`** and **`public/`**. The build copies them into **`dist/`**,
which is **generated and gitignored — never edit it by hand**. Pages and public
assets are flattened to the `dist/` root, so `src/pages/index.html` is served at
`/`, `src/scripts/x.js` at `/scripts/x.js`, `public/vendor/y` at `/vendor/y`, etc.

| Path | What it is |
|------|------------|
| `src/index.js` | Cloudflare Worker — clean-URL routing + the Apple-Silicon chat-engine proxy (wrangler `main`) |
| `src/pages/` | Production HTML pages → `dist/*.html` |
| `src/scripts/` | JavaScript modules → `dist/scripts/` |
| `src/styles/` | `main.css` + `components.css` → `dist/styles/` |
| `src/components/` | Shared HTML partials / language mappings → `dist/components/` |
| `public/` | Static assets served as-is → `dist/` root (favicons, `logo.png`, `robots.txt`, `sitemap.xml`, `vendor/`) |
| `tools/` | Build + helper scripts (`build.js`, `build-dev.js`, `make-favicons.py`, `package-chat-offline.js`) |
| `docs/` | Architecture/design notes, mockups, examples (not deployed) |
| `dist/` | **Build output — generated, gitignored** |

Dev-only (gitignored, never deployed): `dev/` (chat-bench), `vendor-dev/`.

### Adding a page
Create `src/pages/<name>.html`, add the clean-URL routes in `src/index.js`, then
`npm run build`. (The build auto-discovers every `.html` in `src/pages/`.)
Verify it at **375px** for mobile overflow before shipping — see `CLAUDE.md`.

### Favicons
Generated from `public/logo.png` by `python3 tools/make-favicons.py` (composited
onto a white rounded box so the black logo stays visible on dark browser tabs).

## Tool workflows

The site includes Text Cleaner, Anonymizer, Markdown Converter, Context Estimator,
Local AI Chat and Text to Speech. Separate product pages describe apps for macOS
or self-hosting; their data processing differs from these browser tools.

The converter can open its Markdown directly in a new Anonymizer tab. The explicit
one-time handoff uses same-origin messaging with a per-transfer token and source
window check. Text is never put in the URL or persistent storage. Anonymizer
mappings remain in memory and are cleared on page exit. Only numbered placeholders
can be restored automatically; generic redactions cannot.

Run `node --test tests/*.test.cjs` and `node tools/build.js` to validate locally.
Browser checks should cover correction, restoration, the converter handoff,
keyboard navigation, both themes and 320/375/768-pixel layouts.
