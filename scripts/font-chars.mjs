// Which characters each language's page can ever display. Every locale gets its
// own font subset, so a visitor only downloads the glyphs of the page they're on.
// Shared by scripts/build-fonts.mjs and tests/fonts.test.js.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, MESSAGES } from '../src/i18n/index.js';
import { DIALECTS, LINES } from '../src/lines.js';
import { localeText } from './i18n-pages.mjs';

export const ROOT = new URL('..', import.meta.url).pathname;
export const MANIFEST_DIR = join(ROOT, 'scripts/font-chars');
export const manifestPath = (code) => join(MANIFEST_DIR, `${code}.txt`);

// Han, kana and Hangul come only from a locale's own text; code files only
// contribute symbols (♥ ✧ — …), so dev-panel labels never bloat the fonts
const SCRIPT_CHARS = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

const strings = (value) => (typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(strings));

function codeSymbols() {
  // genshin.* is the standalone door page, which is set in system serif fonts
  const files = readdirSync(join(ROOT, 'src')).filter((f) => /\.(js|css)$/.test(f) && !f.startsWith('genshin.')).map((f) => join(ROOT, 'src', f));
  let text = '';
  for (const file of files) {
    text += readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
  }
  return [...text].filter((ch) => ch.codePointAt(0) > 0x7f && !SCRIPT_CHARS.test(ch)).join('');
}

export function collectChars(code) {
  const template = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const { ui, lines } = MESSAGES[code];
  const parts = [
    localeText(template, code),
    ...strings(ui),
    ...strings(code === 'zh-CN' ? LINES : lines),
    ...(code === 'zh-CN' ? DIALECTS.flatMap((d) => [d.label, d.short]) : []),
    // every page's menu lists all languages, and the hint is shown in the target language
    ...LOCALES.flatMap((l) => [l.label, l.short, MESSAGES[l.code].ui.langHint]),
    codeSymbols(),
  ];
  const chars = new Set();
  for (const ch of parts.join('')) if (ch.codePointAt(0) > 0x7f) chars.add(ch);
  return [...chars].sort().join('');
}
