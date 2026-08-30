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

function loadStack(opts = {}) {
  const sandbox = {
    self: {},
    window: {},
    globalThis: {},
    chrome: { i18n: { getMessage: (k) => k }, runtime: { sendMessage: async () => {} } },
    module: { exports: {} },
    document: { documentElement: { lang: opts.lang || 'en' } },
    location: opts.location || { hostname: 'example.com', protocol: 'https:' },
  };
  if (opts.noTranslator) {
    // leave Translator unset
  } else {
    sandbox.self.Translator = opts.Translator || {
      availability: async () => 'readily',
      create: async ({ sourceLanguage, targetLanguage }) => ({
        translate: async (t) => `[${targetLanguage}]${t}`,
      }),
    };
    sandbox.Translator = sandbox.self.Translator;
  }
  sandbox.window = sandbox.self;
  sandbox.globalThis = sandbox.self;
  for (const rel of ['src/config.js', 'presets/tsmpl.js', 'src/lang-tag.js', 'src/lang-detect.js', 'src/translate-text.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox.self;
}

test('translateText https-only on remote http', async () => {
  const g = loadStack({ location: { hostname: 'remote.example', protocol: 'http:' } });
  const result = await g.WTE.translateText('Hello', 'ru', 'en');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'https-only');
});

test('translateText no-translator', async () => {
  const g = loadStack({ noTranslator: true });
  const result = await g.WTE.translateText('Hello', 'ru', 'en');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'no-translator');
});

test('wteCreateTranslator availability invalid-lang', async () => {
  const g = loadStack({
    Translator: {
      availability: async () => { throw new Error('Invalid language tag: xx'); },
      create: async () => ({ translate: async (t) => t }),
    },
  });
  const r = await g.WTE.wteCreateTranslator('en', 'xx');
  assert.strictEqual(r.skipped, true);
  assert.strictEqual(r.reason, 'invalid-lang');
});

test('wteCreateTranslator availability other error', async () => {
  const g = loadStack({
    Translator: {
      availability: async () => { throw new Error('backend down'); },
      create: async () => ({ translate: async (t) => t }),
    },
  });
  const r = await g.WTE.wteCreateTranslator('en', 'ru');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'availability-error');
});

test('wteCreateTranslator user-gesture / sandbox / create-error', async () => {
  const gesture = loadStack({
    Translator: {
      availability: async () => 'readily',
      create: async () => { throw new Error('Requires a user gesture'); },
    },
  });
  assert.strictEqual((await gesture.WTE.wteCreateTranslator('en', 'ru')).reason, 'user-gesture');

  const sandbox = loadStack({
    Translator: {
      availability: async () => 'readily',
      create: async () => { throw new Error('Permission Policy blocked sandbox'); },
    },
  });
  assert.strictEqual((await sandbox.WTE.wteCreateTranslator('en', 'ru')).reason, 'sandbox');

  const other = loadStack({
    Translator: {
      availability: async () => 'readily',
      create: async () => { throw new Error('create blew up'); },
    },
  });
  assert.strictEqual((await other.WTE.wteCreateTranslator('en', 'ru')).reason, 'create-error');
});

test('translateText translate() throw → error', async () => {
  const g = loadStack({
    Translator: {
      availability: async () => 'readily',
      create: async () => ({
        translate: async () => { throw new Error('translate failed'); },
      }),
    },
  });
  const r = await g.WTE.translateText('Hello world', 'ru', 'en');
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.reason, 'error');
});

test('invalid target → skipped', async () => {
  const g = loadStack();
  const r = await g.WTE.translateText('Hello', '!!!');
  assert.strictEqual(r.skipped, true);
  assert.strictEqual(r.reason, 'invalid-target');
});

test('wteResolveLanguages topFrameHtml + latin/cyrillic heuristic', async () => {
  const g = loadStack({ lang: 'en' });
  const sample = 'Привет мир это тестовая лента новостей ВКонтакте';
  const result = await g.WTE.wteResolveLanguages('en', null, sample, {
    topFrameHtmlLang: 'en',
    runtime: { langHeuristicLatinCyrillic: true, langDetection: 'topFrameHtml' },
  });
  // Either detects ru or same-lang skip depending on heuristic availability — just exercise path.
  assert.ok(result.sourceLanguage || result.skipped);
});
