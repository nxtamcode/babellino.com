const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { gtmURL } = require('./gtm-mock.cjs');
const snippet = readFileSync('templates/tracking.html', 'utf8').trim();
const scripts = [...snippet.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
assert.equal(scripts.length, 2);
assert.equal(scripts[0][1].trim(), `async src="${gtmURL}"`);
assert.equal(scripts[0][2], '');
assert.equal(scripts[1][1], '');
assert.match(scripts[1][2], /window\.dataLayer = window\.dataLayer \|\| \[\];/);
assert.match(scripts[1][2], /function gtag\(\)\{dataLayer\.push\(arguments\);\}/);
assert.match(scripts[1][2], /gtag\('js', new Date\(\)\);/);
for (const prefix of ['', 'ca/', 'nl/', 'fr/', 'de/', 'it/', 'zh/', 'pt/', 'ro/', 'es/']) {
  for (const filename of ['index.html', '404.html']) {
    const file = prefix + filename;
    const source = readFileSync(file, 'utf8');
    const head = source.match(/<head>([\s\S]*?)<\/head>/)[1];
    assert.equal(source.split(gtmURL).length - 1, 1, `${file}: load exactly once`);
    assert.ok(head.includes(snippet), `${file}: exact supplied snippet in head`);
    assert.equal(head.indexOf('<script'), head.indexOf(snippet), `${file}: first script in head`);
    assert.ok(!source.includes('googletagmanager.com/ns.html'), 'No unrequested legacy iframe');
  }
}
for (const existing of [false, true]) {
  const context = vm.createContext(existing ? { dataLayer: ['existing entry'] } : {});
  vm.runInContext('window = globalThis;', context);
  vm.runInContext(scripts[1][2], context);
  assert.equal(context.dataLayer.length, existing ? 2 : 1);
  if (existing) assert.equal(context.dataLayer[0], 'existing entry');
  assert.equal(context.dataLayer.at(-1)[0], 'js');
  assert.ok(vm.runInContext('dataLayer[dataLayer.length - 1][1] instanceof Date', context));
  assert.equal(typeof context.gtag, 'function');
}
console.log('GTM source checks passed: exact snippet on 20 pages, async single loader, queue initialization and preservation.');
