/**
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

async function wteTranslateDocument(targetLanguage, sourceLanguageOverride, messageTabId) {
  function wptranlateInjToastErr(msg) {
    try {
      console.error('[Translate Webpage]', msg);
      if (typeof window !== 'undefined' && window === window.top && document.body) {
        const el = document.createElement('div');
        el.id = 'wptranlate-error-toast';
        el.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);max-width:90%;padding:10px 16px;background-color:#1e1826;color:#f1f5f9;border:none;border-radius:8px;font-size:14px;z-index:2147483647;box-shadow:0 4px 12px rgba(0,0,0,.3),0 0 0 1px rgba(170,95,191,.15);';
        el.textContent = msg;
        document.body.appendChild(el);
        setTimeout(() => el.remove(), 6000);
      }
    } catch (_) {}
  }
  const hashStr = (typeof self !== 'undefined' && self.wptranlateDjb2Key) || (s => {
    let h = 5381;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i);
    return (h >>> 0).toString(36);
  });
  const { getCache, saveCache } = (typeof self !== 'undefined' && self.__wptranlateCache) || { getCache: () => ({ entries: {}, urlOrder: [], revEntries: {} }), saveCache: () => {} };

  const isHttp = typeof location !== 'undefined' && location.protocol === 'http:' &&
    !/^localhost$|^127\.0\.0\.1$/.test(location.hostname);
  if (isHttp) {
    wptranlateInjToastErr(chrome.i18n.getMessage('uiErrHttpsOnly'));
    return;
  }
  if (!('Translator' in self)) {
    wptranlateInjToastErr(chrome.i18n.getMessage('uiErrNoBuiltInTranslator'));
    return;
  }

  const hostname = typeof location !== 'undefined' ? location.hostname : '';
  const { wptranlate_enabledDomains: domains = [] } = await chrome.storage.local.get('wptranlate_enabledDomains');
  if (!hostname || !domains.includes(hostname)) return;

  if (self.__wptranlateTranslating) {
    self.__wptranlateTranslatePending = true;
    return;
  }
  if (!document.body) return;
  self.__wptranlateTranslating = true;
  self.__wptranlateLastTranslateArgs = [targetLanguage, sourceLanguageOverride, messageTabId];
  let badgeLit = false;

  const translated = (self.__wptranlateTranslated = self.__wptranlateTranslated || new WeakSet());

  const wptranlateInjNormalizeLang = (typeof self !== 'undefined' && self.wptranlateNormalizeLangTag) || ((tag) => {
    if (tag == null || typeof tag !== 'string') return null;
    const primary = tag.trim().split(/[-_]/)[0].toLowerCase();
    if (!primary || primary === 'x' || /[%{}]/.test(primary) || !/^[a-z]{2,3}$/.test(primary)) return null;
    return primary;
  });
  const wptranlateInjDetectLang = (typeof self !== 'undefined' && self.wptranlateDetectLangFromText) || (async () => null);
  const wptranlateInjSilentSkip = () => ({ skipped: true, reason: 'same-lang' });

  try {
    // Язык: из попапа (sourceLanguageOverride) или LanguageDetector + html[lang]
    const targetLangNorm = wptranlateInjNormalizeLang(targetLanguage);
    if (!targetLangNorm) return wptranlateInjSilentSkip();
    targetLanguage = targetLangNorm;

    const sample = document.body?.innerText?.slice(0, 3000) || '';

    let sourceLanguage;
    if (sourceLanguageOverride && sourceLanguageOverride.trim()) {
      sourceLanguage = wptranlateInjNormalizeLang(sourceLanguageOverride);
      if (!sourceLanguage) return wptranlateInjSilentSkip();
    } else {
      const detected = await wptranlateInjDetectLang(sample, { normalizeLang: wptranlateInjNormalizeLang });
      const fromHtml = wptranlateInjNormalizeLang(document.documentElement?.lang);
      sourceLanguage = detected?.lang ?? fromHtml;
      if (!sourceLanguage) return wptranlateInjSilentSkip();
    }
    if (sourceLanguage === targetLanguage) return wptranlateInjSilentSkip();

    let avail;
    try {
      avail = await Translator.availability({ sourceLanguage, targetLanguage });
    } catch (e) {
      if (/invalid language tag/i.test(e?.message || '')) return wptranlateInjSilentSkip();
      throw e;
    }
    if (avail === 'unavailable') {
      wptranlateInjToastErr(chrome.i18n.getMessage('uiErrModelUnavailable'));
      return;
    }
    const needsDownload = avail === 'downloadable' || avail === 'downloading';

    let translator;
    try {
      translator = await Translator.create({
        sourceLanguage,
        targetLanguage,
        ...(needsDownload && typeof chrome !== 'undefined' && chrome.runtime?.sendMessage && {
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              const total = e.total && e.total > 0 ? e.total : 1;
              const pct = Math.min(100, Math.round((e.loaded / total) * 100));
              chrome.runtime.sendMessage({ action: 'wptranlate:download-progress', loaded: e.loaded, total: e.total, percent: pct, tabId: messageTabId ?? undefined }).catch(() => {});
            });
          },
        }),
      });
    } catch (e) {
      if (/user gesture/i.test(e?.message || '')) return;
      if (/Permission Policy|sandbox|access denied/i.test(e?.message || '')) return; // iframe/sandbox — тихо пропускаем
      wptranlateInjToastErr(chrome.i18n.getMessage('uiErrTranslatorCreate', [String(e?.message || e)]));
      return;
    }

    function wptranlateInjNodeInChromeUi(node) {
      const root = node.getRootNode();
      if (root instanceof ShadowRoot && root.host?.id) {
        const id = root.host.id;
        if (id === 'wptranlate-page-panel' || id === 'wptranlate-error-toast' || id === 'wptranlate-quick-toggle-toast' || id === 'wptranlate-same-lang-toast' || id === 'wptranlate-https-only-toast' || id === 'wptranlate-status-bar') return true;
      }
      const parent = node.parentElement;
      if (parent?.closest?.('[data-wptranlate-ui], [translate="no"], .wptranlate-ui-notranslate')) return true;
      return parent?.closest?.('#wptranlate-page-panel, #wptranlate-error-toast, #wptranlate-quick-toggle-toast, #wptranlate-same-lang-toast, #wptranlate-https-only-toast, #wptranlate-status-bar');
    }
    /** Убирает мусор форматирования HTML (\n + отступы после &lt;br&gt;); в &lt;pre&gt; только trim краёв — переносы внутри блока сохраняем. */
    function wptranlateInjNormalizeText(node) {
      const raw = node.textContent ?? '';
      if (node.parentElement?.closest('pre')) {
        return raw.replace(/^\s+/, '').replace(/\s+$/, '');
      }
      return String(raw).replace(/\s+/g, ' ').trim();
    }
    function wptranlateInjAcceptTextNode(node) {
      if (translated.has(node)) return false;
      const parent = node.parentElement;
      if (!parent) return false;
      if (parent.closest?.('.wptranlate-cached')) return false;
      if (parent.closest?.('span[data-wptranlate-orig]') && !parent.closest?.('.wptranlate-cached')) return false;
      if (wptranlateInjNodeInChromeUi(node)) return false;
      if (parent.tagName === 'CODE' && !parent.closest('pre')) return false;
      if (parent.tagName?.match(/^(SCRIPT|STYLE)$/)) return false;
      return wptranlateInjNormalizeText(node).length >= 2;
    }
    function wptranlateInjGatherTextNodes(root, out) {
      const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      while (w.nextNode()) {
        if (wptranlateInjAcceptTextNode(w.currentNode)) out.push(w.currentNode);
      }
      const els = root.querySelectorAll('*');
      for (const el of els) {
        if (el.shadowRoot && !wptranlateInjElInChromeUi(el)) wptranlateInjGatherTextNodes(el.shadowRoot, out);
      }
    }
    function wptranlateInjUnwrapOrphanSpans(root) {
      root.querySelectorAll('span[data-wptranlate-orig]:not(.wptranlate-cached):not(.wptranlate-wave)').forEach((span) => {
        const t = span.dataset.wptranlateOrig ?? span.textContent ?? '';
        if (span.parentNode) span.parentNode.replaceChild(document.createTextNode(t), span);
      });
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot && !wptranlateInjElInChromeUi(el)) wptranlateInjUnwrapOrphanSpans(el.shadowRoot);
      });
    }
    wptranlateInjUnwrapOrphanSpans(document.body);
    const nodesToTranslate = [];
    wptranlateInjGatherTextNodes(document.body, nodesToTranslate);

    const toProcess = nodesToTranslate.filter((n) => wptranlateInjNormalizeText(n).length >= 2);

    function wptranlateInjElInChromeUi(el) {
      if (!el || el.nodeType !== 1) return true;
      if (el.closest?.('.wptranlate-cached')) return true;
      const r = el.getRootNode();
      if (r instanceof ShadowRoot && r.host?.id) {
        const id = r.host.id;
        if (id === 'wptranlate-page-panel' || id === 'wptranlate-error-toast' || id === 'wptranlate-quick-toggle-toast' || id === 'wptranlate-same-lang-toast' || id === 'wptranlate-https-only-toast' || id === 'wptranlate-status-bar') return true;
      }
      if (el.closest?.('[data-wptranlate-ui], [translate="no"], .wptranlate-ui-notranslate')) return true;
      return Boolean(el.closest?.('#wptranlate-page-panel, #wptranlate-error-toast, #wptranlate-quick-toggle-toast, #wptranlate-same-lang-toast, #wptranlate-https-only-toast, #wptranlate-status-bar'));
    }
    function wptranlateInjSkipAttrValue(str) {
      const t = (str || '').trim();
      if (t.length < 2 || t.length > 8000) return true;
      if (/^(https?:|data:|mailto:|tel:|\/\/)/i.test(t)) return true;
      return false;
    }
    function wptranlateInjAttrHasBackup(el, attrName) {
      const key = {
        placeholder: 'wptranlateI18nPlaceholder',
        title: 'wptranlateI18nTitle',
        'aria-label': 'wptranlateI18nAriaLabel',
        alt: 'wptranlateI18nAlt',
        content: 'wptranlateI18nContent',
        value: 'wptranlateI18nValue',
      }[attrName];
      return key && el.dataset[key] != null && el.dataset[key] !== '';
    }
    function wptranlateInjPushAttrJob(el, attrName, rawVal, out) {
      if (rawVal == null) return;
      const s = String(rawVal);
      if (wptranlateInjSkipAttrValue(s)) return;
      if (wptranlateInjAttrHasBackup(el, attrName)) return;
      out.push({ el, attr: attrName, orig: s });
    }
    function wptranlateInjGatherAttrJobs(root, out) {
      const els = root.querySelectorAll('*');
      for (const el of els) {
        if (wptranlateInjElInChromeUi(el)) continue;
        if (el.closest?.('script, style, noscript')) continue;
        const tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') continue;

        if ('placeholder' in el || el.hasAttribute('placeholder')) {
          const raw = el.getAttribute('placeholder') != null ? el.getAttribute('placeholder') : el.placeholder;
          wptranlateInjPushAttrJob(el, 'placeholder', raw, out);
        }
        if (el.hasAttribute('title')) wptranlateInjPushAttrJob(el, 'title', el.getAttribute('title'), out);
        if (el.hasAttribute('aria-label')) wptranlateInjPushAttrJob(el, 'aria-label', el.getAttribute('aria-label'), out);
        if (el.hasAttribute('alt')) wptranlateInjPushAttrJob(el, 'alt', el.getAttribute('alt'), out);
        if (tag === 'META' && el.hasAttribute('content')) {
          const metaName = (el.getAttribute('name') || '').toLowerCase();
          const prop = (el.getAttribute('property') || '').toLowerCase();
          const metaOk = metaName === 'description' || metaName === 'twitter:description' || metaName === 'twitter:title' ||
            prop === 'og:description' || prop === 'og:title';
          if (metaOk) wptranlateInjPushAttrJob(el, 'content', el.getAttribute('content'), out);
        }
        if (tag === 'INPUT') {
          const typ = (el.type || '').toLowerCase();
          if ((typ === 'submit' || typ === 'button' || typ === 'reset') && el.value) {
            wptranlateInjPushAttrJob(el, 'value', el.value, out);
          }
        }
      }
      for (const el of els) {
        if (el.shadowRoot && !wptranlateInjElInChromeUi(el)) wptranlateInjGatherAttrJobs(el.shadowRoot, out);
      }
    }
    const attrJobs = [];
    wptranlateInjGatherAttrJobs(document.body, attrJobs);
    if (toProcess.length === 0 && attrJobs.length === 0) return { ok: false, reason: 'empty' };

    const VISIBLE_FIRST_BATCH = 20;   // 20 самых маленьких видимых — первый батч
    const VISIBLE_BATCH = 20;         // остальные видимые — батчами по 20
    const OFFSCREEN_BATCH = 100;     // невидимые (за экраном) — батчами по 100
    const BATCH_SEP = '\u2063';       // U+2063 Invisible Separator — не используется в естественных языках

    function wptranlateInjElementVisible(el) {
      const r = el.getBoundingClientRect();
      return r.top < window.innerHeight && r.bottom > 0 && r.left < window.innerWidth && r.right > 0;
    }

    if (!document.getElementById('wptranlate-wave-styles')) {
      const style = document.createElement('style');
      style.id = 'wptranlate-wave-styles';
      style.textContent = `
        .wptranlate-wave {
          background-image: linear-gradient(90deg,
            transparent 0%,
            transparent 40%,
            rgba(100, 180, 255, 0.3) 50%,
            transparent 60%,
            transparent 100%);
          background-size: 200% 100%;
          background-repeat: no-repeat;
          animation: wptranlate-wave-flow 2.68s ease-in-out infinite;
        }
        @keyframes wptranlate-wave-flow {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    }

    // Оборачиваем текст в спаны с волновой анимацией (data-wptranlate-orig для отката при выключении)
    const wrapped = toProcess.length
      ? toProcess.map((node) => {
        const orig = wptranlateInjNormalizeText(node);
        const span = document.createElement('span');
        span.className = 'wptranlate-wave';
        span.dataset.wptranlateOrig = orig;
        span.textContent = orig;
        node.parentNode.replaceChild(span, node);
        return { span };
      })
      : [];

    function wptranlateInjRevertWaveWraps() {
      for (const { span } of wrapped) {
        const orig = span.dataset.wptranlateOrig ?? span.textContent;
        const textNode = document.createTextNode(orig);
        if (span.parentNode) span.parentNode.replaceChild(textNode, span);
      }
    }

    const visible = wrapped.filter((w) => wptranlateInjElementVisible(w.span));
    const offScreen = wrapped.filter((w) => !wptranlateInjElementVisible(w.span));
    const visibleSorted = [...visible].sort((a, b) => a.span.textContent.length - b.span.textContent.length);
    const firstBatch = visibleSorted.slice(0, VISIBLE_FIRST_BATCH);
    const restVisible = visibleSorted.slice(VISIBLE_FIRST_BATCH);
    function wptranlateInjSliceTextBatches(arr, n) { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; }
    const allBatches = wrapped.length
      ? [firstBatch, ...wptranlateInjSliceTextBatches(restVisible, VISIBLE_BATCH), ...wptranlateInjSliceTextBatches(offScreen, OFFSCREEN_BATCH)]
      : [];
    const siteTitle = (typeof document !== 'undefined' && document.title?.trim()) || '';

    const cache = getCache(targetLanguage);
    const currentUrl = (typeof location !== 'undefined' ? location.href : '') || '';

    let titleTranslatedThisRun = false;
    let aborted = false;
    for (const batch of allBatches) {
      if (batch.length === 0) continue;
      const { wptranlate_enabledDomains: domainsNow = [] } = await chrome.storage.local.get('wptranlate_enabledDomains');
      if (!domainsNow.includes(hostname)) {
        aborted = true;
        break;
      }
      const results = [];
      const uncachedIdx = [];
      const uncachedTexts = [];

      const isFirstBatch = batch === firstBatch;
      let cacheDirty = false;
      for (let i = 0; i < batch.length; i++) {
        const { span } = batch[i];
        const orig = span.dataset.wptranlateOrig ?? span.textContent;
        const h = hashStr(orig);
        const cached = cache.entries?.[h];
        if (!isFirstBatch && cached && cached.t === orig && cached.r) {
          results[i] = cached.r;
        } else {
          uncachedIdx.push(i);
          uncachedTexts.push(orig);
        }
      }

      let translations = [];
      if (uncachedTexts.length > 0 || isFirstBatch) {
        if (!badgeLit) {
          badgeLit = true;
          chrome.runtime?.sendMessage?.({ action: 'wptranlate:start', tabId: messageTabId ?? undefined });
        }
        if (isFirstBatch && siteTitle && !titleTranslatedThisRun) {
          titleTranslatedThisRun = true;
          try {
            const translatedTitle = await translator.translate(siteTitle);
            if (translatedTitle?.trim()) {
              if (typeof window !== 'undefined') window.__wptranlateOriginalTitle = document.title;
              document.title = translatedTitle.trim();
              cache.title = { orig: siteTitle, tr: translatedTitle.trim() };
              cacheDirty = true;
            }
          } catch (_) {}
        }
        if (uncachedTexts.length > 0) {
          const joined = uncachedTexts.join(BATCH_SEP);
          try {
            const translatedBatch = await translator.translate(joined);
            const { wptranlate_enabledDomains: domainsAfter = [] } = await chrome.storage.local.get('wptranlate_enabledDomains');
            if (!domainsAfter.includes(hostname)) {
              aborted = true;
              break;
            }
            translations = translatedBatch.split(BATCH_SEP);
            if (translations.length !== uncachedTexts.length) {
              translations = [];
              for (const text of uncachedTexts) translations.push(await translator.translate(text));
            }
          } catch (_) {
            for (const text of uncachedTexts) translations.push(await translator.translate(text));
          }
        }
      }

      for (let u = 0; u < uncachedIdx.length; u++) {
        const i = uncachedIdx[u];
        const tr = translations[u];
        const { span } = batch[i];
        const orig = span.dataset.wptranlateOrig ?? span.textContent;
        const h = hashStr(orig);
        results[i] = tr;
        if (tr && tr !== orig && typeof localStorage !== 'undefined') {
          cache.entries = cache.entries || {};
          cache.entries[h] = { t: orig, r: tr, ts: Date.now(), u: currentUrl };
          cache.revEntries = cache.revEntries || {};
          cache.revEntries[hashStr(tr)] = { o: orig, r: tr };
          cacheDirty = true;
        }
      }

      for (let i = 0; i < batch.length; i++) {
        const { span } = batch[i];
        const tr = results[i];
        const orig = span.dataset.wptranlateOrig ?? span.textContent;
        span.classList.remove('wptranlate-wave');
        if (tr && tr !== orig) {
          span.textContent = tr;
          span.classList.add('wptranlate-cached');
          span.dataset.wptranlateLang = targetLanguage;
          const textNode = span.firstChild;
          if (textNode) translated.add(textNode);
        } else {
          const plain = document.createTextNode(span.dataset.wptranlateOrig ?? span.textContent ?? '');
          if (span.parentNode) span.parentNode.replaceChild(plain, span);
        }
      }

      if (cacheDirty) saveCache(cache, targetLanguage);
      await new Promise((r) => setTimeout(r, 0));
    }

    if (aborted) {
      wptranlateInjRevertWaveWraps();
    } else {
      let attrAborted = false;
      if (attrJobs.length > 0) {
        function wptranlateInjStampAttr(el, attr, origRaw, tr) {
          if (attr === 'placeholder') {
            el.dataset.wptranlateI18nPlaceholder = origRaw;
            el.placeholder = tr;
          } else if (attr === 'title') {
            el.dataset.wptranlateI18nTitle = origRaw;
            el.setAttribute('title', tr);
          } else if (attr === 'aria-label') {
            el.dataset.wptranlateI18nAriaLabel = origRaw;
            el.setAttribute('aria-label', tr);
          } else if (attr === 'alt') {
            el.dataset.wptranlateI18nAlt = origRaw;
            el.setAttribute('alt', tr);
          } else if (attr === 'content') {
            el.dataset.wptranlateI18nContent = origRaw;
            el.setAttribute('content', tr);
          } else if (attr === 'value') {
            el.dataset.wptranlateI18nValue = origRaw;
            el.value = tr;
          }
          el.dataset.wptranlateAttrLang = targetLanguage;
        }
        const visA = attrJobs.filter((j) => wptranlateInjElementVisible(j.el));
        const offA = attrJobs.filter((j) => !wptranlateInjElementVisible(j.el));
        const visSortedA = [...visA].sort((a, b) => a.orig.trim().length - b.orig.trim().length);
        const firstAttrBatch = visSortedA.slice(0, VISIBLE_FIRST_BATCH);
        const restAttrVis = visSortedA.slice(VISIBLE_FIRST_BATCH);
        function wptranlateInjSliceAttrBatches(arr, n) {
          const out = [];
          for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
          return out;
        }
        const attrBatches = [firstAttrBatch, ...wptranlateInjSliceAttrBatches(restAttrVis, VISIBLE_BATCH), ...wptranlateInjSliceAttrBatches(offA, OFFSCREEN_BATCH)];
        for (const batch of attrBatches) {
          if (batch.length === 0) continue;
          const { wptranlate_enabledDomains: dna = [] } = await chrome.storage.local.get('wptranlate_enabledDomains');
          if (!dna.includes(hostname)) {
            attrAborted = true;
            break;
          }
          const isFirstAttrBatch = batch === firstAttrBatch;
          const results = [];
          const uncachedIdx = [];
          const uncachedTexts = [];
          let attrCacheDirty = false;
          for (let i = 0; i < batch.length; i++) {
            const job = batch[i];
            const origT = job.orig.trim();
            const h = hashStr(origT);
            const cached = cache.entries?.[h];
            if (!isFirstAttrBatch && cached && cached.t === origT && cached.r) {
              results[i] = cached.r;
            } else {
              uncachedIdx.push(i);
              uncachedTexts.push(origT);
            }
          }
          let translations = [];
          if (uncachedTexts.length > 0 || isFirstAttrBatch) {
            if (!badgeLit) {
              badgeLit = true;
              chrome.runtime?.sendMessage?.({ action: 'wptranlate:start', tabId: messageTabId ?? undefined });
            }
            if (isFirstAttrBatch && siteTitle && !titleTranslatedThisRun) {
              titleTranslatedThisRun = true;
              try {
                const translatedTitle = await translator.translate(siteTitle);
                if (translatedTitle?.trim()) {
                  if (typeof window !== 'undefined') window.__wptranlateOriginalTitle = document.title;
                  document.title = translatedTitle.trim();
                  cache.title = { orig: siteTitle, tr: translatedTitle.trim() };
                  attrCacheDirty = true;
                }
              } catch (_) {}
            }
            if (uncachedTexts.length > 0) {
              const joined = uncachedTexts.join(BATCH_SEP);
              try {
                const translatedBatch = await translator.translate(joined);
                const { wptranlate_enabledDomains: dna2 = [] } = await chrome.storage.local.get('wptranlate_enabledDomains');
                if (!dna2.includes(hostname)) {
                  attrAborted = true;
                  break;
                }
                translations = translatedBatch.split(BATCH_SEP);
                if (translations.length !== uncachedTexts.length) {
                  translations = [];
                  for (const text of uncachedTexts) translations.push(await translator.translate(text));
                }
              } catch (_) {
                for (const text of uncachedTexts) translations.push(await translator.translate(text));
              }
            }
          }
          for (let u = 0; u < uncachedIdx.length; u++) {
            const i = uncachedIdx[u];
            const tr = translations[u];
            const job = batch[i];
            const origT = job.orig.trim();
            const h = hashStr(origT);
            results[i] = tr;
            if (tr && tr !== origT && typeof localStorage !== 'undefined') {
              cache.entries = cache.entries || {};
              cache.entries[h] = { t: origT, r: tr, ts: Date.now(), u: currentUrl };
              cache.revEntries = cache.revEntries || {};
              cache.revEntries[hashStr(tr)] = { o: origT, r: tr };
              attrCacheDirty = true;
            }
          }
          for (let i = 0; i < batch.length; i++) {
            const job = batch[i];
            const tr = results[i];
            const origT = job.orig.trim();
            if (tr && tr !== origT) wptranlateInjStampAttr(job.el, job.attr, job.orig, tr);
          }
          if (attrCacheDirty) saveCache(cache, targetLanguage);
          await new Promise((r) => setTimeout(r, 0));
        }
      }
      if (!attrAborted && typeof document !== 'undefined' && document.body) {
        function wptranlateInjResyncAttrsFromCache(root) {
          const ent = cache.entries || {};
          const norm = (s) => (typeof s === 'string' ? s.trim() : '');
          const resolved = (orig) => {
            const t = norm(orig);
            if (t.length < 2) return null;
            const h = hashStr(t);
            const c = ent[h];
            return c && c.t === t && c.r ? c.r : null;
          };
          if (!root?.querySelectorAll) return;
          root.querySelectorAll('[data-wptranlate-i18n-placeholder]').forEach((el) => {
            const r = resolved(el.dataset.wptranlateI18nPlaceholder);
            if (r != null && el.placeholder !== r) el.placeholder = r;
          });
          root.querySelectorAll('[data-wptranlate-i18n-aria-label]').forEach((el) => {
            const r = resolved(el.dataset.wptranlateI18nAriaLabel);
            if (r != null && (el.getAttribute('aria-label') || '') !== r) el.setAttribute('aria-label', r);
          });
          root.querySelectorAll('[data-wptranlate-i18n-title]').forEach((el) => {
            const r = resolved(el.dataset.wptranlateI18nTitle);
            if (r != null && (el.getAttribute('title') || '') !== r) el.setAttribute('title', r);
          });
          root.querySelectorAll('[data-wptranlate-i18n-alt]').forEach((el) => {
            const r = resolved(el.dataset.wptranlateI18nAlt);
            if (r != null && (el.getAttribute('alt') || '') !== r) el.setAttribute('alt', r);
          });
          root.querySelectorAll('[data-wptranlate-i18n-content]').forEach((el) => {
            const r = resolved(el.dataset.wptranlateI18nContent);
            if (r != null && (el.getAttribute('content') || '') !== r) el.setAttribute('content', r);
          });
          root.querySelectorAll('[data-wptranlate-i18n-value]').forEach((el) => {
            const r = resolved(el.dataset.wptranlateI18nValue);
            if (r != null && el.value !== r) el.value = r;
          });
          root.querySelectorAll('*').forEach((el) => {
            if (el.shadowRoot && !wptranlateInjElInChromeUi(el)) wptranlateInjResyncAttrsFromCache(el.shadowRoot);
          });
        }
        wptranlateInjResyncAttrsFromCache(document.body);
      }
      if (attrAborted) {
        wptranlateInjRevertWaveWraps();
        if (typeof document !== 'undefined' && document.body && typeof self !== 'undefined' && self.wptranlateRestoreDatasetAttrsTree) {
          self.wptranlateRestoreDatasetAttrsTree(document.body);
        }
      } else if (!self.__wptranlateScrollSetup) {
        self.__wptranlateScrollSetup = true;
        let scrollTid;
        window.addEventListener('scroll', () => {
          clearTimeout(scrollTid);
          scrollTid = setTimeout(() => {
            wteTranslateDocument(targetLanguage);
          }, 400);
        }, { passive: true });
        setTimeout(() => wteTranslateDocument(targetLanguage), 2000);
      }
    }
    return { ok: Boolean(badgeLit) };
  } catch (e) {
    if (/Permission Policy|sandbox|access denied/i.test(e?.message || '')) return;
    if (/invalid language tag/i.test(e?.message || '')) return wptranlateInjSilentSkip();
    wptranlateInjToastErr(chrome.i18n.getMessage('uiErrTranslationFailed', [String(e?.message || e)]));
  } finally {
    self.__wptranlateTranslating = false;
    if (badgeLit) chrome.runtime?.sendMessage?.({ action: 'wptranlate:end', tabId: messageTabId ?? undefined });
    if (self.__wptranlateTranslatePending) {
      self.__wptranlateTranslatePending = false;
      const args = self.__wptranlateLastTranslateArgs;
      const run = () => {
        if (args && args.length) {
          wteTranslateDocument(args[0], args[1], args[2]);
        } else {
          wteTranslateDocument(targetLanguage, sourceLanguageOverride, messageTabId);
        }
      };
      if (typeof queueMicrotask === 'function') queueMicrotask(run);
      else setTimeout(run, 0);
    }
  }
}

  g.WTE = g.WTE || {};
  g.WTE.translateDocument = wteTranslateDocument;
  if (typeof window !== 'undefined') {
    window.__wptranlateTranslate = wteTranslateDocument;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ...module.exports, wteTranslateDocument };
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
