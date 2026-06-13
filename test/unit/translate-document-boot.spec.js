/**
 * translate-document.js must boot without ReferenceError at module footer.
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '../..');

function loadEngineStack(presetFile) {
  const sandbox = {
    self: {},
    window: {},
    globalThis: {},
    chrome: { i18n: { getMessage: (k) => k }, storage: { local: { get: async () => ({}) } }, runtime: { sendMessage: async () => {} } },
    module: { exports: {} },
    document: { body: { innerText: 'Hallo Berlin', querySelectorAll: () => [] }, documentElement: { lang: 'de' } },
    location: { hostname: 'www.berliner-zeitung.de', protocol: 'https:', href: 'https://www.berliner-zeitung.de/' },
    Translator: { availability: async () => 'readily', create: async () => ({ translate: async (t) => t }) },
    queueMicrotask: (fn) => fn(),
  };
  sandbox.window = sandbox.self;
  sandbox.globalThis = sandbox.self;

  const files = [
    'src/config.js',
    presetFile,
    'src/hash.js',
    'src/lang-tag.js',
    'src/lang-detect.js',
    'src/translate-text.js',
    'src/cache.js',
    'src/dom-i18n-restore.js',
    'src/translate-document.js',
  ];
  for (const rel of files) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox.self;
}

test('translate-document boots with wptranlate preset', () => {
  const g = loadEngineStack('presets/wptranlate.js');
  assert.strictEqual(typeof g.WTE?.translateDocument, 'function');
  assert.strictEqual(typeof g.WTE?.translateText, 'function');
  assert.strictEqual(typeof g.__wptranlateTranslate, 'function');
});

test('translate-document boots with tsmpl preset', () => {
  const g = loadEngineStack('presets/tsmpl.js');
  assert.strictEqual(typeof g.WTE?.translateDocument, 'function');
  assert.strictEqual(typeof g.__tsmplTranslate, 'function');
});
