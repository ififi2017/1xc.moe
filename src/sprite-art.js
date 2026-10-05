import { poseData } from './sprite-pose-data.js';
// Source artwork is registered on a 1024 × 1536 canvas. Facial decals live in
// a single 3 × 4 atlas; these coordinates place them beneath the foreground hair.
export const ART_SIZE = { width: 1024, height: 1536 };
export const LAYERS = ['base', 'face_atlas', 'hair_front'];
export const FACE_FRAMES = {
  idle_smile: 0, idle_blink: 1, idle_talk: 2,
  idle_happy: 3, idle_content: 4, idle_sleep: 5,
  idle_pout: 6, idle_surprised: 7, idle_sulky: 8,
  idle_coax: 9, idle_wink: 10, idle_shy: 11,
};
export const FACE_RECT = { x: 313, y: 247, width: 322, height: 242 };

const idle = {
  label:'待机', layers:Object.fromEntries(LAYERS.map(name => [name, `/sprites/idle/${name}.webp`])),
  faceRect:FACE_RECT, grid:{columns:3,rows:4},
  frames:Object.fromEntries(Object.entries(FACE_FRAMES).map(([name,index]) => [name.slice(5),index])),
  defaultExpression:'smile', fallback:{}, faceMode:'legacy',
  featureSpace:{width:418,height:313.5},
  parts:{leftBrow:[25,60,187,73],rightBrow:[224,24,180,71],mouth:[196,237,96,74],
    leftEye:'M34 175 C66 132 165 120 204 155 C202 192 127 219 75 216 Z',
    rightEye:'M222 136 C247 94 341 78 400 114 C388 157 311 183 265 179 Z'},
  // The generated talk cell was 15.5 px left of smile, with steeper lip corners.
  mouthRegistration:{ talk:{source:[230.5,256.5],target:[246,260.5],angle:.12,scale:.58} },
  hair:{pivot:[450,145],path:'M302 204 C318 127 409 109 478 129 C556 130 609 212 638 304 L617 341 C589 337 564 318 542 298 C535 332 521 366 491 392 C480 401 463 408 451 405 C473 399 476 387 466 382 C439 375 416 343 397 308 C383 331 367 349 350 358 C328 323 310 271 302 204 Z'},
  headTop:[.48,.045],
  zones:[
    {zone:'bell',ellipse:[512,563.712,46.08,46.08]},
    {zone:'chin',ellipse:[491.52,483.84,117.76,39.936]},
    {zone:'cheek',ellipse:[409.6,423.936,35.84,21.504]},
    {zone:'cheek',ellipse:[573.44,387.072,35.84,21.504]},
    {zone:'ear',rect:[0,0,348.16,268.8]}, {zone:'ear',rect:[578.56,0,445.44,268.8]},
    {zone:'head',ellipse:[471.04,307.2,296.96,261.12]},
    {zone:'tail',rect:[819.2,721.92,204.8,629.76]},
  ],
};
export const POSES = { idle, ...poseData };
export const EXPRESSION_NAMES = Object.keys(idle.frames);
const shortName = name => String(name).replace(/^(idle|wave|paws|cheer|tail)_/, '');
export function resolveExpression(pose, expression) {
  const config = POSES[pose];
  if (!config) throw new Error(`Unknown pose: ${pose}`);
  let name = shortName(expression);
  const visited = new Set();
  while (!(name in config.frames) && config.fallback[name] && !visited.has(name)) {
    visited.add(name); name = config.fallback[name];
  }
  return name in config.frames ? name : config.defaultExpression;
}
export function faceCell(frame, width, height, pose = 'idle') {
  const config = POSES[pose];
  const index = config.frames[resolveExpression(pose, frame)];
  const { columns, rows } = config.grid;
  return { x:(index % columns)*width/columns, y:Math.floor(index/columns)*height/rows, width:width/columns, height:height/rows };
}

export function faceParts(frame) {
  const eyes = ['idle_talk', 'idle_coax', 'idle_shy', 'idle_wink', 'idle_surprised'].includes(frame) ? 'idle_smile'
    : ['idle_sleep', 'idle_content'].includes(frame) ? 'idle_blink' : frame;
  const mouth = ['idle_blink', 'idle_coax', 'idle_wink', 'idle_shy', 'idle_content'].includes(frame) ? 'idle_smile'
    : frame === 'idle_surprised' ? 'idle_sleep' : frame;
  return { eyes, mouth };
}

