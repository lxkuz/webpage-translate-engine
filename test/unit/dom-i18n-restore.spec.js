'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, describe } = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '../..');

function loadRestore(prefix = 'tsmpl') {
  const sandbox = {
    self: {},
    module: { exports: {} },
  };
  sandbox.self = sandbox;
  // minimal WTE config surface
  const absConfig = path.join(ROOT, 'src/config.js');
  vm.runInNewContext(fs.readFileSync(absConfig, 'utf8'), sandbox, { filename: absConfig });
  sandbox.self.WTE_CONFIG = { prefix };
  // re-merge
  const cfg = sandbox.self.WTE.wteMergeConfig();
  sandbox.self.WTE = sandbox.self.WTE || {};
  Object.assign(sandbox.self.WTE, { wteMergeConfig: () => ({ ...cfg, prefix, names: sandbox.self.WTE.wteMakeNames(prefix) }) });

  const abs = path.join(ROOT, 'src/dom-i18n-restore.js');
  vm.runInNewContext(fs.readFileSync(abs, 'utf8'), sandbox, { filename: abs });
  return sandbox.self;
}

function elWithDatasets(prefix, fields) {
  const nm = {};
  // camelCase dataset keys as browser would expose from data-tsmpl-i18n-placeholder
  const map = {
    placeholder: `${prefix}I18nPlaceholder`,
    title: `${prefix}I18nTitle`,
    ariaLabel: `${prefix}I18nAriaLabel`,
    alt: `${prefix}I18nAlt`,
    content: `${prefix}I18nContent`,
    value: `${prefix}I18nValue`,
    attrLang: `${prefix}AttrLang`,
  };
  const dataset = {};
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'attrLang') dataset[map.attrLang] = v;
    else if (map[k]) dataset[map[k]] = v;
  }
  const attrs = {};
  const el = {
    dataset,
    placeholder: '',
    value: '',
    getAttribute: (n) => attrs[n],
    setAttribute: (n, v) => { attrs[n] = v; },
  };
  return el;
}

describe('dom-i18n-restore', () => {
  test('restores all six attrs and clears dataAttrLang', () => {
    const g = loadRestore('tsmpl');
    assert.equal(typeof g.wteRestoreDatasetAttrsTree, 'function');
    assert.equal(typeof g.tsmplRestoreDatasetAttrsTree, 'function');

    const el = elWithDatasets('tsmpl', {
      placeholder: 'orig-ph',
      title: 'orig-title',
      ariaLabel: 'orig-aria',
      alt: 'orig-alt',
      content: 'orig-content',
      value: 'orig-value',
      attrLang: 'zh',
    });
    // Make querySelectorAll find our element for each selector — restoreTree queries selector then *
    const root = {
      querySelectorAll: (sel) => {
        if (String(sel).includes('i18n') || String(sel).includes('data-')) return [el];
        return [];
      },
    };
    g.wteRestoreDatasetAttrsTree(root);
    assert.equal(el.placeholder, 'orig-ph');
    assert.equal(el.getAttribute('title'), 'orig-title');
    assert.equal(el.getAttribute('aria-label'), 'orig-aria');
    assert.equal(el.getAttribute('alt'), 'orig-alt');
    assert.equal(el.getAttribute('content'), 'orig-content');
    assert.equal(el.value, 'orig-value');
    assert.equal(el.dataset.tsmplAttrLang, undefined);
  });

  test('recurses into shadowRoot', () => {
    const g = loadRestore('tsmpl');
    const inner = elWithDatasets('tsmpl', { placeholder: 'shadow-ph' });
    const host = {
      shadowRoot: {
        querySelectorAll: (sel) => {
          if (String(sel).includes('i18n') || String(sel).includes('data-')) return [inner];
          if (sel === '*') return [];
          return [];
        },
      },
    };
    const root = {
      querySelectorAll: (sel) => {
        if (sel === '*') return [host];
        return [];
      },
    };
    g.wteRestoreDatasetAttrsTree(root);
    assert.equal(inner.placeholder, 'shadow-ph');
  });

  test('noop without querySelectorAll', () => {
    const g = loadRestore('tsmpl');
    g.wteRestoreDatasetAttrsTree(null);
    g.wteRestoreDatasetAttrsTree({});
  });
});
