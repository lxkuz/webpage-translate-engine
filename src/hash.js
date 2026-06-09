/**
 * DJB2 hash для ключей кеша. Один источник правды для content, background и injected.
 */
(function wteHashModule() {
  if (typeof self !== 'undefined' && self.wptranlateDjb2Key) return;

  function wteDjb2Key(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash) + str.charCodeAt(i);
    }
    return (hash >>> 0).toString(36);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { wteDjb2Key, wptranlateDjb2Key: wteDjb2Key };
  }
  if (typeof self !== 'undefined') {
    self.wteDjb2Key = wteDjb2Key;
    self.wptranlateDjb2Key = wteDjb2Key;
  }
})();
