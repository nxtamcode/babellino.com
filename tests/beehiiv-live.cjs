// Read-only integration smoke test. No real submissions, subscriber writes, or
// outbound POSTs. Bot/telemetry writes are blocked too; delivery is NOT tested.
const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');
const assert = require('node:assert/strict');
const { loaderURL, formID } = require('./beehiiv-mock.cjs');
const base = process.env.BASE_URL || 'http://127.0.0.1:8765/';

(async () => {
  await mkdir('test-results', { recursive: true });
  const browser = await chromium.launch();
  const report = [], failures = [];
  try {
    for (const width of [1440, 390, 320]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const requests = [], errors = [];
      await page.route('**/*', route => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
          // Keep report free of form data, cookies, tokens and query strings.
          const url = new URL(route.request().url());
          requests.push({ blockedWrite: route.request().method(), url: url.origin + url.pathname });
          return route.abort();
        }
        return route.continue();
      });
      page.on('response', response => {
        const url = new URL(response.url());
        requests.push({ status: response.status(), url: url.origin + url.pathname });
      });
      page.on('pageerror', error => errors.push(error.message));
      let metrics = null;
      try {
        await page.goto(new URL('/?lang=en', base).href);
        assert.ok(!requests.some(r => r.url === loaderURL), 'Embed should not load on initial hero view');
        await page.locator('.hero .button').click();
        const frameElement = page.locator('#signup-embed iframe');
        await frameElement.waitFor({ timeout: 30000 });
        const frame = page.frameLocator('#signup-embed iframe');
        const email = frame.locator('input[type="email"]');
        await email.waitFor({ timeout: 30000 });
        await page.waitForTimeout(1500); // Let the provider's sizing message settle.
        assert.ok((await frameElement.getAttribute('src')).includes(`/v3/forms/${formID}`));
        assert.equal(await frameElement.getAttribute('title'), 'Babellino email signup');
        assert.equal(await email.getAttribute('required'), 'required');
        assert.ok(await frame.locator('button[type="submit"]').isVisible());
        metrics = await email.evaluate(el => ({
          inputWidth: el.getBoundingClientRect().width,
          pageWidth: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        }));
        assert.ok(metrics.inputWidth >= 140, `Email field is squeezed: ${JSON.stringify(metrics)}`);
        assert.ok(metrics.scrollWidth <= metrics.pageWidth, 'Provider frame overflows');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        assert.equal(await page.locator('.signup-status').isVisible(), false);
      } catch (error) {
        failures.push(`${width}: ${error.message}`);
      } finally {
        await page.locator('#updates').screenshot({ path: `test-results/beehiiv-live-${width}.png` });
        if (width === 1440 || width === 390) await page.screenshot({ path: `test-results/signup-live-page-${width}.png`, fullPage: true });
        report.push({ width, metrics, requests, errors });
        await page.close();
      }
    }
  } finally {
    await writeFile('test-results/beehiiv-live.json', JSON.stringify({ report, failures }, null, 2));
    await browser.close();
  }
  assert.deepEqual(failures, [], 'Read-only provider rendering check failed');
  console.log('Live beehiiv rendering verified; no subscriber was created and email delivery was not tested.');
})().catch(error => { console.error(error); process.exitCode = 1; });
