import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { collectChars, MANIFEST } from '../scripts/font-chars.mjs';

test('the subset font covers every character the site uses', () => {
  const have = new Set(readFileSync(MANIFEST, 'utf8').trim());
  const missing = [...collectChars()].filter((ch) => !have.has(ch));
  assert.deepEqual(missing, [], `run \`npm run fonts\` to add: ${missing.join('')}`);
});

test('font subsets are WOFF2 and stay small', () => {
  for (const weight of [500, 700]) {
    const font = readFileSync(new URL(`../public/fonts/1xc-rounded-${weight}.woff2`, import.meta.url));
    assert.equal(font.toString('ascii', 0, 4), 'wOF2');
    assert.ok(font.length < 200 * 1024, `${weight}: ${font.length} bytes`);
  }
  assert.match(readFileSync(new URL('../public/fonts/OFL.txt', import.meta.url), 'utf8'), /SIL Open Font License/);
});
