/**
 * Single-string translation via translator adapters (Chrome API → remote fallback).
 * Requires: config, lang-tag, lang-detect, translator-adapters (load before this script).
 *
 * Public API (page context):
 *   WTE.wteResolveLanguages(target, sourceOverride, sample, options?)
 *   WTE.wteCreateTranslator(source, target, options?)
 *   WTE.translateText(text, target, sourceOverride?, options?)
 */
(function wteTranslateTextModule(global) {
  const g = global || (typeof self !== 'undefined' ? self : globalThis);

  function wteGetNormalizeLang() {
    if (typeof g.wteNormalizeLangTag === 'function') return g.wteNormalizeLangTag;
    if (typeof g.wptranlateNormalizeLangTag === 'function') return g.wptranlateNormalizeLangTag;
    return (tag) => {
      if (tag == null || typeof tag !== 'string') return null;
      const primary = tag.trim().split(/[-_]/)[0].toLowerCase();
      if (!primary || primary === 'x' || /[%{}]/.test(primary) || !/^[a-z]{2,3}$/.test(primary)) return null;
      return primary;
    };
  }

  function wteGetDetectLang() {
    if (typeof g.wteDetectLangFromText === 'function') return g.wteDetectLangFromText;
    if (typeof g.wptranlateDetectLangFromText === 'function') return g.wptranlateDetectLangFromText;
    return async () => null;
  }

  function wteIsRemoteHttp() {
    if (typeof location === 'undefined') return false;
    return location.protocol === 'http:' && !/^localhost$|^127\.0\.0\.1$/i.test(location.hostname || '');
  }

  function wteHasAnyTranslatorBackend() {
    if (g.WTE?.wteHasChromeTranslator?.()) return true;
    const cfg = g.WTE?.wteMergeConfig?.() || {};
    return Boolean(g.WTE?.wteRemoteEnabled?.(cfg));
  }

  function wteLatinCyrillicCounts(text) {
    const sample = typeof text === 'string' ? text : '';
    return {
      cyrillic: (sample.match(/[\u0400-\u04FF]/g) || []).length,
      latin: (sample.match(/[a-zA-Z]/g) || []).length,
    };
  }

  /** Когда LanguageDetector недоступен (Brave и др.) — грубая оценка по алфавиту. */
  function wteGuessLangFromScript(sample) {
    const { cyrillic, latin } = wteLatinCyrillicCounts(sample);
    if (cyrillic >= 10 && cyrillic > latin * 1.5) return 'ru';
    if (latin >= 10 && latin > cyrillic * 1.5) return 'en';
    return null;
  }

  function wteApplyLatinCyrillicHeuristic(sourceLanguage, targetLangNorm, sample, cfg) {
    if (!cfg.langHeuristicLatinCyrillic || sourceLanguage !== targetLangNorm) {
      return sourceLanguage;
    }
    const { cyrillic, latin } = wteLatinCyrillicCounts(sample);
    if (latin > cyrillic * 1.5) return 'en';
    if (cyrillic > latin * 1.5) return 'ru';
    return sourceLanguage;
  }

  /**
   * @returns {Promise<{ sourceLanguage: string, targetLanguage: string }|{ skipped: true, reason: string }>}
   */
  async function wteResolveLanguages(targetLanguage, sourceLanguageOverride, sampleText, options = {}) {
    const cfg = g.WTE?.wteMergeConfig?.(options.runtime) || {};
    const normalizeLang = wteGetNormalizeLang();
    const detectLang = wteGetDetectLang();
    const detectSampleLen = options.detectSampleLen ?? cfg.detectSampleLen ?? 3000;
    const topFrameHtmlLang = options.topFrameHtmlLang;
    const minDetectLen = options.minDetectSampleLen ?? 3;

    const targetLangNorm = normalizeLang(targetLanguage);
    if (!targetLangNorm) return { skipped: true, reason: 'invalid-target' };

    const sample = (typeof sampleText === 'string' ? sampleText : '').slice(0, detectSampleLen);

    let sourceLanguage;
    if (sourceLanguageOverride && String(sourceLanguageOverride).trim()) {
      sourceLanguage = normalizeLang(sourceLanguageOverride);
      if (!sourceLanguage) return { skipped: true, reason: 'invalid-source' };
      g.WTE?.wteDebugLog?.('resolve-lang:override', { sourceLanguage, targetLangNorm }, cfg);
    } else if (cfg.langDetection === 'topFrameHtml') {
      let declaredLang = '';
      if (typeof topFrameHtmlLang === 'string') {
        declaredLang = topFrameHtmlLang.trim();
      } else if (typeof document !== 'undefined') {
        try {
          declaredLang = (window.top.document.documentElement?.lang || '').trim();
        } catch (_) {
          declaredLang = (document.documentElement?.lang || '').trim();
        }
      }
      sourceLanguage = normalizeLang(declaredLang || 'en');
      if (!sourceLanguage) return { skipped: true, reason: 'no-source' };
      if (cfg.langHeuristicLatinCyrillic && sourceLanguage === targetLangNorm) {
        sourceLanguage = wteApplyLatinCyrillicHeuristic(sourceLanguage, targetLangNorm, sample, cfg);
        if (sourceLanguage === targetLangNorm) return { skipped: true, reason: 'same-lang' };
      }
    } else {
      const detected = await detectLang(sample || sampleText, {
        normalizeLang,
        minSampleLen: minDetectLen,
      });
      const fromHtml = typeof document !== 'undefined'
        ? normalizeLang(document.documentElement?.lang)
        : null;
      const fromScript = wteGuessLangFromScript(sample);
      // Страницы с lang="en" и русским текстом: LanguageDetector (Chrome) часто даёт en.
      // При включённой эвристике доверяем алфавиту раньше детектора и html[lang].
      if (cfg.langHeuristicLatinCyrillic) {
        sourceLanguage = fromScript ?? detected?.lang ?? fromHtml;
      } else {
        sourceLanguage = detected?.lang ?? fromScript ?? fromHtml;
      }
      if (!sourceLanguage) return { skipped: true, reason: 'no-source' };
      sourceLanguage = wteApplyLatinCyrillicHeuristic(sourceLanguage, targetLangNorm, sample, cfg);
      g.WTE?.wteDebugLog?.('resolve-lang:detector', {
        detected: detected?.lang ?? null,
        fromScript,
        fromHtml,
        heuristic: cfg.langHeuristicLatinCyrillic,
        cyrillic: wteLatinCyrillicCounts(sample).cyrillic,
        latin: wteLatinCyrillicCounts(sample).latin,
        sampleLen: sample.length,
        sourceLanguage,
        targetLangNorm,
      }, cfg);
    }

    if (sourceLanguage === targetLangNorm) {
      g.WTE?.wteDebugLog?.('resolve-lang:skip', { reason: 'same-lang', sourceLanguage, targetLangNorm }, cfg);
      return { skipped: true, reason: 'same-lang' };
    }

    g.WTE?.wteDebugLog?.('resolve-lang:ok', { sourceLanguage, targetLangNorm }, cfg);
    return { sourceLanguage, targetLanguage: targetLangNorm };
  }

  /**
   * @returns {Promise<{ ok: true, translator: object, backend?: string, sourceLanguage: string, targetLanguage: string }|{ skipped: true, reason: string }|{ ok: false, reason: string, error?: string }>}
   */
  async function wteCreateTranslator(sourceLanguage, targetLanguage, options = {}) {
    const acquire = g.WTE?.wteAcquireTranslator;
    if (typeof acquire === 'function') {
      return acquire(sourceLanguage, targetLanguage, options);
    }
    return { ok: false, reason: 'no-adapters' };
  }

  /**
   * Translate a single string. All selection / snippet flows should use this entry point.
   *
   * @returns {Promise<{ ok: true, original: string, translated: string, sourceLanguage: string, targetLanguage: string, backend?: string }|{ skipped: true, reason: string }|{ ok: false, reason: string, error?: string }>}
   */
  async function wteTranslateText(text, targetLanguage, sourceLanguageOverride, options = {}) {
    const original = (typeof text === 'string' ? text : '').trim();
    if (!original) return { skipped: true, reason: 'empty' };

    if (wteIsRemoteHttp()) return { ok: false, reason: 'https-only' };
    if (!wteHasAnyTranslatorBackend()) return { ok: false, reason: 'no-translator' };

    const langResult = await wteResolveLanguages(
      targetLanguage,
      sourceLanguageOverride,
      original,
      { ...options, minDetectSampleLen: options.minDetectSampleLen ?? 3 },
    );
    if (langResult.skipped) {
      g.WTE?.wteDebugLog?.('translate-text:skip', { reason: langResult.reason }, g.WTE?.wteMergeConfig?.() || {});
      return langResult;
    }

    const trResult = await wteCreateTranslator(
      langResult.sourceLanguage,
      langResult.targetLanguage,
      options,
    );
    if (trResult.skipped) {
      g.WTE?.wteDebugLog?.('translate-text:skip', { reason: trResult.reason }, g.WTE?.wteMergeConfig?.() || {});
      return trResult;
    }
    if (!trResult.ok) {
      g.WTE?.wteDebugLog?.('translate-text:error', { reason: trResult.reason, error: trResult.error }, g.WTE?.wteMergeConfig?.() || {});
      return trResult;
    }

    try {
      const translated = await trResult.translator.translate(original);
      const out = (translated ?? '').trim();
      g.WTE?.wteDebugLog?.('translate-text:ok', {
        backend: trResult.backend || trResult.translator?.backend,
        sourceLanguage: langResult.sourceLanguage,
        targetLanguage: langResult.targetLanguage,
        chars: original.length,
      }, g.WTE?.wteMergeConfig?.() || {});
      return {
        ok: true,
        original,
        translated: out || original,
        sourceLanguage: langResult.sourceLanguage,
        targetLanguage: langResult.targetLanguage,
        backend: trResult.backend || trResult.translator?.backend,
      };
    } catch (e) {
      return { ok: false, reason: 'error', error: String(e?.message || e) };
    }
  }

  g.WTE = g.WTE || {};
  Object.assign(g.WTE, {
    wteResolveLanguages,
    wteCreateTranslator,
    wteTranslateText,
    translateText: wteTranslateText,
    wteHasAnyTranslatorBackend,
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      wteResolveLanguages,
      wteCreateTranslator,
      wteTranslateText,
      wteHasAnyTranslatorBackend,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
