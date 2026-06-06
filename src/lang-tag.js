/**
 * Нормализация BCP-47 primary subtag.
 * Отсекает шаблонные значения вроде %lang%, x-default, пустые теги.
 */
(function wptranlateLangTagModule() {
  function wptranlateNormalizeLangTag(tag) {
    if (tag == null || typeof tag !== 'string') return null;
    const primary = tag.trim().split(/[-_]/)[0].toLowerCase();
    if (!primary || primary === 'x' || /[%{}]/.test(primary) || !/^[a-z]{2,3}$/.test(primary)) {
      return null;
    }
    return primary;
  }

  const wteNormalizeLangTag = wptranlateNormalizeLangTag;
  const api = { wptranlateNormalizeLangTag, wteNormalizeLangTag };
  if (typeof self !== 'undefined') Object.assign(self, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
