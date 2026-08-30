'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const assert = require('node:assert');
const { loadTsmplEngine, ROOT } = require('../helpers/load-tsmpl-engine');

function loadWithRevert(opts = {}) {
  const loaded = loadTsmplEngine(opts);
  const abs = path.join(ROOT, 'src/revert-document.js');
  // Reuse the same sandbox globals by re-executing into a fresh context that shares refs — simpler: eval into g
  const code = fs.readFileSync(abs, 'utf8');
  const sandbox = {
    self: loaded.g,
    window: loaded.g,
    globalThis: loaded.g,
    document: loaded.g.document,
    localStorage: loaded.g.localStorage,
    module: { exports: {} },
  };
  // document/localStorage already on g
  loaded.g.window = loaded.g;
  vm.runInNewContext(code, {
    self: loaded.g,
    window: loaded.g,
    globalThis: loaded.g,
    document: loaded.g.document,
    localStorage: loaded.g.localStorage || {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    module: { exports: {} },
  }, { filename: abs });
  // Functions attach to g via global in IIFE — ensure WTE methods exist
  if (!loaded.g.WTE.revertDomOnly && loaded.g.wteRevertDomOnly) {
    loaded.g.WTE.revertDomOnly = loaded.g.wteRevertDomOnly;
  }
  return loaded;
}

test('revert-document exports WTE.revertDomOnly / revertAndClearCaches', () => {
  const { g } = loadWithRevert({ bodyText: 'Hello world from test page content' });
  assert.equal(typeof g.WTE.revertDomOnly, 'function');
  assert.equal(typeof g.WTE.revertAndClearCaches, 'function');
});

test('revertDomOnly restores title and clears translated state flags', async () => {
  const { g } = loadWithRevert({
    bodyText: 'Hello world from test page content for revert',
  });
  const nm = g.WTE.wteMergeConfig().names;
  g.document.title = 'Original Title';
  await g.WTE.translateDocument('zh');
  // Simulate title backup used by revert
  g[nm.stateOriginalTitle] = 'Original Title';
  g.document.title = '[zh]Original Title';
  g.WTE.revertDomOnly();
  assert.equal(g.document.title, 'Original Title');
  assert.equal(g[nm.stateScrollSetup], false);
});

test('revertAndClearCaches wipes localStorage cache keys', async () => {
  const { g } = loadWithRevert({
    bodyText: 'Hello world from test page content for cache wipe',
  });
  const nm = g.WTE.wteMergeConfig().names;
  const prefix = nm.cacheKeyPrefix;
  g.localStorage.setItem(`${prefix}zh`, JSON.stringify({ entries: { a: 1 }, revEntries: {} }));
  g.localStorage.setItem('unrelated', 'keep');
  g.WTE.revertAndClearCaches();
  assert.equal(g.localStorage.getItem(`${prefix}zh`), null);
  assert.equal(g.localStorage.getItem('unrelated'), 'keep');
});
