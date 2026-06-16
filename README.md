# webpage-translate-engine

Reusable translation engine for Chrome extensions using the **Chrome Built-in Translator** API, with **LibreTranslate HTTP fallback** when Chrome AI is unavailable.

Runs in the **page context** (via `chrome.scripting.executeScript`) — walks the DOM, batches text through a unified `translator.translate()` adapter, caches results in `localStorage`, and supports revert.

## Requirements

- Chrome 138+ desktop (for primary Chrome Translator path)
- `Translator` and `LanguageDetector` when available in the injected world
- User gesture for first Chrome model download (extension responsibility)
- Optional: `remoteTranslate.baseUrl` — open LibreTranslate API (e.g. `https://trnslt.breget.tech/lt`)

## Quick start (Chrome extension)

1. Vendor this repo into your extension (submodule, copy, or npm `file:` dependency).

2. Inject scripts **in order** before calling the engine:

```
src/config.js
presets/your-preset.js   ← set WTE_CONFIG (prefix, storage keys, events, remoteTranslate)
src/hash.js
src/lang-tag.js
src/lang-detect.js
src/translator-adapters.js
src/translate-text.js
src/cache.js
src/dom-i18n-restore.js
src/translate-document.js
src/revert-document.js
```

3. Run translation from an injected function:

```javascript
await chrome.scripting.executeScript({ target: { tabId, allFrames: true }, files: INJECT_FILES });
const [{ result }] = await chrome.scripting.executeScript({
  target: { tabId, allFrames: true },
  func: (targetLang, sourceOverride, tabId) =>
    self.WTE.translateDocument(targetLang, sourceOverride, tabId),
  args: [targetLang, null, tabId],
});
```

4. Revert:

```javascript
func: () => self.WTE.revertDomOnly()
// or
func: () => self.WTE.revertAndClearCaches()
```

## Configuration (`WTE_CONFIG`)

Set on `self.WTE_CONFIG` in a preset file (see `presets/wptranlate.js`):

| Field | Description |
|-------|-------------|
| `prefix` | DOM class/data-attribute prefix (`wptranlate` → `.wptranlate-cached`) |
| `enabledDomainsStorageKey` | `chrome.storage.local` key listing hostnames allowed to translate |
| `events.start` / `events.end` | `chrome.runtime.sendMessage` action names |
| `uiHostSuffixes` | Shadow host id suffixes skipped during DOM walk |
| `toasts.quickToggle` | `{ css, durationMs }` — «clearing cache, translating again…» (see `revertAndClearCaches`) |
| `toasts.error` | `{ css, durationMs }` — translation errors in `translateDocument` |
| `remoteTranslate.enabled` | Enable LibreTranslate fallback when Chrome `Translator` missing or unavailable |
| `remoteTranslate.baseUrl` | API root, e.g. `https://trnslt.breget.tech/lt` |
| `remoteTranslate.request` | Optional custom `(path, body, cfg) => Promise<object>` (background proxy) |

### Translator backends

`src/translator-adapters.js` exposes `WTE.wteAcquireTranslator(source, target, options)`:

1. **Chrome** — `Translator.availability` + `Translator.create` (unchanged behaviour).
2. **Remote** — `POST {baseUrl}/translate` when Chrome path fails or API is absent.

Page logic (`translate-document.js`, batching, cache) stays the same; only the `translator.translate()` implementation changes.

```javascript
remoteTranslate: {
  enabled: true,
  baseUrl: 'https://trnslt.breget.tech/lt',
},
```

Toast CSS is **full** `element.style.cssText` strings. Defaults are neutral slate/dark; each preset sets its own branding (see `presets/wptranlate.js`).

```javascript
self.WTE_CONFIG = {
  prefix: 'myext',
  toasts: {
    quickToggle: {
      css: 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#9333ea;color:#fff;…',
      durationMs: 1500,
    },
    error: { css: '…', durationMs: 6000 },
  },
};
```

After scripts load, `self.WTE.wteMountToast(cfg, 'quickToggle', { id, text })` is also available for custom injectors.

## Public API (page context)

After scripts load, `self.WTE` exposes:

| Method | Description |
|--------|-------------|
| `translateDocument(targetLang, sourceOverride?, tabId?)` | Detect language, translate page |
| `revertDomOnly()` | Restore originals, keep cache |
| `revertAndClearCaches()` | Restore originals + wipe cache |
| `wteMergeConfig(overrides)` | Merge runtime config |
| `wteMakeNames(prefix)` | Build selectors / dataset names |
| `wteMountToast(cfg, kind, { id, text })` | Show configured in-page toast |

Return values from `translateDocument`:

- `{ ok: true }` — translation ran
- `{ skipped: true, reason: 'same-lang' }` — source equals target
- `{ ok: false, reason: 'empty' }` — nothing to translate

## Service worker helpers

`src/frame-results.js` — pure functions for multi-frame inject results:

```javascript
const { wteMainFrameSkippedSameLang, wteInjectSucceeded } = require('./src/frame-results.js');
```

## Site fixture tests

Real-world page snapshots live under `test/fixtures/sites/`. Refresh and run:

```bash
npm install
npx playwright install chromium   # once
npm run fetch:sites               # download/update frozen pages
npm run test:sites                # Playwright integration tests
npm test                          # unit + site fixtures
```

See `test/fixtures/sites/README.md` to add new sites to the registry.

## Vendoring into an extension

Use a **git submodule** (recommended for [trnslt_one_button](https://github.com/lxkuz/trnslt_one_button)):

```bash
git submodule add -b main https://github.com/lxkuz/webpage-translate-engine.git extension/vendor/webpage-translate-engine
git submodule update --init --recursive
```

Pin a release tag or commit in the parent repo when you need a stable snapshot:

```bash
cd extension/vendor/webpage-translate-engine
git checkout v1.0.1   # or a commit SHA
cd ../../..
git add extension/vendor/webpage-translate-engine
```

## Translate Webpage preset

`presets/wptranlate.js` matches the [trnslt_one_button](https://github.com/lxkuz/trnslt_one_button) extension DOM markers and storage keys.

## License

MIT
