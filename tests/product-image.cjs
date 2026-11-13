// Shared checks for the owner-supplied, unaltered hero image.
const assert = require('node:assert/strict');
module.exports = async function verifyProductImage(page, expectedAlt) {
  const image = page.locator('.product-image');
  assert.equal(await image.count(), 1);
  assert.ok(await image.isVisible());
  await image.evaluate(el => el.decode());
  assert.equal(await image.getAttribute('src'), '/assets/babellino-device.png');
  const alt = await image.getAttribute('alt');
  assert.ok(alt && alt.trim());
  if (expectedAlt) assert.equal(alt, expectedAlt);
  const metrics = await image.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const figure = el.closest('figure').getBoundingClientRect();
    return {
      complete: el.complete,
      naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight,
      width: rect.width, height: rect.height,
      contained: rect.left >= figure.left - 1 && rect.right <= figure.right + 1
        && rect.top >= figure.top - 1 && rect.bottom <= figure.bottom + 1
        && rect.left >= 0 && rect.right <= innerWidth,
    };
  });
  assert.ok(metrics.complete && metrics.contained);
  assert.equal(metrics.naturalWidth, 1450);
  assert.equal(metrics.naturalHeight, 2091);
  assert.ok(metrics.width > 0 && metrics.height > 0);
  assert.ok(Math.abs(metrics.width / metrics.height - 1450 / 2091) < 0.002, 'Image must keep its aspect ratio');
  assert.equal(await page.locator('.product-stage, .device, .screen').count(), 0);
  return metrics;
};
