'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { wptranlateDetectLangFromText } = require('../../src/lang-detect.js');
const { wptranlateNormalizeLangTag } = require('../../src/lang-tag.js');

function withMockLanguageDetector(detectFn, run) {
  const prev = global.LanguageDetector;
  global.LanguageDetector = {
    availability: async () => 'readily',
    create: async () => ({
      detect: async (text) => {
        const top = detectFn(text);
        return Array.isArray(top) ? top : [top];
      },
    }),
  };
  return run().finally(() => {
    if (prev === undefined) delete global.LanguageDetector;
    else global.LanguageDetector = prev;
  });
}

test('wptranlateDetectLangFromText — короткий текст возвращает null', async () => {
  await withMockLanguageDetector(() => ({ detectedLanguage: 'en', confidence: 0.9 }), async () => {
    assert.strictEqual(await wptranlateDetectLangFromText('short'), null);
  });
});

test('wptranlateDetectLangFromText — низкая confidence возвращает null', async () => {
  await withMockLanguageDetector(
    () => ({ detectedLanguage: 'en', confidence: 0.2 }),
    async () => {
      const sample = 'Hello world this is a long enough sample text';
      assert.strictEqual(await wptranlateDetectLangFromText(sample), null);
    },
  );
});

test('wptranlateDetectLangFromText — нормализует тег и возвращает lang', async () => {
  await withMockLanguageDetector(
    () => ({ detectedLanguage: 'de-DE', confidence: 0.95 }),
    async () => {
      const sample = 'Der schnelle braune Fuchs springt über den faulen Hund.';
      const result = await wptranlateDetectLangFromText(sample, { normalizeLang: wptranlateNormalizeLangTag });
      assert.deepStrictEqual(result, { lang: 'de', confidence: 0.95 });
    },
  );
});

test('wptranlateDetectLangFromText — unavailable API возвращает null', async () => {
  const prev = global.LanguageDetector;
  global.LanguageDetector = { availability: async () => 'unavailable' };
  try {
    const sample = 'Hello world this is a long enough sample text';
    assert.strictEqual(await wptranlateDetectLangFromText(sample), null);
  } finally {
    if (prev === undefined) delete global.LanguageDetector;
    else global.LanguageDetector = prev;
  }
});
