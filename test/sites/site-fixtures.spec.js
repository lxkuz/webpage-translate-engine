/**
 * Integration tests on frozen real-world site snapshots.
 * Fixtures: test/fixtures/sites/<id>/ — refresh with npm run fetch:sites
 */
const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');
const {
  wteResetMocks,
  wteSimulateExtensionInject,
  wteRunTranslateDocument,
  wteCollectDiagnostics,
} = require('../helpers/site-fixture-loader');

const SITES_ROOT = path.join(__dirname, '../fixtures/sites');
const registry = JSON.parse(fs.readFileSync(path.join(SITES_ROOT, 'registry.json'), 'utf8'));

function loadSiteConfig(siteId) {
  return JSON.parse(fs.readFileSync(path.join(SITES_ROOT, siteId, 'site.json'), 'utf8'));
}

function attachConsoleCollectors(page) {
  const errors = [];
  const logs = [];
  page.on('pageerror', (err) => errors.push(String(err.message || err)));
  page.on('console', (msg) => {
    const line = msg.text();
    if (msg.type() === 'error') errors.push(line);
    if (msg.type() === 'log' || msg.type() === 'warning') logs.push(line);
  });
  return { errors, logs };
}

for (const entry of registry.sites.filter((s) => s.enabled)) {
  const siteId = entry.id;
  const site = loadSiteConfig(siteId);
  const fixtureUrl = `/test/fixtures/sites/${siteId}/index.html`;

  test.describe(`Site fixture: ${siteId}`, () => {
    test.beforeEach(async ({ page }) => {
      const collectors = attachConsoleCollectors(page);
      page.__wteCollectors = collectors;
      await page.goto(fixtureUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await wteResetMocks(page);
    });

    test('fixture loads with body text and site assets', async ({ page }) => {
      const diag = await wteCollectDiagnostics(page);
      expect(diag.bodyTextLength).toBeGreaterThan(site.minBodyTextLength);
      expect(diag.hasHash).toBe(true);
      expect(diag.htmlLang.toLowerCase().startsWith(site.expectedSourceLang)).toBe(true);

      const indexPath = path.join(SITES_ROOT, siteId, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);
    });

    test('double inject (content script + executeScript) does not throw on hash.js', async ({ page }) => {
      const { errors } = page.__wteCollectors;

      await wteSimulateExtensionInject(page);

      const hashErrors = errors.filter((e) => /wptranlateDjb2Key has already been declared/i.test(e));
      expect(hashErrors).toEqual([]);

      const diag = await wteCollectDiagnostics(page);
      expect(diag.hasWte).toBe(true);
      expect(diag.hasHash).toBe(true);
    });

    test('translateDocument applies translations', async ({ page }) => {
      const { errors } = page.__wteCollectors;

      await wteSimulateExtensionInject(page);

      const result = await wteRunTranslateDocument(page, site.targetLang, site.expectedSourceLang);
      await page.waitForTimeout(800);

      expect(result?.ok).toBe(true);

      const diag = await wteCollectDiagnostics(page);
      expect(diag.translatedSpanCount).toBeGreaterThan(0);

      const bodyText = await page.locator('body').innerText();
      expect(bodyText).toContain(`[${site.targetLang.toUpperCase()}]`);

      const hashErrors = errors.filter((e) => /wptranlateDjb2Key has already been declared/i.test(e));
      expect(hashErrors).toEqual([]);
    });

    test('does not same-lang skip when target differs from page language', async ({ page }) => {
      await wteSimulateExtensionInject(page);
      const result = await wteRunTranslateDocument(page, site.targetLang, site.expectedSourceLang);
      expect(result?.skipped).not.toBe(true);
      expect(result?.reason).not.toBe('same-lang');
    });
  });
}

test.describe('Site fixture registry', () => {
  test('registry lists at least one enabled site', () => {
    expect(registry.sites.filter((s) => s.enabled).length).toBeGreaterThan(0);
  });

  test('each enabled site has index.html and site.json', () => {
    for (const { id } of registry.sites.filter((s) => s.enabled)) {
      expect(fs.existsSync(path.join(SITES_ROOT, id, 'index.html'))).toBe(true);
      expect(fs.existsSync(path.join(SITES_ROOT, id, 'site.json'))).toBe(true);
    }
  });
});
