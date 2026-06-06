/**
 * Определение языка текста через Chrome LanguageDetector API.
 * Fallback на null — вызывающий код может использовать html[lang].
 */
(function wptranlateLangDetectModule() {
  if (typeof self !== 'undefined' && self.__wptranlateLangDetect) return;

  const MIN_SAMPLE_LEN = 20;
  const DEFAULT_MIN_CONFIDENCE = 0.5;

  /**
   * @param {string} sample
   * @param {{ normalizeLang?: (tag: string) => string|null, minConfidence?: number, minSampleLen?: number, monitor?: (m: EventTarget) => void }} [options]
   * @returns {Promise<{ lang: string, confidence: number }|null>}
   */
  async function wptranlateDetectLangFromText(sample, options = {}) {
    const {
      normalizeLang = (tag) => tag,
      minConfidence = DEFAULT_MIN_CONFIDENCE,
      minSampleLen = MIN_SAMPLE_LEN,
      monitor,
    } = options;

    const text = (typeof sample === 'string' ? sample : '').trim();
    if (text.length < minSampleLen) return null;
    const g = typeof globalThis !== 'undefined' ? globalThis : self;
    if (!g || !('LanguageDetector' in g)) return null;

    try {
      const avail = await g.LanguageDetector.availability();
      if (avail === 'unavailable') return null;

      const createOpts = {};
      if (monitor) createOpts.monitor = monitor;

      const detector = await g.LanguageDetector.create(createOpts);
      const results = await detector.detect(text);
      if (!Array.isArray(results) || results.length === 0) return null;

      const top = results[0];
      const lang = normalizeLang(top.detectedLanguage);
      if (!lang) return null;
      if (typeof top.confidence === 'number' && top.confidence < minConfidence) return null;

      return { lang, confidence: top.confidence };
    } catch (_) {
      return null;
    }
  }

  const api = {
    wptranlateDetectLangFromText,
    WPTRANLATE_DETECT_MIN_SAMPLE_LEN: MIN_SAMPLE_LEN,
    WPTRANLATE_DETECT_MIN_CONFIDENCE: DEFAULT_MIN_CONFIDENCE,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof self !== 'undefined') {
    self.__wptranlateLangDetect = api;
    Object.assign(self, { wptranlateDetectLangFromText });
  }
})();
