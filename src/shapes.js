import * as THREE from 'three';

export const sphereGeo = new THREE.SphereGeometry(1, 32, 20);
export const sphereHiGeo = new THREE.SphereGeometry(1, 64, 40);

export const heartGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(5, 5);
  s.bezierCurveTo(5, 5, 4, 0, 0, 0);
  s.bezierCurveTo(-6, 0, -6, 7, -6, 7);
  s.bezierCurveTo(-6, 11, -3, 15.4, 5, 19);
  s.bezierCurveTo(12, 15.4, 16, 11, 16, 7);
  s.bezierCurveTo(16, 7, 16, 0, 10, 0);
  s.bezierCurveTo(7, 0, 5, 5, 5, 5);
  const g = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 2.4, bevelSize: 2, bevelSegments: 5, curveSegments: 20 });
  g.center();
  g.rotateZ(Math.PI);
  g.scale(0.011, 0.011, 0.011);
  return g;
})();

export const starGeo = (() => {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.5 : 1;
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.16, bevelSegments: 4 });
  g.center();
  g.scale(0.12, 0.12, 0.12);
  return g;
})();

// 小鱼干
export const fishGeo = (() => {
  const s = new THREE.Shape();
  s.moveTo(0.9, 0);
  s.quadraticCurveTo(0.35, 0.62, -0.45, 0.12);
  s.lineTo(-0.95, 0.45);
  s.quadraticCurveTo(-0.78, 0, -0.95, -0.45);
  s.lineTo(-0.45, -0.12);
  s.quadraticCurveTo(0.35, -0.62, 0.9, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 16 });
  g.center();
  g.scale(0.15, 0.15, 0.15);
  return g;
})();

// "Z" for sleepy time
export const zTexture = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.font = '800 104px "Fredoka", "M PLUS Rounded 1c", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.lineWidth = 14;
  g.strokeStyle = '#ffffff';
  g.strokeText('Z', 64, 68);
  g.fillStyle = '#b39bff';
  g.fillText('Z', 64, 68);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();

export const shadowTexture = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(150,80,140,0.42)');
  gr.addColorStop(0.45, 'rgba(150,80,140,0.2)');
  gr.addColorStop(1, 'rgba(150,80,140,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
})();
