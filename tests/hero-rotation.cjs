const { mockBeehiiv, loaderURL } = require('./beehiiv-mock.cjs');
const { chromium } = require('playwright');
const AxeBuilder = require('@axe-core/playwright').default;
const assert = require('node:assert/strict');
const { mkdir, writeFile } = require('node:fs/promises');

const languages = ['en', 'es', 'fr', 'it', 'pt', 'ca', 'nl', 'de', 'ro', 'zh-Hans'];
const heading = 'A little less lost in translation.';

(async () => {
  const browser = await chromium.launch();
  const base = process.env.BASE_URL || 'http://127.0.0.1:8765/';
  const report = [];
  await mkdir('test-results', { recursive: true });

  async function open(viewport, reducedMotion = 'no-preference') {
    const context = await browser.newContext({ viewport, reducedMotion });
    const page = await context.newPage();
    await mockBeehiiv(page);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
    await page.clock.pauseAt(new Date('2026-01-01T00:00:10Z'));
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.clock.runFor(50);
    return { context, page, errors };
  }

  const currentLanguage = page => page.locator('.headline-slide.is-current').getAttribute('lang');
  const geometry = page => page.evaluate(() => {
    const visual = document.querySelector('.hero-title-visual').getBoundingClientRect();
    return {
      pageWidth: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      titleHeight: visual.height,
      descriptionTop: document.querySelector('.hero-description').getBoundingClientRect().top + scrollY,
      fits: [...document.querySelectorAll('.headline-line')].every(line => {
        const bounds = line.getBoundingClientRect();
        return bounds.left >= visual.left - 1 && bounds.right <= visual.right + 1
          && bounds.top >= visual.top - 1 && bounds.bottom <= visual.bottom + 1;
      }),
    };
  });

  try {
    for (const [name, width, height] of [
      ['desktop', 1440, 1000], ['mobile', 390, 844],
      ['small-mobile', 320, 700], ['tablet', 768, 1024],
    ]) {
      const { context, page, errors } = await open({ width, height });
      const baseline = await geometry(page);
      assert.equal(await page.locator('.headline-slide').count(), languages.length);
      for (const language of languages) {
        if (language !== 'en') await page.clock.fastForward(6000);
        assert.equal(await currentLanguage(page), language);
        assert.equal(await page.locator('#hero-language').getAttribute('lang'), language);
        assert.equal(await page.getByRole('heading', { level: 1, name: heading, exact: true }).count(), 1);
        const layout = await geometry(page);
        assert.ok(layout.fits, `${name}/${language}: headline overflows its reserved space`);
        assert.equal(layout.scrollWidth, width);
        assert.ok(Math.abs(layout.titleHeight - baseline.titleHeight) < 1);
        assert.ok(Math.abs(layout.descriptionTop - baseline.descriptionTop) < 1, 'Rotating text shifts the page');
        await page.locator('.hero').screenshot({
          path: `test-results/hero-${name}-${language}.png`, animations: 'disabled',
        });
      }
      await page.clock.fastForward(6000);
      assert.equal(await currentLanguage(page), 'en', 'The rotation wraps back to English');

      const toggle = page.locator('#hero-language-toggle');
      await toggle.focus();
      await page.keyboard.press('Space');
      assert.equal(await toggle.textContent(), 'Resume');
      await page.clock.fastForward(18000);
      assert.equal(await currentLanguage(page), 'en', 'Pause persists across multiple intervals');
      await page.keyboard.press('Space');
      assert.equal(await toggle.textContent(), 'Pause');
      await page.clock.fastForward(6000);
      assert.equal(await currentLanguage(page), 'es');

      await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.clock.fastForward(18000);
      assert.equal(await currentLanguage(page), 'es', 'Hidden tabs do not rotate');
      await page.evaluate(() => {
        delete document.hidden;
        document.dispatchEvent(new Event('visibilitychange'));
      });
      await page.clock.fastForward(6000);
      assert.equal(await currentLanguage(page), 'fr');

      // Media-query and viewport notifications arrive on real rendering frames,
      // not the frozen timer clock. Wait for the actual preference response.
      await page.clock.resume();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await toggle.waitFor({ state: 'hidden' });
      await page.clock.fastForward(30000);
      assert.equal(await currentLanguage(page), 'en');
      assert.equal(await toggle.isVisible(), false);
      await page.emulateMedia({ reducedMotion: 'no-preference' });
      await toggle.waitFor({ state: 'visible' });
      await page.clock.fastForward(6000);
      assert.equal(await currentLanguage(page), 'es');
      assert.equal(await toggle.isVisible(), true);

      await page.setViewportSize({ width: width === 320 ? 1440 : 320, height });
      await page.waitForFunction(() => {
        const visual = document.querySelector('.hero-title-visual').getBoundingClientRect();
        return [...document.querySelectorAll('.headline-line')].every(line =>
          line.getBoundingClientRect().right <= visual.right + 1);
      });
      assert.ok((await geometry(page)).fits, 'All languages refit after resizing');
      await toggle.click();
      await page.clock.resume();
      const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      assert.deepEqual(a11y.violations, []);
      assert.deepEqual(errors, []);
      report.push({ name, languages, stableLayout: true, pauseResume: true,
        hiddenTab: true, liveMotionPreference: true, responsiveRefit: true,
        accessibilityViolations: 0 });
      await context.close();
    }

    const reduced = await open({ width: 390, height: 844 }, 'reduce');
    await reduced.page.clock.fastForward(60000);
    assert.equal(await currentLanguage(reduced.page), 'en');
    assert.equal(await reduced.page.locator('#hero-language-toggle').isVisible(), false);
    assert.deepEqual(reduced.errors, []);
    await reduced.context.close();

    const fallback = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 320, height: 700 } });
    const page = await fallback.newPage();
    await mockBeehiiv(page);
    await page.goto(base);
    assert.equal(await currentLanguage(page), 'en');
    assert.equal(await page.locator('.headline-slide').count(), 1);
    assert.equal(await page.getByRole('heading', { name: heading, exact: true }).count(), 1);
    assert.equal(await page.locator('#hero-language-toggle').isVisible(), false);
    assert.ok((await geometry(page)).fits);
    await page.screenshot({ path: 'test-results/hero-no-javascript.png', fullPage: true });
    await fallback.close();
    report.push({ reducedMotionInitially: true, noJavaScriptFallback: true });
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await writeFile('test-results/hero-report.json', JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
