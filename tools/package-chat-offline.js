const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(rootDir, args.out || 'offline-chat');
const modelDir = args.models ? path.resolve(args.models) : null;
const vendorFile = args.vendor ? path.resolve(args.vendor) : null;

function parseArgs(values) {
    const parsed = {};

    for (let i = 0; i < values.length; i++) {
        const value = values[i];
        if (!value.startsWith('--')) {
            continue;
        }

        const key = value.slice(2);
        parsed[key] = values[i + 1] && !values[i + 1].startsWith('--') ? values[++i] : true;
    }

    return parsed;
}

function ensureDir(target) {
    fs.mkdirSync(target, { recursive: true });
}

function copyFile(source, target) {
    ensureDir(path.dirname(target));
    fs.copyFileSync(source, target);
}

function copyDirectory(source, target) {
    ensureDir(target);

    for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
        const sourcePath = path.join(source, entry.name);
        const targetPath = path.join(target, entry.name);

        if (entry.isDirectory()) {
            copyDirectory(sourcePath, targetPath);
        } else {
            copyFile(sourcePath, targetPath);
        }
    }
}

function copyOfflineIndex() {
    const html = fs.readFileSync(path.join(rootDir, 'chat.html'), 'utf8')
        .replace(/href="chat\.html"/g, 'href="index.html"')
        .replace(/https:\/\/asd123\.ai\/chat/g, 'index.html');
    fs.writeFileSync(path.join(outDir, 'index.html'), html);
}

function writeReadme() {
    const readme = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ASD123.ai Local Chat Offline Bundle</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.6; max-width: 820px; margin: 48px auto; padding: 0 24px; }
        code { background: #f1f1ec; padding: 2px 6px; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>ASD123.ai Local Chat Offline Bundle</h1>
    <p>Open <code>index.html</code> in a Chromium-based browser with WebGPU support.</p>
    <p>Use the <strong>Offline Folder</strong> button in the app and select the folder that contains this bundle or its <code>models</code> directory. The app will resolve model files from disk after browser permission is granted.</p>
    <p>Expected model layout examples:</p>
    <ul>
        <li><code>models/onnx-community--gemma-4-E2B-it-ONNX/config.json</code></li>
        <li><code>models/onnx-community/gemma-4-E2B-it-ONNX/config.json</code></li>
    </ul>
    <p>No executable or local server is required. If the bundle has no <code>vendor/transformers.min.js</code>, add a local Transformers.js ESM build before using the bundle fully offline.</p>
</body>
</html>
`;
    fs.writeFileSync(path.join(outDir, 'README.html'), readme);
}

function main() {
    fs.rmSync(outDir, { recursive: true, force: true });
    ensureDir(outDir);

    copyOfflineIndex();
    copyFile(path.join(rootDir, 'styles', 'main.css'), path.join(outDir, 'styles', 'main.css'));
    copyFile(path.join(rootDir, 'styles', 'components.css'), path.join(outDir, 'styles', 'components.css'));

    [
        'shared.js',
        'chat-app.js',
        'chat-files.js',
        'chat-models.js',
        'chat-offline.js',
        'chat-storage.js'
    ].forEach(file => {
        copyFile(path.join(rootDir, 'scripts', file), path.join(outDir, 'scripts', file));
    });

    ensureDir(path.join(outDir, 'models'));

    if (modelDir) {
        if (!fs.existsSync(modelDir)) {
            throw new Error(`Model directory not found: ${modelDir}`);
        }
        copyDirectory(modelDir, path.join(outDir, 'models'));
    }

    if (vendorFile) {
        if (!fs.existsSync(vendorFile)) {
            throw new Error(`Vendor file not found: ${vendorFile}`);
        }
        copyFile(vendorFile, path.join(outDir, 'vendor', 'transformers.min.js'));
    }

    writeReadme();

    console.log(`Offline chat bundle created at ${outDir}`);
    if (!vendorFile) {
        console.log('Note: pass --vendor /path/to/transformers.min.js to include the Transformers.js runtime for full offline use.');
    }
    if (!modelDir) {
        console.log('Note: pass --models /path/to/model-root to include model files.');
    }
}

main();
