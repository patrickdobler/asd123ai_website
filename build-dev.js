const fs = require('fs');
const path = require('path');

// Create dist directory
const distDir = './dist';
if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

// Debounce map to prevent multiple rapid file copies
const debounceTimers = new Map();
const DEBOUNCE_DELAY = 100; // milliseconds

function debounce(key, callback) {
    if (debounceTimers.has(key)) {
        clearTimeout(debounceTimers.get(key));
    }
    
    const timer = setTimeout(() => {
        debounceTimers.delete(key);
        callback();
    }, DEBOUNCE_DELAY);
    
    debounceTimers.set(key, timer);
}

function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyFile(inputFile, outputFile) {
    try {
        if (!fs.existsSync(inputFile)) {
            console.log(`Source file not found: ${inputFile}`);
            return;
        }
        
        const content = fs.readFileSync(inputFile, 'utf8');
        ensureDir(outputFile);
        fs.writeFileSync(outputFile, content);
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ✓ Copied: ${inputFile}`);
    } catch (error) {
        console.error(`✗ Error copying ${inputFile}:`, error.message);
    }
}

function copyDirectory(src, dest) {
    if (!fs.existsSync(src)) return;
    
    if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true });
    }
    
    const entries = fs.readdirSync(src, { withFileTypes: true });
    
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        
        if (entry.isDirectory()) {
            copyDirectory(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function initialBuild() {
    console.log('=== Initial Development Build ===');
    
    // HTML files
    const htmlFiles = [
        'index.html',
        'optimizer.html',
        'documentation.html',
        'about.html',
        'contact.html',
        'privacy.html',
        'terms.html',
        'test-optimizer.html',
        'anonymizer.html',
        'anonymizer_test.html',
        'anonymizer-guide.html',
        'optimizer-guide.html'
    ];
    
    htmlFiles.forEach(file => {
        if (fs.existsSync(file)) {
            copyFile(file, path.join(distDir, file));
        }
    });
    
    // CSS files
    if (fs.existsSync('styles')) {
        const cssFiles = fs.readdirSync('styles').filter(f => f.endsWith('.css'));
        cssFiles.forEach(file => {
            copyFile(
                path.join('styles', file),
                path.join(distDir, 'styles', file)
            );
        });
    }
    
    // JS files
    if (fs.existsSync('scripts')) {
        const jsFiles = fs.readdirSync('scripts').filter(f => f.endsWith('.js'));
        jsFiles.forEach(file => {
            copyFile(
                path.join('scripts', file),
                path.join(distDir, 'scripts', file)
            );
        });
    }
    
    // Copy other files
    const otherFiles = ['sitemap.xml', 'robots.txt'];
    otherFiles.forEach(file => {
        if (fs.existsSync(file)) {
            fs.copyFileSync(file, path.join(distDir, file));
            const timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] ✓ Copied: ${file}`);
        }
    });
    
    // Copy components directory
    if (fs.existsSync('components')) {
        copyDirectory('components', path.join(distDir, 'components'));
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] ✓ Copied: components directory`);
    }
    
    console.log('=== Build Complete ===\n');
}

function watchFile(file, destFile) {
    if (!fs.existsSync(file)) return;
    
    const watcher = fs.watch(file, (eventType) => {
        if (eventType === 'change') {
            debounce(file, () => {
                copyFile(file, destFile);
            });
        }
    });
    
    watcher.on('error', (error) => {
        console.error(`Watcher error for ${file}:`, error.message);
    });
}

function watchDirectory(dir, distSubDir) {
    if (!fs.existsSync(dir)) {
        console.log(`Directory not found: ${dir}`);
        return;
    }
    
    // Watch the directory itself
    const watcher = fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;
        
        const srcPath = path.join(dir, filename);
        const destPath = path.join(distDir, distSubDir, filename);
        
        // Debounce to handle multiple events for same file
        debounce(srcPath, () => {
            if (fs.existsSync(srcPath)) {
                const stats = fs.statSync(srcPath);
                if (stats.isFile()) {
                    copyFile(srcPath, destPath);
                }
            } else {
                // File was deleted
                if (fs.existsSync(destPath)) {
                    fs.unlinkSync(destPath);
                    const timestamp = new Date().toLocaleTimeString();
                    console.log(`[${timestamp}] ✗ Deleted: ${destPath}`);
                }
            }
        });
    });
    
    watcher.on('error', (error) => {
        console.error(`Watcher error for ${dir}:`, error.message);
    });
}

function setupWatchers() {
    console.log('=== Setting Up File Watchers ===');
    
    // Watch HTML files individually
    const htmlFiles = [
        'index.html', 'optimizer.html', 'documentation.html',
        'about.html', 'contact.html', 'privacy.html', 'terms.html',
        'test-optimizer.html', 'anonymizer.html', 'anonymizer_test.html',
        'anonymizer-guide.html', 'optimizer-guide.html'
    ];
    
    htmlFiles.forEach(file => {
        watchFile(file, path.join(distDir, file));
    });
    
    // Watch directories
    watchDirectory('styles', 'styles');
    watchDirectory('scripts', 'scripts');
    watchDirectory('components', 'components');
    
    console.log('✓ Watching for file changes...');
    console.log('✓ Edit your files and they will auto-copy to dist/');
    console.log('✓ Press Ctrl+C to stop\n');
}

// Handle process termination
process.on('SIGINT', () => {
    console.log('\n\n=== Stopping File Watcher ===');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n\n=== Stopping File Watcher ===');
    process.exit(0);
});

// Start
initialBuild();
setupWatchers();
