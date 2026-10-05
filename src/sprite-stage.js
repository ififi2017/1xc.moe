import { fitSprite, projectPoint, unprojectPoint, spriteZone } from './sprite-character.js';
import { ART_SIZE, POSES, drawCharacter, resolveExpression } from './sprite-art.js';
import { createPoseLoader, PoseTransition } from './sprite-loader.js';

export function createSpriteStage(canvas, cat, { reduceMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  const masks = new Map();
  const transition = new PoseTransition(reduceMotion);
  const buffer = () => { const c=document.createElement('canvas'); c.width=ART_SIZE.width; c.height=ART_SIZE.height; return c; };
  const composed=buffer(), previous=buffer(), next=buffer();
  const composedCtx=composed.getContext('2d'), previousCtx=previous.getContext('2d'), nextCtx=next.getContext('2d');
  cat.deferPoseTimers=true;
  const loader=createPoseLoader(async path => {
    const img=new Image(); img.decoding='async'; img.src=path; await img.decode(); return img;
  });
  let preloading=false;
  let lastRequested='idle';
  let lastArtKey='', lastMix=1;
  const particles = [];
  const maskWidth = 128, maskHeight = 192;
  let width = 1, height = 1;
  let rect = fitSprite(1, 0, 1);
  let transform = cat.transform(rect);
  let complete = false;

  async function loadPose(pose) {
    const layers=await loader.load(pose);
    if (!masks.has(pose)) {
      const mask=document.createElement('canvas'); mask.width=maskWidth; mask.height=maskHeight;
      const context=mask.getContext('2d', {willReadFrequently:true});
      context.drawImage(layers.get('base'),0,0,maskWidth,maskHeight);
      masks.set(pose,context.getImageData(0,0,maskWidth,maskHeight).data);
    }
    return layers;
  }
  function requestLoad(pose) {
    if (!loader.pending.has(pose) && !loader.ready.has(pose)) {
      void loadPose(pose).catch(error => { canvas.dataset.loadError=pose; console.warn(`姿势 ${pose} 加载失败，保留待机`,error); });
    }
  }
  function preload() {
    if (preloading) return;
    preloading=true;
    // Two paints separate idle's first visible frame from background requests.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const schedule=globalThis.requestIdleCallback ?? (callback => setTimeout(callback,150));
      const poses=Object.keys(POSES).filter(pose => pose !== 'idle');
      const step=() => schedule(async () => {
        const pose=poses.shift();
        if (!pose) return;
        try { await loadPose(pose); } catch { /* Demand can retry this pose later. */ }
        step();
      });
      step();
    }));
  }

  function resize(w, h, top, bottom, left = 0, areaWidth = w) {
    width = w; height = h;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    rect = fitSprite(areaWidth, top, bottom);
    rect.x += left;
    transform = cat.transform(rect);
  }

  function spawn(kind, point, velocity = { x: 0, y: -50 }, options = {}) {
    if (reduceMotion || particles.length >= 100) return;
    particles.push({ kind, x: point.x, y: point.y, vx: velocity.x, vy: velocity.y,
      life: options.life ?? 1.4, age: 0, size: options.size ?? 18, gravity: options.gravity ?? 15 });
  }

  function burst(point, count = 7) {
    for (let i = 0; i < count; i++) {
      spawn(i % 3 ? 'heart' : 'star', point, { x: (Math.random() - 0.5) * 120, y: -40 - Math.random() * 90 },
        { size: 10 + Math.random() * 12, gravity: 35 });
    }
  }

  function draw(dt) {
    ctx.clearRect(0, 0, width, height);
    transform = cat.transform(rect);
    if (complete) {
      const requested=cat.pose;
      if (!loader.errors.has(requested) || requested !== lastRequested) requestLoad(requested);
      lastRequested=requested;
      if (transition.select(requested,loader.ready)) {
        previousCtx.clearRect(0,0,ART_SIZE.width,ART_SIZE.height);
        previousCtx.drawImage(composed,0,0);
      }
      const pose=transition.pose;
      cat.presentPose(pose);
      const frame=pose === 'idle' ? cat.frame : cat.expressionFrame;
      const hairAngle=Math.round(cat.hairAngle * (pose === 'idle' ? 1 : .2) / .002) * .002;
      const artKey=`${pose}/${frame}/${cat.channels.blink}/${cat.channels.talk}/${hairAngle}`;
      const changed=artKey !== lastArtKey;
      if (changed) {
        nextCtx.clearRect(0,0,ART_SIZE.width,ART_SIZE.height);
        drawCharacter(nextCtx,loader.ready.get(pose),frame,hairAngle,pose,cat.channels);
        lastArtKey=artKey;
      }
      const mix=transition.advance(dt);
      if (changed || mix < 1 || lastMix < 1) {
        composedCtx.clearRect(0,0,ART_SIZE.width,ART_SIZE.height);
        composedCtx.save();
        if (mix < 1) { composedCtx.globalAlpha=1-mix; composedCtx.drawImage(previous,0,0); }
        composedCtx.globalAlpha=mix;
        // Add premultiplied pixels so overlap stays opaque halfway through a fade.
        composedCtx.globalCompositeOperation='lighter'; composedCtx.drawImage(next,0,0); composedCtx.restore();
      }
      lastMix=mix;
      ctx.save();
      ctx.translate(transform.x,transform.y); ctx.rotate(transform.angle);
      ctx.drawImage(composed,-transform.width/2,-transform.height,transform.width,transform.height);
      ctx.restore();
      canvas.dataset.pose=pose;
      canvas.dataset.requestedPose=requested;
      canvas.dataset.expression=resolveExpression(pose,frame);
      canvas.dataset.transition=mix.toFixed(3);
      canvas.dataset.blink=String(cat.channels.blink);
      canvas.dataset.talk=String(cat.channels.talk);
      // the artwork is cropped at mid-thigh; fade that edge out instead of a hard cut
      const fadeH = transform.height * 0.1;
      const bottom = transform.y + 2;
      const fade = ctx.createLinearGradient(0, bottom - fadeH, 0, bottom);
      fade.addColorStop(0, 'rgba(0,0,0,0)');
      fade.addColorStop(1, 'rgba(0,0,0,1)');
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = fade;
      ctx.fillRect(transform.x - transform.width, bottom - fadeH, transform.width * 2, fadeH + 4);
      ctx.restore();
    }
    canvas.dataset.sprite = cat.frame;
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (p.age >= p.life) { particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      ctx.save();
      ctx.globalAlpha = Math.sin(Math.PI * p.age / p.life) * 0.75;
      ctx.fillStyle = p.kind === 'heart' ? '#e695b7' : '#b59bd8';
      ctx.font = `600 ${p.size}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText(p.kind === 'heart' ? '♥' : p.kind === 'z' ? 'z' : '✧', p.x, p.y);
      ctx.restore();
    }
  }

  return {
    resize, draw, spawn, burst, preload, loadPose,
    get width() { return width; },
    get height() { return height; },
    get loaded() { return [...loader.ready.keys()]; },
    get pose() { return transition.pose; },
    pointAt(point) { return projectPoint(point,transform); },
    async init() { await loadPose('idle'); complete=true; draw(0); },
    headTop() {
      const [x,y]=POSES[transition.pose].headTop;
      return projectPoint({x,y},transform);
    },
    zoneAt(point) {
      const uv = unprojectPoint(point, transform);
      if (uv.x < 0 || uv.x >= 1 || uv.y < 0 || uv.y >= 1) return null;
      const mask = masks.get(transition.pose);
      if (!mask || mask[(Math.floor(uv.y * maskHeight) * maskWidth + Math.floor(uv.x * maskWidth)) * 4 + 3] < 48) return null;
      return { zone: spriteZone(uv, transition.pose), side: uv.x < 0.5 ? -1 : 1 };
    },
  };
}
