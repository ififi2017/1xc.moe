// Which characters the site can ever display: everything non-ASCII in the
// page and the source (dialogue lines, UI copy, the skill section).
// Shared by scripts/build-fonts.mjs and tests/fonts.test.js.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const ROOT = new URL('..', import.meta.url).pathname;
export const MANIFEST = join(ROOT, 'scripts/font-chars.txt');

function sourceFiles() {
  const src = readdirSync(join(ROOT, 'src'))
    .filter((f) => /\.(js|css)$/.test(f))
    .map((f) => join(ROOT, 'src', f));
  return [join(ROOT, 'index.html'), ...src];
}

export function collectChars() {
  const chars = new Set();
  for (const file of sourceFiles()) {
    const text = readFileSync(file, 'utf8')
      // skip code comments so notes like this one don't bloat the font
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
      .replace(/<!--[\s\S]*?-->/g, '');
    for (const ch of text) if (ch.codePointAt(0) > 0x7f) chars.add(ch);
  }
  return [...chars].sort().join('');
}
