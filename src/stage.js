import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { sphereGeo, heartGeo, starGeo, fishGeo, zTexture, shadowTexture } from './shapes.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const easeOutBack = (x) => 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2;

export function createStage(canvas, { reduceMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;

  const key = new THREE.DirectionalLight(0xfff2e9, 2.1);
  key.position.set(-3, 8, 6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 7, bottom: -3, near: 0.5, far: 22 });
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 3;
  const rim = new THREE.DirectionalLight(0xd8c8ff, 1.1);
  rim.position.set(-5, 3, -4);
  const fill = new THREE.DirectionalLight(0xfff4f0, 1.5);
  fill.position.set(1, 4, 8);
  scene.add(key, rim, fill, new THREE.HemisphereLight(0xfff4fa, 0xe4d9ff, 0.75));

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ color: '#846879', opacity: 0.14 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0.005;
  ground.receiveShadow = true;
  scene.add(ground);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, toneMapped: false }));
  shadow.position.y = 0.002;
  shadow.renderOrder = -1;
  scene.add(shadow);

  /* floating hearts, stars & 小鱼干 in the background */
  const floatMats = ['#ffd3e2', '#cff3e2', '#e2d8ff', '#fff0bd', '#ffe2ee', '#d4ecff'].map((c) =>
    new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.5, sheen: 1, sheenColor: new THREE.Color('#fff') }));
  const floaters = [];
  for (let k = 0; k < (reduceMotion ? 10 : 30); k++) {
    const kind = k % 4;
    const geo = [sphereGeo, heartGeo, starGeo, fishGeo][kind];
    const m = new THREE.Mesh(geo, kind === 3 ? floatMats[5] : floatMats[k % 5]);
    m.scale.setScalar(kind === 0 ? rand(0.06, 0.14) : rand(0.8, 1.7));
    m.position.set(rand(-8, 8), rand(-2.5, 7), rand(-9, -2.5));
    m.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    floaters.push({ m, vy: rand(0.1, 0.28), rs: rand(-0.8, 0.8), ph: rand(0, 6.28) });
    scene.add(m);
  }

  /* particles */
  const pMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15 });
  const mats = {
    heart: ['#ff7aa2', '#ff9dbd', '#ff5e8c', '#ffb3cb'].map(pMat),
    star: ['#ffd36e', '#ffe7a0', '#c4b2ff', '#8fe3c0'].map(pMat),
  };
  const particles = [];

  function spawn(kind, pos, vel, { life = 1.3, size = 1, gravity = 5 } = {}) {
    if (particles.length > 260) return;
    let obj;
    if (kind === 'z') {
      obj = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTexture, transparent: true, depthWrite: false }));
    } else {
      obj = new THREE.Mesh(kind === 'heart' ? heartGeo : starGeo, pick(mats[kind]));
      obj.rotation.z = rand(-0.4, 0.4);
    }
    obj.position.copy(pos);
    obj.scale.setScalar(0.001);
    scene.add(obj);
    particles.push({ obj, kind, vel, life, size, gravity, age: 0, spin: new THREE.Vector3(rand(-1, 1), rand(-5, 5), rand(-2, 2)) });
  }

  function burst(pos, n = 7) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const sp = rand(1, 2.4);
      spawn(Math.random() < 0.6 ? 'heart' : 'star', pos,
        new THREE.Vector3(Math.cos(a) * sp, rand(3, 5.2), Math.sin(a) * sp * 0.5 + 0.8),
        { life: rand(1.0, 1.6), size: rand(0.8, 1.4) });
    }
  }

  function update(dt, t) {
    for (const f of floaters) {
      f.m.position.y += f.vy * dt;
      f.m.position.x += Math.sin(t * 0.6 + f.ph) * 0.12 * dt;
      f.m.rotation.y += f.rs * dt;
      f.m.rotation.x += f.rs * 0.5 * dt;
      if (f.m.position.y > 7.5) { f.m.position.y = -3; f.m.position.x = rand(-8, 8); }
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        scene.remove(p.obj);
        if (p.kind === 'z') p.obj.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.vel.multiplyScalar(1 - 1.4 * dt);
      p.obj.position.addScaledVector(p.vel, dt);
      if (p.kind === 'z') {
        p.obj.position.x += Math.sin(p.age * 3) * 0.15 * dt;
        p.obj.scale.setScalar(p.size * (0.4 + k * 0.8));
        p.obj.material.opacity = k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8;
        continue;
      }
      p.obj.rotation.x += p.spin.x * dt;
      p.obj.rotation.y += p.spin.y * dt;
      p.obj.rotation.z += p.spin.z * dt;
      const grow = easeOutBack(Math.min(1, p.age / 0.2));
      const fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      p.obj.scale.setScalar(Math.max(0.001, p.size * grow * fade));
    }
  }

  return { renderer, scene, camera, shadow, spawn, burst, update };
}
