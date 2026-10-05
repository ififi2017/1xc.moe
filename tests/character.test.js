import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// Geometry and interaction tests do not need WebGL; texture drawing is verified in-browser.
const gradient = { addColorStop() {} };
const context = new Proxy({}, {
  get: (_, key) => key === 'createLinearGradient' || key === 'createRadialGradient' ? () => gradient : () => {},
  set: () => true,
});
globalThis.document = { createElement: () => ({ getContext: () => context }) };
const { Catgirl } = await import('../src/catgirl.js');
const cat = new Catgirl(new THREE.Scene());
const look = new THREE.Vector3(0, 5.03, 6);

function settle() {
  for (let i = 0; i < 180; i++) cat.update(1 / 60, i / 60, look);
  cat.root.updateMatrixWorld(true);
}
settle();

test('all character surfaces have finite vertices/normals and a full-height silhouette', () => {
  let meshes = 0;
  cat.root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    meshes++;
    for (const attribute of ['position', 'normal']) {
      assert.ok(mesh.geometry.attributes[attribute], `missing ${attribute}`);
      assert.ok(mesh.geometry.attributes[attribute].array.every(Number.isFinite));
    }
  });
  const bounds = new THREE.Box3().setFromObject(cat.root);
  assert.ok(bounds.max.y > 5.8 && bounds.max.y < 6.3);
  assert.ok(bounds.min.y > -0.1 && bounds.min.y < 0.1);
  assert.ok(meshes < 180, `static details should be batched (${meshes} meshes)`);
});

test('all original touch zones remain raycastable', () => {
  for (const zone of ['head', 'ear', 'body', 'bell', 'tail']) {
    const meshes = cat.hit.filter((mesh) => mesh.userData.zone === zone);
    assert.ok(meshes.length > 0, `${zone} has no hit mesh`);
    const hittable = meshes.some((mesh) => {
      const target = new THREE.Box3().setFromObject(mesh).getCenter(new THREE.Vector3());
      const ray = new THREE.Raycaster(target.clone().add(new THREE.Vector3(0, 0, 12)), new THREE.Vector3(0, 0, -1));
      return ray.intersectObjects(cat.hit, false)[0]?.object.userData.zone === zone;
    });
    assert.ok(hittable, `${zone} cannot be hit from the front`);
  }
});

test('chin detection follows the face when the model turns', () => {
  for (const angle of [0, Math.PI / 2, Math.PI]) {
    cat.setView(angle); settle();
    const chin = cat.headMesh.localToWorld(new THREE.Vector3(0, -0.35, 0.23));
    const forehead = cat.headMesh.localToWorld(new THREE.Vector3(0, 0.28, 0.33));
    assert.ok(cat.isChin(chin));
    assert.equal(cat.isChin(forehead), false);
    assert.ok(Math.abs(cat.viewYaw - angle) < 0.001);
  }
});

test('tail is continuous, outward-facing and keeps updated raycast bounds during motion', () => {
  cat.react('tail');
  for (let step = 0; step < 180; step++) {
    cat.update(1 / 60, step / 60, look);
    const pos = cat.tailGeometry.attributes.position;
    assert.ok(pos.array.every(Number.isFinite));
    for (let ring = 0; ring <= cat.tailSegments; ring++) {
      const a = new THREE.Vector3().fromBufferAttribute(pos, ring * (cat.tailRadial + 1));
      const b = new THREE.Vector3().fromBufferAttribute(pos, ring * (cat.tailRadial + 1) + cat.tailRadial);
      assert.ok(a.distanceTo(b) < 1e-5, 'tube seam is open');
      const bounds = cat.tailGeometry.boundingSphere;
      assert.ok(a.distanceTo(bounds.center) <= bounds.radius + 1e-6);
    }
  }
  const ring = 30, index = ring * (cat.tailRadial + 1);
  const center = cat.tailCurve.getPoint(ring / cat.tailSegments);
  const vertex = new THREE.Vector3().fromBufferAttribute(cat.tailGeometry.attributes.position, index);
  const normal = new THREE.Vector3().fromBufferAttribute(cat.tailGeometry.attributes.normal, index);
  assert.ok(normal.dot(vertex.sub(center)) > 0, 'tail surface normals point inward');
});

test('pet, sleep, wake and zone reactions retain their expression maps', () => {
  cat.setLonely(5); cat.expr = null; cat.pet = 0; cat.update(1 / 60, 0, look);
  assert.equal(cat.sleeping, true); assert.equal(cat.currentFace, 'sleep');
  cat.setLonely(0); cat.petTick(); cat.update(1 / 60, 0, look);
  assert.equal(cat.currentFace, 'content');
  for (const [zone, expression] of [['head', 'bonk'], ['ear', 'surprise'], ['bell', 'happy']]) {
    cat.react(zone); cat.update(1 / 60, 0, look);
    assert.equal(cat.currentFace, expression);
    assert.equal(cat.faceMaterial.map, cat.faceMaps[expression]);
    assert.equal(cat.faceMaterial.emissiveMap, cat.faceMaterial.map);
  }
});
