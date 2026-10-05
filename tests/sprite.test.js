import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SpriteCharacter, fitSprite, projectPoint, unprojectPoint, spriteZone } from '../src/sprite-character.js';
import { LAYERS, FACE_FRAMES, faceCell, faceParts } from '../src/sprite-art.js';

test('all shipped layers are WebPs with alpha and atlas frames stay within the image', () => {
  for (const layer of LAYERS) {
    const webp = readFileSync(new URL(`../public/sprites/layers/${layer}.webp`, import.meta.url));
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF');
    assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
    // extended format header: alpha flag + 24-bit canvas size
    assert.equal(webp.toString('ascii', 12, 16), 'VP8X', `${layer} must use the extended (alpha) format`);
    assert.ok(webp[20] & 0x10, `${layer} must preserve alpha`);
    const w = webp.readUIntLE(24, 3) + 1, h = webp.readUIntLE(27, 3) + 1;
    if (layer === 'face_atlas') {
      for (const frame of Object.keys(FACE_FRAMES)) {
        const cell = faceCell(frame, w, h);
        assert.ok(cell.x >= 0 && cell.y >= 0 && cell.x + cell.width <= w && cell.y + cell.height <= h);
      }
    } else assert.deepEqual([w, h], [1024, 1536]);
  }
});

test('talking changes only the mouth, blinking changes only the eyes', () => {
  assert.deepEqual(faceParts('idle_talk'), { eyes: 'idle_smile', mouth: 'idle_talk' });
  assert.deepEqual(faceParts('idle_blink'), { eyes: 'idle_blink', mouth: 'idle_smile' });
  for (const frame of ['idle_coax', 'idle_wink', 'idle_shy']) assert.equal(faceParts(frame).mouth, 'idle_smile');
});

test('subtle expressions preserve the neutral eye proportions and relaxed closed-eye shape', () => {
  for (const frame of ['idle_coax', 'idle_shy', 'idle_surprised', 'idle_wink']) assert.equal(faceParts(frame).eyes, 'idle_smile');
  for (const frame of ['idle_content', 'idle_sleep']) assert.equal(faceParts(frame).eyes, 'idle_blink');
  assert.equal(faceParts('idle_content').mouth, 'idle_smile');
});

test('reactions remain visible through speech and give way to lonely/sleep states', () => {
  const cat = new SpriteCharacter({ random: () => 0.5 });
  cat.react('ear');
  assert.equal(cat.update(0.02, true), 'idle_surprised');
  cat.setLonely(3);
  assert.equal(cat.update(0.02, true), 'idle_sulky');
  cat.setLonely(5);
  cat.setExpr('happy');
  assert.equal(cat.update(0.02, true), 'idle_sleep');
  cat.setLonely(0);
  cat.petTick();
  assert.equal(cat.update(0.02, true), 'idle_content');
  assert.equal(cat.sleeping, false);
});

test('idle blinks, speech mouth and cheek/wink reactions are reachable', () => {
  const cat = new SpriteCharacter({ random: () => 0 });
  cat.blinkIn = 0;
  assert.equal(cat.update(0.01), 'idle_blink');
  cat.update(0.15);
  const speakingFrames = new Set(Array.from({ length: 24 }, () => cat.update(1 / 30, true)));
  assert.ok(speakingFrames.has('idle_talk') && speakingFrames.has('idle_smile'));
  cat.react('cheek');
  assert.equal(cat.update(0.01), 'idle_shy');
  cat.wink();
  assert.equal(cat.update(0.01), 'idle_wink');
});

test('mobile and desktop touch points follow the same animated transform as the art', () => {
  const points = [
    [{ x: 0.25, y: 0.12 }, 'ear'], [{ x: 0.47, y: 0.20 }, 'head'],
    [{ x: 0.48, y: 0.315 }, 'chin'], [{ x: 0.5, y: 0.367 }, 'bell'],
    [{ x: 0.9, y: 0.6 }, 'tail'], [{ x: 0.40, y: 0.276 }, 'cheek'],
  ];
  for (const width of [320, 390, 1280]) {
    const rect = fitSprite(width, 88, 570);
    assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.y >= 88);
    const cat = new SpriteCharacter(); cat.react('head'); cat.update(0.05);
    const transform = cat.transform(rect);
    for (const [point, zone] of points) {
      const uv = unprojectPoint(projectPoint(point, transform), transform);
      assert.ok(Math.abs(uv.x - point.x) < 1e-10 && Math.abs(uv.y - point.y) < 1e-10);
      assert.equal(spriteZone(uv), zone);
    }
  }
});

test('reduced motion keeps artwork and foreground hair still during reactions', () => {
  const cat = new SpriteCharacter({ reduceMotion: true });
  const rect = fitSprite(390, 88, 570);
  const before = cat.transform(rect);
  cat.celebrate(); cat.update(0.03); cat.petTick(); cat.update(0.03);
  assert.deepEqual(cat.transform(rect), before);
  assert.equal(cat.hairAngle, 0);
  assert.equal(cat.frame, 'idle_content');
});
