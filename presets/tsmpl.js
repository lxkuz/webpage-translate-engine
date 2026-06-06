/**
 * Preset for Translate Simple extension (tsmpl).
 * Load after config.js, before hash.js / cache.js.
 */
(function () {
  self.WTE_CONFIG = {
    prefix: 'tsmpl',
    enabledDomainsStorageKey: 'tsmpl_enabledDomains',
    langDetection: 'topFrameHtml',
    langHeuristicLatinCyrillic: true,
    events: {
      start: 'tsmpl:start',
      end: 'tsmpl:end',
      downloadProgress: 'tsmpl:download-progress',
    },
    uiHostSuffixes: [
      'page-panel',
      'error-toast',
      'quick-toggle-toast',
    ],
    logTag: '[Translate Web Page]',
  };
})();
