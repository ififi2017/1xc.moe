import { fitSprite, projectPoint, unprojectPoint, spriteZone } from './sprite-character.js';
import { ART_SIZE, LAYERS, drawCharacter } from './sprite-art.js';

export function createSpriteStage(canvas, cat, { reduceMotion = false } = {}) {
  const ctx = canvas.getContext('2d');
  const images = new Map();
  let alphaMask;
  const particles = [];
  const maskWidth = 128, maskHeight = 192;
  let width = 1, height = 1;
  let rect = fitSprite(1, 0, 1);
  let transform = cat.transform(rect);
  let complete = false;

  async function load(name) {
    if (images.has(name)) return;
    const img = new Image();
    img.decoding = 'async';
    img.src = `/sprites/layers/${name}.webp`;
    await img.decode();
    images.set(name, img);
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
      ctx.save();
      ctx.translate(transform.x, transform.y);
      ctx.rotate(transform.angle);
      ctx.translate(-transform.width / 2, -transform.height);
      ctx.scale(transform.width / ART_SIZE.width, transform.height / ART_SIZE.height);
      drawCharacter(ctx, images, cat.frame, cat.hairAngle);
      ctx.restore();
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
    resize, draw, spawn, burst,
    get width() { return width; },
    get height() { return height; },
    get loaded() { return [...images.keys()]; },
    async init() {
      await Promise.all(LAYERS.map(load));
      const mask = document.createElement('canvas');
      mask.width = maskWidth;
      mask.height = maskHeight;
      const maskCtx = mask.getContext('2d', { willReadFrequently: true });
      maskCtx.drawImage(images.get('character_base'), 0, 0, maskWidth, maskHeight);
      alphaMask = maskCtx.getImageData(0, 0, maskWidth, maskHeight).data;
      complete = true;
      draw(0);
    },
    headTop() { return projectPoint({ x: 0.48, y: 0.045 }, transform); },
    zoneAt(point) {
      const uv = unprojectPoint(point, transform);
      if (uv.x < 0 || uv.x >= 1 || uv.y < 0 || uv.y >= 1) return null;
      const mask = alphaMask;
      if (!mask || mask[(Math.floor(uv.y * maskHeight) * maskWidth + Math.floor(uv.x * maskWidth)) * 4 + 3] < 48) return null;
      return { zone: spriteZone(uv), side: uv.x < 0.5 ? -1 : 1 };
    },
  };
}
