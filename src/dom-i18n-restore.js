/**
 * Restore placeholder / title / aria-label / … from data-{prefix}-i18n-* (including open shadow DOM).
 */
(function wteDomI18nRestoreModule(global) {
  const g = global || (typeof self !== 'undefined' ? self : globalThis);
  if (g.__wteDomI18nRestore) return;

  function wteBuildRestoreApi() {
    const cfg = g.WTE?.wteMergeConfig?.() || {};
    const p = cfg.prefix || 'wte';
    const nm = cfg.names || g.WTE?.wteMakeNames?.(p, cfg.uiHostSuffixes);
    const selector = [
      `[data-${p}-i18n-placeholder]`,
      `[data-${p}-i18n-title]`,
      `[data-${p}-i18n-aria-label]`,
      `[data-${p}-i18n-alt]`,
      `[data-${p}-i18n-content]`,
      `[data-${p}-i18n-value]`,
    ].join(', ');

    const steps = [
      { key: nm.dataI18nPlaceholder, apply: (el, v) => { el.placeholder = v; } },
      { key: nm.dataI18nTitle, apply: (el, v) => { el.setAttribute('title', v); } },
      { key: nm.dataI18nAriaLabel, apply: (el, v) => { el.setAttribute('aria-label', v); } },
      { key: nm.dataI18nAlt, apply: (el, v) => { el.setAttribute('alt', v); } },
      { key: nm.dataI18nContent, apply: (el, v) => { el.setAttribute('content', v); } },
      { key: nm.dataI18nValue, apply: (el, v) => { el.value = v; } },
    ];

    function restoreOnElement(el) {
      steps.forEach(({ key, apply }) => {
        if (el.dataset[key] != null && el.dataset[key] !== '') {
          apply(el, el.dataset[key]);
          delete el.dataset[key];
        }
      });
      if (el.dataset[nm.dataAttrLang] != null) delete el.dataset[nm.dataAttrLang];
    }

    function restoreTree(root) {
      if (!root?.querySelectorAll) return;
      root.querySelectorAll(selector).forEach(restoreOnElement);
      root.querySelectorAll('*').forEach((el) => {
        if (el.shadowRoot) restoreTree(el.shadowRoot);
      });
    }

    return { restoreTree, prefix: p };
  }

  const api = wteBuildRestoreApi();
  g.wteRestoreDatasetAttrsTree = api.restoreTree;
  g.__wteDomI18nRestore = true;

  // Legacy aliases (wptranlate / tsmpl)
  if (api.prefix === 'wptranlate') g.wptranlateRestoreDatasetAttrsTree = api.restoreTree;
  if (api.prefix === 'tsmpl') g.tsmplRestoreDatasetAttrsTree = api.restoreTree;
})();
