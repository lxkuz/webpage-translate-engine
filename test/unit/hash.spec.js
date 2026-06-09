/**
 * Unit tests for wptranlateDjb2Key (djb2).
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { wptranlateDjb2Key } = require('../../src/hash.js');

describe('wptranlateDjb2Key', () => {
  test('identical strings produce identical hash', () => {
    assert.strictEqual(wptranlateDjb2Key('Hello world'), wptranlateDjb2Key('Hello world'));
  });

  test('different strings produce different hashes', () => {
    assert.notStrictEqual(wptranlateDjb2Key('Hello'), wptranlateDjb2Key('World'));
  });

  test('returns base36 string', () => {
    const h = wptranlateDjb2Key('test');
    assert.strictEqual(typeof h, 'string');
    assert.ok(/^[a-z0-9]+$/.test(h));
  });

  test('empty string is consistent', () => {
    const h = wptranlateDjb2Key('');
    assert.strictEqual(wptranlateDjb2Key(''), h);
  });

  test('re-load in same self is idempotent', () => {
    const code = fs.readFileSync(path.join(__dirname, '../../src/hash.js'), 'utf8');
    const sandbox = { self: {}, module: { exports: {} } };
    vm.runInNewContext(code, sandbox);
    const h1 = sandbox.self.wptranlateDjb2Key('repeat-load');
    assert.doesNotThrow(() => vm.runInNewContext(code, sandbox));
    assert.strictEqual(sandbox.self.wptranlateDjb2Key('repeat-load'), h1);
  });
});
