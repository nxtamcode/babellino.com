const verifyProductImage = require('./product-image.cjs');
const { mockBeehiiv, loaderURL } = require('./beehiiv-mock.cjs');
// Browser and accessibility QA: https://playwright.dev/docs/accessibility-testing
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');

// Verify layout, keyboard navigation, assets, and accessibility at representative widths.
(async () => {
  const base = process.env.BASE_URL || 'http://127.0.0.1:8765/';
  const browser = await chromium.launch();
  const results = [];
  await mkdir('test-results', { recursive: true });
  try {
    for (const [name, width, height] of [
      ['desktop', 1440, 1000], ['mobile', 390, 844],
      ['small-mobile', 320, 700], ['tablet', 768, 1024],
      ['compact-desktop', 1101, 1000], ['wide-tablet', 1100, 1000],
      ['large-phone', 430, 932], ['landscape-phone', 844, 390],
      ['tablet-landscape', 1024, 768], ['mobile-breakpoint', 760, 1024],
      ['tablet-breakpoint', 761, 1024], ['wide-desktop', 1920, 1080],
      ['ultrawide', 2560, 1440],
    ]) {
      console.log(`Checking ${name}`);
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await mockBeehiiv(page);
      const errors = [], remoteRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (request.url() !== loaderURL && new URL(request.url()).origin !== new URL(base).origin) remoteRequests.push(request.url());
      });
      page.on('response', response => {
        if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      const response = await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      assert.match(await page.title(), /^Babellino/);
      assert.doesNotMatch(await response.text(), /github|open[\s-]?source/i);
      assert.equal(await page.locator('h1').count(), 1);
      assert.deepEqual(await page.locator('.hero-note li').allTextContents(), ['No subscriptions.', 'No internet required during use.', 'No camera.', 'Dual microphones.']);
      const benefits = await page.locator('.hero-note').evaluate(list => {
        const items = Array.from(list.children, li => li.getBoundingClientRect());
        const style = getComputedStyle(list);
        return {
          singleLines: items.every(r => r.height <= parseFloat(style.lineHeight) + 1),
          aligned: items.every(r => Math.abs(r.left - items[0].left) < 1),
          stacked: items.slice(1).every((r, i) => r.top > items[i].bottom),
          font: parseFloat(style.fontSize),
          ctaFont: parseFloat(getComputedStyle(document.querySelector('.hero .button')).fontSize),
          linkFont: parseFloat(getComputedStyle(document.querySelector('.hero .languages-link')).fontSize),
        };
      });
      assert.ok(benefits.singleLines && benefits.aligned && benefits.stacked, 'English benefits should be a compact list without orphaned words');
      assert.ok(benefits.ctaFont > benefits.font && benefits.font > benefits.linkFont, 'Keep action, facts, and secondary link in a clear type hierarchy');
      const undersized = await page.evaluate(() => {
        const checks = [
          ['.hero-description, .hero-note, .intro-content p, .how-bottom p, .closing p, .questions summary, .supported p, .language-list li, .updates-copy p, dd, .process', 16],
          ['.main-nav, .site-language, .footer-contact, .footer > span, .native-name, .signup-note, .signup-fallback, .hero-language-controls', 14],
          ['.eyebrow, .section-label, dt', 12],
        ];
        return checks.flatMap(([selector, minimum]) => Array.from(document.querySelectorAll(selector))
          .filter(el => parseFloat(getComputedStyle(el).fontSize) < minimum)
          .map(el => ({ selector, minimum, tag: el.tagName, size: getComputedStyle(el).fontSize })));
      });
      assert.deepEqual(undersized, [], 'Keep body copy and supporting text readable at every viewport');
      assert.equal(await page.locator('.details div').filter({ hasText: 'Subscriptions' }).locator('dd').innerText(), 'None required');
      const productImage = await verifyProductImage(page);
      const layout = await page.evaluate(() => ({
        width: innerWidth, scroll: document.documentElement.scrollWidth,
      }));
      if (layout.scroll > width) errors.push('Horizontal page overflow');
      layout.productImage = productImage;
      const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
      await page.locator('.closing').screenshot({ path: `test-results/${name}-closing.png` });
      await page.locator('.hero').screenshot({ path: `test-results/${name}-product-hero.png` });
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').innerText(), 'Skip to content');
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).hash, '#main');
      await page.getByRole('link', { name: 'Get updates' }).click();
      assert.equal(new URL(page.url()).hash, '#updates');
      await page.getByRole('link', { name: 'How it works' }).click();
      assert.equal(new URL(page.url()).hash, '#how-it-works');
      for (const summary of await page.locator('.questions summary').all()) {
        await summary.focus();
        await page.keyboard.press('Enter');
        assert.equal(await summary.evaluate(el => el.parentElement.open), true);
      }
      const expanded = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.equal(expanded.violations.length, 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.locator('.closing').screenshot({ path: `test-results/${name}-questions-open.png` });
      results.push({ name, layout, errors, remoteRequests,
        violations: a11y.violations.map(v => ({
          id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target),
        })),
      });
      await context.close();
      console.log(`Passed ${name}`);
    }
    const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
    const page = await fallback.newPage();
    await mockBeehiiv(page);
    await page.goto(base);
    await verifyProductImage(page);
    await page.getByText('Which languages does Babellino support?', { exact: true }).click();
    assert.ok(await page.getByText('Babellino supports the 10 languages listed above, with more coming.', { exact: false }).isVisible());
    await page.goto(new URL('404.html', base).href);
    assert.equal(await page.locator('h1').innerText(), 'Page not found.');
    await page.screenshot({ path: 'test-results/mobile-404.png', fullPage: true });
    await fallback.close();
    console.log('Passed no-JavaScript questions and 404');
    // axe executes asynchronous JavaScript; run it in an enabled context, while
    // separately preserving the functional no-JavaScript checks above.
    const errorContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const errorPage = await errorContext.newPage();
    await mockBeehiiv(errorPage);
    await errorPage.goto(new URL('404.html', base).href);
    assert.equal((await new AxeBuilder({ page: errorPage }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.length, 0);
    await errorPage.screenshot({ path: 'test-results/desktop-404.png', fullPage: true });
    await errorContext.close();
    await writeFile('test-results/report.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    assert.ok(results.every(r => !r.errors.length && !r.remoteRequests.length && !r.violations.length));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
