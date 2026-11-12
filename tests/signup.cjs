const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { mockBeehiiv, loaderURL, formID } = require('./beehiiv-mock.cjs');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765/';
const codes = ['ca', 'nl', 'en', 'fr', 'de', 'it', 'zh', 'pt', 'ro', 'es'];

(async () => {
  const browser = await chromium.launch();
  try {
    for (const code of codes) {
      const copy = JSON.parse(readFileSync(`locales/${code}.json`));
      const url = new URL(code === 'en' ? '/?lang=en' : `/${code}/`, base).href;
      for (const width of [320, 1440]) {
        const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
        const page = await context.newPage();
        await mockBeehiiv(page);
        const requests = [];
        page.on('request', r => requests.push(r.url()));
        await page.goto(url);
        assert.ok(!requests.includes(loaderURL), 'No vendor request before the signup section is near');
        await page.locator('.hero .button').click();
        assert.equal(new URL(page.url()).hash, '#updates');
        const frame = page.locator('#signup-embed iframe');
        await frame.waitFor();
        await page.waitForFunction(() => document.querySelector('#signup-embed iframe')?.title);
        assert.equal(await frame.getAttribute('title'), copy.updatesFrame);
        assert.equal(await page.locator('[data-beehiiv-form]').getAttribute('data-beehiiv-form'), formID);
        await page.locator('.signup-status').waitFor({ state: 'hidden' });
        assert.equal(await page.locator('.updates h2').innerText(), copy.updatesHeading);
        const link = page.locator('.signup-fallback');
        const href = new URL(await link.getAttribute('href'));
        assert.equal(href.pathname, 'hi@babellino.com');
        assert.equal(href.searchParams.get('subject'), copy.updatesSubject);
        assert.equal(await page.locator('.footer-contact').getAttribute('href'), 'mailto:hi@babellino.com');
        await link.focus();
        assert.ok(await link.evaluate(el => document.activeElement === el));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.deepEqual((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations, []);
        await page.locator('#updates').screenshot({ path: `test-results/signup-mock-${code}-${width}.png` });
        await page.evaluate(() => scrollTo(0, 0));
        await page.locator('#updates').scrollIntoViewIfNeeded();
        assert.equal(requests.filter(r => r === loaderURL).length, 1, 'Loader must run once');
        assert.ok(requests.every(r => r === loaderURL || new URL(r).origin === new URL(base).origin));
        await context.close();
      }
      const noJS = await browser.newPage({ javaScriptEnabled: false });
      await noJS.goto(url);
      assert.ok(await noJS.locator('.signup-fallback').isVisible());
      assert.equal(await noJS.locator('.signup-fallback').innerText(), copy.updatesFallback);
      assert.equal(await noJS.locator('.signup-status').isVisible(), false);
      await noJS.close();
    }
    for (const mode of ['blocked', 'timeout']) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await mockBeehiiv(page, mode);
      await page.clock.install();
      await page.goto(base);
      await page.locator('#updates').scrollIntoViewIfNeeded();
      await page.locator('[data-beehiiv-form]').waitFor({ state: 'attached' });
      await page.clock.runFor(16000);
      assert.equal(await page.locator('.signup-status').innerText(), 'The form couldn’t load. You can email us below.');
      assert.ok(await page.locator('.signup-fallback').isVisible());
      await page.locator('#updates').screenshot({ path: `test-results/signup-${mode}.png` });
      await page.close();
    }
    console.log('Signup shell: 10 locales, keyboard, accessibility, lazy loading, blocked/timeout/no-JS fallbacks passed. Provider submissions are not mocked as end-to-end success.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
