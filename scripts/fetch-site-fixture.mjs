#!/usr/bin/env node
/**
 * Download a real page and linked same-origin assets into test/fixtures/sites/<id>/.
 *
 * Usage:
 *   node scripts/fetch-site-fixture.mjs              # all enabled sites in registry.json
 *   node scripts/fetch-site-fixture.mjs berliner-zeitung bbc-hindi
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_ROOT = path.resolve(__dirname, '..');
const SITES_ROOT = path.join(ENGINE_ROOT, 'test/fixtures/sites');

const HARNESS_SCRIPTS = [
  '/test/mocks/chrome.js',
  '/test/mocks/translator.js',
  '/test/mocks/language-detector.js',
  '/src/config.js',
  '/presets/wptranlate.js',
  '/src/hash.js',
  '/src/cache.js',
];

const HARNESS_MARKER_START = '<!-- wte-site-fixture-harness:start -->';
const HARNESS_MARKER_END = '<!-- wte-site-fixture-harness:end -->';

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function fetchBuffer(url, headers = {}) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'wte-site-fixture/1.0 (+https://github.com/lxkuz/webpage-translate-engine)',
      Accept: '*/*',
      ...headers,
    },
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || '';
  return { buf, contentType };
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function shouldStripUrl(url, patterns) {
  return patterns.some((p) => url.includes(p));
}

function rewriteOriginUrls(html, origin) {
  const host = new URL(origin).host;
  const altHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
  let out = html;
  for (const h of [host, altHost]) {
    out = out.replaceAll(`https://${h}`, '');
    out = out.replaceAll(`http://${h}`, '');
  }
  return out;
}

function stripMatchingTags(html, tagName, urlPatterns) {
  const re = new RegExp(
    `<${tagName}\\b[^>]*(?:src|href)=["']([^"']+)["'][^>]*>\\s*(?:</${tagName}>)?`,
    'gi',
  );
  return html.replace(re, (full, url) => (shouldStripUrl(url, urlPatterns) ? `<!-- wte-stripped:${tagName} ${url} -->` : full));
}

function isStaticAssetPath(pathname) {
  return /\.(js|mjs|css|ico|woff2?|png|jpe?g|webp|svg|json|map|txt)$/i.test(pathname);
}

function collectSameOriginPaths(html, prefixes, explicitPaths = []) {
  const found = new Set(explicitPaths);
  const attrRe = /\b(?:src|href)=["'](\/[^"'#]+)["']/gi;
  let m;
  while ((m = attrRe.exec(html)) !== null) {
    const p = m[1];
    const pathname = p.split('?')[0];
    if (!prefixes.some((pref) => p.startsWith(pref))) continue;
    if (!isStaticAssetPath(pathname)) continue;
    found.add(p);
  }
  return [...found];
}

function rewriteLocalAssetPaths(html, mapping) {
  let out = html;
  const entries = [...mapping.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [from, to] of entries) {
    out = out.replaceAll(`"${from}"`, `"${to}"`);
    out = out.replaceAll(`'${from}'`, `'${to}'`);
  }
  return out;
}

function injectHarness(html) {
  const scripts = HARNESS_SCRIPTS.map((src) => `<script src="${src}"></script>`).join('\n');
  const block = `${HARNESS_MARKER_START}\n${scripts}\n${HARNESS_MARKER_END}`;
  if (html.includes(HARNESS_MARKER_START)) {
    return html.replace(
      new RegExp(`${escapeRegExp(HARNESS_MARKER_START)}[\\s\\S]*?${escapeRegExp(HARNESS_MARKER_END)}`),
      block,
    );
  }
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => `${m}\n${block}\n`);
  return `${block}\n${html}`;
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function writeAsset(siteDir, localRel, buf) {
  const dest = path.join(siteDir, localRel);
  await ensureDir(path.dirname(dest));
  await fs.writeFile(dest, buf);
  return `./${localRel.replace(/\\/g, '/')}`;
}

async function fetchSite(siteId) {
  const siteDir = path.join(SITES_ROOT, siteId);
  const siteConfigPath = path.join(siteDir, 'site.json');
  const config = await readJson(siteConfigPath);
  const { sourceUrl, origin } = config;

  console.log(`\n[wte] Fetching ${siteId} from ${sourceUrl}`);

  const { buf: htmlBuf } = await fetchBuffer(sourceUrl, { Accept: 'text/html,*/*' });
  let html = htmlBuf.toString('utf8');
  html = rewriteOriginUrls(html, origin);

  if (config.stripScriptUrlPatterns?.length) {
    html = stripMatchingTags(html, 'script', config.stripScriptUrlPatterns);
  }
  if (config.stripLinkUrlPatterns?.length) {
    html = stripMatchingTags(html, 'link', config.stripLinkUrlPatterns);
  }

  const assetMap = new Map();
  const sameOriginPaths = collectSameOriginPaths(
    html,
    config.sameOriginAssetPrefixes || [],
    config.sameOriginAssets || [],
  );

  for (const assetPath of sameOriginPaths) {
    const pathname = assetPath.split('?')[0];
    const assetUrl = new URL(assetPath, origin).href;
    const localRel = `assets${pathname}`;
    if (assetMap.has(pathname) || assetMap.has(assetPath)) continue;
    try {
      const { buf } = await fetchBuffer(assetUrl);
      const publicPath = await writeAsset(siteDir, localRel, buf);
      assetMap.set(assetPath, publicPath);
      if (pathname !== assetPath) assetMap.set(pathname, publicPath);
      console.log(`  saved ${assetPath} -> ${localRel} (${buf.length} bytes)`);
    } catch (e) {
      console.warn(`  skip ${assetPath}: ${e.message}`);
    }
  }

  for (const ext of config.externalAssets || []) {
    try {
      const { buf } = await fetchBuffer(ext.url);
      const publicPath = await writeAsset(siteDir, ext.localPath, buf);
      assetMap.set(ext.url, publicPath);
      console.log(`  saved ${ext.url} -> ${ext.localPath} (${buf.length} bytes)`);
    } catch (e) {
      console.warn(`  skip external ${ext.url}: ${e.message}`);
    }
  }

  html = rewriteLocalAssetPaths(html, assetMap);
  html = injectHarness(html);

  await ensureDir(siteDir);
  await fs.writeFile(path.join(siteDir, 'index.html'), html, 'utf8');

  const meta = {
    ...config,
    fetchedAt: new Date().toISOString(),
    bytes: Buffer.byteLength(html, 'utf8'),
    assets: [...assetMap.entries()].map(([from, to]) => ({ from, to })),
  };
  await fs.writeFile(path.join(siteDir, 'site.meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
  console.log(`  index.html (${meta.bytes} bytes)`);
}

async function main() {
  const registry = await readJson(path.join(SITES_ROOT, 'registry.json'));
  const cliIds = process.argv.slice(2);
  const enabledIds = registry.sites.filter((s) => s.enabled).map((s) => s.id);
  const ids = cliIds.length ? cliIds : enabledIds;

  for (const id of ids) {
    if (!enabledIds.includes(id) && !cliIds.includes(id)) {
      console.warn(`[wte] Unknown site id: ${id}`);
      continue;
    }
    await fetchSite(id);
  }
  console.log('\n[wte] Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
