// Check the real photograph, complete-device crop, and deliberate split/stacked layout.
const assert = require('node:assert/strict');
module.exports = async function verifyProductImage(page, expectedAlt) {
  const image = page.locator('.product-image');
  assert.equal(await image.count(), 1);
  await image.evaluate(el => el.decode());
  assert.equal(await image.getAttribute('src'), '/assets/babellino-kitchen.jpg');
  const alt = await image.getAttribute('alt');
  assert.ok(alt?.trim());
  if (expectedAlt) assert.equal(alt, expectedAlt);
  const metrics = await image.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const figure = el.closest('figure');
    const frame = figure.getBoundingClientRect();
    const hero = el.closest('.hero').getBoundingClientRect();
    const copy = document.querySelector('.hero-copy').getBoundingClientRect();
    const header = document.querySelector('.home-header').getBoundingClientRect();
    const style = getComputedStyle(el);
    const width = parseFloat(style.width), height = parseFloat(style.height);
    const zoom = rect.width / width;
    const scale = Math.max(width / el.naturalWidth, height / el.naturalHeight) * zoom;
    const [x, y] = style.objectPosition.split(' ').map(value => parseFloat(value) / 100);
    const painted = {
      left: rect.left + (rect.width - el.naturalWidth * scale) * x,
      top: rect.top + (rect.height - el.naturalHeight * scale) * y,
    };
    painted.right = painted.left + el.naturalWidth * scale;
    painted.bottom = painted.top + el.naturalHeight * scale;
    // Conservative device-and-base bounds in the supplied 1440 × 1376 photograph.
    const device = {
      left: painted.left + 430 * scale,
      right: painted.left + 1060 * scale,
      top: painted.top + 240 * scale,
      bottom: painted.top + 1170 * scale,
    };
    const stacked = innerWidth <= 1000;
    return {
      naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight,
      width: frame.width, height: frame.height, viewport: innerWidth, zoom,
      uniformZoom: Math.abs(zoom - rect.height / height) < .002,
      fit: style.objectFit, position: style.objectPosition,
      clipped: getComputedStyle(figure).overflow === 'hidden',
      coversFrame: [rect, painted].every(box => box.left <= frame.left + 1 && box.right >= frame.right - 1
        && box.top <= frame.top + 1 && box.bottom >= frame.bottom - 1),
      deviceVisible: device.left >= frame.left && device.right <= frame.right
        && device.top >= frame.top && device.bottom <= frame.bottom,
      headerClear: header.bottom <= hero.top + 1,
      copyClear: stacked ? copy.bottom <= frame.top + 1 : copy.right <= frame.left + 1,
      composition: stacked
        ? Math.abs(frame.left) < 1 && Math.abs(frame.right - innerWidth) < 1
        : Math.abs(frame.width - hero.width / 2) < 1 && Math.abs(frame.right - innerWidth) < 1,
      noCaptionStrip: getComputedStyle(figure.querySelector('figcaption')).clipPath === 'inset(50%)',
      noScrim: ['::before', '::after'].every(pseudo => {
        const s = getComputedStyle(el.closest('.hero'), pseudo);
        return s.content === 'none' || s.content === 'normal';
      }),
    };
  });
  assert.equal(metrics.naturalWidth, 1440);
  assert.equal(metrics.naturalHeight, 1376);
  assert.ok(metrics.width > 0 && metrics.height > 0);
  assert.equal(metrics.fit, 'cover');
  assert.equal(metrics.position, '52% 52%');
  assert.ok(Math.abs(metrics.zoom - 1) < .002 && metrics.uniformZoom, 'Uniform crop, never stretch the photograph');
  assert.ok(metrics.clipped && metrics.coversFrame, 'No empty image edges or page overflow');
  assert.ok(metrics.deviceVisible && metrics.copyClear, 'Complete device stays separate from copy');
  assert.ok(metrics.headerClear && metrics.composition, 'Quiet header, split desktop and photo-after-copy on mobile');
  assert.ok(metrics.noCaptionStrip && metrics.noScrim);
  assert.equal(await page.locator('.product-stage, .device, .screen').count(), 0);
  const detail = page.locator('.device-detail img');
  assert.equal(await detail.getAttribute('src'), '/assets/conversation.es.png');
  assert.equal(await detail.getAttribute('loading'), 'lazy');
  await detail.evaluate(el => el.decode());
  const screen = await detail.evaluate(el => {
    const rect = el.getBoundingClientRect();
    const frame = el.closest('.conversation-frame').getBoundingClientRect();
    return {
      width: el.naturalWidth, height: el.naturalHeight,
      ratio: rect.width / rect.height,
      insideFrame: rect.left >= frame.left && rect.right <= frame.right
        && rect.top >= frame.top && rect.bottom <= frame.bottom,
      fitsViewport: frame.left >= 0 && frame.right <= innerWidth,
      noPerspective: getComputedStyle(el).transform === 'none'
        && getComputedStyle(el.parentElement).transform === 'none',
    };
  });
  assert.equal(screen.width, 800);
  assert.equal(screen.height, 1280);
  assert.ok(Math.abs(screen.ratio - 800 / 1280) < .002, 'Preserve the complete screenshot aspect ratio');
  assert.ok(screen.insideFrame && screen.fitsViewport && screen.noPerspective, 'Straight-on frame fits without clipping the UI');
  return metrics;
};
