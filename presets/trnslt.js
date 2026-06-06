/**
 * Preset for Trnslt extension (trnslt).
 * Load after config.js, before hash.js / cache.js.
 */
(function () {
  self.WTE_CONFIG = {
    prefix: 'trnslt',
    enabledDomainsStorageKey: 'trnslt_enabledDomains',
    langDetection: 'topFrameHtml',
    langHeuristicLatinCyrillic: true,
    events: {
      start: 'trnslt:start',
      end: 'trnslt:end',
      downloadProgress: 'trnslt:download-progress',
      queueLlmRefine: 'trnslt:queue-llm-refine',
      translationStarted: 'trnslt:translation-started',
    },
    llmRefine: {
      enabled: true,
      visibleOnly: true,
    },
    uiHostSuffixes: [
      'page-panel',
      'error-toast',
      'quick-toggle-toast',
    ],
    logTag: '[Trnslt]',
  };
})();
