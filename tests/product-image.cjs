// Shared checks for the owner-supplied, unaltered kitchen hero asset.
const assert = require('node:assert/strict');
module.exports = async function verifyProductImage(page, expectedAlt) {
  const image = page.locator('.product-image');
  assert.equal(await image.count(), 1);
  assert.ok(await image.isVisible());
  await image.evaluate(el => el.decode());
  assert.equal(await image.getAttribute('src'), '/assets/babellino-kitchen.jpg');
  const alt = await image.getAttribute('alt');
  assert.ok(alt && alt.trim());
  if (expectedAlt) assert.equal(alt, expectedAlt);
  const metrics = await image.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const figure = el.closest('figure').getBoundingClientRect();
    const hero = el.closest('.hero').getBoundingClientRect();
    const copy = document.querySelector('.hero-copy').getBoundingClientRect();
    const style = getComputedStyle(el);
    const scale = Math.max(rect.width / el.naturalWidth, rect.height / el.naturalHeight);
    // The device occupies this measured region of the supplied photograph.
    // Track its visible bounds after the CSS cover crop (56% horizontal, 50% vertical).
    const offsetX = (rect.width - el.naturalWidth * scale) * .56;
    const offsetY = (rect.height - el.naturalHeight * scale) * .5;
    const device = {
      left: rect.left + offsetX + .49 * el.naturalWidth * scale,
      right: rect.left + offsetX + .63 * el.naturalWidth * scale,
      top: rect.top + offsetY + .40 * el.naturalHeight * scale,
      bottom: rect.top + offsetY + .75 * el.naturalHeight * scale,
    };
    return {
      complete: el.complete,
      naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight,
      width: rect.width, height: rect.height, viewport: innerWidth,
      fullHeroWidth: Math.abs(rect.width - hero.width) < 1,
      fit: style.objectFit, position: style.objectPosition,
      contained: rect.left >= figure.left - 1 && rect.right <= figure.right + 1
        && rect.top >= figure.top - 1 && rect.bottom <= figure.bottom + 1
        && rect.left >= 0 && rect.right <= innerWidth,
      deviceVisible: device.left >= rect.left && device.right <= rect.right
        && device.top >= rect.top && device.bottom <= rect.bottom,
      copyClear: innerWidth > 1100 ? copy.right + 8 < device.left : copy.top > figure.bottom,
    };
  });
  assert.ok(metrics.complete && metrics.contained);
  assert.equal(metrics.naturalWidth, 1792);
  assert.equal(metrics.naturalHeight, 1008);
  assert.ok(metrics.width > 0 && metrics.height > 0);
  assert.ok(metrics.fullHeroWidth, 'Kitchen image must span the hero, not the old portrait slot');
  assert.equal(metrics.fit, 'cover', 'Cover preserves proportions without stretching');
  assert.equal(metrics.position, '56% 50%');
  assert.ok(metrics.deviceVisible, 'Keep the complete device inside the responsive crop');
  assert.ok(metrics.copyClear, 'The headline and signup controls must not cover the device');
  if (metrics.viewport <= 1100) {
    const ratio = metrics.viewport <= 760 ? 4 / 3 : 1792 / 1008;
    assert.ok(Math.abs(metrics.width / metrics.height - ratio) < .002, 'Expected responsive photo ratio');
  }
  assert.equal(await page.locator('.product-stage, .device, .screen').count(), 0);
  return metrics;
};
