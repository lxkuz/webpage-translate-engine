/**
 * Single-string translation via Chrome Built-in Translator API.
 * Requires: config, lang-tag, lang-detect (load before this script).
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
        const cyrillic = (sample.match(/[\u0400-\u04FF]/g) || []).length;
        const latin = (sample.match(/[a-zA-Z]/g) || []).length;
        if (latin > cyrillic * 1.5) sourceLanguage = 'en';
        else return { skipped: true, reason: 'same-lang' };
      }
    } else {
      const detected = await detectLang(sample || sampleText, {
        normalizeLang,
        minSampleLen: minDetectLen,
      });
      const fromHtml = typeof document !== 'undefined'
        ? normalizeLang(document.documentElement?.lang)
        : null;
      sourceLanguage = detected?.lang ?? fromHtml;
      if (!sourceLanguage) return { skipped: true, reason: 'no-source' };
    }

    if (sourceLanguage === targetLangNorm) return { skipped: true, reason: 'same-lang' };

    return { sourceLanguage, targetLanguage: targetLangNorm };
  }

  /**
   * @returns {Promise<{ ok: true, translator: object, sourceLanguage: string, targetLanguage: string }|{ skipped: true, reason: string }|{ ok: false, reason: string, error?: string }>}
   */
  async function wteCreateTranslator(sourceLanguage, targetLanguage, options = {}) {
    const cfg = g.WTE?.wteMergeConfig?.() || {};
    const ev = cfg.events || {};
    const messageTabId = options.messageTabId;

    if (!('Translator' in g)) {
      return { ok: false, reason: 'no-translator' };
    }

    let avail;
    try {
      avail = await Translator.availability({ sourceLanguage, targetLanguage });
    } catch (e) {
      if (/invalid language tag/i.test(e?.message || '')) return { skipped: true, reason: 'invalid-lang' };
      return { ok: false, reason: 'availability-error', error: String(e?.message || e) };
    }

    if (avail === 'unavailable') return { ok: false, reason: 'unavailable' };
    const needsDownload = avail === 'downloadable' || avail === 'downloading';

    try {
      const translator = await Translator.create({
        sourceLanguage,
        targetLanguage,
        ...(needsDownload && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && {
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              const total = e.total && e.total > 0 ? e.total : 1;
              const pct = Math.min(100, Math.round((e.loaded / total) * 100));
              chrome.runtime.sendMessage({
                action: ev.downloadProgress,
                loaded: e.loaded,
                total: e.total,
                percent: pct,
                tabId: messageTabId ?? undefined,
              }).catch(() => {});
            });
          },
        }),
      });
      return { ok: true, translator, sourceLanguage, targetLanguage };
    } catch (e) {
      const msg = String(e?.message || e);
      if (/user gesture/i.test(msg)) return { ok: false, reason: 'user-gesture' };
      if (/Permission Policy|sandbox|access denied/i.test(msg)) return { ok: false, reason: 'sandbox' };
      return { ok: false, reason: 'create-error', error: msg };
    }
  }

  /**
   * Translate a single string. All selection / snippet flows should use this entry point.
   *
   * @returns {Promise<{ ok: true, original: string, translated: string, sourceLanguage: string, targetLanguage: string }|{ skipped: true, reason: string }|{ ok: false, reason: string, error?: string }>}
   */
  async function wteTranslateText(text, targetLanguage, sourceLanguageOverride, options = {}) {
    const original = (typeof text === 'string' ? text : '').trim();
    if (!original) return { skipped: true, reason: 'empty' };

    if (wteIsRemoteHttp()) return { ok: false, reason: 'https-only' };
    if (!('Translator' in g)) return { ok: false, reason: 'no-translator' };

    const langResult = await wteResolveLanguages(
      targetLanguage,
      sourceLanguageOverride,
      original,
      { ...options, minDetectSampleLen: options.minDetectSampleLen ?? 3 },
    );
    if (langResult.skipped) return langResult;

    const trResult = await wteCreateTranslator(
      langResult.sourceLanguage,
      langResult.targetLanguage,
      options,
    );
    if (trResult.skipped) return trResult;
    if (!trResult.ok) return trResult;

    try {
      const translated = await trResult.translator.translate(original);
      const out = (translated ?? '').trim();
      return {
        ok: true,
        original,
        translated: out || original,
        sourceLanguage: langResult.sourceLanguage,
        targetLanguage: langResult.targetLanguage,
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
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      wteResolveLanguages,
      wteCreateTranslator,
      wteTranslateText,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
