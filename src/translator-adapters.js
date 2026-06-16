/**
 * Translator backends: Chrome Built-in Translator API (primary) and LibreTranslate HTTP API (fallback).
 * Load after config.js, before translate-text.js.
 *
 * Unified translator handle: { translate(text), backend: 'chrome'|'remote' }
 */
(function wteTranslatorAdaptersModule(global) {
  const g = global || (typeof self !== 'undefined' ? self : globalThis);

  function wteCfg() {
    return g.WTE?.wteMergeConfig?.() || {};
  }

  function wteHasChromeTranslator() {
    return 'Translator' in g;
  }

  function wteRemoteEnabled(cfg) {
    const rt = cfg?.remoteTranslate;
    return Boolean(rt?.enabled && rt?.baseUrl);
  }

  function wteRemoteBaseUrl(cfg) {
    return String(cfg.remoteTranslate.baseUrl || '').replace(/\/$/, '');
  }

  /**
   * @param {string} path e.g. '/translate'
   * @param {object} body
   */
  async function wteRemoteJsonRequest(cfg, path, body) {
    const custom = cfg.remoteTranslate?.request;
    g.WTE?.wteDebugLog?.('remote:request', {
      path,
      source: body?.source,
      target: body?.target,
      qLen: typeof body?.q === 'string' ? body.q.length : 0,
      via: typeof custom === 'function' ? 'extension-proxy' : 'fetch',
    }, cfg);
    if (typeof custom === 'function') {
      const data = await custom(path, body, cfg);
      g.WTE?.wteDebugLog?.('remote:response', { path, ok: true, via: 'extension-proxy' }, cfg);
      return data;
    }
    const url = `${wteRemoteBaseUrl(cfg)}${path}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      g.WTE?.wteDebugLog?.('remote:error', { path, status: res.status, detail: detail.slice(0, 200) }, cfg);
      throw new Error(`remote translate HTTP ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
    }
    const data = await res.json();
    g.WTE?.wteDebugLog?.('remote:response', { path, ok: true, via: 'fetch' }, cfg);
    return data;
  }

  /**
   * @returns {Promise<{ ok: true, translator: object, backend: 'chrome' }|{ ok: false, reason: string, error?: string }|{ skipped: true, reason: string }>}
   */
  async function wteCreateChromeTranslatorAdapter(sourceLanguage, targetLanguage, options = {}) {
    const cfg = wteCfg();
    const ev = cfg.events || {};
    const messageTabId = options.messageTabId;

    if (!wteHasChromeTranslator()) {
      g.WTE?.wteDebugLog?.('chrome-translator:skip', { reason: 'no-api' }, cfg);
      return { ok: false, reason: 'no-translator' };
    }

    let avail;
    try {
      avail = await Translator.availability({ sourceLanguage, targetLanguage });
    } catch (e) {
      if (/invalid language tag/i.test(e?.message || '')) return { skipped: true, reason: 'invalid-lang' };
      g.WTE?.wteDebugLog?.('chrome-translator:error', { stage: 'availability', error: String(e?.message || e) }, cfg);
      return { ok: false, reason: 'availability-error', error: String(e?.message || e) };
    }

    g.WTE?.wteDebugLog?.('chrome-translator:availability', { sourceLanguage, targetLanguage, avail }, cfg);
    if (avail === 'unavailable') return { ok: false, reason: 'unavailable' };

    const needsDownload = avail === 'downloadable' || avail === 'downloading';
    const emitProgress = g.WTE?.wteEmitDownloadProgress;

    try {
      if (needsDownload && emitProgress) {
        emitProgress(ev, messageTabId, 0, 100, 0);
      }
      const chromeTranslator = await Translator.create({
        sourceLanguage,
        targetLanguage,
        ...(needsDownload && emitProgress && {
          monitor(m) {
            m.addEventListener('downloadprogress', (e) => {
              const total = e.total && e.total > 0 ? e.total : 1;
              const pct = Math.min(100, Math.round((e.loaded / total) * 100));
              emitProgress(ev, messageTabId, e.loaded, e.total, pct);
            });
          },
        }),
      });
      if (needsDownload && emitProgress) {
        emitProgress(ev, messageTabId, 100, 100, 100);
      }

      const translator = {
        backend: 'chrome',
        sourceLanguage,
        targetLanguage,
        translate: (text) => chromeTranslator.translate(text),
      };
      return { ok: true, translator, backend: 'chrome', sourceLanguage, targetLanguage };
    } catch (e) {
      const msg = String(e?.message || e);
      g.WTE?.wteDebugLog?.('chrome-translator:error', { stage: 'create', error: msg }, cfg);
      if (/user gesture/i.test(msg)) return { ok: false, reason: 'user-gesture' };
      if (/Permission Policy|sandbox|access denied/i.test(msg)) return { ok: false, reason: 'sandbox' };
      return { ok: false, reason: 'create-error', error: msg };
    }
  }

  async function wteRemoteTranslateOne(cfg, sourceLanguage, targetLanguage, text) {
    const payload = {
      q: text,
      source: sourceLanguage,
      target: targetLanguage,
      format: 'text',
    };
    const data = await wteRemoteJsonRequest(cfg, '/translate', payload);
    const out = data?.translatedText;
    if (typeof out !== 'string') throw new Error('remote translate: missing translatedText');
    return out;
  }

  /**
   * @returns {Promise<{ ok: true, translator: object, backend: 'remote' }|{ ok: false, reason: string, error?: string }>}
   */
  async function wteCreateRemoteTranslatorAdapter(sourceLanguage, targetLanguage) {
    const cfg = wteCfg();
    if (!wteRemoteEnabled(cfg)) {
      return { ok: false, reason: 'remote-disabled' };
    }

    const batchSep = cfg.batch?.sep ?? '\u2063';

    const translator = {
      backend: 'remote',
      sourceLanguage,
      targetLanguage,
      async translate(text) {
        const input = typeof text === 'string' ? text : String(text ?? '');
        if (!input) return '';

        if (input.includes(batchSep)) {
          const parts = input.split(batchSep);
          const translated = await Promise.all(
            parts.map((part) => wteRemoteTranslateOne(cfg, sourceLanguage, targetLanguage, part)),
          );
          return translated.join(batchSep);
        }

        return wteRemoteTranslateOne(cfg, sourceLanguage, targetLanguage, input);
      },
    };

    return { ok: true, translator, backend: 'remote', sourceLanguage, targetLanguage };
  }

  function wteShouldFallbackToRemote(chromeResult) {
    if (!chromeResult) return true;
    if (chromeResult.skipped) return false;
    if (chromeResult.ok) return false;
    const silent = new Set(['user-gesture', 'sandbox']);
    if (silent.has(chromeResult.reason)) return false;
    return true;
  }

  /**
   * Try Chrome Translator API first; on failure fall back to remote LibreTranslate API.
   * @returns same shape as wteCreateChromeTranslatorAdapter
   */
  async function wteAcquireTranslator(sourceLanguage, targetLanguage, options = {}) {
    const cfg = wteCfg();
    g.WTE?.wteDebugLog?.('acquire-translator:start', {
      sourceLanguage,
      targetLanguage,
      hasChrome: wteHasChromeTranslator(),
      remoteEnabled: wteRemoteEnabled(cfg),
    }, cfg);

    if (wteHasChromeTranslator()) {
      const chromeResult = await wteCreateChromeTranslatorAdapter(sourceLanguage, targetLanguage, options);
      if (chromeResult.ok) {
        g.WTE?.wteDebugLog?.('acquire-translator:ok', { backend: 'chrome' }, cfg);
        return chromeResult;
      }
      g.WTE?.wteDebugLog?.('acquire-translator:chrome-failed', { reason: chromeResult.reason, error: chromeResult.error }, cfg);
      if (!wteShouldFallbackToRemote(chromeResult)) return chromeResult;
      g.WTE?.wteDebugLog?.('acquire-translator:fallback-remote', { chromeReason: chromeResult.reason }, cfg);
    }

    if (!wteRemoteEnabled(cfg)) {
      g.WTE?.wteDebugLog?.('acquire-translator:error', { reason: 'no-backend' }, cfg);
      if (wteHasChromeTranslator()) {
        return { ok: false, reason: 'no-translator' };
      }
      return { ok: false, reason: 'no-backend' };
    }

    const remoteResult = await wteCreateRemoteTranslatorAdapter(sourceLanguage, targetLanguage);
    if (remoteResult.ok) g.WTE?.wteDebugLog?.('acquire-translator:ok', { backend: 'remote' }, cfg);
    else g.WTE?.wteDebugLog?.('acquire-translator:error', { reason: remoteResult.reason }, cfg);
    return remoteResult;
  }

  g.WTE = g.WTE || {};
  Object.assign(g.WTE, {
    wteHasChromeTranslator,
    wteRemoteEnabled,
    wteCreateChromeTranslatorAdapter,
    wteCreateRemoteTranslatorAdapter,
    wteAcquireTranslator,
    wteRemoteJsonRequest,
  });

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      wteHasChromeTranslator,
      wteRemoteEnabled,
      wteCreateChromeTranslatorAdapter,
      wteCreateRemoteTranslatorAdapter,
      wteAcquireTranslator,
      wteRemoteJsonRequest,
    };
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
