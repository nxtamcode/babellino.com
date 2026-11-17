const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { mockBeehiiv, loaderURL } = require('./beehiiv-mock.cjs');
const { gtmURL, ahrefsURL, ahrefsKey } = require('./analytics-mock.cjs');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765/';

(async () => {
  const browser = await chromium.launch();
  try {
    for (const prefix of ['', 'ca/', 'nl/', 'fr/', 'de/', 'it/', 'zh/', 'pt/', 'ro/', 'es/']) {
      for (const filename of ['index.html', '404.html']) {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await mockBeehiiv(page);
        const requests = [], errors = [];
        page.on('request', r => requests.push(r.url()));
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(new URL(prefix + filename, base).href, { waitUntil: 'networkidle' });
        const state = await page.evaluate(url => ({
          loaders: document.querySelectorAll(`head script[src="${url}"]`).length,
          async: document.querySelector(`script[src="${url}"]`)?.async,
          initialized: typeof window.gtag === 'function' && Array.isArray(window.dataLayer),
          commands: window.dataLayer?.map(command => command[0]),
          date: window.dataLayer?.[0]?.[1] instanceof Date,
        }), gtmURL);
        assert.deepEqual(state, { loaders: 1, async: true, initialized: true, commands: ['js'], date: true });
        assert.equal(requests.filter(url => url === gtmURL).length, 1);
        const ahrefs = page.locator(`head script[src="${ahrefsURL}"]`);
        assert.equal(await ahrefs.count(), 1);
        assert.equal(await ahrefs.getAttribute('data-key'), ahrefsKey);
        assert.equal(await ahrefs.evaluate(el => el.async), true);
        assert.equal(requests.filter(url => url === ahrefsURL).length, 1);
        assert.ok(requests.every(url => [gtmURL, ahrefsURL, loaderURL].includes(url) || new URL(url).origin === new URL(base).origin));
        assert.deepEqual(errors, []);
        await page.close();
      }
    }
    const blocked = await browser.newPage({ reducedMotion: 'reduce' });
    await mockBeehiiv(blocked);
    for (const url of [gtmURL, ahrefsURL]) await blocked.route(url, route => route.abort());
    const errors = [];
    blocked.on('pageerror', e => errors.push(e.message));
    await blocked.goto(new URL('/?lang=en', base).href);
    assert.ok(await blocked.locator('#hero-title').isVisible());
    await blocked.locator('.hero .button').click();
    assert.equal(new URL(blocked.url()).hash, '#updates');
    assert.ok(await blocked.locator('.signup-fallback').isVisible());
    assert.deepEqual(errors, []);
    await blocked.close();
    console.log('GTM/Ahrefs browser checks passed on 20 pages and with both loaders blocked. Real analytics were suppressed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
