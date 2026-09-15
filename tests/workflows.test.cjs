const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadClass(file, name, globals = {}) {
    const source = fs.readFileSync(file, 'utf8').replace(/^import .*;$/gm, '').replace(/^export .*;$/gm, '');
    const context = vm.createContext({ console, document: { addEventListener() {} }, ...globals });
    return vm.runInContext(source + `\n${name}`, context);
}
function restoration(text) {
    const fields = { llmInput: { value: text }, llmOutput: { value: '' } };
    const App = loadClass('src/scripts/anonymizer-core.js', 'AnonymizerApp', {
        document: { addEventListener() {}, getElementById: id => fields[id] }
    });
    const entries = new Map([
        ['[EMAIL_1]', { original: 'alpha@example.com', isActive: true }],
        ['[EMAIL_2]', { original: 'beta@example.com', isActive: true }]
    ]);
    App.prototype.deanonymizeText.call({
        entityManager: { entityMap: entries, getEntity: key => entries.get(key) },
        redactionOrder: ['[EMAIL_1]', '[EMAIL_2]'],
        uiController: { showSuccess() {}, showError() {}, showInfo() {} }
    });
    return fields.llmOutput.value;
}
test('generic redactions are never guessed after an answer drops or reorders values', () => {
    assert.equal(restoration('Second address: [redacted].'), 'Second address: [redacted].');
});
test('unique placeholders restore repeated and reordered values', () => {
    assert.equal(restoration('[EMAIL_2] / [EMAIL_1] / [EMAIL_2]'), 'beta@example.com / alpha@example.com / beta@example.com');
});
test('unknown placeholders remain visible for manual review', () => {
    assert.equal(restoration('[EMAIL_3]'), '[EMAIL_3]');
});
test('oversized images are rejected before reading the image', () => {
    const Processor = loadClass('src/scripts/chat-files.js', 'ChatFileProcessor');
    assert.equal(new Processor().validate({ name: 'large.png', type: 'image/png', size: 15 * 1024 * 1024 + 1 }).ok, false);
});
test('supported text attachments and images at the limit are accepted', () => {
    const Processor = loadClass('src/scripts/chat-files.js', 'ChatFileProcessor');
    for (const name of ['data.csv', 'data.json', 'server.log', 'image.png']) {
        assert.equal(new Processor().validate({ name, type: name.endsWith('png') ? 'image/png' : 'text/plain', size: 15 * 1024 * 1024 }).ok, true);
    }
});

function outputApp(text, entries = []) {
    const fields = {
        inputText: { value: text }, outputText: { value: '' }, outputState: {},
        copyOutputBtn: {}, placeholderModeBtn: { setAttribute() {} }, redactBtn: { setAttribute() {} }
    };
    const EntityManager = loadClass('src/scripts/entity-manager.js', 'EntityManager');
    const App = loadClass('src/scripts/anonymizer-core.js', 'AnonymizerApp', {
        document: { addEventListener() {}, getElementById: id => fields[id] }
    });
    const app = Object.create(App.prototype);
    Object.assign(app, {
        entityManager: new EntityManager(), sourceText: text, placeholderText: text,
        isRedactMode: false, isProcessing: false,
        uiController: { updateEntityList() {}, showInfo() {}, showError() {}, showSuccess() {} }, refreshHighlightView() {}
    });
    for (const [token, entity] of entries) app.entityManager.entityMap.set(token, entity);
    return { app, fields };
}
test('programmatic input changes disable copying an old result', () => {
    const { app, fields } = outputApp('Document A');
    app.renderOutput(); assert.equal(fields.copyOutputBtn.disabled, false);
    fields.inputText.value = 'Document B'; app.updateInputState();
    assert.equal(fields.copyOutputBtn.disabled, true);
    assert.match(fields.outputState.textContent, /Input changed/);
    fields.inputText.value = 'Document A'; app.updateInputState();
    assert.equal(fields.copyOutputBtn.disabled, false);
});

