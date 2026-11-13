# Babellino website

- Keep this a small, buildless static site. The default branch is `master`.
- Product branding is Babellino. This is a prelaunch page, not a store or live demo.
- The owner confirmed on 2026-11-13 that the supplied product image shows the real
  Babellino product. Do not reintroduce concept/not-final-hardware disclaimers.
  The image is not an interactive demo. Publish only the approved language list
  in issue #8; do not infer additional support from the image.
- Only publish approved product facts. Never copy private device source into this repo.
- Owner-confirmed hardware facts (2026-11-13): no camera and dual microphones.
  These do not establish recording behavior, noise cancellation, or privacy guarantees.
- Do not add repository links or imply public-source availability in visitor-facing content.
- Prefer local assets; do not add analytics, remote fonts, or unnecessary JavaScript.
  Exception: the owner-approved beehiiv signup embed. Its provider-owned iframe may
  load third-party fonts, anti-bot services and telemetry; no optional attribution
  script or site analytics. Do not claim this integration is tracking/cookie-free.
- Babellino's public contact is `hi@babellino.com`, configured in `site.json`.
  Never use another product's address or put subscriber data/API secrets in this repo.
- Visually check desktop and mobile after UI changes, then remove unnecessary copy
  and decoration. Keep the prelaunch/development state until the owner confirms a change; the real
  product image does not itself announce pricing, availability, or a shipping date.
- Publish through GitHub Pages. Confirm build status and the public HTTP response.
