# Babellino

The prelaunch website for **Babellino**, a self-contained AI live translation
device with an 8-inch touchscreen and no internet requirement during use.

## Development

Buildless HTML, CSS, and vanilla JavaScript. No runtime dependencies, third-party fonts, analytics,
cookies, or external runtime requests.

### Languages and content editing

The site has static pages in Catalan, Dutch, English, French, German, Italian,
Mandarin Chinese, Portuguese, Romanian, and Spanish (owner-approved issue #8).
English lives at `/`; other languages use `/ca/`, `/nl/`, `/fr/`, `/de/`, `/it/`,
`/zh/`, `/pt/`, `/ro/`, and `/es/`. The Mandarin page uses Simplified Chinese
(`zh-Hans`); regional browser variants select the same page, not a separate
Traditional Chinese translation. Portuguese copy uses European Portuguese.

Edit `locales/*.json` and `templates/`, then run `python3 scripts/render.py` and
commit the generated HTML, `llms.txt` files, and sitemap. The small Python stdlib
script is an **authoring tool**, not a hosting dependency. CI's `--check` catches
generated-file drift. `site.json` contains the confirmed public contact address
and meaningful-content `lastModified` date. Never guess a contact address.
The owner confirmed the Babellino public contact address, `hi@babellino.com` (2026-11-12).
Request links prefill a localized subject. Their native mailto URLs are character-
encoded in HTML as a basic scraper deterrent, not strong spam protection; they
still work without JavaScript. `llms.txt` directs requests to the website section.

`site.js` selects the first supported browser language on the English entry
point, with an explicit `?lang=` choice or saved manual selection taking priority.
Explicit localized URLs stay in their chosen language. The native disclosure
menu works without JavaScript; with JavaScript it remembers manual selections in
localStorage, tolerating blocked storage. `/?lang=en` allows an English override
even without storage. No cookies, IP lookup, third-party detection, or analytics.

`hero.js` cycles through all ten languages every six seconds, starting with the
current page language. Pause/Resume stops updates; hidden tabs suspend the timer.
Reduced-motion preferences keep the current page language static. The localized
heading works without JavaScript and stays stable for assistive technology.
The product language list is explicit and independent of the illustrative demo.

```sh
python3 -m http.server 8080 --bind 127.0.0.1
```

Open <http://127.0.0.1:8080>.

## Publishing

GitHub Pages serves the repository root from `master`. `.nojekyll` keeps the
site static. The custom domain is **[babellino.com](https://babellino.com)**,
declared in `CNAME`. GitHub Pages manages the TLS certificate; HTTPS is enforced.

The device illustration and displayed conversation are conceptual, not a final
hardware render or a live translator. The explicit supported-language list is
approved; the product remains in development. Final specifications, pricing,
and availability are not announced.

## Content boundaries

- Use **Babellino** as the product brand.
- Owner-approved messaging (2026-11-10): no subscriptions; no internet required during
  translation use. This does not announce a hardware price, free lifetime updates,
  or an offline firmware-update process.
- This repository is the website, not device firmware.
- Do not publish internal source, provisioning details, private links, or credentials.
- Do not add unverified latency, accuracy, language counts, battery life, certifications,
  availability, pricing, or privacy guarantees. The ten-language list in issue #8
  is approved; do not add unconfirmed languages.
- Preserve keyboard navigation, reduced-motion support, and mobile layout.

## Boot splash artwork

Draft 800 × 1280 boot artwork is in [`artwork/boot-splash/`](artwork/boot-splash/).
It includes matched greyscale/colour SVGs and reference PNGs, not firmware code.
Final loader formats, progress placement, and device validation are still pending.

## Verification

Test desktop and mobile layouts, local asset loading, anchor navigation, keyboard
focus, accessibility, and the final GitHub Pages URL before reporting deployment.

The GitHub Actions check runs Playwright and axe at 320, 390, 768, and 1440 pixels,
and checks all ten locales at 320 and 1440 pixels, native language navigation,
browser defaults, overrides, blocked storage, and translated errors. It saves
screenshots plus a report as a seven-day workflow artifact. For local QA:

```sh
npm ci --ignore-scripts
npx playwright install chromium
# Start the static server on port 8765 in another terminal.
npm test
```

Browser QA dependencies are development-only. Publishing requires no npm build.

## Search and sharing

Every language has a self-canonical static page, localized metadata, reciprocal
hreflang links, and an entry in the sitemap. Essential facts and FAQs are HTML,
usable without JavaScript. The brand-only share image avoids English text baked
into other languages' previews. Each locale has a localized `llms.txt`.

Browser-language redirection is an explicit product requirement. It runs only on
the root entry point, not on localized links, and never uses crawler-specific
behavior. [Google recommends separate URLs and avoiding automatic language
redirects](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites);
we retain crawlable native-language links, reciprocal hreflang, and an English
x-default/static response to limit that tradeoff. This does not guarantee indexing.

- Keep the title, description, Open Graph/Twitter fields, and WebPage JSON-LD in sync.
- WebSite/WebPage/Brand describe the prelaunch site, not an offer. Do not invent a
  company identity, ratings, prices, availability, unconfirmed languages, or sameAs links.
- `llms.txt` is an optional factual navigation aid, not a ranking or citation promise.
- `sitemap.xml` lists all ten canonical language pages. Update `lastmod` only for meaningful
  public-content changes, not every deployment; update the corresponding test date.
- `404.html` is the branded, noindex error page. On missing URLs, it translates in
  place from the path or browser/preference, keeping HTTP 404 instead of redirecting
  to a successful homepage. Localized static error pages also work without JS.
  Check an actual missing URL after deploy.
- `social-card.svg` uses the existing brand design. Regenerate the committed PNG with
  `rsvg-convert social-card.svg -o social-card.png`; verify 1200 × 630 and inspect it.

`tests/seo.py` validates the static metadata, graph references, share image, sitemap,
robots, links, and claim boundaries. Browser QA also covers question disclosures
(open/closed and no-JavaScript), their keyboard operation, and the 404 design.
Search Console/Bing verification and actual search/AI visibility need separate
account access and measurements; passing these checks does not demonstrate indexing.
