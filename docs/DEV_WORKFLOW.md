# Development Workflow Guide

## Quick Start

Simply run:

```bash
npm run dev
```

This single command will:
1. **Watch for file changes** - Automatically copy modified files to `dist/` (no minification)
2. **Run Wrangler dev server** - Serve your site at `http://localhost:8787` with hot reloading

**You no longer need to restart the server when you make changes!** Just edit your files and refresh your browser.

---

## Available Scripts

### Development

- **`npm run dev`** *(recommended)*  
  Runs both the file watcher and Wrangler dev server simultaneously. This is your go-to command for development.

- **`npm run dev:watch`**  
  Runs only the file watcher (copies files to dist/ without minification).

- **`npm run dev:server`**  
  Runs only the Wrangler dev server.

### Production

- **`npm run build`**  
  Creates an optimized production build in `dist/` with:
  - Minified HTML, CSS, and JavaScript
  - Console logs removed
  - Comments stripped

- **`npm run deploy`**  
  Builds and deploys to Cloudflare Workers production environment.

---

## How It Works

### Development Mode (`npm run dev`)

1. **Initial Build**: Copies all source files to `dist/` (unminified for easier debugging)
2. **File Watching**: Monitors these directories for changes:
   - Root HTML files
   - `scripts/` - JavaScript files
   - `styles/` - CSS files
   - `components/` - Shared components and mappings
3. **Auto-Copy**: When you save a file, it's instantly copied to `dist/`
4. **Hot Reload**: Wrangler detects the change and triggers a browser refresh

### Production Mode (`npm run build`)

Uses [`build.js`](build.js) to create optimized assets:
- Minifies HTML with aggressive whitespace removal
- Uglifies JavaScript (removes console logs, debugger statements)
- Minifies CSS with level 2 optimizations
- Copies static assets (sitemap, robots.txt, components)

---

## Development Tips

### Making Changes

1. **Edit source files** in the root directory or subdirectories (not in `dist/`)
2. **Save your changes** - they'll automatically copy to `dist/` (with timestamp in console)
3. **Wait a moment** - the file watcher debounces changes (100ms) for reliability
4. **Refresh your browser** - Wrangler will serve the updated files

**Look for these console messages:**
- `[HH:MM:SS] ✓ Copied: filename` - File successfully updated
- `[HH:MM:SS] ✗ Deleted: filename` - File was removed

### Debugging

- Source files in dev mode are **unminified** - easier to debug with browser DevTools
- Console logs are preserved during development
- Check the terminal output for file watcher and Wrangler messages

### Stopping the Dev Server

Press `Ctrl+C` once - this will stop both the file watcher and Wrangler server.

---

## Troubleshooting

### Changes aren't showing up?

1. Check the terminal - you should see `Change detected: <filename>` messages
2. Hard refresh your browser (`Ctrl+Shift+R` or `Cmd+Shift+R`)
3. Clear your browser cache
4. Check that you're editing files in the root/source directories (not `dist/`)

### "Port 8787 already in use"?

Another dev server is running. Find and kill it:
```bash
# Linux/Mac
lsof -ti:8787 | xargs kill -9

# Or just restart your terminal
```

### File watcher not detecting changes?

1. **Check the terminal** - Look for `[timestamp] ✓ Copied: filename` messages
2. **Wait briefly** - Changes are debounced (100ms delay) to prevent conflicts
3. **Save the file again** - IDE might not have written the file yet
4. **Restart dev server** - If still not working: `Ctrl+C` then `npm run dev`

Some systems have file watcher limits. Increase them if needed:
```bash
# Linux
echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

### Chrome DevTools errors?

The `.well-known/appspecific/com.chrome.devtools.json` 404 error is now handled gracefully and won't appear in your logs.

---

## What Changed?

### Before
- Run `npm run dev`
- Make a change
- Stop server (`Ctrl+C`)
- Run `npm run dev` again
- Wait for build to complete
- Refresh browser

### After
- Run `npm run dev` **once**
- Make changes and save
- Refresh browser
- That's it! 🎉

---

## Technical Details

- **File Watcher**: Custom Node.js script using `fs.watch()` with:
  - Recursive directory monitoring
  - 100ms debouncing to prevent duplicate copies
  - Timestamped console output for debugging
  - Automatic handling of file deletions
- **Process Manager**: `concurrently` runs both watch and server processes
- **Build Optimization**: Development builds skip minification for faster iteration
- **Production Builds**: Still use full minification when deploying
- **Chrome DevTools**: Worker gracefully handles `.well-known/` requests (204 No Content)
