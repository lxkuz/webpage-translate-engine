# Real-world site fixtures

Frozen HTML/JS/CSS snapshots of production pages for integration tests.

## Layout

```
test/fixtures/sites/
  registry.json           # list of sites (enable/disable, notes)
  <site-id>/
    site.json             # fetch config + test expectations
    site.meta.json        # generated: fetch timestamp, asset map
    index.html            # page with test harness injected in <head>
    assets/               # same-origin JS/CSS downloaded from live site
```

## Refresh fixtures

From the engine repo root:

```bash
npm run fetch:sites                  # all enabled sites in registry.json
npm run fetch:sites -- bbc-hindi     # one site
```

## Add a new site

1. Create `test/fixtures/sites/<id>/site.json` (copy an existing one).
2. Add `{ "id": "<id>", "enabled": true }` to `registry.json`.
3. Run `npm run fetch:sites -- <id>`.
4. Run `npm run test:sites` and commit `index.html` + `assets/`.

## What tests verify

- Page loads with meaningful body text.
- Content-script stack + `executeScript` inject (double `hash.js`) does not throw.
- `WTE.translateDocument(targetLang)` returns `{ ok: true }` and marks DOM nodes.

Harness scripts (mocks + content-script deps) are injected into `index.html` at fetch time.
Playwright then simulates the second inject pass before calling `translateDocument`.
