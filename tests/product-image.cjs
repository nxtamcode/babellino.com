// Shared checks for the supplied kitchen image and its responsive, clipped crop.
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
    const figureEl = el.closest('figure');
    const frame = figureEl.getBoundingClientRect();
    const hero = el.closest('.hero').getBoundingClientRect();
    const copy = document.querySelector('.hero-copy').getBoundingClientRect();
    const header = document.querySelector('.home-header').getBoundingClientRect();
    const style = getComputedStyle(el);
    const layoutWidth = parseFloat(style.width), layoutHeight = parseFloat(style.height);
    const zoom = rect.width / layoutWidth;
    const scale = Math.max(layoutWidth / el.naturalWidth, layoutHeight / el.naturalHeight) * zoom;
    const plain = /^([\d.]+)% ([\d.]+)%$/.exec(style.objectPosition);
    const calc = /^calc\((.+)\) ([\d.]+)%$/.exec(style.objectPosition);
    const percent = calc && /([\d.]+)%/.exec(calc[1]);
    const pixels = calc && /([-+]?\s*[\d.]+)px/.exec(calc[1]);
    const positionValid = !!(plain || (calc && percent && pixels));
    const xPercent = plain ? Number(plain[1]) / 100 : Number(percent?.[1]) / 100;
    const xPixels = plain ? 0 : Number(pixels?.[1].replace(/\s/g, ''));
    const yPercent = Number(plain ? plain[2] : calc?.[2]) / 100;
    const offsetX = (rect.width - el.naturalWidth * scale) * xPercent + xPixels * zoom;
    const offsetY = (rect.height - el.naturalHeight * scale) * yPercent;
    // The device's measured region in the original photograph. Work from the
    // transformed image bounds, but compare its visible content with the clipping frame.
    const painted = { left: rect.left + offsetX, top: rect.top + offsetY };
    painted.right = painted.left + el.naturalWidth * scale;
    painted.bottom = painted.top + el.naturalHeight * scale;
    const device = {
      left: painted.left + .49 * el.naturalWidth * scale,
      right: painted.left + .63 * el.naturalWidth * scale,
      top: painted.top + .40 * el.naturalHeight * scale,
      bottom: painted.top + .75 * el.naturalHeight * scale,
    };
    return {
      complete: el.complete, naturalWidth: el.naturalWidth, naturalHeight: el.naturalHeight,
      width: frame.width, height: frame.height, viewport: innerWidth,
      zoom, uniformZoom: Math.abs(zoom - rect.height / layoutHeight) < .002,
      position: style.objectPosition, positionValid,
      centeredCrop: xPercent === .5 && yPercent === .5 && Math.abs(xPixels + layoutHeight * .106666667) < .02,
      deviceCenterOffset: (device.left + device.right - frame.left - frame.right) / 2,
      startsAtPageTop: Math.abs(frame.top + scrollY) < 1,
      headerOverImage: header.top >= frame.top && header.bottom <= frame.bottom,
      headerClear: header.bottom + 8 < device.top && header.bottom + 16 < copy.top,
      noCaptionStrip: getComputedStyle(figureEl.querySelector('figcaption')).clipPath === 'inset(50%)',
      fullHeroWidth: Math.abs(frame.width - hero.width) < 1,
      fullViewportWidth: Math.abs(frame.left) < 1 && Math.abs(frame.right - innerWidth) < 1,
      noScrim: ['::before', '::after'].every(pseudo => {
        const s = getComputedStyle(el.closest('.hero'), pseudo);
        return s.content === 'none' || s.content === 'normal';
      }) && getComputedStyle(el.closest('.hero')).backgroundImage === 'none',
      copyOverImage: copy.left >= frame.left && copy.right <= frame.right
        && copy.top >= frame.top && copy.bottom <= frame.bottom,
      fit: style.objectFit, clipped: getComputedStyle(figureEl).overflow === 'hidden',
      coversFrame: [rect, painted].every(box => box.left <= frame.left + 1 && box.right >= frame.right - 1
        && box.top <= frame.top + 1 && box.bottom >= frame.bottom - 1),
      deviceVisible: device.left >= frame.left && device.right <= frame.right
        && device.top >= frame.top && device.bottom <= frame.bottom,
      copyClear: innerWidth > 1100 ? copy.right + 8 < device.left : copy.top > frame.bottom,
    };
  });
  assert.ok(metrics.complete && metrics.positionValid, `Image decode/position: ${metrics.position}`);
  assert.equal(metrics.naturalWidth, 1792);
  assert.equal(metrics.naturalHeight, 1008);
  assert.ok(metrics.width > 0 && metrics.height > 0);
  assert.ok(metrics.fullHeroWidth && metrics.fullViewportWidth, 'Keep the photo edge-to-edge');
  assert.ok(metrics.clipped && metrics.coversFrame, 'Crop the enlarged photo without overflow or empty edges');
  assert.ok(metrics.noScrim, 'Do not restore a gradient or image-covering scrim');
  assert.ok(metrics.startsAtPageTop && metrics.headerOverImage, 'Navigation overlays the image from the page top');
  assert.ok(metrics.headerClear, 'Navigation must not collide with the device or copy');
  assert.ok(metrics.noCaptionStrip, 'Keep the descriptive caption accessible without a separate strip');
  assert.equal(metrics.fit, 'cover');
  assert.ok(metrics.uniformZoom, 'Do not stretch the photograph');
  assert.ok(Math.abs(metrics.zoom - (metrics.viewport > 1100 ? 1.12 : 1.16)) < .002, 'Enlarge the device at every breakpoint');
  assert.ok(metrics.deviceVisible && metrics.copyClear, 'Keep the complete device clear of the text');
  if (metrics.viewport > 1100) {
    assert.ok(metrics.copyOverImage);
    assert.equal(metrics.position, '56% 62%');
  } else {
    assert.ok(metrics.centeredCrop && Math.abs(metrics.deviceCenterOffset) < 1, 'Center the device when text is stacked');
    const height = metrics.viewport <= 760
      ? Math.min(520, Math.max(360, metrics.viewport * .90))
      : Math.min(660, Math.max(420, metrics.viewport * .62));
    assert.ok(Math.abs(metrics.height - height) < 1, 'Reserve room for navigation and the complete device');
  }
  assert.equal(await page.locator('.product-stage, .device, .screen').count(), 0);
  return metrics;
};
