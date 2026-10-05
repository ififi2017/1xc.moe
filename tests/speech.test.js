import test from 'node:test';
import assert from 'node:assert/strict';
import { speechPlan } from '../src/speech.js';
import { SpriteCharacter } from '../src/sprite-character.js';

test('one voice blip per spoken character; punctuation and kaomoji are silent', () => {
  const plan = speechPlan('嘿咻！俺跳得高不高喵～(｡•̀ᴗ-)✧');
  assert.equal(plan.filter((s) => s.voiced).map((s) => s.ch).join(''), '嘿咻俺跳得高不高喵');
  assert.equal(plan.map((s) => s.ch).join(''), '嘿咻！俺跳得高不高喵～(｡•̀ᴗ-)✧', 'graphemes stay intact');
  assert.equal(speechPlan('ご主人様～お帰りにゃ').filter((s) => s.voiced).length, 9);
});

test('questions lift the last syllable and full stops pause longer than commas', () => {
  const plan = speechPlan('好吗？嗯，好。');
  assert.equal(plan.find((s) => s.ch === '吗').rising, true);
  assert.ok(plan.find((s) => s.ch === '。').delay > plan.find((s) => s.ch === '，').delay);
});

test('continuous petting sways smoothly instead of restarting the motion', () => {
  const cat = new SpriteCharacter({ random: () => 0.5 });
  const rect = { x: 0, y: 0, width: 400, height: 600 };
  let prev = cat.transform(rect), maxAngle = 0, maxY = 0;
  for (let frame = 0; frame < 240; frame++) {
    if (frame % 3 === 0) cat.petTick(); // mouse rubbing: many ticks a second
    cat.update(1 / 60);
    const t = cat.transform(rect);
    maxAngle = Math.max(maxAngle, Math.abs(t.angle - prev.angle));
    maxY = Math.max(maxY, Math.abs(t.y - prev.y));
    prev = t;
  }
  assert.ok(maxAngle < 0.003, `angle jumped ${maxAngle}`);
  assert.ok(maxY < 1.5, `y jumped ${maxY}px`);
  assert.ok(cat.nuzzle > 0.9, 'still nuzzling while being petted');
  for (let i = 0; i < 180; i++) cat.update(1 / 60);
  assert.ok(cat.nuzzle < 0.05, 'settles once petting stops');
});
