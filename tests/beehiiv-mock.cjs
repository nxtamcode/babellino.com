// Explicit test double for the external loader, NOT a vendor implementation.
// No subscriber can be created. Real rendering has a separate read-only smoke test.
const loaderURL = 'https://subscribe-forms.beehiiv.com/v3/loader.js';
const formID = '686fd649-8c20-4918-b7ab-f87bda722800';
const frameHTML = `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Signup test double</title><style>body{margin:16px;font:16px Georgia;color:#252a23}label{display:block;margin-bottom:8px}form{display:flex;gap:8px;flex-wrap:wrap}input{flex:1;min-width:120px;width:120px;padding:12px;font:inherit}button{padding:12px;background:#252a23;color:white;border:0;font:inherit}input:focus-visible,button:focus-visible{outline:3px solid #567528;outline-offset:2px}</style></head><body><main><label for="email">Email</label><form onsubmit="event.preventDefault()"><input id="email" type="email" required autocomplete="email"><button>Subscribe</button></form></main></body></html>`;
async function mockBeehiiv(page, mode = 'ready') {
  await page.route(loaderURL, async route => {
    if (mode === 'blocked') return route.abort();
    const body = mode === 'timeout' ? '' : `(() => {
      const script = document.querySelector('script[data-beehiiv-form="${formID}"]');
      const frame = document.createElement('iframe');
      frame.srcdoc = ${JSON.stringify(frameHTML)};
      frame.style.height = '128px';
      script.after(frame);
    })();`;
    return route.fulfill({ contentType: 'text/javascript', body });
  });
}
module.exports = { mockBeehiiv, loaderURL, formID };
