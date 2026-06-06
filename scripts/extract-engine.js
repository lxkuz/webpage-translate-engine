#!/usr/bin/env node
/**
 * One-time helper: extracts translate/revert from extension background.js
 * and wraps with WTE config hooks. Run from repo root:
 *   node scripts/extract-engine.js /path/to/extension/background.js
 */
const fs = require('fs');
const path = require('path');

const bgPath = process.argv[2] || path.join(__dirname, '../../trnslt_one_button/extension/background.js');
const bg = fs.readFileSync(bgPath, 'utf8');

function sliceFn(name, endMarker) {
  const start = bg.indexOf(`async function ${name}`) !== -1
    ? bg.indexOf(`async function ${name}`)
  : bg.indexOf(`function ${name}`);
  if (start < 0) throw new Error(`Function ${name} not found`);
  let depth = 0;
  let started = false;
  for (let i = start; i < bg.length; i++) {
    if (bg[i] === '{') { depth++; started = true; }
    if (bg[i] === '}') {
      depth--;
      if (started && depth === 0) return bg.slice(start, i + 1);
    }
  }
  throw new Error(`Unbalanced braces for ${name}`);
}

const translateFn = sliceFn('wptranlateSwInjectTranslateDocument');
const revertOnly = sliceFn('wptranlateSwInjectRevertDomOnly');
const revertClear = sliceFn('wptranlateSwInjectRevertAndClearCaches');

const header = `/**
 * Chrome Built-in Translator page engine.
 * Requires: config, hash, lang-tag, lang-detect, cache, dom-i18n-restore (load via executeScript files).
 */
(function wteTranslateDocumentModule(global) {
  const g = global || (typeof self !== 'undefined' ? self : globalThis);

  function wteCfg(runtime) {
    return g.WTE?.wteMergeConfig?.(runtime) || { prefix: 'wte', names: g.WTE?.wteMakeNames?.('wte') };
  }

  async function wteIsEnabled(cfg, hostname) {
    if (!cfg.enabledDomainsStorageKey) return true;
    if (!hostname) return false;
    const data = await chrome.storage.local.get(cfg.enabledDomainsStorageKey);
    const domains = data[cfg.enabledDomainsStorageKey] || [];
    return domains.includes(hostname);
  }

  function wteMsg(cfg, key, subs) {
    if (cfg.messageKeys?.[key]) key = cfg.messageKeys[key];
    if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
      return chrome.i18n.getMessage(key, subs) || key;
    }
    return key;
  }

  function wteSend(cfg, action, payload) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ action, ...payload }).catch(() => {});
    }
  }

`;

const footer = `
  g.WTE = g.WTE || {};
  g.WTE.translateDocument = wteTranslateDocument;
  g.WTE.revertDomOnly = wteRevertDomOnly;
  g.WTE.revertAndClearCaches = wteRevertAndClearCaches;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { wteTranslateDocument, wteRevertDomOnly, wteRevertAndClearCaches };
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
`;

let body = translateFn
  .replace(/async function wptranlateSwInjectTranslateDocument/g, 'async function wteTranslateDocument')
  .replace(/function wptranlateSwInjectRevertDomOnly/g, 'function wteRevertDomOnly')
  .replace(/function wptranlateSwInjectRevertAndClearCaches/g, 'function wteRevertAndClearCaches');

// rename recursive self-calls
body = body.replace(/wptranlateSwInjectTranslateDocument/g, 'wteTranslateDocument');

fs.writeFileSync(path.join(__dirname, '../src/_translate-raw.js'), header + body + '\n' + revertOnly.replace(/function wptranlateSwInjectRevertDomOnly/, 'function wteRevertDomOnly') + '\n' + revertClear.replace(/function wptranlateSwInjectRevertAndClearCaches/, 'function wteRevertAndClearCaches') + footer);
console.log('Wrote src/_translate-raw.js — review and split into translate-document.js + revert-document.js');
