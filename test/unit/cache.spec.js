'use strict';

/**
 * Unit coverage for src/cache.js (localStorage read/write/wipe).
 */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, describe } = require('node:test');
const assert = require('node:assert');

const ROOT = path.join(__dirname, '../..');

function loadCache() {
  const data = Object.create(null);
  const localStorage = {
    getItem(k) {
      return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
    },
    setItem(k, v) {
      data[k] = String(v);
      this[k] = String(v);
    },
    removeItem(k) {
      delete data[k];
      delete this[k];
    },
  };

  const sandbox = {
    self: {},
    localStorage,
    location: { href: 'https://example.com/page' },
    module: { exports: {} },
  };
  sandbox.self.localStorage = localStorage;
  sandbox.self.location = sandbox.location;
  sandbox.self.WTE_CONFIG = { prefix: 'wte' };

  const hashAbs = path.join(ROOT, 'src/hash.js');
  const cacheAbs = path.join(ROOT, 'src/cache.js');
  vm.runInNewContext(fs.readFileSync(hashAbs, 'utf8'), sandbox, { filename: hashAbs });
  sandbox.wteDjb2Key = sandbox.self.wteDjb2Key;
  vm.runInNewContext(fs.readFileSync(cacheAbs, 'utf8'), sandbox, { filename: cacheAbs });

  return {
    api: sandbox.self.__wteCache || sandbox.module.exports,
    data,
    localStorage,
  };
}

describe('wte cache', () => {
  test('empty read returns skeleton', () => {
    const { api } = loadCache();
    const c = api.getCache('en');
    assert.equal(Object.keys(c.entries).length, 0);
    assert.equal(c.urlOrder.length, 0);
  });

  test('save + read roundtrip', () => {
    const { api } = loadCache();
    api.saveCache({
      entries: { abc: { r: 'hello', u: 'https://example.com/page', ts: 1 } },
      urlOrder: ['https://example.com/page'],
      revEntries: {},
      title: 'T',
    }, 'en');
    const again = api.getCache('en');
    assert.equal(again.title, 'T');
    assert.equal(again.entries.abc.r, 'hello');
  });

  test('corrupt JSON → empty skeleton', () => {
    const { api, data } = loadCache();
    const key = api.getCacheKey('en');
    data[key] = '{not-json';
    const c = api.getCache('en');
    assert.equal(Object.keys(c.entries).length, 0);
  });

  test('clearAllCaches wipes prefix keys', () => {
    const { api, data, localStorage } = loadCache();
    api.saveCache({
      entries: { a: { r: 'x', u: 'https://example.com/page', ts: 1 } },
      urlOrder: [],
      revEntries: {},
    }, 'en');
    api.saveCache({
      entries: { b: { r: 'y', u: 'https://example.com/page', ts: 1 } },
      urlOrder: [],
      revEntries: {},
    }, 'ru');
    assert.ok(Object.keys(data).length >= 2);
    for (const k of Object.keys(data)) {
      localStorage[k] = data[k];
    }
    api.clearAllCaches();
    assert.equal(Object.keys(api.getCache('en').entries).length, 0);
    assert.equal(Object.keys(api.getCache('ru').entries).length, 0);
  });

  test('getCacheKey uses lang primary', () => {
    const { api } = loadCache();
    assert.match(api.getCacheKey('en-US'), /en$/);
  });

  test('url eviction when urlOrder exceeds MAX_URLS', () => {
    const { api } = loadCache();
    const cache = { entries: {}, urlOrder: [], revEntries: {} };
    for (let i = 0; i < 12; i++) {
      const url = `https://example.com/p${i}`;
      cache.entries[`h${i}`] = { t: `t${i}`, r: `r${i}`, ts: i, u: url };
      cache.revEntries[api.getCacheKey ? `r${i}` : `r${i}`] = { o: `t${i}`, r: `r${i}` };
      cache.urlOrder.push(url);
    }
    api.saveCache(cache, 'en');
    const again = api.getCache('en');
    assert.ok(again.urlOrder.length <= 10);
  });

  test('entry cap evicts oldest 20%', () => {
    const { api } = loadCache();
    const cache = { entries: {}, urlOrder: ['https://example.com/page'], revEntries: {} };
    const N = 3010;
    for (let i = 0; i < N; i++) {
      cache.entries[`k${i}`] = { t: `t${i}`, r: `r${i}`, ts: i, u: 'https://example.com/page' };
    }
    api.saveCache(cache, 'en');
    const again = api.getCache('en');
    assert.ok(Object.keys(again.entries).length < N);
  });

  test('quota throw shrinks and retries', () => {
    const data = Object.create(null);
    let throws = 1;
    const localStorage = {
      getItem(k) {
        return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null;
      },
      setItem(k, v) {
        if (throws > 0) {
          throws -= 1;
          throw new Error('QuotaExceededError');
        }
        data[k] = String(v);
        this[k] = String(v);
      },
      removeItem(k) {
        delete data[k];
        delete this[k];
      },
    };
    const sandbox = {
      self: {},
      localStorage,
      location: { href: 'https://example.com/page' },
      module: { exports: {} },
    };
    sandbox.self.localStorage = localStorage;
    sandbox.self.location = sandbox.location;
    sandbox.self.WTE_CONFIG = { prefix: 'wte' };
    const hashAbs = path.join(ROOT, 'src/hash.js');
    const cacheAbs = path.join(ROOT, 'src/cache.js');
    vm.runInNewContext(fs.readFileSync(hashAbs, 'utf8'), sandbox, { filename: hashAbs });
    sandbox.wteDjb2Key = sandbox.self.wteDjb2Key;
    vm.runInNewContext(fs.readFileSync(cacheAbs, 'utf8'), sandbox, { filename: cacheAbs });
    const api = sandbox.self.__wteCache;
    api.saveCache({
      entries: {
        a: { t: '1', r: '1', ts: 1, u: 'https://example.com/page' },
        b: { t: '2', r: '2', ts: 2, u: 'https://example.com/page' },
      },
      urlOrder: ['https://example.com/page'],
      revEntries: {},
    }, 'en');
    assert.ok(Object.keys(api.getCache('en').entries).length >= 1);
  });
});
