'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '../..');

function loadTranslateTextStack() {
  const sandbox = {
    self: {},
    window: {},
    globalThis: {},
    chrome: { i18n: { getMessage: (k) => k }, runtime: { sendMessage: async () => {} } },
    module: { exports: {} },
    document: { documentElement: { lang: 'de' } },
    location: { hostname: 'example.com', protocol: 'https:' },
  };
  sandbox.self.Translator = {
    availability: async () => 'readily',
    create: async ({ sourceLanguage, targetLanguage }) => ({
      translate: async (t) => `[${targetLanguage}]${t}`,
    }),
  };
  sandbox.Translator = sandbox.self.Translator;
  sandbox.window = sandbox.self;
  sandbox.globalThis = sandbox.self;

  for (const rel of ['src/config.js', 'presets/wptranlate.js', 'src/lang-tag.js', 'src/lang-detect.js', 'src/translate-text.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox.self;
}

test('translateText returns translated string', async () => {
  const g = loadTranslateTextStack();
  const result = await g.WTE.translateText('Hello world', 'ru', 'en');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.original, 'Hello world');
  assert.strictEqual(result.translated, '[ru]Hello world');
  assert.strictEqual(result.sourceLanguage, 'en');
  assert.strictEqual(result.targetLanguage, 'ru');
});

test('translateText skips same language', async () => {
  const g = loadTranslateTextStack();
  const result = await g.WTE.translateText('Hallo', 'de', 'de');
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'same-lang');
});

test('translateText rejects empty input', async () => {
  const g = loadTranslateTextStack();
  const result = await g.WTE.translateText('   ', 'en');
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'empty');
});
