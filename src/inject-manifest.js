/** Canonical inject order — paths relative to extension root. */
const WTE_INJECT_FILES = [
  'vendor/webpage-translate-engine/src/config.js',
  'vendor/webpage-translate-engine/presets/wptranlate.js',
  'vendor/webpage-translate-engine/src/hash.js',
  'vendor/webpage-translate-engine/src/lang-tag.js',
  'vendor/webpage-translate-engine/src/lang-detect.js',
  'vendor/webpage-translate-engine/src/cache.js',
  'vendor/webpage-translate-engine/presets/aliases.js',
  'vendor/webpage-translate-engine/src/dom-i18n-restore.js',
  'vendor/webpage-translate-engine/src/translate-document.js',
  'vendor/webpage-translate-engine/src/revert-document.js',
];

const WTE_INJECT_FILES_TSMPL = [
  'vendor/webpage-translate-engine/src/config.js',
  'vendor/webpage-translate-engine/presets/tsmpl.js',
  'vendor/webpage-translate-engine/src/hash.js',
  'vendor/webpage-translate-engine/src/lang-tag.js',
  'vendor/webpage-translate-engine/src/lang-detect.js',
  'vendor/webpage-translate-engine/src/cache.js',
  'vendor/webpage-translate-engine/presets/aliases.js',
  'vendor/webpage-translate-engine/src/dom-i18n-restore.js',
  'vendor/webpage-translate-engine/src/translate-document.js',
  'vendor/webpage-translate-engine/src/revert-document.js',
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WTE_INJECT_FILES, WTE_INJECT_FILES_TSMPL };
}
