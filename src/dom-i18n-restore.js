/**
 * Восстановление placeholder / title / aria-label / … из data-wptranlate-i18n-* (включая open shadow DOM).
 * Подключается в страницу до инжекта функций из background.js (executeScript files).
 */
(function () {
  if (typeof self !== 'undefined' && self.__wptranlateDomI18nRestore) return;

  const SELECTOR = [
    '[data-wptranlate-i18n-placeholder]',
    '[data-wptranlate-i18n-title]',
    '[data-wptranlate-i18n-aria-label]',
    '[data-wptranlate-i18n-alt]',
    '[data-wptranlate-i18n-content]',
    '[data-wptranlate-i18n-value]',
  ].join(', ');

  const RESTORE_STEPS = [
    {
      test: (el) => el.dataset.wptranlateI18nPlaceholder != null && el.dataset.wptranlateI18nPlaceholder !== '',
      apply: (el) => {
        el.placeholder = el.dataset.wptranlateI18nPlaceholder;
        delete el.dataset.wptranlateI18nPlaceholder;
      },
    },
    {
      test: (el) => el.dataset.wptranlateI18nTitle != null && el.dataset.wptranlateI18nTitle !== '',
      apply: (el) => {
        el.setAttribute('title', el.dataset.wptranlateI18nTitle);
        delete el.dataset.wptranlateI18nTitle;
      },
    },
    {
      test: (el) => el.dataset.wptranlateI18nAriaLabel != null && el.dataset.wptranlateI18nAriaLabel !== '',
      apply: (el) => {
        el.setAttribute('aria-label', el.dataset.wptranlateI18nAriaLabel);
        delete el.dataset.wptranlateI18nAriaLabel;
      },
    },
    {
      test: (el) => el.dataset.wptranlateI18nAlt != null && el.dataset.wptranlateI18nAlt !== '',
      apply: (el) => {
        el.setAttribute('alt', el.dataset.wptranlateI18nAlt);
        delete el.dataset.wptranlateI18nAlt;
      },
    },
    {
      test: (el) => el.dataset.wptranlateI18nContent != null && el.dataset.wptranlateI18nContent !== '',
      apply: (el) => {
        el.setAttribute('content', el.dataset.wptranlateI18nContent);
        delete el.dataset.wptranlateI18nContent;
      },
    },
    {
      test: (el) => el.dataset.wptranlateI18nValue != null && el.dataset.wptranlateI18nValue !== '',
      apply: (el) => {
        el.value = el.dataset.wptranlateI18nValue;
        delete el.dataset.wptranlateI18nValue;
      },
    },
  ];

  function wptranlateRestoreDatasetAttrsOnElement(el) {
    RESTORE_STEPS.forEach(({ test, apply }) => {
      if (test(el)) apply(el);
    });
    if (el.dataset.wptranlateAttrLang != null) delete el.dataset.wptranlateAttrLang;
  }

  function wptranlateRestoreDatasetAttrsTree(root) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll(SELECTOR).forEach(wptranlateRestoreDatasetAttrsOnElement);
    root.querySelectorAll('*').forEach((el) => {
      if (el.shadowRoot) wptranlateRestoreDatasetAttrsTree(el.shadowRoot);
    });
  }

  if (typeof self !== 'undefined') {
    self.wptranlateRestoreDatasetAttrsTree = wptranlateRestoreDatasetAttrsTree;
    self.__wptranlateDomI18nRestore = true;
  }
})();
