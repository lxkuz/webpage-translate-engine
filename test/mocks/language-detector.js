/**
 * Mock LanguageDetector API for engine site-fixture tests.
 */
(function wteLanguageDetectorMock() {
  let availabilityOverride = null;

  function detectLang(text) {
    const t = (text || '').trim();
    if (/[\u0900-\u097F]/.test(t)) return { detectedLanguage: 'hi', confidence: 0.95 };
    if (/[\u0400-\u04FF]/.test(t)) return { detectedLanguage: 'ru', confidence: 0.95 };
    if (/[äöüßÄÖÜ]/.test(t) || /\b(der|die|das|und|ist|nicht|eine?n?|wird|sind|haben|Berlin)\b/i.test(t)) {
      return { detectedLanguage: 'de', confidence: 0.92 };
    }
    if (/[\u4e00-\u9fff]/.test(t)) return { detectedLanguage: 'zh', confidence: 0.9 };
    if (/[a-zA-Z]/.test(t) && t.length >= 5) return { detectedLanguage: 'en', confidence: 0.85 };
    return { detectedLanguage: 'en', confidence: 0.2 };
  }

  window.LanguageDetector = {
    availability: async () => (availabilityOverride !== null ? availabilityOverride : 'readily'),
    create: async () => ({
      detect: async (text) => {
        const top = detectLang(text);
        return [top, { detectedLanguage: 'en', confidence: 0.05 }];
      },
    }),
  };

  window.__wteLanguageDetectorMock = {
    setAvailability: (v) => { availabilityOverride = v; },
    _reset: () => { availabilityOverride = null; },
  };
})();
