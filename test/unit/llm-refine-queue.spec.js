/**
 * Unit tests for llm-refine-queue helpers.
 * node --test test/unit/llm-refine-queue.spec.js
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  wteLlmRefineConfig,
  wteQueueLlmRefine,
  wteNotifyTranslationStarted,
} = require('../../src/llm-refine-queue.js');

describe('wteLlmRefineConfig', () => {
  it('defaults to disabled', () => {
    assert.deepEqual(wteLlmRefineConfig({}), { enabled: false, visibleOnly: true });
  });

  it('reads preset flags', () => {
    assert.deepEqual(wteLlmRefineConfig({ llmRefine: { enabled: true, visibleOnly: false } }), {
      enabled: true,
      visibleOnly: false,
    });
  });
});

describe('wteQueueLlmRefine', () => {
  it('no-ops when disabled', () => {
    const sent = [];
    global.chrome = { runtime: { sendMessage: (msg) => { sent.push(msg); } } };
    wteQueueLlmRefine({ llmRefine: { enabled: false }, events: { queueLlmRefine: 'x:queue' } }, {}, {
      visible: true,
      orig: 'a',
      local_tr: 'b',
    });
    assert.equal(sent.length, 0);
    delete global.chrome;
  });

  it('sends queue message for visible item', () => {
    const sent = [];
    global.chrome = { runtime: { sendMessage: (msg) => { sent.push(msg); return Promise.resolve(); } } };
    wteQueueLlmRefine(
      { prefix: 'trnslt', llmRefine: { enabled: true }, events: { queueLlmRefine: 'trnslt:queue-llm-refine' } },
      {},
      {
        tabId: 1,
        targetLang: 'ru',
        visible: true,
        orig: 'Hello',
        local_tr: 'Привет',
        sourceLanguage: 'en',
        targetLanguage: 'ru',
      },
    );
    assert.equal(sent.length, 1);
    assert.equal(sent[0].action, 'trnslt:queue-llm-refine');
    assert.equal(sent[0].item.orig, 'Hello');
    assert.equal(sent[0].item.local_tr, 'Привет');
    delete global.chrome;
  });
});

describe('wteNotifyTranslationStarted', () => {
  it('sends in top frame context', () => {
    const sent = [];
    global.chrome = { runtime: { sendMessage: (msg) => { sent.push(msg); return Promise.resolve(); } } };
    global.window = global;
    global.window.top = global.window;
    wteNotifyTranslationStarted({ events: { translationStarted: 'trnslt:translation-started' } }, { tabId: 5 });
    assert.equal(sent.length, 1);
    assert.equal(sent[0].action, 'trnslt:translation-started');
    assert.equal(sent[0].tabId, 5);
    delete global.chrome;
    delete global.window;
  });
});
