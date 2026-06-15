'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createMinimalPageDocument } = require('./minimal-page-dom');

const ROOT = path.join(__dirname, '../..');

const ENGINE_FILES = [
  'src/config.js',
  'presets/tsmpl.js',
  'src/hash.js',
  'src/lang-tag.js',
  'src/lang-detect.js',
  'src/translate-text.js',
  'src/cache.js',
  'presets/aliases.js',
  'src/dom-i18n-restore.js',
  'src/translate-document.js',
];

/**
 * @param {object} [opts]
 * @param {string} [opts.bodyText]
 * @param {() => Promise<string>} [opts.availability]
 * @param {import('node:vm').Context} [opts.extra]
 */
function loadTsmplEngine(opts = {}) {
  const sentMessages = [];
  const { document, injectedStyles } = createMinimalPageDocument({
    bodyText: opts.bodyText ?? 'Hello world',
    lang: opts.lang ?? 'en',
  });

  const storage = { tsmpl_enabledDomains: ['example.com'] };
  const localStorageData = {};

  const sandbox = {
    self: {},
    window: {},
    globalThis: {},
    document,
    localStorage: {
      getItem: (k) => localStorageData[k] ?? null,
      setItem: (k, v) => { localStorageData[k] = v; },
    },
    location: { hostname: 'example.com', protocol: 'https:', href: 'https://example.com/' },
    NodeFilter: { SHOW_TEXT: 4 },
    ShadowRoot: function ShadowRoot() {},
    queueMicrotask: (fn) => fn(),
    setTimeout: (fn) => { fn(); return 0; },
    chrome: {
      i18n: { getMessage: (k) => k },
      storage: {
        local: {
          get: async (keys) => {
            const out = {};
            const arr = Array.isArray(keys) ? keys : [keys];
            for (const k of arr) {
              if (storage[k] !== undefined) out[k] = storage[k];
            }
            return out;
          },
        },
      },
      runtime: {
        sendMessage: async (msg) => { sentMessages.push(msg); },
      },
    },
    module: { exports: {} },
    ...(opts.extra || {}),
  };

  sandbox.window = sandbox.self;
  sandbox.globalThis = sandbox.self;
  sandbox.self.window = sandbox.window;
  sandbox.self.window.top = sandbox.window;
  sandbox.self.top = sandbox.window;
  sandbox.window.addEventListener = () => {};
  sandbox.self.addEventListener = sandbox.window.addEventListener;
  sandbox.setTimeout = (fn) => {
    if (typeof fn === 'function') queueMicrotask(fn);
    return 1;
  };
  sandbox.self.setTimeout = sandbox.setTimeout;
  sandbox.self.document = document;
  sandbox.self.localStorage = sandbox.localStorage;
  sandbox.self.location = sandbox.location;
  sandbox.self.chrome = sandbox.chrome;
  sandbox.self.NodeFilter = sandbox.NodeFilter;
  sandbox.self.ShadowRoot = sandbox.ShadowRoot;
  sandbox.self.queueMicrotask = sandbox.queueMicrotask;
  sandbox.self.setTimeout = sandbox.setTimeout;

  let monitorHandler = null;
  sandbox.self.Translator = {
    availability: opts.availability ?? (async () => 'readily'),
    create: async (cfg) => {
      if (cfg.monitor) {
        cfg.monitor({
          addEventListener: (ev, cb) => {
            if (ev === 'downloadprogress') monitorHandler = cb;
          },
        });
      }
      if (monitorHandler) {
        monitorHandler({ loaded: 50, total: 100 });
      }
      return {
        translate: async (t) => `[zh]${t}`,
      };
    },
  };
  sandbox.Translator = sandbox.self.Translator;

  for (const rel of ENGINE_FILES) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), sandbox, { filename: rel });
  }

  return {
    g: sandbox.self,
    sentMessages,
    injectedStyles,
    fireDownloadProgress: (loaded, total) => {
      if (monitorHandler) monitorHandler({ loaded, total });
    },
  };
}

module.exports = { loadTsmplEngine, ENGINE_FILES, ROOT };
