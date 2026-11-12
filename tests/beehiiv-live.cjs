// Read-only integration probe. Never adds a subscriber or sends a message.
const { chromium } = require('playwright');
const { mkdir, writeFile } = require('node:fs/promises');

(async () => {
  await mkdir('test-results', { recursive: true });
  const browser = await chromium.launch();
  const report = [];
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      const requests = [], errors = [];
      await page.route('**/*', async route => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())) {
          requests.push({ blockedWrite: route.request().method(), url: route.request().url() });
          return route.abort();
        }
        if (new URL(route.request().url()).pathname === '/__embed_probe') {
          return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signup probe</title></head><body style="background:#f5f3e9;padding:20px"><main style="max-width:600px;margin:60px auto"><h1>Get Babellino updates.</h1><script async src="https://subscribe-forms.beehiiv.com/v3/loader.js" data-beehiiv-form="686fd649-8c20-4918-b7ab-f87bda722800"></script></main></body></html>` });
        }
        return route.continue();
      });
      page.on('response', response => requests.push({ status: response.status(), url: response.url() }));
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:8765/__embed_probe');
      await page.waitForTimeout(12000);
      const frames = [];
      for (const frame of page.frames()) {
        frames.push({ url: frame.url(), content: await frame.content().catch(() => '') });
      }
      report.push({ width, requests, errors, frames });
      await page.screenshot({ path: `test-results/beehiiv-live-${width}.png`, fullPage: true });
      await page.close();
    }
  } finally {
    await writeFile('test-results/beehiiv-live.json', JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
