/**
 * Optional: load after hash.js + cache.js to expose extension-specific global aliases.
 */
(function () {
  const p = self.WTE_CONFIG?.prefix;
  if (!p || typeof self === 'undefined') return;
  if (self.wteDjb2Key) self[`${p}Djb2Key`] = self.wteDjb2Key;
  if (self.__wteCache) self[`__${p}Cache`] = self.__wteCache;
  if (self.wteNormalizeLangTag) self[`${p}NormalizeLangTag`] = self.wteNormalizeLangTag;
  if (self.wteDetectLangFromText) self[`${p}DetectLangFromText`] = self.wteDetectLangFromText;
})();
