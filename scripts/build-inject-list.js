#!/usr/bin/env node
/** Prints inject file order (one path per line) for chrome.scripting.executeScript. */
const files = [
  'src/config.js',
  'src/hash.js',
  'src/lang-tag.js',
  'src/lang-detect.js',
  'src/cache.js',
  'src/dom-i18n-restore.js',
  'src/translate-document.js',
  'src/revert-document.js',
];
process.stdout.write(files.join('\n'));
