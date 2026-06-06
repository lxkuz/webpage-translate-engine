/**
 * Optional LLM refinement queue hooks for translate-document.
 * Extension background handles WebSocket batching; engine only sends queue messages.
 */
(function wteLlmRefineQueueModule(global) {
  const g = global || (typeof self !== 'undefined' ? self : globalThis);

  function wteLlmRefineConfig(cfg) {
    const base = cfg?.llmRefine || {};
    return {
      enabled: !!base.enabled,
      visibleOnly: base.visibleOnly !== false,
    };
  }

  function wteSendRuntime(action, payload) {
    if (!action || typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) return;
    try {
      const p = chrome.runtime.sendMessage({ action, ...payload });
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } catch (_) {}
  }

  function wteQueueLlmRefine(cfg, nm, opts) {
    const lr = wteLlmRefineConfig(cfg);
    if (!lr.enabled) return;
    const action = cfg.events?.queueLlmRefine;
    if (!action) return;

    const {
      tabId,
      targetLang,
      visible,
      orig,
      local_tr,
      sourceLanguage,
      targetLanguage,
    } = opts || {};

    if (lr.visibleOnly && !visible) return;
    if (!orig || !local_tr || orig === local_tr) return;

    wteSendRuntime(action, {
      tabId: tabId ?? undefined,
      targetLang: targetLang || targetLanguage,
      visible: !!visible,
      item: {
        orig,
        local_tr,
        source_lang: sourceLanguage,
        target_lang: targetLanguage || targetLang,
      },
    });
  }

  function wteNotifyTranslationStarted(cfg, opts) {
    const action = cfg.events?.translationStarted;
    if (!action) return;
    const tabId = opts?.tabId;
    if (!tabId) return;
    if (typeof window !== 'undefined' && window !== window.top) return;
    wteSendRuntime(action, { tabId });
  }

  function wteSpanInViewport(span) {
    if (!span?.getBoundingClientRect) return false;
    const rect = span.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0 &&
      rect.left < window.innerWidth && rect.right > 0;
  }

  function wteRescanVisibleCachedForLlmRefine(cfg, nm, opts) {
    const lr = wteLlmRefineConfig(cfg);
    if (!lr.enabled || !cfg.events?.queueLlmRefine) return;
    if (typeof document === 'undefined') return;

    const { targetLanguage, sourceLanguage, messageTabId } = opts || {};
    const sel = `.${nm.classCached}[data-${cfg.prefix}-orig]`;
    document.querySelectorAll(sel).forEach((span) => {
      if (!wteSpanInViewport(span)) return;
      const orig = span.dataset[nm.dataOrig];
      const localTr = span.textContent?.trim() || '';
      if (!orig || !localTr || orig === localTr) return;
      wteQueueLlmRefine(cfg, nm, {
        tabId: messageTabId,
        targetLang: span.dataset[nm.dataLang] || targetLanguage,
        visible: true,
        orig,
        local_tr: localTr,
        sourceLanguage,
        targetLanguage: span.dataset[nm.dataLang] || targetLanguage,
      });
    });
  }

  const api = {
    wteQueueLlmRefine,
    wteNotifyTranslationStarted,
    wteRescanVisibleCachedForLlmRefine,
    wteLlmRefineConfig,
  };

  g.WTE = g.WTE || {};
  Object.assign(g.WTE, api);

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : undefined);
