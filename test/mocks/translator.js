/**
 * Mock Translator API for engine site-fixture tests.
 */
(function wteTranslatorMock() {
  let availabilityOverride = null;
  let createThrow = null;
  let translateCallCount = 0;
  const BATCH_SEP = '\u2063';

  function translateText(text, targetLanguage) {
    if (!text || !text.trim()) return text;
    const tag = String(targetLanguage || 'en').toUpperCase();
    return `[${tag}]${text}`;
  }

  window.Translator = {
    availability: async () => (availabilityOverride !== null ? availabilityOverride : 'readily'),
    create: async ({ targetLanguage, monitor }) => {
      if (createThrow) throw createThrow;
      if (monitor && typeof monitor === 'function') {
        monitor({ addEventListener: (ev, cb) => { if (ev === 'downloadprogress') cb({ loaded: 1, total: 1 }); } });
      }
      return {
        translate: async (text) => {
          translateCallCount += 1;
          if (text.includes(BATCH_SEP)) {
            return text.split(BATCH_SEP).map((p) => translateText(p, targetLanguage)).join(BATCH_SEP);
          }
          return translateText(text, targetLanguage);
        },
      };
    },
  };

  window.__wteTranslatorMock = {
    setAvailability: (v) => { availabilityOverride = v; },
    setCreateThrow: (err) => { createThrow = err; },
    getTranslateCallCount: () => translateCallCount,
    _reset: () => {
      availabilityOverride = null;
      createThrow = null;
      translateCallCount = 0;
    },
  };
})();
