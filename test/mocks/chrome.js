/**
 * Mock Chrome Extension API for engine site-fixture tests.
 */
(function wteChromeMock() {
  const storage = { wptranlate_enabledDomains: ['localhost', '127.0.0.1'], wptranlate_targetLang: 'en' };
  let uiLocale = 'en';
  const messageListeners = [];
  const _sentMessages = [];
  let runtimeId = 'wte-test-extension';

  window.chrome = {
    get runtime() {
      return {
        id: runtimeId,
        sendMessage: async (msg) => {
          _sentMessages.push(msg);
          const sender = { tab: { id: 1, url: location.href } };
          messageListeners.forEach((cb) => {
            try { cb(msg, sender, () => {}); } catch (_) {}
          });
        },
        onMessage: { addListener: (cb) => { messageListeners.push(cb); } },
        onInstalled: { addListener: () => {} },
        getURL: (p) => `chrome-extension://${runtimeId}/${String(p || '').replace(/^\//, '')}`,
      };
    },
    storage: {
      local: {
        get: (keys) => {
          const result = {};
          const keyArr = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || {}));
          keyArr.forEach((k) => { if (storage[k] !== undefined) result[k] = storage[k]; });
          return Promise.resolve(result);
        },
        set: (obj) => {
          Object.assign(storage, obj);
          return Promise.resolve();
        },
      },
      onChanged: { addListener: () => {} },
    },
    i18n: {
      getUILanguage: () => uiLocale,
      getMessage: (id, subs) => {
        const arr = subs == null ? [] : (Array.isArray(subs) ? subs : [subs]);
        const messages = {
          uiErrHttpsOnly: 'HTTPS only',
          uiErrNoBuiltInTranslator: 'No built-in translator',
          uiErrModelUnavailable: 'Model unavailable',
          uiErrTranslatorCreate: 'Translator.create: $DETAIL$',
          uiErrTranslationFailed: 'Translation failed: $DETAIL$',
        };
        let s = messages[id] || id;
        if (arr.length) s = s.replace(/\$DETAIL\$/gi, String(arr[0]));
        return s;
      },
    },
  };

  window.__wteChromeMock = {
    resetStorage: () => {
      storage.wptranlate_enabledDomains = ['localhost', '127.0.0.1'];
      storage.wptranlate_targetLang = 'en';
      delete storage.wptranlate_disabledAt;
    },
    setStorage: (key, value) => { storage[key] = value; },
    getStorage: () => ({ ...storage }),
    enableTranslationForCurrentHost: () => {
      const host = location.hostname || 'localhost';
      storage.wptranlate_enabledDomains = storage.wptranlate_enabledDomains || [];
      if (!storage.wptranlate_enabledDomains.includes(host)) {
        storage.wptranlate_enabledDomains.push(host);
      }
    },
    getSentMessages: () => [..._sentMessages],
    clearSentMessages: () => { _sentMessages.length = 0; },
  };
})();
