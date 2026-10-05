import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectChars, manifestPath } from '../scripts/font-chars.mjs';
import { LOCALES } from '../src/i18n/index.js';

for (const { code } of LOCALES) {
  test(`${code}: its font subset covers every character its page uses`, () => {
    const have = new Set(readFileSync(manifestPath(code), 'utf8').trim());
    const missing = [...collectChars(code)].filter((ch) => !have.has(ch));
    assert.deepEqual(missing, [], `run \`npm run fonts\` to add: ${missing.join('')}`);
  });
}

test('font subsets are WOFF2, small, referenced by fonts.css, and ship the OFL', () => {
  const css = readFileSync(new URL('../src/fonts.css', import.meta.url), 'utf8');
  for (const { code } of LOCALES) {
    for (const weight of [500, 700]) {
      const name = `1xc-rounded-${code}-${weight}.woff2`;
      const font = readFileSync(new URL(`../public/fonts/${name}`, import.meta.url));
      assert.equal(font.toString('ascii', 0, 4), 'wOF2');
      assert.ok(font.length < 200 * 1024, `${name}: ${font.length} bytes`);
      assert.ok(css.includes(`/fonts/${name}`), `${name} missing from fonts.css`);
    }
    assert.ok(css.includes(`:root:lang(${code})`));
  }
  assert.match(readFileSync(new URL('../public/fonts/OFL.txt', import.meta.url), 'utf8'), /SIL Open Font License/);
});
