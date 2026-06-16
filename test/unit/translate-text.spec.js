'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '../..');

function loadTranslateTextStack(extra = {}) {
  const sandbox = {
    window: {},
    globalThis: {},
    chrome: { i18n: { getMessage: (k) => k }, runtime: { sendMessage: async () => {} } },
    module: { exports: {} },
    document: { documentElement: { lang: 'de' } },
    location: { hostname: 'example.com', protocol: 'https:' },
    ...extra,
  };
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.Translator = {
    availability: async () => 'readily',
    create: async ({ sourceLanguage, targetLanguage }) => ({
      translate: async (t) => `[${targetLanguage}]${t}`,
    }),
  };

  for (const rel of ['src/config.js', 'presets/wptranlate.js', 'src/lang-tag.js', 'src/lang-detect.js', 'src/translate-text.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox;
}

function loadHeuristicStack(extra = {}) {
  const sandbox = loadTranslateTextStack(extra);
  sandbox.WTE_CONFIG = { ...(sandbox.WTE_CONFIG || {}), langHeuristicLatinCyrillic: true };
  return sandbox;
}

test('translateText returns translated string', async () => {
  const sandbox = loadTranslateTextStack();
  const result = await sandbox.WTE.translateText('Hello world', 'ru', 'en');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.original, 'Hello world');
  assert.strictEqual(result.translated, '[ru]Hello world');
  assert.strictEqual(result.sourceLanguage, 'en');
  assert.strictEqual(result.targetLanguage, 'ru');
});

test('translateText skips same language', async () => {
  const sandbox = loadTranslateTextStack();
  const result = await sandbox.WTE.translateText('Hallo', 'de', 'de');
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'same-lang');
});

test('wteResolveLanguages: html lang=en + Cyrillic body → ru', async () => {
  const sandbox = loadHeuristicStack({ document: { documentElement: { lang: 'en' } } });
  const sample = 'Это русский текст на странице с lang=en. '.repeat(5);
  const result = await sandbox.WTE.wteResolveLanguages('en', null, sample);
  assert.strictEqual(result.sourceLanguage, 'ru');
  assert.strictEqual(result.targetLanguage, 'en');
});

test('wteResolveLanguages: LanguageDetector en + Cyrillic body → ru with heuristic', async () => {
  const sandbox = loadHeuristicStack({
    document: { documentElement: { lang: 'en' } },
    LanguageDetector: {
      availability: async () => 'readily',
      create: async () => ({
        detect: async () => [{ detectedLanguage: 'en', confidence: 0.99 }],
      }),
    },
  });
  const sample = 'Это русский текст на странице с lang=en. '.repeat(5);
  const result = await sandbox.WTE.wteResolveLanguages('en', null, sample);
  assert.strictEqual(result.sourceLanguage, 'ru');
  assert.strictEqual(result.targetLanguage, 'en');
});

test('translateText rejects empty input', async () => {
  const sandbox = loadTranslateTextStack();
  const result = await sandbox.WTE.translateText('   ', 'en');
  assert.strictEqual(result.skipped, true);
  assert.strictEqual(result.reason, 'empty');
});
