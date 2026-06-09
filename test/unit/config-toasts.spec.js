/**
 * WTE_CONFIG.toasts merge and wteMountToast.
 */
const { test, describe } = require('node:test');
const assert = require('node:assert');

const { wteMergeConfig, wteMountToast, WTE_DEFAULT_TOASTS } = require('../../src/config.js');

describe('WTE_CONFIG.toasts', () => {
  test('defaults when preset has no toasts', () => {
    global.WTE_CONFIG = { prefix: 'wte' };
    const cfg = wteMergeConfig();
    assert.strictEqual(cfg.toasts.quickToggle.css, WTE_DEFAULT_TOASTS.quickToggle.css);
    assert.strictEqual(cfg.toasts.error.durationMs, WTE_DEFAULT_TOASTS.error.durationMs);
  });

  test('preset overrides quickToggle css, error keeps default', () => {
    global.WTE_CONFIG = {
      prefix: 'demo',
      toasts: {
        quickToggle: { css: 'background-color:#ff0000;color:#fff;' },
      },
    };
    const cfg = wteMergeConfig();
    assert.match(cfg.toasts.quickToggle.css, /#ff0000/);
    assert.strictEqual(cfg.toasts.error.css, WTE_DEFAULT_TOASTS.error.css);
  });

  test('partial override keeps default durationMs', () => {
    global.WTE_CONFIG = {
      toasts: { quickToggle: { css: 'x:1;' } },
    };
    const cfg = wteMergeConfig();
    assert.strictEqual(cfg.toasts.quickToggle.durationMs, WTE_DEFAULT_TOASTS.quickToggle.durationMs);
  });
});

describe('wteMountToast', () => {
  test('applies css and removes after durationMs', () => {
    let mounted = null;
    const timers = [];
    global.setTimeout = (fn, ms) => {
      timers.push({ fn, ms });
      return timers.length;
    };
    global.document = {
      body: {
        appendChild(el) { mounted = el; },
      },
      createElement() {
        return {
          id: '',
          style: { cssText: '' },
          textContent: '',
          remove() { mounted = null; },
        };
      },
    };

    const cfg = {
      toasts: {
        quickToggle: { css: 'background:#9333ea;', durationMs: 1200 },
      },
    };
    const el = wteMountToast(cfg, 'quickToggle', { id: 'demo-toast', text: 'Hello' });
    assert.ok(el);
    assert.strictEqual(el.id, 'demo-toast');
    assert.strictEqual(el.textContent, 'Hello');
    assert.strictEqual(el.style.cssText, 'background:#9333ea;');
    assert.ok(mounted);
    assert.strictEqual(timers.length, 1);
    assert.strictEqual(timers[0].ms, 1200);
    timers[0].fn();
    assert.strictEqual(mounted, null);
  });
});
