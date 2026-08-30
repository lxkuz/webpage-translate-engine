/**
 * Нормализация BCP-47 для Chrome Translator.
 * Сохраняет zh-Hant; legacy iw → he; остальные регионы/скрипты отсекаются.
 */
(function wptranlateLangTagModule() {
  function wptranlateNormalizeLangTag(tag) {
    if (typeof self !== 'undefined' && typeof self.__tsmplConstants?.normalizeTranslatorLang === 'function') {
      return self.__tsmplConstants.normalizeTranslatorLang(tag);
    }
    if (tag == null || typeof tag !== 'string') return null;
    let t = tag.trim().replace(/_/g, '-');
    if (!t) return null;
    const lower = t.toLowerCase();
    if (lower === 'iw' || lower.startsWith('iw-')) t = `he${t.slice(2)}`;
    const parts = t.split('-').filter(Boolean);
    const primary = (parts[0] || '').toLowerCase();
    if (!primary || primary === 'x' || /[%{}]/.test(primary) || !/^[a-z]{2,3}$/.test(primary)) {
      return null;
    }
    if (primary === 'zh' && parts[1] && /^hant$/i.test(parts[1])) return 'zh-Hant';
    return primary;
  }

  const wteNormalizeLangTag = wptranlateNormalizeLangTag;
  const api = { wptranlateNormalizeLangTag, wteNormalizeLangTag };
  if (typeof self !== 'undefined') Object.assign(self, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
