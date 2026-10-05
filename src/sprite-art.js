// Source artwork is registered on a 1024 × 1536 canvas. Facial decals live in
// a single 3 × 4 atlas; these coordinates place them beneath the foreground hair.
export const ART_SIZE = { width: 1024, height: 1536 };
export const LAYERS = ['character_base', 'face_atlas', 'hair_front'];
export const FACE_FRAMES = {
  idle_smile: 0, idle_blink: 1, idle_talk: 2,
  idle_happy: 3, idle_content: 4, idle_sleep: 5,
  idle_pout: 6, idle_surprised: 7, idle_sulky: 8,
  idle_coax: 9, idle_wink: 10, idle_shy: 11,
};
export const FACE_RECT = { x: 313, y: 247, width: 322, height: 242 };

export function faceCell(frame, width, height) {
  const index = FACE_FRAMES[frame] ?? 0;
  return { x: (index % 3) * width / 3, y: Math.floor(index / 3) * height / 4, width: width / 3, height: height / 4 };
}

export function faceParts(frame) {
  const eyes = ['idle_talk', 'idle_coax', 'idle_shy', 'idle_wink', 'idle_surprised'].includes(frame) ? 'idle_smile'
    : ['idle_sleep', 'idle_content'].includes(frame) ? 'idle_blink' : frame;
  const mouth = ['idle_blink', 'idle_coax', 'idle_wink', 'idle_shy', 'idle_content'].includes(frame) ? 'idle_smile'
    : frame === 'idle_surprised' ? 'idle_sleep' : frame;
  return { eyes, mouth };
}

function drawFace(ctx, atlas, frame) {
  const parts = faceParts(frame);
  const content = frame === 'idle_content', shy = frame === 'idle_shy', coax = frame === 'idle_coax';
  const surprised = frame === 'idle_surprised', sleeping = frame === 'idle_sleep';
  const mouthScale = frame === 'idle_talk' ? 0.58 : sleeping ? 0.56 : surprised ? 0.8 : 1;
  const blush = shy ? 0.23 : coax ? 0.10 : content ? 0.14 : 0;
  ctx.save();
  ctx.translate(FACE_RECT.x, FACE_RECT.y);
  ctx.scale(FACE_RECT.width / 418, FACE_RECT.height / 313.5);

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
      ctx.translate(235, 266); ctx.scale(mouthScale, mouthScale); ctx.translate(-235, -266);
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
    ctx.beginPath();
    if (island === 'leftBrow') ctx.rect(25, 60, 187, 73);
    else if (island === 'rightBrow') ctx.rect(224, 24, 180, 71);
    else if (island === 'leftEye') {
      ctx.moveTo(34, 175);
      ctx.bezierCurveTo(66, 132, 165, 120, 204, 155);
      ctx.bezierCurveTo(202, 192, 127, 219, 75, 216);
      ctx.closePath();
    } else if (island === 'rightEye') {
      ctx.moveTo(222, 136);
      ctx.bezierCurveTo(247, 94, 341, 78, 400, 114);
      ctx.bezierCurveTo(388, 157, 311, 183, 265, 179);
      ctx.closePath();
    } else ctx.rect(196, 237, 96, 74);
    ctx.clip();
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

export function drawCharacter(ctx, layers, frame, hairAngle = 0) {
  ctx.drawImage(layers.get('character_base'), 0, 0, ART_SIZE.width, ART_SIZE.height);
  const atlas = layers.get('face_atlas');
  drawFace(ctx, atlas, frame);

  ctx.save();
  // The crown is anchored; the ends of the fringe can sway over the eyes.
  ctx.translate(450, 145);
  ctx.rotate(hairAngle);
  ctx.translate(-450, -145);
  ctx.beginPath();
  ctx.moveTo(302, 204);
  ctx.bezierCurveTo(318, 127, 409, 109, 478, 129);
  ctx.bezierCurveTo(556, 130, 609, 212, 638, 304);
  ctx.lineTo(617, 341);
  ctx.bezierCurveTo(589, 337, 564, 318, 542, 298);
  ctx.bezierCurveTo(535, 332, 521, 366, 491, 392);
  ctx.bezierCurveTo(480, 401, 463, 408, 451, 405);
  ctx.bezierCurveTo(473, 399, 476, 387, 466, 382);
  ctx.bezierCurveTo(439, 375, 416, 343, 397, 308);
  ctx.bezierCurveTo(383, 331, 367, 349, 350, 358);
  ctx.bezierCurveTo(328, 323, 310, 271, 302, 204);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(layers.get('hair_front'), 0, 0, ART_SIZE.width, ART_SIZE.height);
  ctx.restore();
}
