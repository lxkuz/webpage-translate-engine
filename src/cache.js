/**
 * Translation cache in localStorage. Requires hash.js loaded first.
 */
(function wteCacheModule() {
  if (typeof self !== 'undefined' && self.__wteCache) return;

  function wteCachePrefix() {
    const p = (typeof self !== 'undefined' && self.WTE_CONFIG?.prefix) || 'wte';
    return `${p}_cache_`;
  }

  const MAX_CACHE_ENTRIES = 3000;
  const MAX_URLS = 10;

  function wteBuildLangCacheKey(targetLang) {
    return wteCachePrefix() + ((targetLang || 'en') + '').toLowerCase().split('-')[0];
  }

  function wteReadLangCache(targetLang) {
    const key = wteBuildLangCacheKey(targetLang);
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null;
      if (!raw) return { entries: {}, urlOrder: [], revEntries: {} };
      const parsed = JSON.parse(raw);
      return {
        entries: parsed.entries || {},
        urlOrder: parsed.urlOrder || [],
        revEntries: parsed.revEntries || {},
        title: parsed.title,
      };
    } catch (e) {
      return { entries: {}, urlOrder: [], revEntries: {} };
    }
  }

  function wteWriteLangCache(cache, targetLang) {
    const key = wteBuildLangCacheKey(targetLang);
    const entries = cache.entries || {};
    const urlOrder = cache.urlOrder || [];
    const hashStr = (typeof wteDjb2Key !== 'undefined' ? wteDjb2Key : (typeof self !== 'undefined' && self.wteDjb2Key));
    const currentUrl = (typeof location !== 'undefined' ? location.href : '') || '';

    let toEvict = urlOrder.filter((u) => u !== currentUrl);
    if (toEvict.length >= MAX_URLS) {
      const evictUrl = toEvict[0];
      Object.keys(entries).forEach((h) => {
        if (entries[h]?.u === evictUrl) {
          const r = entries[h]?.r;
          if (r && cache.revEntries) delete cache.revEntries[hashStr(r)];
          delete entries[h];
        }
      });
      cache.urlOrder = urlOrder.filter((u) => u !== evictUrl);
    }
    if (currentUrl && !cache.urlOrder?.includes(currentUrl)) {
      cache.urlOrder = (cache.urlOrder || []).concat(currentUrl).slice(-MAX_URLS);
    }

    const keys = Object.keys(entries);
    if (keys.length > MAX_CACHE_ENTRIES) {
      const sorted = keys.map((k) => ({ k, ts: entries[k]?.ts || 0 })).sort((a, b) => a.ts - b.ts);
      sorted.slice(0, Math.floor(MAX_CACHE_ENTRIES * 0.2)).forEach(({ k }) => {
        const r = entries[k]?.r;
        if (r && cache.revEntries) delete cache.revEntries[hashStr(r)];
        delete entries[k];
      });
    }

    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(cache));
    } catch (e) {
      const sorted = Object.entries(entries).sort((a, b) => (a[1].ts || 0) - (b[1].ts || 0));
      cache.entries = Object.fromEntries(sorted.slice(-Math.floor(sorted.length * 0.5)));
      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(cache));
      } catch (_) {}
    }
  }

  function wteWipeAllLangCaches() {
    const prefix = wteCachePrefix();
    try {
      if (typeof localStorage === 'undefined') return;
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(prefix)) localStorage.removeItem(k);
      });
    } catch (_) {}
  }

  const api = {
    getCache: wteReadLangCache,
    saveCache: wteWriteLangCache,
    getCacheKey: wteBuildLangCacheKey,
    clearAllCaches: wteWipeAllLangCaches,
    CACHE_KEY_PREFIX: wteCachePrefix(),
    MAX_CACHE_ENTRIES,
    MAX_URLS,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof self !== 'undefined') {
    self.__wteCache = api;
    // Legacy alias for wptranlate extension integration
    self.__wptranlateCache = api;
  }
})();
