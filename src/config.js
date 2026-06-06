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
      logTag: overrides?.logTag ?? base.logTag ?? '[WebpageTranslateEngine]',
    };
  }

  const api = { wteMakeNames, wteMergeConfig, DEFAULT_UI_HOST_IDS };
  g.WTE = g.WTE || {};
  Object.assign(g.WTE, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
