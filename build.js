const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const { minify: minifyJS } = require('terser');
const CleanCSS = require('clean-css');

// Recreate dist directory so removed pages do not remain deployable as stale assets.
const distDir = './dist';
const srcDir = './src';
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
if (!fs.existsSync(srcDir)) {
    fs.mkdirSync(srcDir, { recursive: true });
}

// Minification options
const htmlMinifyOptions = {
    removeComments: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: true,
    collapseWhitespace: true,
    preserveLineBreaks: false,
    removeAttributeQuotes: true,
    useShortDoctype: true
};

const jsMinifyOptions = {
    compress: {
        drop_console: true,
        drop_debugger: true
    },
    mangle: true,
    format: {
        comments: false
    }
};

async function minifyFile(inputFile, outputFile, type) {
    try {
        const content = fs.readFileSync(inputFile, 'utf8');
        let minified;
        
        switch (type) {
            case 'html':
                minified = await minify(content, htmlMinifyOptions);
                break;
            case 'css':
                const cleanCSS = new CleanCSS({ level: 2 });
                minified = cleanCSS.minify(content).styles;
                break;
            case 'js':
                const result = await minifyJS(content, jsMinifyOptions);
                minified = result.code;
                break;
            default:
                minified = content;
        }
        
        fs.writeFileSync(outputFile, minified);
        console.log(`Minified: ${inputFile} -> ${outputFile}`);
    } catch (error) {
        console.error(`Error minifying ${inputFile}:`, error);
    }
}

async function copyAndMinifyFiles() {
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
        'chat.html',
        'context.html',
        'anonymizer.html',
        'anonymizer-guide.html',
        'chat-guide.html',
        'context-guide.html',
        'optimizer-guide.html'
    ];
    for (const file of htmlFiles) {
        if (fs.existsSync(file)) {
            await minifyFile(file, path.join(distDir, file), 'html');
        }
    }
    
    // CSS files - excluding anonymizer.css (merged into components.css)
    if (fs.existsSync('styles')) {
        if (!fs.existsSync(path.join(distDir, 'styles'))) {
            fs.mkdirSync(path.join(distDir, 'styles'), { recursive: true });
        }
        const cssFiles = fs.readdirSync('styles')
            .filter(f => f.endsWith('.css') && f !== 'anonymizer.css');
        for (const file of cssFiles) {
            await minifyFile(
                path.join('styles', file),
                path.join(distDir, 'styles', file),
                'css'
            );
        }
    }
    
    // JS files - minify and uglify all scripts
    if (fs.existsSync('scripts')) {
        if (!fs.existsSync(path.join(distDir, 'scripts'))) {
            fs.mkdirSync(path.join(distDir, 'scripts'), { recursive: true });
        }
        const jsFiles = fs.readdirSync('scripts').filter(f => f.endsWith('.js'));
        for (const file of jsFiles) {
            await minifyFile(
                path.join('scripts', file),
                path.join(distDir, 'scripts', file),
                'js'
            );
        }
    }
    
    // Copy other files as-is
    const otherFiles = ['sitemap.xml', 'robots.txt'];
    for (const file of otherFiles) {
        if (fs.existsSync(file)) {
            fs.copyFileSync(file, path.join(distDir, file));
            console.log(`Copied: ${file}`);
        }
    }
    
    // Copy components directory
    if (fs.existsSync('components')) {
        const copyRecursively = (src, dest) => {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            const files = fs.readdirSync(src);
            for (const file of files) {
                const srcFile = path.join(src, file);
                const destFile = path.join(dest, file);
                if (fs.statSync(srcFile).isDirectory()) {
                    copyRecursively(srcFile, destFile);
                } else {
                    fs.copyFileSync(srcFile, destFile);
                }
            }
        };
        copyRecursively('components', path.join(distDir, 'components'));
        console.log('Copied: components directory');
    }

    // Copy self-hosted vendor assets used by browser-only tools
    if (fs.existsSync('vendor')) {
        const copyRecursively = (src, dest) => {
            if (!fs.existsSync(dest)) {
                fs.mkdirSync(dest, { recursive: true });
            }
            const files = fs.readdirSync(src);
            for (const file of files) {
                const srcFile = path.join(src, file);
                const destFile = path.join(dest, file);
                if (fs.statSync(srcFile).isDirectory()) {
                    copyRecursively(srcFile, destFile);
                } else {
                    fs.copyFileSync(srcFile, destFile);
                }
            }
        };
        copyRecursively('vendor', path.join(distDir, 'vendor'));
        console.log('Copied: vendor directory');
    }
}

async function main() {
    console.log('Building for production...');
    await copyAndMinifyFiles();
    console.log('Build complete!');
}

main().catch(console.error);
