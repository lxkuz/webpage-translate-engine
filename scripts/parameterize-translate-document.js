#!/usr/bin/env node
/**
 * One-time helper: parameterize hardcoded wptranlate strings in translate-document.js.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/translate-document.js');
let s = fs.readFileSync(file, 'utf8');

if (s.includes('const nm = cfg.names')) {
  console.log('Already parameterized');
  process.exit(0);
}

s = s.replace(
  'async function wteTranslateDocument(targetLanguage, sourceLanguageOverride, messageTabId) {',
  `async function wteTranslateDocument(targetLanguage, sourceLanguageOverride, messageTabId, topFrameHtmlLang) {
  const cfg = g.WTE?.wteMergeConfig?.() || {};
  const nm = cfg.names || g.WTE?.wteMakeNames?.('wptranlate');
  const ev = cfg.events || {};
  const domainsKey = cfg.enabledDomainsStorageKey || 'wptranlate_enabledDomains';
  const batchCfg = cfg.batch || {};
  const scrollDebounceMs = cfg.scrollDebounceMs ?? 400;
  const scrollRetryMs = cfg.scrollRetryMs ?? 2000;
  const detectSampleLen = cfg.detectSampleLen ?? 3000;
  const uiHostIdSet = new Set(nm.uiHostIds || []);
  const restoreTree = () => {
    const fn = self.wteRestoreDatasetAttrsTree || self.wptranlateRestoreDatasetAttrsTree;
    if (fn && document.body) fn(document.body);
  };
  async function wteGetEnabledDomains() {
    const data = await chrome.storage.local.get(domainsKey);
    return data[domainsKey] || [];
  }`
);

s = s.replace(/function wptranlateInjToastErr/g, 'function injToastErr');
s = s.replace(/wptranlateInjToastErr/g, 'injToastErr');
s = s.replace("el.id = 'wptranlate-error-toast';", 'el.id = nm.errorToastId;');
s = s.replace(
  "console.error('[Translate Webpage]', msg);",
  "console.error(cfg.logTag || '[WebpageTranslateEngine]', msg);"
);

s = s.replace(
  /const hashStr = \(typeof self !== 'undefined' && self\.wptranlateDjb2Key\)[^;]+;/,
  "const hashStr = (typeof self !== 'undefined' && (self.wteDjb2Key || self.wptranlateDjb2Key)) || (s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i); return (h >>> 0).toString(36); });"
);
s = s.replace(
  /const \{ getCache, saveCache \} = \(typeof self !== 'undefined' && self\.__wptranlateCache\)[^;]+;/,
  "const { getCache, saveCache } = (typeof self !== 'undefined' && (self.__wteCache || self.__wptranlateCache)) || { getCache: () => ({ entries: {}, urlOrder: [], revEntries: {} }), saveCache: () => {} };"
);

s = s.replace(
  /const \{ wptranlate_enabledDomains: domains = \[\] \} = await chrome\.storage\.local\.get\('wptranlate_enabledDomains'\);/g,
  'const domains = await wteGetEnabledDomains();'
);
s = s.replace(
  /const \{ wptranlate_enabledDomains: domainsNow = \[\] \} = await chrome\.storage\.local\.get\('wptranlate_enabledDomains'\);/g,
  'const domainsNow = await wteGetEnabledDomains();'
);
s = s.replace(
  /const \{ wptranlate_enabledDomains: domainsAfter = \[\] \} = await chrome\.storage\.local\.get\('wptranlate_enabledDomains'\);/g,
  'const domainsAfter = await wteGetEnabledDomains();'
);
s = s.replace(
  /const \{ wptranlate_enabledDomains: dna = \[\] \} = await chrome\.storage\.local\.get\('wptranlate_enabledDomains'\);/g,
  'const dna = await wteGetEnabledDomains();'
);
s = s.replace(
  /const \{ wptranlate_enabledDomains: dna2 = \[\] \} = await chrome\.storage\.local\.get\('wptranlate_enabledDomains'\);/g,
  'const dna2 = await wteGetEnabledDomains();'
);

s = s.replace(/self\.__wptranlateTranslating/g, 'self[nm.stateTranslating]');
s = s.replace(/self\.__wptranlateTranslatePending/g, 'self[nm.stateTranslatePending]');
s = s.replace(/self\.__wptranlateLastTranslateArgs/g, 'self[nm.stateLastArgs]');
s = s.replace(
  /self\.__wptranlateLastTranslateArgs = \[targetLanguage, sourceLanguageOverride, messageTabId\];/,
  'self[nm.stateLastArgs] = [targetLanguage, sourceLanguageOverride, messageTabId, topFrameHtmlLang];'
);
s = s.replace(
  /const translated = \(self\.__wptranlateTranslated = self\.__wptranlateTranslated \|\| new WeakSet\(\)\);/,
  'const translated = (self[nm.stateTranslated] = self[nm.stateTranslated] || new WeakSet());'
);
s = s.replace(/self\.__wptranlateScrollSetup/g, 'self[nm.stateScrollSetup]');

s = s.replace(/wptranlateInjNormalizeLang/g, 'injNormalizeLang');
s = s.replace(/wptranlateInjDetectLang/g, 'injDetectLang');
s = s.replace(/wptranlateInjSilentSkip/g, 'injSilentSkip');

s = s.replace(
  /const injNormalizeLang = \(typeof self !== 'undefined' && self\.wptranlateNormalizeLangTag\)/,
  'const injNormalizeLang = (typeof self !== \'undefined\' && (self.wteNormalizeLangTag || self.wptranlateNormalizeLangTag))'
);
s = s.replace(
  /const injDetectLang = \(typeof self !== 'undefined' && self\.wptranlateDetectLangFromText\)/,
  'const injDetectLang = (typeof self !== \'undefined\' && (self.wteDetectLangFromText || self.wptranlateDetectLangFromText))'
);

s = s.replace(
  /const sample = document\.body\?\.innerText\?\.slice\(0, 3000\) \|\| '';\s+let sourceLanguage;\s+if \(sourceLanguageOverride && sourceLanguageOverride\.trim\(\)\) \{[\s\S]*?if \(sourceLanguage === targetLanguage\) return injSilentSkip\(\);/,
  `const sample = document.body?.innerText?.slice(0, detectSampleLen) || '';

    let sourceLanguage;
    if (sourceLanguageOverride && sourceLanguageOverride.trim()) {
      sourceLanguage = injNormalizeLang(sourceLanguageOverride);
      if (!sourceLanguage) return injSilentSkip();
    } else if (cfg.langDetection === 'topFrameHtml') {
      let declaredLang = '';
      if (typeof topFrameHtmlLang === 'string') {
        declaredLang = topFrameHtmlLang.trim();
      } else {
        try {
          declaredLang = (window.top.document.documentElement?.lang || '').trim();
        } catch (_) {
          declaredLang = (document.documentElement?.lang || '').trim();
        }
      }
      sourceLanguage = injNormalizeLang(declaredLang || 'en');
      if (!sourceLanguage) return injSilentSkip();
      if (cfg.langHeuristicLatinCyrillic && sourceLanguage === targetLanguage) {
        const cyrillic = (sample.match(/[\\u0400-\\u04FF]/g) || []).length;
        const latin = (sample.match(/[a-zA-Z]/g) || []).length;
        if (latin > cyrillic * 1.5) sourceLanguage = 'en';
        else return injSilentSkip();
      }
    } else {
      const detected = await injDetectLang(sample, { normalizeLang: injNormalizeLang });
      const fromHtml = injNormalizeLang(document.documentElement?.lang);
      sourceLanguage = detected?.lang ?? fromHtml;
      if (!sourceLanguage) return injSilentSkip();
    }
    if (sourceLanguage === targetLanguage) return injSilentSkip();`
);

s = s.replace(/action: 'wptranlate:download-progress'/g, 'action: ev.downloadProgress');
s = s.replace(/action: 'wptranlate:start'/g, 'action: ev.start');
s = s.replace(/action: 'wptranlate:end'/g, 'action: ev.end');

s = s.replace(/function wptranlateInj/g, 'function inj');
s = s.replace(/wptranlateInj/g, 'inj');

// UI host checks
s = s.replace(
  /if \(id === 'wptranlate-page-panel' \|\| id === 'wptranlate-error-toast'[\s\S]*?return true;/g,
  'if (uiHostIdSet.has(id)) return true;'
);
s = s.replace(
  /if \(parent\?\.closest\?\.\('\[data-wptranlate-ui\], \[translate="no"\], \.wptranlate-ui-notranslate'\)\) return true;\s+return parent\?\.closest\?\.\('#wptranlate-page-panel[\s\S]*?'\);/g,
  `if (parent?.closest?.(\`[\${nm.dataUiAttr}], [translate="no"], .\${nm.classUiNotranslate}\`)) return true;
      return parent?.closest?.(nm.uiClosestSelector);`
);
s = s.replace(
  /if \(el\.closest\?\.\('\[data-wptranlate-ui\], \[translate="no"\], \.wptranlate-ui-notranslate'\)\) return true;\s+return Boolean\(el\.closest\?\.\('#wptranlate-page-panel[\s\S]*?'\)\);/g,
  `if (el.closest?.(\`[\${nm.dataUiAttr}], [translate="no"], .\${nm.classUiNotranslate}\`)) return true;
      return Boolean(el.closest?.(nm.uiClosestSelector));`
);

s = s.replace(/\.wptranlate-cached/g, `.${'${nm.classCached}'}`);
// Fix the above - it created wrong syntax. Let me fix manually after

fs.writeFileSync(file, s);
console.log('Wrote', file, '- manual fixes may be needed');
