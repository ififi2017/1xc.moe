import * as THREE from 'three';

// Character geometry is generated locally; the only download is a ~50 kB painted eye (with a procedural fallback).
export const HEAD_Y = 5.03;
export const NECK_Y = 4.43;
export const CHARACTER_HEIGHT = 6.08;
const smooth = (x) => { const t = THREE.MathUtils.clamp(x, 0, 1); return t * t * (3 - 2 * t); };

function canvasTexture(draw, size = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.scale(size, size);
  draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function path(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const p of points.slice(1)) p.length === 2 ? ctx.lineTo(...p) : ctx.bezierCurveTo(...p);
}

// The same UV layout is used by the painted eye and the procedural fallback.
// One illustration is mirrored at draw time, so every expression stays registered.
export const EYE_TEXTURE_URL = '/textures/catgirl-eye.webp';
export const FACE_EXPRESSIONS = ['open', 'happy', 'content', 'sleep', 'blink', 'bonk', 'surprise', 'sad'];
const EYE_ART_CROP = [0, 0, 724, 311]; // pre-cropped to the painted eye
// Eyes sized to the face reference sheet: about a quarter of the face width each.
const EYE_SCALE = 0.82;
const EYE_X = 0.2;

function eye(ctx, side, expression, artwork) {
  ctx.save();
  ctx.translate(0.5 + side * EYE_X, 0.575);
  ctx.scale(side * EYE_SCALE, EYE_SCALE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Quiet, nearly straight lilac brows. Their inner ends lift when she looks sad.
  const sad = expression === 'sad';
  ctx.strokeStyle = '#b893a4';
  ctx.lineWidth = 0.005;
  path(ctx, [[-0.125, sad ? -0.132 : -0.11], [-0.04, -0.126, 0.07, -0.119, 0.143, -0.089]]);
  ctx.stroke();
  ctx.strokeStyle = '#dac0c599'; ctx.lineWidth = 0.003;
  path(ctx, [[-0.109, -0.096], [-0.021, -0.11, 0.065, -0.108, 0.127, -0.086]]); ctx.stroke();

  if (['happy', 'content', 'sleep', 'blink'].includes(expression)) {
    const up = expression === 'happy' ? -0.053 : 0.033;
    ctx.strokeStyle = '#6a3e46'; ctx.lineWidth = 0.008;
    path(ctx, [[-0.142, 0.005], [-0.054, up, 0.057, up, 0.144, -0.014]]); ctx.stroke();
    ctx.lineWidth = 0.004;
    for (let i = 0; i < 3; i++) {
      const x = 0.09 + i * 0.024;
      path(ctx, [[x, -0.002], [x + 0.015, -0.005, x + 0.025, -0.014, x + 0.031, -0.025]]); ctx.stroke();
    }
    ctx.restore();
    return;
  }

  if (expression === 'bonk') ctx.rotate(-0.07);
  if (sad) ctx.rotate(0.04);
  const openness = expression === 'surprise' ? 1.2 : expression === 'bonk' ? 0.8 : sad ? 0.87 : 1;
  ctx.scale(1, openness);

  if (artwork) {
    // Transparent, painted lashes and iris; never a rectangular picture on the face.
    ctx.drawImage(artwork, ...EYE_ART_CROP, -0.161, -0.103, 0.371, 0.19);
    ctx.restore();
    return;
  }

  // Offline/loading fallback follows the same low upper lid and warm oval pupil.
  const almond = () => path(ctx, [[-0.15, 0.012], [-0.072, -0.064, 0.059, -0.068, 0.15, -0.014], [0.103, 0.051, -0.049, 0.066, -0.15, 0.012]]);
  almond();
  const white = ctx.createLinearGradient(0, -0.06, 0, 0.06);
  white.addColorStop(0, '#ba919f'); white.addColorStop(0.55, '#fff2e8'); white.addColorStop(1, '#fff7e9');
  ctx.fillStyle = white; ctx.fill();
  ctx.save(); ctx.clip();
  const iris = ctx.createLinearGradient(0, -0.08, 0, 0.074);
  iris.addColorStop(0, '#392334'); iris.addColorStop(0.3, '#553346'); iris.addColorStop(0.55, '#a36336');
  iris.addColorStop(0.78, '#db9e4e'); iris.addColorStop(1, '#ffe1a0');
  ctx.fillStyle = iris;
  ctx.beginPath(); ctx.ellipse(-0.005, -0.001, 0.08, 0.078, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#754432'; ctx.lineWidth = 0.0035; ctx.stroke();
  for (let i = 0; i < 64; i++) {
    const a = i * Math.PI * 2 / 64, r = 0.04 + Math.sin(i * 7.3) * 0.008;
    ctx.strokeStyle = i % 3 ? '#e8ae6390' : '#713a3550'; ctx.lineWidth = 0.0015;
    path(ctx, [[-0.005 + Math.sin(a) * r, Math.cos(a) * r], [-0.005 + Math.sin(a) * 0.074, Math.cos(a) * 0.073]]); ctx.stroke();
  }
  ctx.fillStyle = '#c28a41'; ctx.beginPath(); ctx.ellipse(-0.005, -0.002, 0.029, 0.037, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#51302c'; ctx.beginPath(); ctx.ellipse(-0.005, -0.005, 0.023, 0.031, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff4d8';
  for (const [x, y, rx, ry] of [[-0.033, -0.045, 0.016, 0.011], [0.044, 0.026, 0.013, 0.006], [-0.04, 0.042, 0.007, 0.004]]) {
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, -0.3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = '#56323b'; ctx.lineWidth = 0.011;
  path(ctx, [[-0.15, 0.012], [-0.072, -0.064, 0.059, -0.068, 0.15, -0.014]]); ctx.stroke();
  ctx.strokeStyle = '#af7c7b'; ctx.lineWidth = 0.0025;
  path(ctx, [[-0.12, 0.041], [-0.04, 0.061, 0.09, 0.05, 0.13, 0.012]]); ctx.stroke();
  ctx.strokeStyle = '#56323b';
  for (let i = 0; i < 7; i++) {
    const x = 0.047 + i * 0.017, y = -0.043 + i * i * 0.0009;
    ctx.lineWidth = 0.0024 + (i % 3) * 0.001;
    path(ctx, [[x - 0.02, y + 0.005], [x + 0.006, y, x + 0.027, y - 0.017, x + 0.037, y - 0.035]]); ctx.stroke();
  }
  ctx.restore();
}

export function makeFaceMaps(artwork = null) {
  return Object.fromEntries(FACE_EXPRESSIONS.map((expression) => [expression, canvasTexture((ctx) => {
    ctx.fillStyle = '#ffe0d5'; ctx.fillRect(0, 0, 1, 1);
    const skin = ctx.createRadialGradient(0.5, 0.52, 0.03, 0.5, 0.53, 0.56);
    skin.addColorStop(0, '#ffebe0'); skin.addColorStop(0.6, '#ffe3da'); skin.addColorStop(1, '#eeb6bb');
    ctx.fillStyle = skin; ctx.fillRect(0, 0, 1, 1);
    for (const side of [-1, 1]) {
      ctx.save(); ctx.translate(0.5 + side * 0.247, 0.659); ctx.scale(1, 0.62);
      const blush = ctx.createRadialGradient(0, 0, 0.005, 0, 0, 0.173);
      blush.addColorStop(0, expression === 'content' ? '#f0828fbb' : '#ee8794a6'); blush.addColorStop(0.55, '#ee95a65c'); blush.addColorStop(1, '#ee9aaa00');
      ctx.fillStyle = blush; ctx.fillRect(-0.19, -0.19, 0.38, 0.38); ctx.restore();
      ctx.strokeStyle = '#ce78864d'; ctx.lineWidth = 0.0013;
      for (let i = 0; i < 9; i++) {
        const x = 0.5 + side * 0.248 + (i - 4) * 0.0105;
        const y = 0.657 + Math.sin(i * 1.3) * 0.006;
        path(ctx, [[x, y - 0.006], [x - 0.008, y + 0.012]]); ctx.stroke();
      }
      eye(ctx, side, expression, artwork);
    }
    // Small painted nose highlight and a restrained lip line, as in the sheet.
    const nose = ctx.createRadialGradient(0.502, 0.675, 0, 0.502, 0.675, 0.029);
    nose.addColorStop(0, '#e98e8e55'); nose.addColorStop(1, '#e98e8e00');
    ctx.fillStyle = nose; ctx.fillRect(0.47, 0.643, 0.065, 0.067);
    ctx.fillStyle = '#fff9ea';
    path(ctx, [[0.495, 0.652], [0.5, 0.644], [0.51, 0.651], [0.504, 0.658]]); ctx.fill();
    ctx.strokeStyle = '#c88a87'; ctx.lineWidth = 0.002;
    path(ctx, [[0.503, 0.676], [0.505, 0.681]]); ctx.stroke();
    ctx.lineCap = 'round';
    if (expression === 'happy' || expression === 'surprise') {
      ctx.fillStyle = '#91515c';
      ctx.beginPath(); ctx.ellipse(0.5, 0.756, expression === 'happy' ? 0.039 : 0.023, expression === 'happy' ? 0.028 : 0.022, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6a0a4'; ctx.beginPath(); ctx.ellipse(0.5, 0.77, 0.024, 0.011, 0, 0, Math.PI * 2); ctx.fill();
      if (expression === 'happy') { ctx.fillStyle = '#fff4e9'; ctx.fillRect(0.471, 0.733, 0.058, 0.009); }
    } else {
      const frown = expression === 'sad' || expression === 'bonk';
      const lip = ctx.createRadialGradient(0.5, 0.767, 0.002, 0.5, 0.767, 0.048);
      lip.addColorStop(0, '#d889974d'); lip.addColorStop(1, '#e9a2a900');
      ctx.save(); ctx.translate(0.5, 0.768); ctx.scale(1, 0.34); ctx.translate(-0.5, -0.768);
      ctx.fillStyle = lip; ctx.fillRect(0.45, 0.717, 0.1, 0.1); ctx.restore();
      ctx.strokeStyle = '#a45c65'; ctx.lineWidth = 0.003;
      path(ctx, [[0.451, 0.753], [0.474, frown ? 0.739 : 0.757, 0.484, 0.754, 0.5, 0.754], [0.519, 0.759, 0.531, 0.751, 0.55, 0.749]]); ctx.stroke();
      ctx.strokeStyle = '#fff2e7'; ctx.lineWidth = 0.0025;
      path(ctx, [[0.484, 0.772], [0.514, 0.771]]); ctx.stroke();
    }
  })]));
}

function knitTexture() {
  return canvasTexture((ctx) => {
    ctx.fillStyle = '#9e9e9e'; ctx.fillRect(0, 0, 1, 1);
    ctx.lineCap = 'round';
    // Seamless rows of tiny V-shaped yarn loops; used as a bump map, not painted stripes.
    for (let y = -1; y <= 32; y++) for (let x = -1; x <= 32; x++) {
      const px = x / 32, py = y / 32;
      ctx.strokeStyle = '#6b6b6b'; ctx.lineWidth = 0.011;
      path(ctx, [[px - 0.013, py - 0.014], [px, py + 0.012], [px + 0.013, py - 0.014]]); ctx.stroke();
      ctx.strokeStyle = '#d4d4d4'; ctx.lineWidth = 0.005;
      path(ctx, [[px - 0.011, py - 0.014], [px, py + 0.007], [px + 0.011, py - 0.014]]); ctx.stroke();
    }
  }, 512);
}

export function makeMaterials() {
  const fabric = knitTexture();
  fabric.colorSpace = THREE.NoColorSpace;
  fabric.wrapS = fabric.wrapT = THREE.RepeatWrapping;
  fabric.repeat.set(3, 3);
  const soft = (color, roughness = 0.65, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness, ...extra });
  return {
    skin: soft('#ffe8dc', 0.72),
    hair: soft('#ffffff', 0.46, { vertexColors: true, sheen: 0.45, sheenColor: new THREE.Color('#f7e7fa') }),
    hairLine: soft('#cdbbda', 0.7),
    fluff: soft('#fff5f1', 0.83, { sheen: 0.8, sheenColor: new THREE.Color('#efdfee') }),
    earInner: soft('#eaa9b5', 0.83),
    knit: soft('#fff0e3', 0.91, { bumpMap: fabric, bumpScale: 0.014, sheen: 0.65 }),
    knitRib: soft('#f4e3d9', 0.9, { bumpMap: fabric, bumpScale: 0.009, sheen: 0.5 }),
    cable: soft('#f3e0d6', 0.94),
    dress: soft('#e7cedf', 0.75, { sheen: 0.7, sheenColor: new THREE.Color('#fff0f5') }),
    lace: soft('#fff0f2', 0.81),
    ribbon: soft('#cbaacb', 0.57, { sheen: 0.6 }),
    gold: soft('#e5b366', 0.28, { metalness: 0.78 }),
    leather: soft('#382934', 0.75),
    ink: soft('#65414b', 0.85),
    pink: soft('#dfa4b8', 0.89),
  };
}

// Parametric grid with outward-facing triangles and stable UVs for all custom surfaces.
export function surface(uSteps, vSteps, sample) {
  const positions = [], uvs = [], indices = [];
  for (let j = 0; j <= vSteps; j++) for (let i = 0; i <= uSteps; i++) {
    positions.push(...sample(i / uSteps, j / vSteps));
    uvs.push(i / uSteps, 1 - j / vSteps);
  }
  for (let j = 0; j < vSteps; j++) for (let i = 0; i < uSteps; i++) {
    const a = j * (uSteps + 1) + i, b = a + uSteps + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices); geo.computeVertexNormals();
  return geo;
}

export function faceGeometry() {
  const geo = surface(96, 64, (u, v) => {
    const a = u * Math.PI * 2, t = v * Math.PI;
    const rawY = Math.cos(t) * 0.59;
    const y = rawY < 0 ? rawY * 0.75 : rawY;
    const jaw = 0.7 + 0.3 * smooth((y + 0.5) / 0.46);
    const x = Math.sin(a) * Math.sin(t) * 0.47 * jaw;
    let z = Math.cos(a) * Math.sin(t) * 0.405;
    if (z > 0) {
      // A small nose bridge and pointed anime nose integrated into the surface.
      z += Math.exp(-((x / 0.06) ** 2) - (((y + 0.15) / 0.1) ** 2)) * 0.028;
      z += Math.exp(-((x / 0.13) ** 2) - (((y + 0.35) / 0.11) ** 2)) * 0.023;
    }
    return [x, y, z];
  });
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 0.94 + 0.5, p.getY(i) / 1.18 + 0.5);
  return geo;
}

export function colorHair(geo) {
  const top = new THREE.Color('#fff6ef'), mid = new THREE.Color('#eaddf0'), end = new THREE.Color('#aa88c1');
  const p = geo.attributes.position, colors = [], c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    c.copy(end).lerp(mid, smooth((y - 4.3) / 0.65)).lerp(top, smooth((y - 4.93) / 0.67));
    const strand = 0.95 + Math.cos(geo.attributes.uv.getX(i) * Math.PI * 12) * 0.05; // visible strands
    c.multiplyScalar(strand); colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geo;
}

export function hairLock(points, width, depth = 0.04, normal = [0, 0, 1]) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const outward = new THREE.Vector3(...normal).normalize();
  const tangent = new THREE.Vector3(), across = new THREE.Vector3(), n = new THREE.Vector3();
  return colorHair(surface(12, 32, (u, v) => {
    const p = curve.getPoint(v);
    curve.getTangent(v, tangent);
    across.crossVectors(tangent, outward).normalize();
    n.crossVectors(across, tangent).normalize();
    const taper = Math.max(0.006, Math.sin(Math.PI * (0.17 + v * 0.83)) ** 0.72);
    const a = u * Math.PI * 2;
    return p.addScaledVector(across, Math.cos(a) * width * taper)
      .addScaledVector(n, Math.sin(a) * depth * taper).toArray();
  }));
}

export function tube(points, radius = 0.01, steps = 40, radial = 6) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), steps, radius, radial, false);
}

