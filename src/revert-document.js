/**
 * Revert translated DOM to originals (with optional cache wipe).
 */
(function wteRevertDocumentModule(global) {
  const g = global || (typeof self !== 'undefined' ? self : globalThis);

  function wteRevertDomOnly() {
    const cfg = g.WTE?.wteMergeConfig?.() || {};
    const nm = cfg.names || g.WTE?.wteMakeNames?.('wptranlate');
    const CACHE_KEY_PREFIX = g.__wteCache?.CACHE_KEY_PREFIX || g.__wptranlateCache?.CACHE_KEY_PREFIX || nm.cacheKeyPrefix;
    const hashStr = (typeof self !== 'undefined' && (self.wteDjb2Key || self.wptranlateDjb2Key || self.tsmplDjb2Key)) || ((s) => {
      let h = 5381;
      for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
      return (h >>> 0).toString(36);
    });
    const restoreFn = self.wteRestoreDatasetAttrsTree || self.wptranlateRestoreDatasetAttrsTree || self.tsmplRestoreDatasetAttrsTree;

    function collectCachedSpans(root, out) {
      root.querySelectorAll('.' + nm.classCached).forEach((el) => out.push(el));
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) collectCachedSpans(el.shadowRoot, out);
      });
    }
    function revLookupForSpan(span) {
      const lang = span.dataset[nm.dataLang];
      if (lang) {
        try {
          const raw = localStorage.getItem(CACHE_KEY_PREFIX + lang.toLowerCase().split('-')[0]);
          if (raw) return JSON.parse(raw).revEntries || {};
        } catch (_) {}
      }
      const merged = {};
      try {
        Object.keys(localStorage || {}).forEach((k) => {
          if (k.startsWith(CACHE_KEY_PREFIX)) {
            const parsed = JSON.parse(localStorage.getItem(k) || '{}');
            if (parsed.revEntries) Object.assign(merged, parsed.revEntries);
          }
        });
      } catch (_) {}
      return merged;
    }

    if (document.body && restoreFn) restoreFn(document.body);
    const spans = [];
    if (document.body) collectCachedSpans(document.body, spans);
    for (const span of spans) {
      const revEntries = revLookupForSpan(span);
      const orig = span.dataset[nm.dataOrig] ||
        (revEntries && revEntries[hashStr(span.textContent || '')]?.o) ||
        span.textContent;
      const textNode = document.createTextNode(orig || '');
      if (span.parentNode) span.parentNode.replaceChild(textNode, span);
    }
    const titleKey = nm.stateOriginalTitle;
    let originalTitle = window?.[titleKey];
    if (originalTitle == null) {
      try {
        Object.keys(localStorage || {}).forEach((k) => {
          if (k.startsWith(CACHE_KEY_PREFIX)) {
            const parsed = JSON.parse(localStorage.getItem(k) || '{}');
            if (parsed?.title?.orig) originalTitle = parsed.title.orig;
          }
        });
      } catch (_) {}
    }
    if (typeof document !== 'undefined' && originalTitle != null) {
      document.title = originalTitle;
      if (window?.[titleKey] != null) delete window[titleKey];
    }
    if (typeof self !== 'undefined') {
      self[nm.stateTranslated] = new WeakSet();
      self[nm.stateScrollSetup] = false;
    }
  }

  function wteRevertAndClearCaches() {
    const cfg = g.WTE?.wteMergeConfig?.() || {};
    const nm = cfg.names || g.WTE?.wteMakeNames?.('wptranlate');
    try {
      if (typeof document !== 'undefined' && document.body) {
        const el = document.createElement('div');
        el.id = nm.quickToggleToastId;
        el.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);max-width:min(420px,calc(100vw - 24px));padding:10px 16px;background-color:#9333ea;color:#ffffff;border:2px solid #e9d5ff;border-radius:10px;font-size:13px;font-weight:600;line-height:1.45;z-index:2147483647;box-shadow:0 8px 28px rgba(147,51,234,.55),0 0 0 1px rgba(255,255,255,.2);text-shadow:0 1px 2px rgba(0,0,0,.18);';
        el.textContent = chrome.i18n.getMessage('uiQuickToggleToast');
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 1500);
      }
    } catch (_) {}
    wteRevertDomOnly();
    const CACHE_KEY_PREFIX = g.__wteCache?.CACHE_KEY_PREFIX || g.__wptranlateCache?.CACHE_KEY_PREFIX || nm.cacheKeyPrefix;
    const clearAllCaches = self.__wteCache?.clearAllCaches || self.__wptranlateCache?.clearAllCaches || self.__tsmplCache?.clearAllCaches;
    if (clearAllCaches) clearAllCaches();
    else {
      try {
        Object.keys(localStorage || {}).forEach((k) => {
          if (k.startsWith(CACHE_KEY_PREFIX)) localStorage.removeItem(k);
        });
      } catch (_) {}
    }
  }

  g.WTE = g.WTE || {};
  g.WTE.revertDomOnly = wteRevertDomOnly;
  g.WTE.revertAndClearCaches = wteRevertAndClearCaches;
  if (typeof window !== 'undefined') {
    window.__wptranlateRevertOnly = wteRevertDomOnly;
    window.__wptranlateRevertAndClearCache = wteRevertAndClearCaches;
    window.__tsmplRevertOnly = wteRevertDomOnly;
    window.__tsmplRevertAndClearCache = wteRevertAndClearCaches;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { wteRevertDomOnly, wteRevertAndClearCaches };
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
