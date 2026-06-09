/**
 * Script load order mirroring the Translate Webpage extension.
 */
const path = require('node:path');

const ENGINE_ROOT = path.resolve(__dirname, '../..');

/** Loaded by content_scripts at document_idle (subset). */
const WTE_CONTENT_SCRIPT_FILES = [
  '/src/config.js',
  '/presets/wptranlate.js',
  '/src/hash.js',
  '/src/cache.js',
];

/** Loaded via chrome.scripting.executeScript before translateDocument. */
const WTE_INJECTED_FILES = [
  '/src/config.js',
  '/presets/wptranlate.js',
  '/src/hash.js',
  '/src/lang-tag.js',
  '/src/lang-detect.js',
  '/src/cache.js',
  '/src/dom-i18n-restore.js',
  '/src/translate-document.js',
  '/src/revert-document.js',
];

module.exports = {
  ENGINE_ROOT,
  WTE_CONTENT_SCRIPT_FILES,
  WTE_INJECTED_FILES,
};
