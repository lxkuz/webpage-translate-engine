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
      translationStarted: 'tsmpl:translation-started',
    },
    uiHostSuffixes: [
      'page-panel',
      'error-toast',
      'quick-toggle-toast',
    ],
    logTag: '[Translate Web Page]',
    toasts: {
      quickToggle: {
        css:
          'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);padding:8px 16px;' +
          'background-color:#03c36d;color:#ffffff;border:none;border-radius:8px;font-size:13px;' +
          'z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,.2);',
        durationMs: 1500,
      },
    },
  };
})();
