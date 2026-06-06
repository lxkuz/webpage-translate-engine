'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { wptranlateNormalizeLangTag } = require('../../src/lang-tag.js');

test('wptranlateNormalizeLangTag — валидные теги', () => {
  assert.strictEqual(wptranlateNormalizeLangTag('en-US'), 'en');
  assert.strictEqual(wptranlateNormalizeLangTag(' ru '), 'ru');
  assert.strictEqual(wptranlateNormalizeLangTag('zh_CN'), 'zh');
});

test('wptranlateNormalizeLangTag — шаблоны и мусор', () => {
  assert.strictEqual(wptranlateNormalizeLangTag('%lang%'), null);
  assert.strictEqual(wptranlateNormalizeLangTag(''), null);
  assert.strictEqual(wptranlateNormalizeLangTag('x-default'), null);
  assert.strictEqual(wptranlateNormalizeLangTag('english'), null);
});
