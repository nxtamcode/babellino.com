// Suppress the real container in QA: never send synthetic visits to analytics.
// This does not mock or claim successful delivery to any analytics destination.
const gtmURL = 'https://www.googletagmanager.com/gtm.js?id=GTM-PCC32WMM';
async function mockGTM(page) {
  await page.route(gtmURL, route => route.fulfill({
    contentType: 'text/javascript', body: '/* GTM suppressed for automated QA. */',
  }));
}
module.exports = { gtmURL, mockGTM };