function drawIdleFace(ctx, atlas, frame, config) {
  const parts = faceParts(frame);
  const content = frame === 'idle_content', shy = frame === 'idle_shy', coax = frame === 'idle_coax';
  const surprised = frame === 'idle_surprised', sleeping = frame === 'idle_sleep';
  const mouthScale = frame === 'idle_talk' ? 0.58 : sleeping ? 0.56 : surprised ? 0.8 : 1;
  const blush = shy ? 0.23 : coax ? 0.10 : content ? 0.14 : 0;
  ctx.save();
  ctx.translate(config.faceRect.x, config.faceRect.y);
  ctx.scale(config.faceRect.width / config.featureSpace.width, config.faceRect.height / config.featureSpace.height);

  if (blush) {
    ctx.save();
    ctx.globalAlpha = blush;
    for (const [x, y] of [[111, 218], [325, 183]]) {
      ctx.save();
      ctx.translate(x, y); ctx.rotate(-0.23); ctx.scale(1, 0.4);
      const gradient = ctx.createRadialGradient(0, 0, 2, 0, 0, 45);
      gradient.addColorStop(0, '#ed88a1'); gradient.addColorStop(1, 'rgba(237,136,161,0)');
      ctx.fillStyle = gradient; ctx.fillRect(-45, -45, 90, 90);
      ctx.restore();
    }
    ctx.restore();
  }

  const drawIsland = (source, island) => {
    const cell = faceCell(source, atlas.width, atlas.height);
    ctx.save();
    if (island === 'mouth') {
      const registration=config.mouthRegistration[frame.replace('idle_','')];
      if (registration) {
        ctx.translate(...registration.target); ctx.rotate(registration.angle);
        ctx.scale(registration.scale,registration.scale); ctx.translate(-registration.source[0],-registration.source[1]);
      } else {
        ctx.translate(235, 266); ctx.scale(mouthScale, mouthScale); ctx.translate(-235, -266);
      }
    } else if (island.endsWith('Brow')) {
      const left = island === 'leftBrow';
      const x = left ? 70 : 365, y = left ? 120 : 75;
      ctx.translate(x, y - (surprised ? 3 : 0));
      ctx.rotate((coax ? 0.035 : shy ? 0.018 : 0) * (left ? -1 : 1));
      ctx.translate(-x, -y);
    } else if (surprised) {
      const x = island === 'leftEye' ? 130 : 308, y = island === 'leftEye' ? 176 : 137;
      ctx.translate(x, y); ctx.scale(1, 1.045); ctx.translate(-x, -y);
    }
    const shape = config.parts[island];
    if (typeof shape === 'string') ctx.clip(new Path2D(shape));
    else { ctx.beginPath(); ctx.rect(...shape); ctx.clip(); }
    ctx.drawImage(atlas, cell.x, cell.y, cell.width, cell.height, 0, 0, 418, 313.5);
    ctx.restore();
  };
  drawIsland(parts.eyes, 'leftBrow');
  drawIsland(parts.eyes, 'rightBrow');
  drawIsland(parts.eyes, 'leftEye');
  drawIsland(frame === 'idle_wink' ? 'idle_blink' : parts.eyes, 'rightEye');
  drawIsland(parts.mouth, 'mouth');
  ctx.restore();
  ctx.save();
  ctx.fillStyle = '#fff4ed';
  ctx.beginPath(); ctx.ellipse(490, 410, 4, 6, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function poseFaceParts(pose, frame, { blink = false, talk = false } = {}) {
  const config = POSES[pose], expression = resolveExpression(pose, frame);
  return {
    brows: ['blink','talk','wink'].includes(expression) ? config.neutralEyes : expression,
    eyes: blink ? 'blink' : expression === 'talk' ? config.neutralEyes : expression,
    mouth: talk ? 'talk' : ['blink','wink'].includes(expression) ? config.neutralMouth : expression,
  };
}

function drawPoseFace(ctx, atlas, frame, pose, channels) {
  const config = POSES[pose], parts = poseFaceParts(pose, frame, channels);
  const { x,y,width,height } = config.faceRect;
  ctx.save(); ctx.translate(x,y);
  for (const [part, region] of Object.entries(config.parts)) {
    const source=part === 'mouth' ? parts.mouth : part.endsWith('Brow') ? parts.brows : parts.eyes;
    const cell = faceCell(source, atlas.width, atlas.height, pose);
    ctx.save(); ctx.beginPath(); ctx.rect(...region); ctx.clip();
    ctx.drawImage(atlas, cell.x, cell.y, cell.width, cell.height, 0,0,width,height);
    ctx.restore();
  }
  ctx.restore();
  const [nx,ny,rx,ry] = config.nose;
  ctx.save(); ctx.fillStyle='#fff4ed'; ctx.beginPath(); ctx.ellipse(nx,ny,rx,ry,-.5,0,Math.PI*2); ctx.fill(); ctx.restore();
}

export function drawCharacter(ctx, layers, frame, hairAngle = 0, pose = 'idle', channels = {}) {
  const config = POSES[pose];
  ctx.drawImage(layers.get('base'), 0, 0, ART_SIZE.width, ART_SIZE.height);
  const atlas = layers.get('face_atlas');
  if (config.faceMode === 'legacy') drawIdleFace(ctx, atlas, `idle_${resolveExpression(pose, frame)}`, config);
  else drawPoseFace(ctx, atlas, frame, pose, channels);
  const [x,y] = config.hair.pivot;
  ctx.save(); ctx.translate(x,y); ctx.rotate(hairAngle); ctx.translate(-x,-y);
  ctx.clip(new Path2D(config.hair.path));
  ctx.drawImage(layers.get('hair_front'), 0,0,ART_SIZE.width,ART_SIZE.height);
  ctx.restore();
}
