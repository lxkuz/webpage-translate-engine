'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '../..');

function loadAdapterStack(extra = {}) {
  const sandbox = {
    self: {},
    window: {},
    globalThis: {},
    chrome: { i18n: { getMessage: (k) => k }, runtime: { sendMessage: async () => {} } },
    module: { exports: {} },
    document: { documentElement: { lang: 'en' } },
    location: { hostname: 'example.com', protocol: 'https:' },
    fetch: extra.fetch || (async () => ({ ok: true, json: async () => ({ translatedText: 'remote-ok' }) })),
  };
  sandbox.self.Translator = extra.Translator ?? {
    availability: async () => 'readily',
    create: async () => ({
      translate: async (t) => `[chrome]${t}`,
    }),
  };
  sandbox.Translator = sandbox.self.Translator;
  sandbox.self.WTE_CONFIG = {
    prefix: 'wte',
    remoteTranslate: {
      enabled: true,
      baseUrl: 'https://translate.example/lt',
    },
  };
  sandbox.window = sandbox.self;
  sandbox.globalThis = sandbox.self;

  for (const rel of ['src/config.js', 'presets/wptranlate.js', 'src/translator-adapters.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }
  return sandbox.self;
}

test('wteAcquireTranslator uses Chrome when available', async () => {
  const g = loadAdapterStack();
  const result = await g.WTE.wteAcquireTranslator('en', 'ru');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.backend, 'chrome');
  const tr = await result.translator.translate('Hi');
  assert.strictEqual(tr, '[chrome]Hi');
});

test('wteAcquireTranslator falls back to remote when Chrome unavailable', async () => {
  const g = loadAdapterStack({
    Translator: {
      availability: async () => 'unavailable',
      create: async () => { throw new Error('should not create'); },
    },
  });
  const result = await g.WTE.wteAcquireTranslator('en', 'ru');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.backend, 'remote');
  const tr = await result.translator.translate('Hi');
  assert.strictEqual(tr, 'remote-ok');
});

test('wteAcquireTranslator uses remote when Chrome API missing', async () => {
  const sandbox = {
    self: {},
    globalThis: {},
    module: { exports: {} },
    fetch: async () => ({ ok: true, json: async () => ({ translatedText: 'no-chrome' }) }),
  };
  sandbox.self.WTE_CONFIG = {
    remoteTranslate: { enabled: true, baseUrl: 'https://translate.example/lt' },
  };
  sandbox.globalThis = sandbox.self;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/config.js'), 'utf8'), sandbox, { filename: 'src/config.js' });
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/translator-adapters.js'), 'utf8'), sandbox, { filename: 'src/translator-adapters.js' });
  const result = await sandbox.self.WTE.wteAcquireTranslator('en', 'de');
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.backend, 'remote');
});

test('remote adapter splits batch separator and translates parts', async () => {
  const calls = [];
  const g = loadAdapterStack({
    Translator: { availability: async () => 'unavailable', create: async () => ({}) },
    fetch: async (_url, init) => {
      const body = JSON.parse(init.body);
      calls.push(body.q);
      return { ok: true, json: async () => ({ translatedText: `R:${body.q}` }) };
    },
  });
  const result = await g.WTE.wteAcquireTranslator('en', 'ru');
  const sep = '\u2063';
  const out = await result.translator.translate(`one${sep}two`);
  assert.strictEqual(out, `R:one${sep}R:two`);
  assert.deepStrictEqual(calls, ['one', 'two']);
});
