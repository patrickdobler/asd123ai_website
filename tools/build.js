const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
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

// Generate dist/sitemap.xml from the actual pages, with lastmod taken from each
// page's last git commit (hand-maintained dates in a static sitemap went stale).
function generateSitemap() {
    const TOOLS = new Set(['text-cleaner', 'anonymizer', 'chat', 'context', 'converter', 'tts']);
    const LEGAL = new Set(['privacy', 'terms']);
    const entries = [];
    for (const file of fs.readdirSync(path.join(SRC, 'pages')).filter(f => f.endsWith('.html'))) {
        const name = file.replace(/\.html$/, '');
        const loc = name === 'index' ? 'https://asd123.ai/' : `https://asd123.ai/${name}`;
        let lastmod;
        try {
            lastmod = execFileSync('git', ['log', '-1', '--format=%cs', '--', path.join(SRC, 'pages', file)], { encoding: 'utf8' }).trim();
        } catch (_) { /* not a git checkout */ }
        if (!lastmod) lastmod = new Date().toISOString().slice(0, 10);
        let priority = 0.7, changefreq = 'monthly';
        if (name === 'index') { priority = 1.0; changefreq = 'weekly'; }
        else if (TOOLS.has(name)) { priority = 0.9; changefreq = 'weekly'; }
        else if (name === 'documentation') { priority = 0.8; }
        else if (LEGAL.has(name)) { priority = 0.5; changefreq = 'yearly'; }
        entries.push({ loc, lastmod, changefreq, priority, sort: name === 'index' ? '' : name });
    }
    entries.sort((a, b) => b.priority - a.priority || a.sort.localeCompare(b.sort));
    const xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
        + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + entries.map(e =>
            `    <url>\n        <loc>${e.loc}</loc>\n        <lastmod>${e.lastmod}</lastmod>\n        <changefreq>${e.changefreq}</changefreq>\n        <priority>${e.priority.toFixed(1)}</priority>\n    </url>`
        ).join('\n')
        + '\n</urlset>\n';
    fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml);
    console.log(`Generated: sitemap.xml (${entries.length} URLs)`);
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

    // Tailwind: compile the utilities actually used in pages/scripts into a
    // static stylesheet (replaces the former in-browser Play runtime).
    execFileSync(process.execPath, [
        require.resolve('tailwindcss/lib/cli.js'),
        '-c', 'tools/tailwind.config.js',
        '-i', 'tools/tailwind.input.css',
        '-o', path.join(distDir, 'styles', 'tailwind.css'),
        '--minify'
    ], { stdio: 'inherit' });
    console.log('Compiled: tailwind.css');

    // JS: src/scripts/*.js
    const scriptsDir = path.join(SRC, 'scripts');
    for (const file of fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'))) {
        await minifyFile(path.join(scriptsDir, file), path.join(distDir, 'scripts', file), 'js');
    }


    // Static public assets (favicons, logo, robots.txt, vendor/) -> dist root.
    if (fs.existsSync(PUBLIC)) {
        copyDir(PUBLIC, distDir);
        console.log('Copied: public assets (incl. vendor)');
    }

    // Sitemap is generated (not a static asset) so lastmod tracks git history.
    generateSitemap();

    console.log('Build complete!');
}

build().catch(console.error);
