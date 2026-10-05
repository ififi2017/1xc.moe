import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'node-html-parser';
import { LOCALES, MESSAGES, preferredLocale } from '../src/i18n/index.js';
import { LINES } from '../src/lines.js';
import { localizeHtml } from '../scripts/i18n-pages.mjs';

const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const reference = MESSAGES['zh-CN'].ui;
const LINE_KEYS = Object.keys(LINES.henan);

test('every locale has every UI string', () => {
  for (const { code } of LOCALES) {
    const ui = MESSAGES[code].ui;
    const missing = Object.keys(reference).filter((k) => typeof ui[k] !== 'string' || !ui[k].trim());
    assert.deepEqual(missing, [], `${code} is missing ui: ${missing.join(', ')}`);
  }
});

test('every language (and every zh-CN dialect) has a full set of lines', () => {
  const sets = [
    ...Object.entries(LINES).map(([d, lines]) => [`zh-CN/${d}`, lines]),
    ...LOCALES.filter((l) => l.code !== 'zh-CN').map((l) => [l.code, MESSAGES[l.code].lines]),
  ];
  for (const [name, lines] of sets) {
    const missing = LINE_KEYS.filter((k) => !lines?.[k] || (Array.isArray(lines[k]) && !lines[k].length));
    assert.deepEqual(missing, [], `${name} is missing lines: ${missing.join(', ')}`);
    assert.equal(lines.lonely.length, 5, `${name}: 寂寞小猫 needs 5 stages`);
  }
});

test('the template only uses keys that exist', () => {
  const root = parse(template);
  const keys = [
    ...root.querySelectorAll('[data-i18n]').map((el) => el.getAttribute('data-i18n')),
    ...root.querySelectorAll('[data-i18n-attr]').flatMap((el) => el.getAttribute('data-i18n-attr').split(',').map((p) => p.split(':')[1].trim())),
  ];
  assert.ok(keys.length > 30);
  for (const k of keys) assert.ok(k in reference, `unknown key ${k}`);
});

test('each pre-rendered page is in its own language with hreflang alternates', () => {
  for (const locale of LOCALES) {
    const root = parse(localizeHtml(template, locale.code));
    const ui = MESSAGES[locale.code].ui;
    assert.equal(root.querySelector('html').getAttribute('lang'), locale.code);
    assert.equal(root.querySelector('title').text, ui.title);
    assert.equal(root.querySelector('meta[name="description"]').getAttribute('content'), ui.description);
    assert.equal(root.querySelector('.tagline [data-i18n]').text, ui.tagline);
    assert.equal(root.querySelector('link[rel="canonical"]').getAttribute('href'), `https://1xc.moe${locale.path}`);
    const alternates = root.querySelectorAll('link[rel="alternate"]').map((el) => el.getAttribute('hreflang'));
    assert.deepEqual(alternates.sort(), [...LOCALES.map((l) => l.code), 'x-default'].sort());
    assert.equal(root.querySelector('#fontPreload').getAttribute('href'), `/fonts/1xc-rounded-${locale.code}-700.woff2`);
  }
});

test('browser languages map to the right page', () => {
  assert.equal(preferredLocale(['zh-TW']), 'zh-TW');
  assert.equal(preferredLocale(['zh-Hant-HK']), 'zh-HK');
  assert.equal(preferredLocale(['zh-Hans-CN']), 'zh-CN');
  assert.equal(preferredLocale(['en-GB', 'ja']), 'en');
  assert.equal(preferredLocale(['ko-KR']), 'ko');
  assert.equal(preferredLocale(['fr-FR']), null);
});
