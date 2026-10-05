// Subsets 寒蝉圆黑体 (Chill Round Gothic, SIL OFL 1.1) down to the characters the
// site actually uses, so ~9 MB per weight becomes a few tens of kB.
//
//   npm run fonts
//
// Run it after changing any Chinese/Japanese text; tests/fonts.test.js fails in CI
// when the text uses a character the committed subset doesn't contain.
// Source fonts are downloaded once into .cache/fonts (gitignored), pinned to a
// commit and checked by SHA-256.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { join } from 'node:path';
import subsetFont from 'subset-font';
import { ROOT, MANIFEST, collectChars } from './font-chars.mjs';

const REPO = 'Warren2060/ChillRoundGothic';
const COMMIT = '53505f0818983d2fcdda00dc66e051ad13e81ffb';
const CACHE = join(ROOT, '.cache/fonts');
const OUT = join(ROOT, 'public/fonts');

// CSS weight → source file, sha256. Two weights keep the download small: CSS
// asking for 800 falls back to the 700 face, anything up to 500 to the 500 face.
const WEIGHTS = {
  500: ['ChillRoundGothic/ChillRoundGothic_Medium.otf', '401edab0771f03bd9a5fcdb51d9850c08ac2417c9dacc7843ac4dc6342838253'],
  700: ['ChillRoundGothic/ChillRoundGothic_Bold.otf', '7786713cbc1bde2ec2a4161fbb552e2a7d3e187737eeb581a48485d352a14caa'],
};
const LICENSE = ['License.txt', 'bdefa7c6496762298804550255762c4532124282910e976db960b24d04665ad4'];

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function fetchPinned([path, hash]) {
  const file = join(CACHE, path.split('/').pop());
  if (!existsSync(file)) {
    const url = `https://raw.githubusercontent.com/${REPO}/${COMMIT}/${path}`;
    console.log(`downloading ${url}`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const buf = readFileSync(file);
  if (sha256(buf) !== hash) throw new Error(`${file}: checksum mismatch, delete it and rerun`);
  return file;
}

mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT, { recursive: true });

const chars = collectChars();
console.log(`${[...chars].length} characters`);

for (const [weight, source] of Object.entries(WEIGHTS)) {
  const file = await fetchPinned(source);
  const woff2 = await subsetFont(readFileSync(file), chars, { targetFormat: 'woff2' });
  const out = join(OUT, `1xc-rounded-${weight}.woff2`);
  writeFileSync(out, woff2);
  console.log(`${out.replace(ROOT, '')}  ${(woff2.length / 1024).toFixed(1)} kB`);
}
copyFileSync(await fetchPinned(LICENSE), join(OUT, 'OFL.txt'));
writeFileSync(MANIFEST, chars + '\n');
console.log(`wrote ${MANIFEST.replace(ROOT, '')}`);
