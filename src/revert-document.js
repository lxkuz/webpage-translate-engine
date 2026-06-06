/**
 * Revert translated DOM to originals (with optional cache wipe).
 */
(function wteRevertDocumentModule(global) {
  const g = global || (typeof self !== 'undefined' ? self : globalThis);

function wteRevertDomOnly() {
  const CACHE_KEY_PREFIX = (g.__wteCache?.CACHE_KEY_PREFIX) || (g.__wptranlateCache?.CACHE_KEY_PREFIX) || 'wptranlate_cache_';
  const hashStr = (typeof self !== 'undefined' && self.wptranlateDjb2Key) || (s => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return (h >>> 0).toString(36);
  });
  function wptranlateInjectCollectCachedSpans(root, out) {
    const els = root.querySelectorAll('.wptranlate-cached');
    els.forEach((el) => out.push(el));
    root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) wptranlateInjectCollectCachedSpans(el.shadowRoot, out);
    });
  }
  function wptranlateInjectRevLookupForSpan(span) {
    const lang = span.dataset.wptranlateLang;
    if (lang) {
      try {
        const raw = localStorage.getItem(CACHE_KEY_PREFIX + lang.toLowerCase().split('-')[0]);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.revEntries || {};
        }
      } catch (_) {}
    }
    let merged = {};
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
  if (document.body && typeof self !== 'undefined' && self.wptranlateRestoreDatasetAttrsTree) {
    self.wptranlateRestoreDatasetAttrsTree(document.body);
  }
  const spans = [];
  if (document.body) wptranlateInjectCollectCachedSpans(document.body, spans);
  for (const span of spans) {
    const revEntries = wptranlateInjectRevLookupForSpan(span);
    const orig = span.dataset.wptranlateOrig ||
      (revEntries && revEntries[hashStr(span.textContent || '')]?.o) ||
      span.textContent;
    const textNode = document.createTextNode(orig || '');
    if (span.parentNode) span.parentNode.replaceChild(textNode, span);
  }
  let originalTitle = window?.__wptranlateOriginalTitle;
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
    if (window?.__wptranlateOriginalTitle != null) delete window.__wptranlateOriginalTitle;
  }
  if (typeof self !== 'undefined') {
    self.__wptranlateTranslated = new WeakSet();
    self.__wptranlateScrollSetup = false;
  }
}

function wteRevertAndClearCaches() {
  function wptranlateInjectQuickToggleToast() {
    try {
      if (typeof document === 'undefined' || !document.body) return;
      const el = document.createElement('div');
      el.id = 'wptranlate-quick-toggle-toast';
      el.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);padding:8px 16px;background-color:#aa5fbf;color:#ffffff;border:none;border-radius:8px;font-size:13px;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,.2);';
      el.textContent = chrome.i18n.getMessage('uiQuickToggleToast');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1500);
    } catch (_) {}
  }
  wptranlateInjectQuickToggleToast();
  const CACHE_KEY_PREFIX = (g.__wteCache?.CACHE_KEY_PREFIX) || (g.__wptranlateCache?.CACHE_KEY_PREFIX) || 'wptranlate_cache_';
  const hashStr = (typeof self !== 'undefined' && self.wptranlateDjb2Key) || (s => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return (h >>> 0).toString(36);
  });
  function wptranlateInjectCollectCachedSpans(root, out) {
    const els = root.querySelectorAll('.wptranlate-cached');
    els.forEach((el) => out.push(el));
    root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) wptranlateInjectCollectCachedSpans(el.shadowRoot, out);
    });
  }
  function wptranlateInjectRevLookupForSpan(span) {
    const lang = span.dataset.wptranlateLang;
    if (lang) {
      try {
        const raw = localStorage.getItem(CACHE_KEY_PREFIX + lang.toLowerCase().split('-')[0]);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed.revEntries || {};
        }
      } catch (_) {}
    }
    let merged = {};
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
  if (document.body && typeof self !== 'undefined' && self.wptranlateRestoreDatasetAttrsTree) {
    self.wptranlateRestoreDatasetAttrsTree(document.body);
  }
  const spans = [];
  if (document.body) wptranlateInjectCollectCachedSpans(document.body, spans);
  for (const span of spans) {
    const revEntries = wptranlateInjectRevLookupForSpan(span);
    const orig = span.dataset.wptranlateOrig ||
      (revEntries && revEntries[hashStr(span.textContent || '')]?.o) ||
      span.textContent;
    const textNode = document.createTextNode(orig || '');
    if (span.parentNode) span.parentNode.replaceChild(textNode, span);
  }
  let originalTitle = window?.__wptranlateOriginalTitle;
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
  const clearAllCaches = (typeof self !== 'undefined' && (self.__wteCache?.clearAllCaches || self.__wptranlateCache?.clearAllCaches));
  if (clearAllCaches) clearAllCaches();
  else {
    try {
      Object.keys(localStorage || {}).forEach((k) => {
        if (k.startsWith(CACHE_KEY_PREFIX)) localStorage.removeItem(k);
      });
    } catch (_) {}
  }
  if (typeof document !== 'undefined' && originalTitle != null) {
    document.title = originalTitle;
    if (window?.__wptranlateOriginalTitle != null) delete window.__wptranlateOriginalTitle;
  }
  if (typeof self !== 'undefined') {
    self.__wptranlateTranslated = new WeakSet();
    self.__wptranlateScrollSetup = false;
  }
}

  g.WTE = g.WTE || {};
  g.WTE.revertDomOnly = wteRevertDomOnly;
  g.WTE.revertAndClearCaches = wteRevertAndClearCaches;
  if (typeof window !== 'undefined') {
    window.__wptranlateRevertOnly = wteRevertDomOnly;
    window.__wptranlateRevertAndClearCache = wteRevertAndClearCaches;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { wteRevertDomOnly, wteRevertAndClearCaches };
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
