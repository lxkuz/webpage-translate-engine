/**
 * Preset for Translate Webpage extension (wptranlate).
 * Load after config.js, before cache.js.
 */
(function () {
  self.WTE_CONFIG = {
    prefix: 'wptranlate',
    enabledDomainsStorageKey: 'wptranlate_enabledDomains',
    events: {
      start: 'wptranlate:start',
      end: 'wptranlate:end',
      downloadProgress: 'wptranlate:download-progress',
    },
    uiHostSuffixes: [
      'page-panel',
      'error-toast',
      'quick-toggle-toast',
      'same-lang-toast',
      'https-only-toast',
      'status-bar',
    ],
    logTag: '[Translate Webpage]',
  };
})();
