import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SpriteCharacter, fitSprite, projectPoint, unprojectPoint, spriteZone } from '../src/sprite-character.js';
import { LAYERS, POSES, EXPRESSION_NAMES, faceCell, faceParts, resolveExpression, poseFaceParts } from '../src/sprite-art.js';
import { createPoseLoader, PoseTransition } from '../src/sprite-loader.js';

test('all shipped layers are WebPs with alpha and atlas frames stay within the image', () => {
  const paths = new Set();
  for (const [pose, config] of Object.entries(POSES)) {
   let bytes = 0;
   for (const layer of LAYERS) {
    assert.ok(config.layers[layer].startsWith(`/sprites/${pose}/`));
    assert.ok(!paths.has(config.layers[layer]), 'poses must not share textures'); paths.add(config.layers[layer]);
    const webp = readFileSync(new URL(`../public${config.layers[layer]}`, import.meta.url));
    bytes += webp.length;
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF');
    assert.equal(webp.toString('ascii', 8, 12), 'WEBP');
    // extended format header: alpha flag + 24-bit canvas size
    assert.equal(webp.toString('ascii', 12, 16), 'VP8X', `${layer} must use the extended (alpha) format`);
    assert.ok(webp[20] & 0x10, `${layer} must preserve alpha`);
    const w = webp.readUIntLE(24, 3) + 1, h = webp.readUIntLE(27, 3) + 1;
    if (layer === 'face_atlas') {
      const expected = pose === 'idle' ? [1254,1254] : [config.faceRect.width*config.grid.columns,config.faceRect.height*config.grid.rows];
      assert.deepEqual([w,h],expected);
      for (const frame of Object.keys(config.frames)) {
        const cell = faceCell(frame, w, h, pose);
        assert.ok(cell.x >= 0 && cell.y >= 0 && cell.x + cell.width <= w && cell.y + cell.height <= h);
      }
    } else assert.deepEqual([w, h], [1024, 1536]);
   }
   assert.ok(bytes <= 800_000, `${pose}: ${bytes} bytes`);
   assert.ok('blink' in config.frames && 'talk' in config.frames);
   assert.ok(config.hair.path && config.zones.length && config.parts.leftEye && config.parts.mouth);
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
  assert.equal(cat.pose, 'cheer'); // a pet tick cannot interrupt this higher priority action
  assert.equal(cat.frame, 'idle_happy');
});

test('every expression resolves inside its pose, including unknown input', () => {
  for (const [pose,config] of Object.entries(POSES)) {
    for (const expression of [...EXPRESSION_NAMES,'unknown','idle_coax']) {
      assert.ok(resolveExpression(pose,expression) in config.frames);
    }
    for (const target of Object.values(config.fallback)) assert.ok(target in config.frames);
    for (const expression of Object.keys(config.frames)) assert.equal(resolveExpression(pose,expression),expression);
  }
  assert.equal(resolveExpression('wave','content'),'happy');
  assert.equal(resolveExpression('tail','surprised'),'sulky');
  assert.throws(() => resolveExpression('missing','smile'));
});

test('new poses keep expression eyes while talking, and expression mouth while blinking', () => {
  for (const pose of ['wave','paws','cheer','tail']) {
    for (const expression of Object.keys(POSES[pose].frames).filter(x => !['blink','talk','wink'].includes(x))) {
      assert.deepEqual(poseFaceParts(pose,expression,{talk:true}), {brows:expression,eyes:expression,mouth:'talk'});
      assert.deepEqual(poseFaceParts(pose,expression,{blink:true}), {brows:expression,eyes:'blink',mouth:expression});
      assert.deepEqual(poseFaceParts(pose,expression,{blink:true,talk:true}), {brows:expression,eyes:'blink',mouth:'talk'});
    }
  }
});

const tick = (cat, seconds, talking=false) => { for(let t=0;t<seconds;t+=.02) cat.update(.02,talking); };

test('temporary poses expire and petting renews the 1.5 second hold', () => {
  const cat = new SpriteCharacter();
  cat.wave(); assert.equal(cat.pose,'wave'); tick(cat,1.5); assert.equal(cat.pose,'wave');
  tick(cat,.15); assert.equal(cat.pose,'idle');
  cat.petTick(); tick(cat,1); cat.petTick(); tick(cat,1); assert.equal(cat.pose,'paws');
  tick(cat,.6); assert.equal(cat.pose,'idle');
  cat.react('chin'); assert.equal(cat.pose,'paws');
  cat.react('cheek'); assert.equal(cat.pose,'paws');
  cat.setExpr('coax'); assert.equal(cat.pose,'paws');
});

test('celebration outranks touching/greeting, persistent loneliness resumes, sleep wins', () => {
  const cat = new SpriteCharacter();
  cat.setLonely(3); assert.equal(cat.pose,'tail'); tick(cat,30); assert.equal(cat.pose,'tail');
  cat.celebrate(); cat.wave(); cat.petTick(); assert.equal(cat.pose,'cheer');
  tick(cat,2.7); assert.equal(cat.pose,'tail');
  cat.setLonely(4); assert.equal(cat.pose,'tail');
  cat.setLonely(5); cat.celebrate(); cat.petTick(); assert.equal(cat.pose,'idle');
  assert.equal(cat.update(.02,true),'idle_sleep');
  cat.setLonely(0); cat.wave(); assert.equal(cat.pose,'wave');
  tick(cat,1.7); assert.equal(cat.pose,'idle');
  for(const level of [1,2]) { cat.setLonely(level); assert.equal(cat.pose,'paws'); }
});

test('loading holds the timer, canceled requests do not return when decoding completes', () => {
  const cat = new SpriteCharacter(); cat.deferPoseTimers=true;
  cat.wave(); tick(cat,4); assert.equal(cat.pose,'wave');
  cat.presentPose('wave'); tick(cat,1.5); assert.equal(cat.pose,'wave');
  tick(cat,.2); assert.equal(cat.pose,'idle');
  cat.petTick(); cat.setLonely(5); cat.presentPose('paws'); tick(cat,.1);
  assert.equal(cat.pose,'idle'); assert.equal(cat.frame,'idle_sleep');
});

test('every pose keeps blinking and speech channels during its expression', () => {
  const cat = new SpriteCharacter({random:()=>0});
  for (const action of [()=>cat.wave(),()=>cat.petTick(),()=>cat.celebrate(),()=>cat.setLonely(3)]) {
    cat.setLonely(0); action(); cat.blinkIn=0; cat.time=0;
    cat.update(.01,true); assert.equal(cat.channels.blink,true); assert.equal(cat.channels.talk,true);
    tick(cat,.2,true); assert.equal(cat.channels.blink,false);
  }
});

test('180 ms transitions only select complete poses and reduced motion switches immediately', () => {
  const loaded=new Map([['idle',{}]]), fade=new PoseTransition();
  assert.equal(fade.select('wave',loaded),false); assert.equal(fade.pose,'idle');
  loaded.set('wave',{}); assert.equal(fade.select('wave',loaded),true);
  assert.equal(fade.mix,0); assert.equal(fade.advance(.09),.5); assert.equal(fade.advance(.09),1);
  fade.select('paws',loaded); assert.equal(fade.pose,'idle');
  loaded.set('paws',{}); fade.select('idle',loaded); assert.equal(fade.pose,'idle','stale loads do not switch');
  const reduced=new PoseTransition(true); reduced.select('wave',loaded); assert.equal(reduced.mix,1);
});

test('loader deduplicates requests and publishes complete poses atomically', async () => {
  const pending=[];
  const loader=createPoseLoader(path => new Promise(resolve => pending.push({path,resolve})));
  const first=loader.load('wave'); assert.equal(loader.load('wave'),first); assert.equal(pending.length,3);
  pending[0].resolve({}); pending[1].resolve({}); await Promise.resolve();
  assert.equal(loader.ready.has('wave'),false);
  pending[2].resolve({}); const layers=await first;
  assert.equal(layers.size,3); assert.equal(loader.ready.has('wave'),true);
  assert.ok(pending.every(x=>x.path.startsWith('/sprites/wave/')));
});

test('failed decode retains no partial pose and can be retried', async () => {
  let fail=true;
  const loader=createPoseLoader(async path => { if(fail && path.endsWith('face_atlas.webp')) throw Error('decode'); return {}; });
  await assert.rejects(loader.load('paws')); assert.equal(loader.ready.has('paws'),false);
  assert.equal(loader.pending.size,0); fail=false;
  assert.equal((await loader.load('paws')).size,3); assert.equal(loader.errors.size,0);
});

test('pose-specific zones exclude hands, sleeves, hidden bell and raised cheer hands', () => {
  const at=(pose,x,y) => spriteZone({x:x/1024,y:y/1536},pose);
  assert.equal(at('wave',527,550),'bell');
  assert.equal(at('paws',532,562),'body');
  assert.equal(at('paws',400,500),'body');
  assert.equal(at('paws',432,428),'cheek');
  assert.equal(at('cheer',95,170),'body');
  assert.equal(at('tail',678,618),'tail');
  assert.equal(at('tail',532,579),'bell');
  for(const pose of Object.keys(POSES)) assert.equal(spriteZone({x:-1,y:.5},pose),null);
});