// Profiles go from the bottom to the top; x/z radii make cloth elliptical rather than cylindrical.
export function loft(profiles, { folds = 0, amplitude = 0, segments = 64, rows = 40, phase = 0 } = {}) {
  const curve = new THREE.CatmullRomCurve3(profiles.map(([y, x, z]) => new THREE.Vector3(x, y, z)));
  return surface(segments, rows, (u, v) => {
    const p = curve.getPoint(1 - v), a = u * Math.PI * 2;
    const wave = 1 + Math.cos(a * folds + v * phase) * amplitude * (0.3 + 0.7 * Math.sin(v * Math.PI));
    return [Math.sin(a) * p.x * wave, p.y, Math.cos(a) * p.z * wave];
  });
}

export function earGeometry(inner = false) {
  const shape = new THREE.Shape();
  shape.moveTo(-0.23, 0);
  shape.quadraticCurveTo(-0.28, 0.23, -0.26, 0.55);
  shape.quadraticCurveTo(-0.09, 0.5, 0.24, 0.04);
  shape.quadraticCurveTo(0, -0.07, -0.23, 0);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: inner ? 0.009 : 0.11, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: inner ? 0.015 : 0.04, bevelThickness: inner ? 0.008 : 0.055, curveSegments: 20 });
  const position = geo.attributes.position;
  for (let i = 0; i < position.count; i++) {
    position.setZ(i, position.getZ(i) * (1 - 0.72 * smooth(position.getY(i) / 0.57)));
  }
  if (inner) {
    geo.scale(0.69, 0.72, 1);
    for (let i = 0; i < position.count; i++) {
      const outerDepth = 0.165 * (1 - 0.72 * smooth((position.getY(i) + 0.055) / 0.57));
      position.setZ(i, position.getZ(i) + outerDepth + 0.008 - 0.172);
    }
  }
  geo.computeVertexNormals();
  return geo;
}
