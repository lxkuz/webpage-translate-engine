# webpage-translate-engine

Reusable translation engine for Chrome extensions using the **Chrome Built-in Translator** and **LanguageDetector** APIs.

Runs in the **page context** (via `chrome.scripting.executeScript`) — walks the DOM, batches text to `Translator.translate()`, caches results in `localStorage`, and supports revert.

## Requirements

- Chrome 138+ desktop
- `Translator` and `LanguageDetector` available in the injected world
- User gesture for first model download (extension responsibility)

## Quick start (Chrome extension)

1. Vendor this repo into your extension (submodule, copy, or npm `file:` dependency).

2. Inject scripts **in order** before calling the engine:

```
src/config.js
presets/your-preset.js   ← set WTE_CONFIG (prefix, storage keys, events)
src/hash.js
src/lang-tag.js
src/lang-detect.js
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
| `events.queueLlmRefine` | Optional: queue visible translations for LLM refinement (extension handles WebSocket) |
| `events.translationStarted` | Optional: fired after first visible batch (e.g. close panel early) |
| `llmRefine.enabled` | Enable in-page queue hooks (default `false`) |
| `uiHostSuffixes` | Shadow host id suffixes skipped during DOM walk |

## Public API (page context)

After scripts load, `self.WTE` exposes:

| Method | Description |
|--------|-------------|
| `translateDocument(targetLang, sourceOverride?, tabId?)` | Detect language, translate page |
| `revertDomOnly()` | Restore originals, keep cache |
| `revertAndClearCaches()` | Restore originals + wipe cache |
| `wteMergeConfig(overrides)` | Merge runtime config |
| `wteMakeNames(prefix)` | Build selectors / dataset names |

Return values from `translateDocument`:

- `{ ok: true }` — translation ran
- `{ skipped: true, reason: 'same-lang' }` — source equals target
- `{ ok: false, reason: 'empty' }` — nothing to translate

## Service worker helpers

`src/frame-results.js` — pure functions for multi-frame inject results:

```javascript
const { wteMainFrameSkippedSameLang, wteInjectSucceeded } = require('./src/frame-results.js');
```

## Translate Webpage preset

`presets/wptranlate.js` matches the [trnslt_one_button](https://github.com/lxkuz/trnslt_one_button) extension DOM markers and storage keys.

## Trnslt preset

`presets/trnslt.js` matches the [trnslt](https://github.com/lxkuz/trnslt) extension (LLM refine queue hooks enabled, `topFrameHtml` language detection).

## License

MIT
