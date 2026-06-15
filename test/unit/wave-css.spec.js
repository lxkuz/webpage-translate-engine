'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const assert = require('node:assert');
const { loadTsmplEngine } = require('../helpers/load-tsmpl-engine');

const SRC = fs.readFileSync(path.join(__dirname, '../../src/translate-document.js'), 'utf8');

test('translate-document.js does not use broken string-concat inside template literal for wave CSS', () => {
  assert.ok(!SRC.includes(".' + nm.classWave + '"), 'regression: literal concat inside backticks');
  assert.ok(!SRC.includes("' + nm.prefix + '-wave-flow"), 'regression: keyframes name concat inside backticks');
  assert.ok(SRC.includes('.${nm.classWave}'), 'wave selector must interpolate classWave');
  assert.ok(SRC.includes('${nm.prefix}-wave-flow'), 'keyframes must interpolate prefix');
});

test('wave style targets configured classWave (tsmpl-wave)', async () => {
  const { g, injectedStyles } = loadTsmplEngine();
  await g.WTE.translateDocument('zh', null, 42);

  const style = injectedStyles.find((s) => s.id === 'tsmpl-wave-styles');
  assert.ok(style, 'wave style element must be injected');
  assert.match(style.textContent, /\.tsmpl-wave\s*\{/);
  assert.match(style.textContent, /@keyframes tsmpl-wave-flow/);
  assert.doesNotMatch(style.textContent, /\+\s*nm\.classWave/);
});
