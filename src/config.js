/**
 * Configurable namespace for DOM markers, cache keys, and extension hooks.
 * Set self.WTE_CONFIG before other scripts load, or pass options to translateDocument().
 */
(function wteConfigModule(global) {
  const g = global || (typeof self !== 'undefined' ? self : globalThis);

  const DEFAULT_UI_HOST_IDS = [
    'page-panel',
    'error-toast',
    'quick-toggle-toast',
    'same-lang-toast',
    'https-only-toast',
    'status-bar',
  ];

  /** Neutral defaults; presets override via WTE_CONFIG.toasts. */
  const WTE_DEFAULT_TOASTS = {
    quickToggle: {
      css:
        'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);max-width:min(420px,calc(100vw - 24px));' +
        'padding:10px 16px;background-color:#334155;color:#ffffff;border-radius:8px;font-size:13px;' +
        'z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,.2);',
      durationMs: 1500,
    },
    error: {
      css:
        'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);max-width:90%;padding:10px 16px;' +
        'background-color:#1e1826;color:#f1f5f9;border:none;border-radius:8px;font-size:14px;' +
        'z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,.3),0 0 0 1px rgba(170,95,191,.15);',
      durationMs: 6000,
    },
  };

  function wteMergeToastSpec(key, overrides, base) {
    const o = overrides?.toasts?.[key] ?? {};
    const b = base?.toasts?.[key] ?? {};
    const d = WTE_DEFAULT_TOASTS[key] || {};
    return {
      css: o.css ?? b.css ?? d.css ?? '',
      durationMs: o.durationMs ?? b.durationMs ?? d.durationMs ?? 3000,
    };
  }

  /**
   * Mount an in-page toast from cfg.toasts[kind] (css + durationMs).
   * @returns {HTMLElement|null}
   */
  function wteMountToast(cfg, kind, { id, text } = {}) {
    const spec = cfg?.toasts?.[kind];
    if (!spec?.css || typeof document === 'undefined') return null;
    const root = document.body || document.documentElement;
    if (!root) return null;
    try {
      const el = document.createElement('div');
      if (id) el.id = id;
      el.style.cssText = spec.css;
      if (text != null) el.textContent = text;
      root.appendChild(el);
      setTimeout(() => { try { el.remove(); } catch (_) {} }, spec.durationMs ?? 3000);
      return el;
    } catch (_) {
      return null;
    }
  }

  function wteMakeNames(prefix, uiHostSuffixes) {
    const p = (prefix || 'wte').replace(/-+$/g, '');
    const hosts = (uiHostSuffixes || DEFAULT_UI_HOST_IDS).map((s) => `${p}-${s}`);
    const hostSelector = hosts.map((id) => `#${id}`).join(', ');
    return {
      prefix: p,
      cacheKeyPrefix: `${p}_cache_`,
      classCached: `${p}-cached`,
      classWave: `${p}-wave`,
      classUiNotranslate: `${p}-ui-notranslate`,
      dataUiAttr: `data-${p}-ui`,
      dataOrig: `${p}Orig`,
      dataLang: `${p}Lang`,
      dataAttrLang: `${p}AttrLang`,
      dataI18nPlaceholder: `${p}I18nPlaceholder`,
      dataI18nTitle: `${p}I18nTitle`,
      dataI18nAriaLabel: `${p}I18nAriaLabel`,
      dataI18nAlt: `${p}I18nAlt`,
      dataI18nContent: `${p}I18nContent`,
      dataI18nValue: `${p}I18nValue`,
      waveStylesId: `${p}-wave-styles`,
      errorToastId: `${p}-error-toast`,
      quickToggleToastId: `${p}-quick-toggle-toast`,
      uiHostIds: hosts,
      uiClosestSelector: hostSelector,
      selCached: `.${p}-cached`,
      selWave: `.${p}-wave`,
      selOrigSpan: `span[data-${p}-orig]:not(.${p}-cached):not(.${p}-wave)`,
      stateTranslating: `__${p}Translating`,
      stateTranslatePending: `__${p}TranslatePending`,
      stateLastArgs: `__${p}LastTranslateArgs`,
      stateTranslated: `__${p}Translated`,
      stateScrollSetup: `__${p}ScrollSetup`,
      stateOriginalTitle: `__${p}OriginalTitle`,
    };
  }

  function wteMergeConfig(overrides) {
    const base = g.WTE_CONFIG || {};
    const prefix = overrides?.prefix ?? base.prefix ?? 'wte';
    const names = wteMakeNames(prefix, overrides?.uiHostSuffixes ?? base.uiHostSuffixes);
    return {
      prefix,
      names,
      enabledDomainsStorageKey: overrides?.enabledDomainsStorageKey ?? base.enabledDomainsStorageKey ?? null,
      messageKeys: { ...base.messageKeys, ...overrides?.messageKeys },
      events: {
        start: overrides?.events?.start ?? base.events?.start ?? 'wte:translate-start',
        end: overrides?.events?.end ?? base.events?.end ?? 'wte:translate-end',
        downloadProgress: overrides?.events?.downloadProgress ?? base.events?.downloadProgress ?? 'wte:download-progress',
      },
      batch: {
        visibleFirst: overrides?.batch?.visibleFirst ?? base.batch?.visibleFirst ?? 20,
        visible: overrides?.batch?.visible ?? base.batch?.visible ?? 20,
        offscreen: overrides?.batch?.offscreen ?? base.batch?.offscreen ?? 100,
        sep: overrides?.batch?.sep ?? base.batch?.sep ?? '\u2063',
      },
      scrollDebounceMs: overrides?.scrollDebounceMs ?? base.scrollDebounceMs ?? 400,
      scrollRetryMs: overrides?.scrollRetryMs ?? base.scrollRetryMs ?? 2000,
      detectSampleLen: overrides?.detectSampleLen ?? base.detectSampleLen ?? 3000,
      /** 'languageDetector' (default) | 'topFrameHtml' */
      langDetection: overrides?.langDetection ?? base.langDetection ?? 'languageDetector',
      /** When langDetection=topFrameHtml and declared source equals target, use latin/cyrillic heuristic */
      langHeuristicLatinCyrillic: overrides?.langHeuristicLatinCyrillic ?? base.langHeuristicLatinCyrillic ?? false,
      logTag: overrides?.logTag ?? base.logTag ?? '[WebpageTranslateEngine]',
      toasts: {
        quickToggle: wteMergeToastSpec('quickToggle', overrides, base),
        error: wteMergeToastSpec('error', overrides, base),
      },
    };
  }

  const api = { wteMakeNames, wteMergeConfig, wteMountToast, WTE_DEFAULT_TOASTS, DEFAULT_UI_HOST_IDS };
  g.WTE = g.WTE || {};
  Object.assign(g.WTE, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
