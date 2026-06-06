/**
 * Решение «same-lang» только по результату главного фрейма (frameId 0).
 * Иначе любой iframe с en→en даёт ложное совпадение при zh-CN в top-level.
 *
 * @param {Array<{ frameId?: number, result?: { skipped?: boolean, reason?: string } }>|undefined} results
 * @returns {boolean}
 */
function wteMainFrameSkippedSameLang(results) {
  const main = results?.find((r) => r.frameId === 0);
  return Boolean(main?.result?.skipped === true && main?.result?.reason === 'same-lang');
}

/** Хотя бы один фрейм реально применил перевод (не пустой inject). */
function wteInjectSucceeded(results) {
  return Boolean(results?.some((r) => r?.result?.ok === true));
}

try {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      wteMainFrameSkippedSameLang,
      wteInjectSucceeded,
      wptranlateSwMainFrameSkippedSameLang: wteMainFrameSkippedSameLang,
      wptranlateSwInjectSucceeded: wteInjectSucceeded,
    };
  }
} catch (_) {}
