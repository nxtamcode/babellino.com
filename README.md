# Babellino

The prelaunch website for **Babellino**, a self-contained AI live translation
device with an 8-inch touchscreen and no internet requirement during use.

## Development

Buildless HTML, CSS, and vanilla JavaScript. No runtime dependencies, third-party fonts, analytics,
cookies, or external runtime requests.

The local `hero.js` progressively enhances the headline with English, Spanish,
French, Italian, and Portuguese translations, cycling every six seconds. A small
Pause/Resume control stops automatic updates. Hidden tabs suspend the timer;
reduced-motion preferences keep English static. The English heading also works
without JavaScript and remains stable for assistive technology. Headline language
examples do not announce supported product languages.

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open <http://127.0.0.1:8080>.

## Publishing

GitHub Pages serves the repository root from `master`. `.nojekyll` keeps the
site static. The custom domain is **[babellino.com](https://babellino.com)**,
declared in `CNAME`. GitHub Pages manages the TLS certificate; HTTPS is enforced.

The device illustration and displayed conversation are conceptual, not a final
hardware render, a live translator, or a statement of supported languages.
The product is in development; final specifications, supported languages,
pricing, and availability are not announced.

## Content boundaries

- Use **Babellino** as the product brand.
- This repository is the website, not device firmware.
- Do not publish internal source, provisioning details, private links, or credentials.
- Do not add unverified latency, accuracy, language counts, battery life, certifications,
  availability, pricing, or privacy guarantees.
- Preserve keyboard navigation, reduced-motion support, and mobile layout.

## Boot splash artwork

Draft 800 × 1280 boot artwork is in [`artwork/boot-splash/`](artwork/boot-splash/).
It includes matched greyscale/colour SVGs and reference PNGs, not firmware code.
Final loader formats, progress placement, and device validation are still pending.

## Verification

Test desktop and mobile layouts, local asset loading, anchor navigation, keyboard
focus, accessibility, and the final GitHub Pages URL before reporting deployment.

The GitHub Actions check runs Playwright and axe at 320, 390, 768, and 1440 pixels,
and saves screenshots plus a report as a seven-day workflow artifact. For local QA:

```sh
npm ci --ignore-scripts
npx playwright install chromium
# Start the static server on port 8765 in another terminal.
npm test
```

Browser QA dependencies are development-only. Publishing requires no npm build.