test('IPv6 placeholders stay intact across display modes', () => {
    const { app, fields } = outputApp('[IP_ADDRESS_IPV6_1]', [['[IP_ADDRESS_IPV6_1]', { original: '2001:db8::1', isActive: true }]]);
    app.renderOutput(); assert.equal(fields.outputText.value, '[IP_ADDRESS_IPV6_1]');
    app.isRedactMode = true; app.renderOutput(); assert.equal(fields.outputText.value, '[redacted]');
    app.entityManager.getEntity('[IP_ADDRESS_IPV6_1]').isActive = false;
    app.renderOutput(); assert.equal(fields.outputText.value, '2001:db8::1');
});
test('selected text anonymizes only the selected occurrence', () => {
    const { app, fields } = outputApp('ProjektX and ProjektX');
    app.renderOutput();
    Object.assign(fields.outputText, { selectionStart: 13, selectionEnd: 21 });
    app.anonymizeHighlighted();
    assert.equal(fields.outputText.value, 'ProjektX and [CUSTOM_1]');
    assert.equal(app.entityManager.getEntity('[CUSTOM_1]').original, 'ProjektX');
});
test('selected text uses displayed offsets after redacted or unchecked entities', () => {
    for (const active of [true, false]) {
        const { app, fields } = outputApp('[EMAIL_1] then $&', [['[EMAIL_1]', { original: 'long@example.com', isActive: active }]]);
        app.isRedactMode = true; app.renderOutput();
        const start = fields.outputText.value.indexOf('$&');
        Object.assign(fields.outputText, { selectionStart: start, selectionEnd: start + 2 });
        app.anonymizeHighlighted();
        assert.equal(app.placeholderText, '[EMAIL_1] then [CUSTOM_1]');
        assert.equal(app.entityManager.getEntity('[CUSTOM_1]').original, '$&');
    }
});
test('selecting part of a placeholder leaves its mapping intact', () => {
    const { app, fields } = outputApp('[EMAIL_1]', [['[EMAIL_1]', { original: 'alpha@example.com', isActive: true }]]);
    app.renderOutput();
    Object.assign(fields.outputText, { selectionStart: 1, selectionEnd: 4 });
    app.anonymizeHighlighted();
    assert.equal(app.placeholderText, '[EMAIL_1]');
    assert.equal(app.entityManager.entityMap.size, 1);
});

test('Tools menu opens on hover, stays reachable and closes with Escape or mouse leave', () => {
    const listeners = new Map();
    const on = target => (type, callback) => listeners.set(target + ':' + type, callback);
    const classes = new Set();
    const attributes = {};
    let closeTimer;
    const trigger = { addEventListener: on('trigger'), setAttribute: (key, value) => attributes[key] = value, focus() {} };
    const panel = { hidden: false, contains: () => false };
    const menu = {
        querySelector: selector => selector === '.nav-tools-trigger' ? trigger : panel,
        addEventListener: on('menu'), contains: () => false,
        classList: { contains: value => classes.has(value), toggle: (value, enabled) => enabled ? classes.add(value) : classes.delete(value) }
    };
    const Navigation = loadClass('src/scripts/shared.js', 'NavigationManager', {
        document: { querySelectorAll: () => [menu], addEventListener: on('document'), activeElement: null, documentElement: { setAttribute() {} }, getElementById: () => null },
        localStorage: { getItem: () => 'dark', setItem() {} },
        window: { matchMedia: () => ({ matches: true }) },
        setTimeout: callback => { closeTimer = callback; return 1; }, clearTimeout: () => { closeTimer = undefined; }
    });
    Navigation.prototype.initToolsMenu.call({});
    assert.equal(panel.hidden, true);
    listeners.get('menu:mouseenter')();
    assert.equal(panel.hidden, false);
    assert.equal(attributes['aria-expanded'], 'true');
    listeners.get('trigger:click')({ detail: 1, preventDefault() {} });
    assert.equal(panel.hidden, false);
    listeners.get('menu:mouseleave')();
    listeners.get('menu:mouseenter')();
    assert.equal(closeTimer, undefined);
    assert.equal(panel.hidden, false);
    listeners.get('document:keydown')({ key: 'Escape' });
    assert.equal(panel.hidden, true);
    assert.equal(attributes['aria-expanded'], 'false');
    listeners.get('menu:mouseenter')();
    listeners.get('menu:mouseleave')();
    closeTimer();
    assert.equal(panel.hidden, true);
});
