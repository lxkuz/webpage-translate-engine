/**
 * Default script load order for chrome.scripting.executeScript({ files }).
 * Paths are relative to extension root when vendored.
 */
const WTE_INJECT_FILES = [
  'vendor/webpage-translate-engine/src/config.js',
  'vendor/webpage-translate-engine/presets/wptranlate.js',
  'vendor/webpage-translate-engine/src/hash.js',
  'vendor/webpage-translate-engine/src/lang-tag.js',
  'vendor/webpage-translate-engine/src/lang-detect.js',
  'vendor/webpage-translate-engine/src/cache.js',
  'vendor/webpage-translate-engine/src/dom-i18n-restore.js',
  'vendor/webpage-translate-engine/src/translate-document.js',
  'vendor/webpage-translate-engine/src/revert-document.js',
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { WTE_INJECT_FILES };
}
