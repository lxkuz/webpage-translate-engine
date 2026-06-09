/**
 * Playwright helpers: simulate extension content script + executeScript inject on a site fixture.
 */
const { WTE_INJECTED_FILES } = require('./inject-files');

async function wteResetMocks(page) {
  await page.evaluate(() => {
    window.__wteChromeMock?.resetStorage?.();
    window.__wteTranslatorMock?._reset?.();
    window.__wteLanguageDetectorMock?._reset?.();
    window.__wteChromeMock?.enableTranslationForCurrentHost?.();
  });
}

async function wteInjectScriptFiles(page, files) {
  for (const url of files) {
    await page.addScriptTag({ url });
  }
}

/** Second pass: same files as chrome.scripting.executeScript({ files: INJECTED_DEPS }). */
async function wteSimulateExtensionInject(page) {
  await wteInjectScriptFiles(page, WTE_INJECTED_FILES);
}

async function wteRunTranslateDocument(page, targetLang, sourceLang = null) {
  return page.evaluate(
    async ({ targetLang, sourceLang }) => self.WTE.translateDocument(targetLang, sourceLang, 1),
    { targetLang, sourceLang },
  );
}

async function wteCollectDiagnostics(page) {
  return page.evaluate(() => ({
    hasWte: typeof self.WTE?.translateDocument === 'function',
    hasHash: typeof self.wptranlateDjb2Key === 'function',
    hashDoubleLoadSafe: typeof self.wptranlateDjb2Key === 'function',
    bodyTextLength: (document.body?.innerText || '').trim().length,
    translatedSpanCount: document.querySelectorAll('.wptranlate-cached, span[data-wptranlate-orig]').length,
    htmlLang: document.documentElement?.lang || '',
    title: document.title,
  }));
}

module.exports = {
  wteResetMocks,
  wteInjectScriptFiles,
  wteSimulateExtensionInject,
  wteRunTranslateDocument,
  wteCollectDiagnostics,
  WTE_INJECTED_FILES,
};
