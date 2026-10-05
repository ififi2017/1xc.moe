import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { sphereGeo, sphereHiGeo } from './shapes.js';
import { HEAD_Y, NECK_Y, makeMaterials, makeFaceMaps, faceGeometry, colorHair, surface, hairLock, loft, tube, earGeometry } from './character-assets.js';

export function buildCharacter(cat) {
  const { body, head } = cat;
  const m = makeMaterials();
  const add = (parent, geometry, material, zone = 'body', position, scale) => {
    const mesh = new THREE.Mesh(geometry, material);
    if (position) mesh.position.set(...position);
    if (scale) mesh.scale.set(...scale);
    mesh.userData.zone = zone;
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    cat.hit.push(mesh);
    return mesh;
  };
  const line = (parent, points, material, radius = 0.008, zone = 'body') => add(parent, tube(points, radius), material, zone);
  const orb = (parent, material, position, scale, zone = 'body') => add(parent, sphereGeo, material, zone, position, scale);

  function bow(parent, position, size = 1, zone = 'body') {
    const g = new THREE.Group(); g.position.set(...position); g.scale.setScalar(size); parent.add(g);
    for (const side of [-1, 1]) {
      const loop = new THREE.Shape();
      loop.moveTo(0, 0); loop.bezierCurveTo(side * 0.13, 0.14, side * 0.24, 0.12, side * 0.21, -0.01);
      loop.bezierCurveTo(side * 0.18, -0.09, side * 0.08, -0.07, 0, 0);
      add(g, new THREE.ExtrudeGeometry(loop, { depth: 0.025, bevelEnabled: true, bevelSize: 0.009, bevelThickness: 0.012, bevelSegments: 2, curveSegments: 12 }), m.ribbon, zone);
      const tail = new THREE.Shape(); tail.moveTo(side * 0.018, -0.015); tail.lineTo(side * 0.06, -0.22);
      tail.lineTo(side * 0.115, -0.19); tail.lineTo(side * 0.15, -0.205); tail.lineTo(side * 0.085, -0.012);
      add(g, new THREE.ExtrudeGeometry(tail, { depth: 0.017, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.005, bevelSegments: 2 }), m.ribbon, zone);
      line(g, [[0, 0, 0.045], [side * 0.075, 0.025, 0.051], [side * 0.17, 0.026, 0.037]], m.dress, 0.004, zone);
    }
    orb(g, m.ribbon, [0, 0, 0.028], [0.037, 0.053, 0.043], zone);
    return g;
  }

  function bell(parent, position, size = 1) {
    const g = new THREE.Group(); g.position.set(...position); g.scale.setScalar(size); parent.add(g);
    const b = orb(g, m.gold, [0, 0, 0], [0.088, 0.092, 0.084], 'bell');
    add(g, new THREE.TorusGeometry(0.083, 0.006, 6, 32), m.gold, 'bell', [0, 0, 0]).rotation.x = Math.PI / 2;
    add(g, new THREE.TorusGeometry(0.021, 0.008, 6, 20), m.gold, 'bell', [0, 0.11, 0]);
    line(g, [[0, -0.013, 0.084], [0, -0.035, 0.08], [0, -0.066, 0.058]], m.leather, 0.007, 'bell');
    orb(g, m.leather, [0, -0.012, 0.085], [0.02, 0.015, 0.004], 'bell');
    return b;
  }

  function paw(parent, position, size = 1, zone = 'body') {
    const g = new THREE.Group(); g.position.set(...position); g.scale.setScalar(size); parent.add(g);
    orb(g, m.pink, [0, -0.035, 0], [0.072, 0.059, 0.008], zone);
    for (const [x, y, a] of [[-0.083, 0.023, -0.5], [-0.032, 0.083, -0.16], [0.038, 0.08, 0.2], [0.085, 0.019, 0.5]]) {
      orb(g, m.pink, [x, y, 0], [0.03, 0.04, 0.008], zone).rotation.z = a;
    }
    return g;
  }

  // Sculpted continuous face; eyes, blush and lips share its curved surface.
  cat.faceMaps = makeFaceMaps();
  cat.faceMaterial = new THREE.MeshPhysicalMaterial({ map: cat.faceMaps.open, roughness: 0.78, emissive: '#ffffff', emissiveMap: cat.faceMaps.open, emissiveIntensity: 0.22 });
  cat.headMesh = add(head, faceGeometry(), cat.faceMaterial, 'head', [0, HEAD_Y, 0]);
  cat.headMesh.receiveShadow = false;

  // The scalp follows the skull. Individual swept locks cover the edge and form the bob silhouette.
  const scalp = surface(80, 40, (u, v) => {
    const a = u * Math.PI * 2;
    const back = (1 - Math.cos(a)) / 2;
    const theta = v * (1.33 + back * 1.12);
    return [Math.sin(a) * Math.sin(theta) * 0.515, HEAD_Y + Math.cos(theta) * 0.645, Math.cos(a) * Math.sin(theta) * 0.443 - 0.025];
  });
  add(head, colorHair(scalp), m.hair, 'head');
  // A complete back and side shell of tapered locks, with a second shorter layer.
  for (let layer = 0; layer < 2; layer++) {
    const count = layer ? 18 : 22;
    for (let i = 0; i < count; i++) {
      const a = 0.95 + i / (count - 1) * (Math.PI * 2 - 1.9);
      const sx = Math.sin(a), sz = Math.cos(a);
      const wiggle = Math.sin(i * 2.7 + layer) * 0.045;
      const endY = (layer ? 4.58 : 4.3) + Math.cos(i * 2.2) * 0.06;
      const points = [
        [sx * 0.23, 5.59 - layer * 0.025, sz * 0.23 - 0.025],
        [sx * (0.49 + layer * 0.027), 5.28, sz * (0.46 + layer * 0.035) - 0.035],
        [sx * (0.52 + layer * 0.035), 4.93, sz * (0.46 + layer * 0.04) - 0.028],
        [sx * (0.56 + wiggle + layer * 0.04), endY + 0.16, sz * (0.45 + layer * 0.04) - 0.04],
        [sx * (0.68 + wiggle * 1.6 + layer * 0.02), endY, sz * (0.47 + layer * 0.04) + 0.016],
      ];
      add(head, hairLock(points, layer ? 0.075 : 0.084, 0.031, [sx, 0, sz]), m.hair, 'head');
    }
  }
  // Swept, uneven fringe. Tips frame the eyes rather than forming a row of beads.
  const fringes = [
    [[-0.045, 5.66, 0.09], [-0.23, 5.5, 0.35], [-0.25, 5.24, 0.43], [-0.33, 5.06, 0.36]],
    [[-0.04, 5.67, 0.12], [-0.12, 5.49, 0.435], [-0.11, 5.2, 0.466], [-0.025, 4.98, 0.44]],
    [[0.00, 5.66, 0.09], [0.13, 5.48, 0.43], [0.22, 5.25, 0.44], [0.27, 5.10, 0.383]],
    [[0.04, 5.64, 0.065], [0.29, 5.43, 0.35], [0.39, 5.15, 0.305], [0.46, 4.99, 0.22]],
    [[-0.1, 5.61, 0.07], [-0.38, 5.36, 0.285], [-0.43, 5.04, 0.27], [-0.4, 4.82, 0.25]],
  ];
  fringes.forEach((points, i) => add(head, hairLock(points, [0.11, 0.137, 0.128, 0.095, 0.08][i], 0.036), m.hair, 'head'));
  // the thin lock that falls between her eyes in the face sheet
  add(head, hairLock([[0.02, 5.6, 0.2], [0.05, 5.4, 0.45], [0.03, 5.13, 0.475], [0.0, 4.94, 0.452]], 0.05, 0.022), m.hair, 'head');
  // messy, outward-flicking lilac ends that give the bob its volume
  for (let i = 0; i < 24; i++) {
    const a = 1.15 + i / 23 * (Math.PI * 2 - 2.3);
    const sx = Math.sin(a), sz = Math.cos(a);
    const r = 0.6 + Math.sin(i * 1.7) * 0.03, y = 4.5 + Math.cos(i * 2.9) * 0.07;
    add(head, hairLock([
      [sx * (r - 0.06), y + 0.32, sz * (r - 0.14) - 0.03],
      [sx * r, y + 0.08, sz * (r - 0.1) - 0.02],
      [sx * (r + 0.12), y - 0.08, sz * (r - 0.06)],
      [sx * (r + 0.2), y - 0.02 + Math.sin(i) * 0.04, sz * (r - 0.03) + 0.02],
    ], 0.06, 0.024, [sx, 0, sz]), m.hair, 'head');
  }
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x = side * (0.43 + i * 0.026);
      add(head, hairLock([[x * 0.85, 5.44 - i * 0.08, 0.26 - i * 0.025], [x, 5.03, 0.3 - i * 0.035], [side * (0.43 + i * 0.04), 4.62, 0.25 - i * 0.035], [side * (0.31 + i * 0.11), 4.48 - i * 0.035, 0.32 - i * 0.05]], 0.067, 0.028), m.hair, 'head');
    }
  }

  cat.ahogeG = new THREE.Group(); head.add(cat.ahogeG);
  add(cat.ahogeG, hairLock([[0, 5.63, 0], [-0.13, 5.84, 0], [-0.08, 6.01, 0], [0.095, 6.0, 0.01], [0.13, 5.9, 0.01]], 0.035, 0.018), m.hair, 'head');

  cat.ears = [-1, 1].map((side) => {
    const g = new THREE.Group(); g.position.set(side * 0.35, 5.49, -0.055); g.scale.setScalar(0.78); head.add(g);
    const outer = add(g, earGeometry(), m.fluff, 'ear'); outer.scale.x = -side;
    const inner = add(g, earGeometry(true), m.earInner, 'ear', [-side * 0.022, 0.055, 0.172]); inner.scale.x = -side;
    for (let i = 0; i < 5; i++) {
      const tuft = add(g, new THREE.ConeGeometry(0.046, 0.145, 12), m.fluff, 'ear', [side * (0.12 - i * 0.037), 0.055 + i * 0.028, 0.19], [1, 1, 0.48]);
      tuft.rotation.z = side * (0.65 - i * 0.12);
    }
    g.traverse((obj) => { obj.userData.side = side; });
    return g;
  });
  const clip = new THREE.Group(); clip.position.set(0.38, 5.23, 0.348); clip.rotation.set(0, 0.6, -0.16); head.add(clip);
  orb(clip, m.gold, [0, 0, -0.01], [0.089, 0.091, 0.019], 'head');
  orb(clip, m.lace, [0, 0, 0], [0.082, 0.084, 0.019], 'head');
  paw(clip, [0, 0, 0.024], 0.63, 'head');

  // Pivot the entire head at the neck without changing any authored body-space coordinates.
  head.position.y = NECK_Y;
  for (const child of head.children) child.position.y -= NECK_Y;

  // Torso and neck, dressed in an opaque camisole with a fluted hem.
  add(body, loft([[3.35, 0.35, 0.23], [3.92, 0.43, 0.25], [4.16, 0.49, 0.23], [4.28, 0.35, 0.19], [4.4, 0.143, 0.135], [4.65, 0.139, 0.13]]), m.skin);
  add(body, loft([[2.63, 0.62, 0.39], [2.78, 0.59, 0.37], [3.1, 0.48, 0.31], [3.46, 0.365, 0.262], [3.87, 0.433, 0.28], [4.0, 0.434, 0.261]], { folds: 20, amplitude: 0.035 }), m.dress);
  // A closed underskirt keeps the outfit opaque from below and during jumps.
  add(body, new THREE.CircleGeometry(0.6, 64), m.dress, 'body', [0, 2.65, 0], [1, 0.64, 1]).rotation.x = Math.PI / 2;
  for (let tier = 0; tier < 2; tier++) {
    add(body, surface(128, 10, (u, v) => {
      const a = u * Math.PI * 2, wave = Math.cos(a * 24);
      const r = 0.56 + v * 0.095 + wave * 0.019 * v + tier * 0.02;
      return [Math.sin(a) * r, 2.81 - tier * 0.14 - v * 0.17 + wave * 0.021 * v, Math.cos(a) * r * 0.63];
    }), tier ? m.lace : m.dress);
  }
  const neckline = [];
  for (let i = 0; i <= 100; i++) {
    const a = i / 100 * Math.PI * 2;
    neckline.push([Math.sin(a) * 0.436, 4.0 + Math.sin(a * 24) * 0.02, Math.cos(a) * 0.269]);
  }
  line(body, neckline, m.lace, 0.026);
  bow(body, [0, 3.9, 0.295], 0.6);
  for (const side of [-1, 1]) {
    line(body, [[side * 0.295, 3.97, 0.237], [side * 0.327, 4.23, 0.165], [side * 0.31, 4.28, -0.02], [side * 0.29, 4.02, -0.234]], m.ribbon, 0.015);
  }

  // Open cardigan panels with knitted cables. Front opening reveals the camisole.
  const coatProfile = new THREE.CatmullRomCurve3([[0.65, 2.74, 0.4], [0.59, 3.01, 0.37], [0.47, 3.5, 0.32], [0.49, 3.97, 0.28]].map((p) => new THREE.Vector3(...p)));
  function coatPoint(u, v, lift = 0) {
    const p = coatProfile.getPoint(1 - v);
    const opening = 0.08 + 0.49 * (1 - THREE.MathUtils.smoothstep(v, 0.15, 0.9));
    const a = opening + u * (Math.PI * 2 - opening * 2);
    const fold = 1 + Math.sin(a * 12 + v * 2) * 0.018;
    return [Math.sin(a) * (p.x * fold + lift), p.y + Math.sin(a * 3) * 0.025 * v, Math.cos(a) * (p.z * fold + lift)];
  }
  add(body, surface(96, 40, (u, v) => coatPoint(u, v)), m.knit);
  for (const v of [0.02, 0.98]) {
    const points = Array.from({ length: 80 }, (_, i) => coatPoint(i / 79, v, 0.013));
    line(body, points, m.knitRib, v < 0.1 ? 0.072 : 0.04);
  }
  for (const edge of [0, 1]) line(body, Array.from({ length: 32 }, (_, i) => coatPoint(edge, i / 31, 0.011)), m.knitRib, 0.032);
  for (let col = 0; col < 16; col++) for (const phase of [0, Math.PI]) {
    const points = Array.from({ length: 64 }, (_, j) => {
      const v = 0.09 + j / 63 * 0.79;
      return coatPoint((col + 0.5) / 16 + Math.sin(v * Math.PI * 9 + phase) * 0.008, v, 0.012);
    });
    line(body, points, m.cable, 0.01);
  }
  // Side lacing and matching bows, visible in both three-quarter and rear views.
  for (const side of [-1, 1]) {
    for (let j = 0; j < 3; j++) {
      line(body, [[side * 0.57, 3.12 - j * 0.1, 0.23], [side * 0.635, 3.06 - j * 0.1, 0.23], [side * 0.605, 3.0 - j * 0.1, 0.24]], m.ribbon, 0.012);
    }
    bow(body, [side * 0.61, 2.78, 0.25], 0.42);
  }

  add(body, loft([[4.37, 0.149, 0.137], [4.46, 0.147, 0.137]]), m.leather);
  const buckle = add(body, new THREE.TorusGeometry(0.042, 0.008, 6, 4), m.gold, 'bell', [0, 4.415, 0.144]); buckle.rotation.z = Math.PI / 4;
  bell(body, [0, 4.26, 0.19], 0.85);

  // Slender legs, softly folded leg warmers and embroidered cat slippers.
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.x = side * 0.245; body.add(leg);
    const legMesh = add(leg, loft([[0.24, 0.102, 0.104], [0.86, 0.12, 0.13], [1.42, 0.145, 0.155], [1.74, 0.151, 0.157], [2.08, 0.194, 0.195], [2.63, 0.227, 0.22], [2.84, 0.2, 0.195]]), m.skin);
    legMesh.rotation.z = -side * 0.026;
    add(leg, loft([[0.17, 0.16, 0.16], [0.24, 0.192, 0.178], [0.37, 0.168, 0.16], [0.51, 0.186, 0.17], [0.68, 0.153, 0.146], [0.88, 0.165, 0.154], [1.12, 0.161, 0.159], [1.36, 0.161, 0.168], [1.42, 0.172, 0.174]], { folds: 14, amplitude: 0.035, phase: 3 }), m.knit);
    add(leg, loft([[1.31, 0.171, 0.177], [1.4, 0.178, 0.18], [1.44, 0.17, 0.176]], { folds: 32, amplitude: 0.018 }), m.knitRib);
    bow(leg, [side * 0.13, 1.37, 0.133], 0.36);
    bow(leg, [side * 0.135, 0.24, 0.132], 0.36);
    orb(leg, m.fluff, [0, 0.135, 0.12], [0.205, 0.15, 0.31]);
    for (const k of [-1, 1]) {
      const e = add(leg, new THREE.ConeGeometry(0.063, 0.13, 16), m.fluff, 'body', [k * 0.106, 0.28, 0.19], [1, 1, 0.5]); e.rotation.z = -k * 0.2;
      orb(leg, m.ink, [k * 0.073, 0.164, 0.408], [0.014, 0.019, 0.006]);
      line(leg, [[k * 0.107, 0.133, 0.392], [k * 0.158, 0.12, 0.356]], m.pink, 0.004);
    }
    orb(leg, m.pink, [0, 0.135, 0.42], [0.014, 0.01, 0.006]);
    line(leg, [[-0.03, 0.115, 0.414], [0, 0.106, 0.422], [0.03, 0.115, 0.414]], m.ink, 0.0035);
  }

  cat.arms = [-1, 1].map((side) => {
    const g = new THREE.Group(); g.position.set(side * 0.48, 4.15, 0); body.add(g);
    orb(g, m.skin, [0, -0.16, 0], [0.172, 0.26, 0.178]);
    add(g, loft([[-1.52, 0.19, 0.18], [-1.35, 0.26, 0.23], [-0.98, 0.255, 0.239], [-0.62, 0.216, 0.21], [-0.32, 0.201, 0.2], [-0.21, 0.214, 0.21]], { folds: 12, amplitude: 0.027, phase: 1.7 }), m.knit);
    add(g, loft([[-0.4, 0.229, 0.232], [-0.25, 0.23, 0.233], [-0.2, 0.219, 0.22]], { folds: 30, amplitude: 0.019 }), m.knitRib);
    add(g, loft([[-1.6, 0.17, 0.174], [-1.5, 0.195, 0.197], [-1.43, 0.19, 0.19]], { folds: 28, amplitude: 0.019 }), m.knitRib);
    for (const cx of [-0.11, 0, 0.11]) for (const phase of [0, Math.PI]) {
      const points = Array.from({ length: 45 }, (_, j) => {
        const t = j / 44, x = cx + Math.sin(t * Math.PI * 6 + phase) * 0.021;
        return [x, -0.46 - t * 0.79, Math.sqrt(Math.max(0.01, 0.224 ** 2 - x * x)) + 0.009];
      });
      line(g, points, m.cable, 0.01);
    }
    paw(g, [0, -1.3, 0.228], 0.9);
    orb(g, m.skin, [0, -1.66, 0.035], [0.11, 0.135, 0.079]);
    for (let i = 0; i < 4; i++) orb(g, m.skin, [(i - 1.5) * 0.044, -1.745 + Math.abs(i - 1.5) * 0.017, 0.061], [0.025, 0.061, 0.033]);
    orb(g, m.skin, [-side * 0.1, -1.65, 0.081], [0.041, 0.072, 0.04]).rotation.z = side * 0.35;
    return g;
  });

  // One deforming tube, with shared vertices along every ring: no segmented tail beads.
  cat.tailGeometry = new THREE.BufferGeometry();
  cat.tailSegments = 64; cat.tailRadial = 12;
  const positions = new Float32Array((cat.tailSegments + 1) * (cat.tailRadial + 1) * 3);
  const uv = [], indices = [];
  for (let i = 0; i <= cat.tailSegments; i++) for (let j = 0; j <= cat.tailRadial; j++) {
    uv.push(j / cat.tailRadial, i / cat.tailSegments);
    if (i < cat.tailSegments && j < cat.tailRadial) {
      const a = i * (cat.tailRadial + 1) + j, b = a + cat.tailRadial + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  cat.tailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  cat.tailGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); cat.tailGeometry.setIndex(indices);
  cat.tailMesh = add(body, cat.tailGeometry, m.fluff, 'tail');
  cat.tailMesh.frustumCulled = false;
  cat.tailBow = bow(body, [1.1, 3.65, -0.35], 0.67, 'tail');
  bell(cat.tailBow, [0, -0.24, 0], 0.66);

  // Batch static details within each animated joint. Keep material and hit-zone
  // boundaries, the facial mesh and the deforming tail intact.
  const parents = [];
  body.traverse((obj) => { if (obj.isGroup) parents.push(obj); });
  for (const parent of parents) {
    const batches = new Map();
    for (const mesh of parent.children) {
      if (!mesh.isMesh || mesh === cat.headMesh || mesh === cat.tailMesh) continue;
      const key = `${mesh.material.id}:${mesh.userData.zone}:${mesh.userData.side ?? 0}`;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(mesh);
    }
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const geometries = meshes.map((mesh) => {
        mesh.updateMatrix();
        const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrix);
        if (!geometry.index) geometry.setIndex(Array.from({ length: geometry.attributes.position.count }, (_, i) => i));
        // Mirrored ears need winding reversed when their transform is baked in.
        if (mesh.matrix.determinant() < 0) {
          const index = geometry.index;
          for (let i = 0; i < index.count; i += 3) {
            const a = index.getX(i); index.setX(i, index.getX(i + 2)); index.setX(i + 2, a);
          }
        }
        return geometry;
      });
      const merged = mergeGeometries(geometries);
      geometries.forEach((geometry) => geometry.dispose());
      if (!merged) continue;
      const replacement = add(parent, merged, meshes[0].material, meshes[0].userData.zone);
      replacement.userData.side = meshes[0].userData.side;
      for (const mesh of meshes) {
        parent.remove(mesh);
        const i = cat.hit.indexOf(mesh);
        if (i !== -1) cat.hit.splice(i, 1);
      }
    }
  }
}
