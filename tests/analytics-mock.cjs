// Suppress real analytics in QA; never send synthetic visits to either provider.
// These inert responses do not claim successful analytics delivery.
const gtmURL = 'https://www.googletagmanager.com/gtm.js?id=GTM-PCC32WMM';
const ahrefsURL = 'https://analytics.ahrefs.com/analytics.js';
const ahrefsKey = 'adKBOFq2SLSVDhNqS2N7lg';
async function mockAnalytics(page) {
  for (const url of [gtmURL, ahrefsURL]) {
    await page.route(url, route => route.fulfill({
      contentType: 'text/javascript', body: '/* Analytics suppressed for automated QA. */',
    }));
  }
}
module.exports = { gtmURL, ahrefsURL, ahrefsKey, mockAnalytics };
