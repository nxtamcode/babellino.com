// Dependency-free source contracts. Not a substitute for browser visual/reflow QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const hero = fs.readFileSync(path.join(root, 'hero.js'), 'utf8');
const template = fs.readFileSync(path.join(root, 'templates/index.html'), 'utf8');
const rule = selector => {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `Missing selector ${selector}`);
  return css.slice(start, css.indexOf('}', start));
};
assert.ok(!/text-shadow\s*:|text-stroke\s*:|drop-shadow\(/.test(css), 'No text halo or outline');
assert.ok(!/gradient\(/.test(css), 'No gradient patch over the product photo');
assert.match(rule('body'), /font-weight: 400/);
assert.match(rule('h1, h2'), /font-weight: 400/);
assert.match(rule('.hero-copy'), /background: var\(--paper\)/);
assert.match(rule('.hero'), /grid-template-columns: 50% 50%/);
assert.match(rule('.hero-title-visual'), /display: grid/);
assert.ok(template.includes('<div class="conversation-frame">'));
assert.ok(!template.includes('/assets/babellino-device.png'), 'Use the supplied UI, not the older angled device render');
assert.match(rule('.conversation-frame'), /width: min\(100%, 400px\)/);
assert.match(rule('.conversation-frame img'), /width: 100%; height: auto/);
assert.ok(!/transform:|object-fit: cover|height: [\d.]+px/.test(rule('.conversation-frame img')), 'Keep the full screenshot at its original aspect ratio');
assert.ok(!hero.includes('fontSize'), 'Do not shrink translations to fit');
assert.ok(!css.includes('.is-animated .headline-line'), 'Translations must wrap naturally');
assert.match(hero, /6000/);
assert.match(hero, /prefers-reduced-motion/);
assert.match(hero, /visibilitychange/);
assert.ok(!template.includes('hero-facts') && !template.includes('hero-note'));
assert.deepEqual([...template.matchAll(/<section class="[^"]+" id="([^"]+)"/g)].map(m => m[1]),
  ['the-device', 'how-it-works', 'languages', 'questions', 'updates']);
assert.ok(template.includes('<h2 id="closing-title">$questions</h2>'));
assert.ok(!template.includes('$deviceDescription') && !template.includes('$howHeadingHTML'), 'Avoid duplicate definition and extra slogan');
assert.ok(template.includes('$deviceStory') && template.includes('$development'));
const reassurance = template.match(/<ul class="reassurance wrap">([\s\S]*?)<\/ul>/)[1];
assert.ok(reassurance.includes('$noSubscriptions') && reassurance.includes('$noInternet'));
assert.ok(!reassurance.includes('$noCamera') && !reassurance.includes('$dualMicrophones'));
const details = template.match(/<ul class="details">([\s\S]*?)<\/ul>/)[1];
for (const fact of ['$screenDetail', '$noCamera', '$dualMicrophones', '$languagesLink']) assert.ok(details.includes(fact));
for (const filename of fs.readdirSync(path.join(root, 'locales'))) {
  const copy = JSON.parse(fs.readFileSync(path.join(root, 'locales', filename), 'utf8'));
  assert.equal(copy.subscribeNav, copy.updatesCTA);
  assert.ok(copy.deviceAlt && copy.deviceAlt.includes('Babellino'));
}
function luminance(hex) {
  const channels = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
const token = name => css.match(new RegExp(`--${name}: (#[a-f0-9]{6})`))[1];
function contrast(a, b) {
  const [low, high] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (high + .05) / (low + .05);
}
for (const [fg, bg] of [[token('ink'), token('paper')], [token('muted'), token('paper')],
  [token('paper'), token('forest')], ['#e1e6d8', token('forest')]]) {
  assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg} needs normal-text contrast`);
}
console.log('PASS: hierarchy, no halos, natural headline wrapping, page order, localized product facts, CTA naming, and flat-surface text contrast.');
console.log('Scope: source contracts only; browser layout, photo rendering, and provider-form usability require separate checks.');
