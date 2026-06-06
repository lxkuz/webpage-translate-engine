/**
 * Unit-тесты для wptranlateDjb2Key (djb2) — можно запускать в Node без браузера.
 * node --test test/unit/hash.spec.js
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');
const { wptranlateDjb2Key } = require('../../src/hash.js');

describe('wptranlateDjb2Key', () => {
  test('одинаковая строка дает одинаковый хеш', () => {
    const h1 = wptranlateDjb2Key('Hello world');
    const h2 = wptranlateDjb2Key('Hello world');
    assert.strictEqual(h1, h2);
  });

  test('разные строки дают разные хеши', () => {
    const h1 = wptranlateDjb2Key('Hello');
    const h2 = wptranlateDjb2Key('World');
    assert.notStrictEqual(h1, h2);
  });

  test('возвращает строку в base36', () => {
    const h = wptranlateDjb2Key('test');
    assert.strictEqual(typeof h, 'string');
    assert.ok(/^[a-z0-9]+$/.test(h));
  });

  test('пустая строка возвращает консистентный хеш', () => {
    const h = wptranlateDjb2Key('');
    assert.strictEqual(typeof h, 'string');
    assert.strictEqual(wptranlateDjb2Key(''), h);
  });
});
