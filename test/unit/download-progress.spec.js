'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert');
const { loadTsmplEngine } = require('../helpers/load-tsmpl-engine');

const ROOT = path.join(__dirname, '../..');

function loadConfigSandbox() {
  const sent = [];
  const sandbox = {
    self: {},
    chrome: { runtime: { sendMessage: async (m) => { sent.push(m); } } },
    module: { exports: {} },
  };
  sandbox.self = sandbox;
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/config.js'), 'utf8'), sandbox, { filename: 'config.js' });
  return { g: sandbox.self, sent };
}

test('wteEmitDownloadProgress sends downloadProgress action with tabId', async () => {
  const { g, sent } = loadConfigSandbox();
  const ev = { downloadProgress: 'tsmpl:download-progress' };
  g.WTE.wteEmitDownloadProgress(ev, 7, 40, 100, 40);
  assert.strictEqual(sent.length, 1);
  assert.strictEqual(sent[0].action, 'tsmpl:download-progress');
  assert.strictEqual(sent[0].percent, 40);
  assert.strictEqual(sent[0].tabId, 7);
});

test('wteCreateTranslator emits 0% and 100% when model is downloadable', async () => {
  const sent = [];
  const sandbox = {
    self: {},
    chrome: { runtime: { sendMessage: async (m) => { sent.push(m); } } },
    module: { exports: {} },
    Translator: {
      availability: async () => 'downloadable',
      create: async ({ monitor }) => {
        monitor?.({
          addEventListener: (ev, cb) => {
            if (ev === 'downloadprogress') cb({ loaded: 60, total: 100 });
          },
        });
        return { translate: async (t) => t };
      },
    },
  };
  sandbox.self = sandbox;
  sandbox.Translator = sandbox.Translator;
  for (const rel of ['src/config.js', 'presets/tsmpl.js', 'src/lang-tag.js', 'src/lang-detect.js', 'src/translate-text.js']) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }

  const result = await sandbox.self.WTE.wteCreateTranslator('en', 'zh', { messageTabId: 3 });
  assert.strictEqual(result.ok, true);

  const progress = sent.filter((m) => m.action === 'tsmpl:download-progress');
  assert.ok(progress.length >= 3, `expected 0%, mid, 100% — got ${progress.length}`);
  assert.strictEqual(progress[0].percent, 0);
  assert.strictEqual(progress[progress.length - 1].percent, 100);
  assert.ok(progress.some((m) => m.percent === 60));
});

test('translateDocument emits download-progress when model is downloadable', async () => {
  const { g, sentMessages } = loadTsmplEngine({
    availability: async () => 'downloadable',
  });
  await g.WTE.translateDocument('zh', null, 99);

  const progress = sentMessages.filter((m) => m.action === 'tsmpl:download-progress');
  assert.ok(progress.length >= 2, 'must report download start and completion');
  assert.strictEqual(progress[0].percent, 0);
  assert.strictEqual(progress[progress.length - 1].percent, 100);
});
