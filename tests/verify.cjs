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
    ]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
      const page = await context.newPage();
      const errors = [], remoteRequests = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        if (new URL(request.url()).origin !== new URL(base).origin) remoteRequests.push(request.url());
      });
      page.on('response', response => {
        if (response.status() >= 400) errors.push(`HTTP ${response.status()}: ${response.url()}`);
      });
      const response = await page.goto(base, { waitUntil: 'networkidle' });
      assert.equal(response.status(), 200);
      assert.match(await page.title(), /^Babellino/);
      assert.doesNotMatch(await response.text(), /github|open[\s-]?source/i);
      assert.equal(await page.locator('h1').count(), 1);
      const layout = await page.evaluate(() => ({
        width: innerWidth, scroll: document.documentElement.scrollWidth,
        screenHeight: document.querySelector('.screen').clientHeight,
        screenScroll: document.querySelector('.screen').scrollHeight,
      }));
      if (layout.scroll > width) errors.push('Horizontal page overflow');
      if (layout.screenScroll > layout.screenHeight + 1) errors.push('Screen mockup clipping');
      const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
      await page.locator('.closing').screenshot({ path: `test-results/${name}-closing.png` });
      await page.keyboard.press('Tab');
      assert.equal(await page.locator(':focus').innerText(), 'Skip to content');
      await page.keyboard.press('Enter');
      assert.equal(new URL(page.url()).hash, '#main');
      await page.getByRole('link', { name: 'Meet Babellino' }).click();
      assert.equal(new URL(page.url()).hash, '#the-device');
      await page.getByRole('link', { name: 'How it works' }).click();
      assert.equal(new URL(page.url()).hash, '#how-it-works');
      results.push({ name, layout, errors, remoteRequests,
        violations: a11y.violations.map(v => ({
          id: v.id, impact: v.impact, nodes: v.nodes.map(n => n.target),
        })),
      });
      await context.close();
    }
    await writeFile('test-results/report.json', JSON.stringify(results, null, 2));
    console.log(JSON.stringify(results, null, 2));
    assert.ok(results.every(r => !r.errors.length && !r.remoteRequests.length && !r.violations.length));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
