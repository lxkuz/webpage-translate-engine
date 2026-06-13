/**
 * Preset for Translate Webpage extension (wptranlate).
 * Load after config.js, before cache.js.
 */
(function () {
  const WPTRANLATE_TOAST_PURPLE =
    'background-color:#9333ea;color:#ffffff;border:2px solid #e9d5ff;' +
    'font-weight:600;line-height:1.45;' +
    'box-shadow:0 8px 28px rgba(147,51,234,.55),0 0 0 1px rgba(255,255,255,.2);' +
    'text-shadow:0 1px 2px rgba(0,0,0,.18);';

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
      'selection-popup',
    ],
    logTag: '[Translate Webpage]',
    toasts: {
      quickToggle: {
        css:
          'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);max-width:min(420px,calc(100vw - 24px));' +
          'padding:10px 16px;border-radius:10px;font-size:13px;z-index:2147483647;' +
          WPTRANLATE_TOAST_PURPLE,
        durationMs: 1500,
      },
      error: {
        css:
          'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);max-width:90%;padding:10px 16px;' +
          'background-color:#1e1826;color:#f1f5f9;border:none;border-radius:8px;font-size:14px;' +
          'z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,.3),0 0 0 1px rgba(170,95,191,.15);',
        durationMs: 6000,
      },
    },
  };
})();
