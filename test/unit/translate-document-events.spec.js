'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { loadTsmplEngine } = require('../helpers/load-tsmpl-engine');

test('translateDocument sends translation-started after first batch in main frame', async () => {
  const { g, sentMessages } = loadTsmplEngine();
  const result = await g.WTE.translateDocument('zh', null, 12);

  assert.strictEqual(result?.ok, true);
  const started = sentMessages.filter((m) => m.action === 'tsmpl:translation-started');
  assert.strictEqual(started.length, 1);
  assert.strictEqual(started[0].tabId, 12);
});

test('tsmpl preset configures translationStarted event', () => {
  const { g } = loadTsmplEngine();
  const cfg = g.WTE.wteMergeConfig();
  assert.strictEqual(cfg.events.translationStarted, 'tsmpl:translation-started');
});

test('translateDocument sends tsmpl:start and tsmpl:end around translation', async () => {
  const { g, sentMessages } = loadTsmplEngine();
  await g.WTE.translateDocument('zh', null, 5);

  assert.ok(sentMessages.some((m) => m.action === 'tsmpl:start'));
  assert.ok(sentMessages.some((m) => m.action === 'tsmpl:end'));
});
