'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { loadTsmplEngine } = require('../helpers/load-tsmpl-engine');

test('http non-localhost → early return', async () => {
  const { g } = loadTsmplEngine({
    protocol: 'http:',
    hostname: 'evil.example',
    bodyText: 'Hello world from remote http page',
  });
  const r = await g.WTE.translateDocument('zh');
  assert.equal(r, undefined);
});

test('no Translator → early return', async () => {
  const { g } = loadTsmplEngine({ bodyText: 'Hello world from test page content' });
  delete g.Translator;
  const r = await g.WTE.translateDocument('zh');
  assert.equal(r, undefined);
});

test('domain off → silent skip', async () => {
  const { g } = loadTsmplEngine({
    bodyText: 'Hello world from test page content',
    domains: [],
  });
  const r = await g.WTE.translateDocument('zh');
  assert.equal(r, undefined);
});

test('translator unavailable → early return', async () => {
  const { g } = loadTsmplEngine({
    bodyText: 'Hello world from test page content',
    availability: async () => 'unavailable',
  });
  const r = await g.WTE.translateDocument('zh');
  assert.equal(r, undefined);
});

test('busy translating → sets pending and returns', async () => {
  const { g } = loadTsmplEngine({ bodyText: 'Hello world from test page content' });
  const nm = g.WTE.wteMergeConfig().names;
  g[nm.stateTranslating] = true;
  const r = await g.WTE.translateDocument('zh');
  assert.equal(r, undefined);
  assert.equal(g[nm.stateTranslatePending], true);
});

test('happy path translates and emits start/end', async () => {
  const { g, sentMessages } = loadTsmplEngine({
    bodyText: 'Hello world from test page content for translation',
  });
  const r = await g.WTE.translateDocument('zh');
  assert.ok(r);
  assert.equal(r.ok, true);
  assert.ok(sentMessages.some((m) => m.action === 'tsmpl:start' || m.action === 'tsmpl:end'
    || m.action === 'tsmpl:translation-started'));
});

test('create user-gesture → early return', async () => {
  const { g } = loadTsmplEngine({ bodyText: 'Hello world from test page content' });
  g.Translator.create = async () => {
    throw new Error('Requires a user gesture');
  };
  const r = await g.WTE.translateDocument('zh');
  assert.equal(r, undefined);
});

test('create sandbox error → early return', async () => {
  const { g } = loadTsmplEngine({ bodyText: 'Hello world from test page content' });
  g.Translator.create = async () => {
    throw new Error('Permission Policy blocked sandbox');
  };
  const r = await g.WTE.translateDocument('zh');
  assert.equal(r, undefined);
});

test('invalid language tag on availability → silent skip', async () => {
  const { g } = loadTsmplEngine({
    bodyText: 'Hello world from test page content',
    availability: async () => {
      throw new Error('Invalid language tag: xx');
    },
  });
  const r = await g.WTE.translateDocument('xx');
  assert.ok(r === undefined || r?.skipped === true);
});

test('source override forces language pair', async () => {
  const { g } = loadTsmplEngine({
    bodyText: 'Hello world from test page content',
    lang: 'en',
  });
  const r = await g.WTE.translateDocument('ru', 'de');
  assert.ok(r);
  assert.equal(r.ok, true);
});
