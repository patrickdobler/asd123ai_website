const fs = require('fs');
const path = require('path');

// Dev build: copy source into dist/ unminified and watch for changes.
// Mirrors tools/build.js layout exactly, so dev and prod serve identical paths.
// Paths resolve from the repo root (npm runs scripts with cwd = repo root).
const distDir = './dist';

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const debounceTimers = new Map();
const DEBOUNCE_DELAY = 100;

function debounce(key, callback) {
    if (debounceTimers.has(key)) clearTimeout(debounceTimers.get(key));
    debounceTimers.set(key, setTimeout(() => {
        debounceTimers.delete(key);
        callback();
    }, DEBOUNCE_DELAY));
}

function copyFile(inputFile, outputFile) {
    try {
        if (!fs.existsSync(inputFile)) return;
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
        fs.copyFileSync(inputFile, outputFile);
        console.log(`[${new Date().toLocaleTimeString()}] ✓ ${inputFile}`);
    } catch (error) {
        console.error(`✗ Error copying ${inputFile}:`, error.message);
    }
}

function copyDir(src, dest) {
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
    }
}

// Copy every .html in a directory to the dist root (pages are flattened).
function copyHtmlFlat(dir) {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir)
        .filter(f => f.endsWith('.html'))
        .forEach(f => copyFile(path.join(dir, f), path.join(distDir, f)));
}

function initialBuild() {
    console.log('=== Initial Development Build ===');
    copyHtmlFlat('src/pages');   // production pages
    copyHtmlFlat('dev');         // dev-only pages (chat-bench)
    copyDir('src/styles', path.join(distDir, 'styles'));
    copyDir('src/scripts', path.join(distDir, 'scripts'));
    copyDir('public', distDir);          // favicons, logo, robots, sitemap, vendor/
    copyDir('vendor-dev', path.join(distDir, 'vendor-dev')); // dev-only engine
    console.log('=== Build Complete ===\n');
}

// Watch a directory; mirror file changes into dist at distSubDir (recursive).
function watchDirectory(dir, distSubDir) {
    if (!fs.existsSync(dir)) return;
    const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        const srcPath = path.join(dir, filename);
        const destPath = path.join(distDir, distSubDir, filename);
        debounce(srcPath, () => {
            if (fs.existsSync(srcPath)) {
                if (fs.statSync(srcPath).isFile()) copyFile(srcPath, destPath);
            } else if (fs.existsSync(destPath)) {
                fs.unlinkSync(destPath);
                console.log(`[${new Date().toLocaleTimeString()}] ✗ Deleted: ${destPath}`);
            }
        });
    });
    watcher.on('error', error => console.error(`Watcher error for ${dir}:`, error.message));
}

function setupWatchers() {
    console.log('=== Setting Up File Watchers ===');
    watchDirectory('src/pages', '');   // pages -> dist root
    watchDirectory('dev', '');         // dev pages -> dist root
    watchDirectory('src/styles', 'styles');
    watchDirectory('src/scripts', 'scripts');
    watchDirectory('public', '');      // public assets (incl. vendor) -> dist root
    watchDirectory('vendor-dev', 'vendor-dev');
    console.log('✓ Watching for changes... (Ctrl+C to stop)\n');
}

process.on('SIGINT', () => { console.log('\n=== Stopping watcher ==='); process.exit(0); });
process.on('SIGTERM', () => { console.log('\n=== Stopping watcher ==='); process.exit(0); });

initialBuild();
setupWatchers();
