const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const { minify: minifyJS } = require('terser');
const CleanCSS = require('clean-css');

// Paths are resolved from the repo root (npm runs scripts with cwd = repo root).
const SRC = 'src';
const PUBLIC = 'public';
const distDir = './dist';

// Recreate dist so removed pages do not linger as stale deployable assets.
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

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
    compress: { drop_console: true, drop_debugger: true },
    mangle: true,
    format: { comments: false }
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
                minified = new CleanCSS({ level: 2 }).minify(content).styles;
                break;
            case 'js':
                minified = (await minifyJS(content, jsMinifyOptions)).code;
                break;
            default:
                minified = content;
        }
        fs.mkdirSync(path.dirname(outputFile), { recursive: true });
        fs.writeFileSync(outputFile, minified);
        console.log(`Minified: ${inputFile} -> ${outputFile}`);
    } catch (error) {
        console.error(`Error minifying ${inputFile}:`, error);
    }
}

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
        const s = path.join(src, entry.name);
        const d = path.join(dest, entry.name);
        if (entry.isDirectory()) copyDir(s, d);
        else fs.copyFileSync(s, d);
    }
}

async function build() {
    console.log('Building for production...');

    // HTML pages: src/pages/*.html -> dist/*.html (flattened to the root).
    const pagesDir = path.join(SRC, 'pages');
    for (const file of fs.readdirSync(pagesDir).filter(f => f.endsWith('.html'))) {
        await minifyFile(path.join(pagesDir, file), path.join(distDir, file), 'html');
    }

    // CSS: src/styles/*.css (anonymizer.css is merged into components.css).
    const stylesDir = path.join(SRC, 'styles');
    for (const file of fs.readdirSync(stylesDir).filter(f => f.endsWith('.css') && f !== 'anonymizer.css')) {
        await minifyFile(path.join(stylesDir, file), path.join(distDir, 'styles', file), 'css');
    }

    // JS: src/scripts/*.js
    const scriptsDir = path.join(SRC, 'scripts');
    for (const file of fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'))) {
        await minifyFile(path.join(scriptsDir, file), path.join(distDir, 'scripts', file), 'js');
    }


    // Static public assets (favicons, logo, robots.txt, sitemap.xml, vendor/) -> dist root.
    if (fs.existsSync(PUBLIC)) {
        copyDir(PUBLIC, distDir);
        console.log('Copied: public assets (incl. vendor)');
    }

    console.log('Build complete!');
}

build().catch(console.error);
