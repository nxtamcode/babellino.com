const { mockBeehiiv, loaderURL } = require('./beehiiv-mock.cjs');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { writeFile } = require('node:fs/promises');
const contactEmail = JSON.parse(readFileSync('site.json')).contactEmail;
const codes = ['ca', 'nl', 'en', 'fr', 'de', 'it', 'zh', 'pt', 'ro', 'es'];
const data = Object.fromEntries(codes.map(c => [c, JSON.parse(readFileSync(`locales/${c}.json`))]));
const route = c => c === 'en' ? '/' : `/${c}/`;
const base = process.env.BASE_URL || 'http://127.0.0.1:8765/';

(async () => {
  const browser = await chromium.launch();
  const report = [];
  try {
    for (const code of codes) {
      const copy = data[code];
      for (const width of [1440, 320]) {
        const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await mockBeehiiv(page);
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        page.on('request', r => { if (r.url() !== loaderURL && new URL(r.url()).origin !== new URL(base).origin) errors.push(r.url()); });
        page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
        assert.equal((await page.goto(new URL(route(code), base).href, { waitUntil: 'networkidle' })).status(), 200);
        assert.equal(await page.locator('html').getAttribute('lang'), copy.htmlLang);
        assert.equal(await page.title(), copy.title);
        assert.equal(await page.locator('.headline-slide.is-current').getAttribute('lang'), copy.htmlLang);
        assert.equal(await page.locator('#hero-language-toggle').isVisible(), false);
        assert.equal(await page.getByRole('heading', { level: 1, name: copy.headlineAccessible, exact: true }).count(), 1);
        assert.equal(await page.locator('.language-list li').count(), 10);
        assert.equal(await page.locator('.supported h2').textContent(), copy.languagesHeading);
        for (const name of copy.languageNames) assert.ok((await page.locator('.language-list').innerText()).includes(name));
        assert.ok((await page.locator('.supported').innerText()).includes(copy.moreLanguages));
        const request = page.locator('.request-language');
        assert.equal(await request.innerText(), copy.requestLanguage);
        const mailto = new URL(await request.getAttribute('href'));
        assert.equal(mailto.protocol, 'mailto:');
        assert.equal(mailto.pathname, contactEmail);
        assert.equal(mailto.searchParams.get('subject'), copy.requestSubject);
        await request.focus();
        assert.equal(await request.evaluate(el => el === document.activeElement), true);
        await page.evaluate(() => scrollTo(0, 0));
        const layout = await page.evaluate(() => {
          const screen = document.querySelector('.screen');
          return { overflow: document.documentElement.scrollWidth > innerWidth,
            clipped: screen.scrollHeight > screen.clientHeight + 1 || screen.scrollWidth > screen.clientWidth + 1 };
        });
        assert.deepEqual(layout, { overflow: false, clipped: false }, `${code}/${width}`);
        assert.deepEqual((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations, []);
        await page.screenshot({ path: `test-results/locale-${code}-${width}.png`, fullPage: true });
        // Native disclosure, all native names, keyboard focus and escape.
        await page.locator('.site-language summary').focus();
        await page.keyboard.press('Enter');
        assert.equal(await page.locator('.site-language').getAttribute('open'), '');
        for (const c of codes) assert.equal(await page.locator(`[data-locale="${c}"]`).textContent(), data[c].native);
        await page.screenshot({ path: `test-results/menu-${code}-${width}.png` });
        assert.deepEqual((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations, []);
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('.site-language').getAttribute('open'), null);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const toggle = page.locator('#hero-language-toggle');
        await toggle.waitFor({ state: 'visible' });
        assert.equal(await toggle.textContent(), copy.pause);
        assert.equal(await toggle.getAttribute('aria-label'), copy.pauseLabel);
        await toggle.click();
        assert.equal(await toggle.textContent(), copy.resume);
        assert.equal(await toggle.getAttribute('aria-label'), copy.resumeLabel);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await toggle.waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.headline-slide.is-current').getAttribute('lang'), copy.htmlLang);
        assert.deepEqual(errors, []);
        report.push({ code, width, ...layout, accessibilityViolations: 0 });
        await context.close();
      }
      // Every locale is real HTML, not an English shell requiring JS.
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 700 } });
      const page = await context.newPage();
      await mockBeehiiv(page);
      await page.goto(new URL(route(code), base).href);
      assert.equal(await page.locator('html').getAttribute('lang'), copy.htmlLang);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(new URL(await page.locator('.request-language').getAttribute('href')).pathname, contactEmail);
      await page.screenshot({ path: `test-results/no-js-${code}.png`, fullPage: true });
      await page.locator('.site-language summary').click();
      await page.locator('[data-locale="fr"]').click();
      assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
      await page.goto(new URL(`${route(code)}404.html`, base).href);
      assert.equal(await page.locator('h1').textContent(), copy.errorHeading);
      await context.close();
    }

    // Browser regions are matched to the supported base language, in priority order.
    for (const [locale, code] of [['ca-ES', 'ca'], ['nl-NL', 'nl'], ['en-GB', 'en'], ['fr-CA', 'fr'],
      ['de-DE', 'de'], ['it-IT', 'it'], ['zh-TW', 'zh'], ['zh-CN', 'zh'], ['pt-BR', 'pt'], ['ro-RO', 'ro'], ['es-MX', 'es'], ['ja-JP', 'en']]) {
      const context = await browser.newContext({ locale });
      const page = await context.newPage();
      await mockBeehiiv(page);
      await page.goto(base);
      await page.waitForURL(url => url.pathname === route(code));
      assert.equal(await page.locator('html').getAttribute('lang'), data[code].htmlLang);
      await context.close();
    }
    const context = await browser.newContext({ locale: 'de-DE' });
    const page = await context.newPage();
    await mockBeehiiv(page);
    await page.goto(base);
    await page.waitForURL('**/de/');
    await page.locator('.site-language summary').click();
    await page.locator('[data-locale="es"]').click();
    await page.waitForURL('**/es/');
    await page.goto(base);
    await page.waitForURL('**/es/');
    await page.goto(new URL('/fr/', base).href); // Shared URL beats remembered preference.
    assert.equal(await page.locator('html').getAttribute('lang'), 'fr');
    await page.locator('.site-language summary').click();
    await page.locator('[data-locale="en"]').click();
    await page.waitForURL('**/?lang=en');
    await page.goto(base);
    assert.equal(await page.locator('html').getAttribute('lang'), 'en');
    await context.close();

    // Ordered fallback, preserved URL fragment/query, denied storage, no open redirect.
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => {
      Object.defineProperty(navigator, 'languages', { get: () => ['ja-JP', 'ro-RO', 'de-DE'] });
      Object.defineProperty(window, 'localStorage', { get: () => { throw new DOMException('Blocked', 'SecurityError'); } });
    });
    const p = await blocked.newPage();
    await mockBeehiiv(p);
    await p.goto(new URL('/?campaign=test#languages', base).href);
    await p.waitForURL('**/ro/?campaign=test#languages');
    await p.locator('.site-language summary').click();
    await p.locator('[data-locale="en"]').click();
    await p.waitForURL('**/?lang=en');
    assert.equal(await p.locator('html').getAttribute('lang'), 'en');
    await p.reload();
    assert.equal(await p.locator('html').getAttribute('lang'), 'en');
    await p.goto(new URL('/?lang=https://example.com', base).href);
    await p.waitForURL('**/ro/');
    assert.equal(new URL(p.url()).origin, new URL(base).origin);

    // Simulate Pages serving the root error document, keeping the real 404 status.
    await p.route('**/de/missing-page', r => r.fulfill({ status: 404, contentType: 'text/html', body: readFileSync('404.html', 'utf8') }));
    assert.equal((await p.goto(new URL('/de/missing-page', base).href)).status(), 404);
    assert.equal(await p.locator('h1').textContent(), data.de.errorHeading);
    await p.locator('.site-language summary').click();
    await p.locator('[data-locale="zh"]').click();
    assert.equal(new URL(p.url()).pathname, '/de/missing-page');
    assert.equal(await p.locator('h1').textContent(), data.zh.errorHeading);
    assert.equal(await p.title(), data.zh.errorTitle);
    assert.equal(await p.locator('html').getAttribute('lang'), 'zh-Hans');
    await p.screenshot({ path: 'test-results/localized-404.png', fullPage: true });
    await blocked.close();
    console.log('All locales, browser defaults, explicit URLs, overrides, blocked storage and errors passed.');
  } finally {
    await writeFile('test-results/locales-report.json', JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
