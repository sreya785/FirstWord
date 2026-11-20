// Parametric animals and people, built from primitives with named pivots (legs, arms, head, wings, tail)
// so the world can animate walking, talking, flapping and clapping.
import * as THREE from 'three';
import { build, mat, geo, DARK, WOOD } from './models.js';

const D2R = Math.PI / 180;
const SKIN = ['#f6c9a8', '#e8b48c', '#c68642', '#8d5524', '#f1d3b8'];

// ---------- simple face decal ----------
const faceCache = new Map();
export function faceTexture({ mouth = 'smile', eyes = 'open', blush = true, talk = false, glasses = false, beard = null, kind = 'person' } = {}) {
  const key = JSON.stringify([mouth, eyes, blush, talk, glasses, beard, kind]);
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  x.clearRect(0, 0, 128, 128);
  // eyes
  x.fillStyle = '#2b2140';
  const ey = 54;
  if (eyes === 'closed') { x.lineWidth = 4; x.strokeStyle = '#2b2140'; for (const ex of [44, 84]) { x.beginPath(); x.arc(ex, ey + 2, 8, Math.PI, 0); x.stroke(); } }
  else for (const ex of [44, 84]) { x.beginPath(); x.ellipse(ex, ey, 6, kind === 'baby' ? 9 : 8, 0, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(ex + 2, ey - 3, 2.2, 0, 7); x.fill(); x.fillStyle = '#2b2140'; }
  if (glasses) { x.lineWidth = 3; x.strokeStyle = '#2b2140'; for (const ex of [44, 84]) { x.beginPath(); x.arc(ex, ey, 13, 0, 7); x.stroke(); } x.beginPath(); x.moveTo(57, ey); x.lineTo(71, ey); x.stroke(); }
  if (blush) { x.fillStyle = 'rgba(255,120,150,.35)'; for (const bx of [30, 98]) { x.beginPath(); x.ellipse(bx, 74, 9, 5, 0, 0, 7); x.fill(); } }
  // mouth
  x.strokeStyle = '#7a2d3a'; x.fillStyle = '#7a2d3a'; x.lineWidth = 4; x.lineCap = 'round';
  if (talk) { x.beginPath(); x.ellipse(64, 86, 10.5, 13, 0, 0, 7); x.fill(); }   // a clear open mouth while talking
  else if (mouth === 'smile') { x.beginPath(); x.arc(64, 78, 13, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
  else if (mouth === 'o') { x.beginPath(); x.arc(64, 86, 7, 0, 7); x.fill(); }
  else if (mouth === 'sad') { x.beginPath(); x.arc(64, 96, 12, 1.15 * Math.PI, 1.85 * Math.PI); x.stroke(); }
  else { x.beginPath(); x.moveTo(54, 86); x.lineTo(74, 86); x.stroke(); }
  if (beard) { x.fillStyle = beard; x.beginPath(); x.ellipse(64, 104, 34, 18, 0, 0, Math.PI); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  faceCache.set(key, t); return t;
}
/** A curved face decal: a patch of sphere slightly larger than the head, so it hugs the head from every angle. */
export function facePatch(r, texture, { phi = 1.7, theta = 1.5 } = {}) {
  const g = new THREE.SphereGeometry(r * 1.03, 24, 16, Math.PI / 2 - phi / 2, phi, Math.PI / 2 - theta / 2, theta);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.renderOrder = 2; return m;
}
function faceMesh(r, opts) {
  const m = facePatch(r, faceTexture(opts));
  m.userData.faceOpts = { ...opts };
  return m;
}
export function setFace(mesh, patch) { if (!mesh) return; const o = { ...mesh.userData.faceOpts, ...patch }; mesh.userData.faceOpts = o; mesh.material.map = faceTexture(o); mesh.material.needsUpdate = true; }

// ---------- animals ----------
export const ANIMALS = {
  cat: { c: '#f59e0b', body: [0.42, 0.36, 0.62], head: 0.34, ears: 'tri', tail: 'curl', whiskers: true },
  dog: { c: '#b5651d', body: [0.48, 0.42, 0.75], head: 0.36, ears: 'flop', tail: 'up', snout: true },
  bird: { c: '#60a5fa', fly: true, body: [0.24, 0.22, 0.32], head: 0.18, beak: '#f59e0b', wings: true, legs: 0 },
  owl: { c: '#8d6e63', body: [0.34, 0.42, 0.34], head: 0.3, beak: '#f59e0b', wings: true, bigEyes: true, legs: 0, perch: true },
  fish: { c: '#fb923c', swim: true, body: [0.5, 0.3, 0.2], fin: true, legs: 0 },
  whale: { c: '#3b82f6', swim: true, body: [1.5, 0.8, 0.8], fin: true, legs: 0, spout: true, scale: 1.3 },
  octopus: { c: '#a855f7', swim: true, head: 0.5, legs8: true, legs: 0 },
  turtle: { c: '#22c55e', body: [0.6, 0.3, 0.72], shell: '#15803d', head: 0.22, legsFlat: true },
  crab: { c: '#ef4444', body: [0.5, 0.22, 0.36], claws: true, legsSide: true, legs: 0, eyesTop: true },
  elephant: { c: '#9ca3af', body: [0.9, 0.8, 1.15], head: 0.55, ears: 'big', trunk: true, legR: 0.18, legH: 0.7, scale: 1.35 },
  lion: { c: '#f59e0b', body: [0.55, 0.5, 0.9], head: 0.42, mane: '#b45309', tail: 'tuft' },
  tiger: { c: '#f97316', body: [0.55, 0.5, 0.9], head: 0.42, stripes: true, tail: 'up' },
  monkey: { c: '#92400e', body: [0.35, 0.42, 0.35], head: 0.3, ears: 'round', tail: 'curl', biped: true, arms: true, muzzle: '#f5d6a7' },
  rabbit: { c: '#f3f4f6', body: [0.35, 0.36, 0.45], head: 0.3, ears: 'long', tail: 'pom' },
  butterfly: { c: '#ec4899', fly: true, body: [0.07, 0.07, 0.3], wingsBig: true, legs: 0, head: 0.08 },
  bee: { c: '#facc15', fly: true, body: [0.2, 0.18, 0.3], stripes: true, wings: true, legs: 0, head: 0.14 },
  cow: { c: '#f9fafb', body: [0.65, 0.55, 1], head: 0.4, spots: '#1f2937', horns: true, legH: 0.55, snout: '#f9a8d4' },
  goat: { c: '#e5e7eb', body: [0.45, 0.4, 0.75], head: 0.32, horns: true, beard: '#d1d5db' },
  horse: { c: '#92400e', body: [0.55, 0.55, 1.1], head: 0.35, neck: true, mane: '#1f2937', tail: 'hair', legH: 0.8 },
  duck: { c: '#fde047', body: [0.35, 0.3, 0.45], head: 0.25, beak: '#f97316', neck: true, legs: 2, legsThin: true },
  chicken: { c: '#fff', body: [0.35, 0.35, 0.4], head: 0.22, beak: '#f97316', comb: true, legs: 2, legsThin: true },
  frog: { c: '#4ade80', body: [0.4, 0.3, 0.45], head: 0.26, eyesTop: true, legsFlat: true },
  penguin: { c: '#111827', body: [0.35, 0.5, 0.35], belly: '#fff', beak: '#f97316', biped: true, flippers: true, head: 0.26 },
  bear: { c: '#78350f', body: [0.6, 0.6, 0.8], head: 0.42, ears: 'round', muzzle: '#d6a461' },
  fox: { c: '#f97316', body: [0.4, 0.35, 0.7], head: 0.32, ears: 'tri', tail: 'bushy', belly: '#fff' },
  deer: { c: '#b45309', body: [0.5, 0.45, 0.9], head: 0.3, neck: true, antlers: true, legH: 0.7, spots: '#fde68a' },
  giraffe: { c: '#fbbf24', body: [0.55, 0.5, 1], head: 0.3, neck: 'long', spots: '#b45309', legH: 1.2, scale: 1.25 },
  snake: { c: '#16a34a', snake: true, legs: 0 },
  crocodile: { c: '#15803d', body: [0.45, 0.3, 1.6], head: 0.3, snout: '#15803d', legsFlat: true, tail: 'long', spikes: true },
  dragon: { c: '#16a34a', body: [0.6, 0.6, 1.1], head: 0.42, wingsBig: true, horns: true, tail: 'long', spikes: true, scale: 1.4, biped: true, arms: true, fly: 'maybe' },
  dinosaur: { c: '#22c55e', body: [0.6, 0.65, 1.2], head: 0.4, biped: true, tail: 'long', spikes: true, scale: 1.4, arms: true },
  unicorn: { c: '#fdf2f8', body: [0.5, 0.5, 1], head: 0.33, neck: true, horn: true, mane: '#f472b6', tail: 'hair', legH: 0.75 },
  mermaid: null,
};

export function animalParts(key, color) {
  const s = ANIMALS[key]; if (!s) return null;
  const c = color || s.c;
  const parts = [];
  const legH = s.legH ?? 0.45, legR = s.legR ?? 0.1;
  if (s.snake) {
    for (let i = 0; i < 8; i++) parts.push(['sphere', [0.18 - i * 0.012], c, [Math.sin(i * 0.9) * 0.35, 0.16, -i * 0.3 + 1]]);
    parts.push(['sphere', [0.22], c, [0, 0.22, 1.2]], ['sphere', [0.04], DARK, [-0.08, 0.3, 1.38]], ['sphere', [0.04], DARK, [0.08, 0.3, 1.38]], ['box', [0.04, 0.02, 0.25], '#ef4444', [0, 0.18, 1.5]]);
    return parts;
  }
  if (s.legs8) {
    parts.push(['sphere', [s.head], c, [0, 0.75, 0], 0, [1, 1.1, 1]]);
    for (let i = 0; i < 8; i++) { const a = i * 45; parts.push({ name: 'leg' + i, at: [0, 0.45, 0], rot: [0, a, 0], parts: [['capsule', [0.07, 0.5], c, [0, -0.1, 0.35], [40, 0, 0]]] }); }
    parts.push(['sphere', [0.07], '#fff', [-0.16, 0.85, 0.45]], ['sphere', [0.07], '#fff', [0.16, 0.85, 0.45]], ['sphere', [0.04], DARK, [-0.16, 0.85, 0.51]], ['sphere', [0.04], DARK, [0.16, 0.85, 0.51]]);
    return parts;
  }
  const [bx, by, bz] = s.body || [0.4, 0.4, 0.6];
  const bodyY = (s.fly ? 1.6 : s.swim ? 0.6 : legH) + by * 0.8;
  const biped = s.biped;
  // body
  parts.push(['sphere', [1], c, [0, bodyY, 0], biped ? [-20, 0, 0] : 0, [bx, by, bz], 'body']);
  if (s.belly) parts.push(['sphere', [1], s.belly, [0, bodyY - by * 0.1, bz * 0.3], 0, [bx * 0.75, by * 0.8, bz * 0.75]]);
  if (s.shell) parts.push(['sphere', [1], s.shell, [0, bodyY + by * 0.2, 0], 0, [bx * 1.05, by * 1.1, bz * 0.95]], ['sphere', [1], '#166534', [0, bodyY + by * 0.5, 0], 0, [bx * 0.6, by * 0.6, bz * 0.55]]);
  if (s.spots) for (let i = 0; i < 5; i++) { const a = i * 1.3; parts.push(['sphere', [0.12], s.spots, [Math.cos(a) * bx * 0.9, bodyY + Math.sin(a * 1.7) * by * 0.5, Math.sin(a) * bz * 0.8], 0, [1, 1, 0.5]]); }
  if (s.stripes) for (let i = 0; i < 3; i++) parts.push(['torus', [Math.max(bx, by) * 0.98, 0.035, 6, 24], '#1f2937', [0, bodyY, (i - 1) * bz * 0.45], [0, 0, 0], [1, by / bx, 1]]);
  if (s.spikes) for (let i = 0; i < 4; i++) parts.push(['cone', [0.09, 0.22, 4], '#065f46', [0, bodyY + by * 0.95 - i * 0.05, bz * 0.5 - i * bz * 0.4]]);
  // legs
  const nLegs = s.legs ?? (biped ? 2 : 4);
  if (nLegs) {
    const lx = bx * 0.55, lz = bz * 0.5;
    const spots = nLegs === 4 ? [[-lx, lz, 'legFL'], [lx, lz, 'legFR'], [-lx, -lz, 'legBL'], [lx, -lz, 'legBR']] : [[-bx * 0.45, 0, 'legFL'], [bx * 0.45, 0, 'legFR']];
    for (const [x, z, name] of spots) {
      if (s.legsFlat) parts.push(['sphere', [0.14], c, [x * 1.3, 0.12, z * 1.1], 0, [1, 0.6, 1.3], name]);
      else parts.push({ name, at: [x, legH, z], parts: [['cyl', [s.legsThin ? 0.03 : legR, s.legsThin ? 0.03 : legR * 1.1, legH], s.legsThin ? '#f97316' : c, [0, -legH / 2, 0]], s.legsThin ? ['box', [0.16, 0.03, 0.2], '#f97316', [0, -legH + 0.015, 0.05]] : null] });
    }
  }
  if (s.legsSide) for (let i = 0; i < 3; i++) for (const side of [-1, 1]) parts.push(['capsule', [0.04, 0.3], c, [side * (bx * 0.9), 0.15, (i - 1) * 0.2], [0, 0, side * 60]]);
  if (s.claws) for (const side of [-1, 1]) parts.push({ name: side < 0 ? 'armL' : 'armR', at: [side * bx * 0.8, 0.3, bz * 0.6], parts: [['capsule', [0.05, 0.3], c, [side * 0.15, 0, 0.1], [0, 0, side * 70]], ['sphere', [0.14], c, [side * 0.3, 0.05, 0.22], 0, [1.2, 0.8, 1]]] });
  if (s.flippers) for (const side of [-1, 1]) parts.push({ name: side < 0 ? 'armL' : 'armR', at: [side * bx * 0.9, bodyY + 0.1, 0], parts: [['sphere', [0.2], c, [side * 0.08, -0.2, 0], 0, [0.4, 1, 0.6]]] });
  if (s.arms) for (const side of [-1, 1]) parts.push({ name: side < 0 ? 'armL' : 'armR', at: [side * bx * 0.85, bodyY + by * 0.2, bz * 0.2], parts: [['capsule', [0.07, 0.3], c, [side * 0.05, -0.2, 0.1], [-30, 0, side * 20]]] });
  // neck + head
  const neckLen = s.neck === 'long' ? 1.6 : s.neck ? 0.5 : 0;
  const headPos = [0, bodyY + by * 0.55 + neckLen * 0.9 + (biped ? by * 0.3 : 0), bz * (biped ? 0.35 : 0.8) + (s.neck ? 0.2 : 0)];
  if (neckLen) parts.push(['cyl', [s.head * 0.55, s.head * 0.75, neckLen + 0.3], c, [0, bodyY + by * 0.3 + neckLen * 0.45, bz * 0.7], [-20, 0, 0]]);
  const h = s.head || 0.3;
  const head = { name: 'head', at: headPos, parts: [] };
  head.parts.push(['sphere', [h], c, [0, 0, 0]]);
  if (s.muzzle) head.parts.push(['sphere', [h * 0.55], s.muzzle, [0, -h * 0.25, h * 0.7], 0, [1.1, 0.8, 0.8]]);
  if (s.snout) head.parts.push(['sphere', [h * 0.5], typeof s.snout === 'string' ? s.snout : c, [0, -h * 0.2, h * 0.9], 0, [1, 0.75, 1.2]], ['sphere', [h * 0.18], DARK, [0, -h * 0.05, h * 1.5]]);
  if (s.beak) head.parts.push(['cone', [h * 0.35, h * 0.8, 8], s.beak, [0, -h * 0.1, h * 1.1], [90, 0, 0]]);
  if (s.trunk) head.parts.push({ name: 'trunk', at: [0, -h * 0.3, h * 0.8], parts: [['cyl', [0.12, 0.16, 0.6], c, [0, -0.25, 0.1], [-15, 0, 0]], ['cyl', [0.1, 0.12, 0.5], c, [0, -0.7, 0.25], [10, 0, 0]], ['cyl', [0.09, 0.1, 0.4], c, [0, -1.05, 0.4], [40, 0, 0]]] });
  if (s.horn) head.parts.push(['cone', [0.08, 0.5, 8], { c: '#fde68a', m: 0.4, r: 0.4 }, [0, h * 0.95, h * 0.2], [-15, 0, 0]]);
  if (s.horns) for (const side of [-1, 1]) head.parts.push(['cone', [0.06, 0.3, 6], '#e5e7eb', [side * h * 0.6, h * 0.8, 0], [0, 0, side * -30]]);
  if (s.antlers) for (const side of [-1, 1]) head.parts.push(['cyl', [0.03, 0.03, 0.6], '#7c4a1d', [side * h * 0.5, h * 1.1, 0], [0, 0, side * -20]], ['cyl', [0.025, 0.025, 0.3], '#7c4a1d', [side * h * 0.7, h * 1.3, 0], [0, 0, side * -70]]);
  if (s.comb) head.parts.push(['sphere', [0.07], '#ef4444', [0, h * 0.95, 0]], ['sphere', [0.06], '#ef4444', [0, h * 0.9, -0.08]], ['sphere', [0.05], '#ef4444', [0, h * 0.5, h * 1.05]]);
  if (s.mane) head.parts.push(['sphere', [h * 1.35], s.mane, [0, 0, -h * 0.25], 0, [1, 1, 0.55]]);
  if (s.beard) head.parts.push(['cone', [h * 0.3, h * 0.7, 6], s.beard, [0, -h * 0.9, h * 0.5], [180, 0, 0]]);
  const ear = (side) => {
    const x = side * h * 0.65;
    if (s.ears === 'tri') return ['cone', [h * 0.35, h * 0.6, 4], c, [x, h * 0.85, 0], [0, 45, side * -15]];
    if (s.ears === 'round') return ['sphere', [h * 0.35], c, [x * 1.1, h * 0.8, 0]];
    if (s.ears === 'long') return ['capsule', [h * 0.22, h * 0.9], c, [x * 0.7, h * 1.2, 0], [0, 0, side * -12]];
    if (s.ears === 'flop') return ['capsule', [h * 0.22, h * 0.5], '#7c4a1d', [x * 1.3, h * 0.1, 0], [0, 0, side * -20]];
    if (s.ears === 'big') return ['sphere', [h * 0.7], c, [x * 1.5, h * 0.1, -h * 0.2], 0, [0.35, 1, 0.9]];
    return null;
  };
  if (s.ears) head.parts.push(ear(-1), ear(1));
  // eyes
  const eyeR = s.bigEyes ? h * 0.33 : h * 0.2;
  for (const side of [-1, 1]) {
    const ex = side * h * (s.eyesTop ? 0.45 : 0.4), ey = s.eyesTop ? h * 0.85 : h * 0.2, ez = s.eyesTop ? h * 0.3 : h * 0.82;
    head.parts.push(['sphere', [eyeR], '#fff', [ex, ey, ez]], ['sphere', [eyeR * 0.55], DARK, [ex, ey, ez + eyeR * 0.6]], ['sphere', [eyeR * 0.2], '#fff', [ex + eyeR * 0.2, ey + eyeR * 0.25, ez + eyeR * 1.05]]);
  }
  if (s.whiskers) for (const side of [-1, 1]) for (let i = 0; i < 2; i++) head.parts.push(['box', [h * 1.1, 0.012, 0.012], '#e5e7eb', [side * h * 0.8, -h * 0.15 + i * 0.07, h * 0.75], [0, 0, side * (i ? -8 : 8)]]);
  parts.push(head);
  // tail
  const tz = -bz * 0.95;
  const tail = { name: 'tail', at: [0, bodyY + (s.tail === 'long' ? -by * 0.2 : by * 0.2), tz], parts: [] };
  if (s.tail === 'curl') tail.parts.push(['sphere', [0.08], c, [0, 0.1, -0.1]], ['sphere', [0.07], c, [0, 0.3, -0.18]], ['sphere', [0.065], c, [0, 0.48, -0.1]], ['sphere', [0.06], c, [0, 0.6, 0.05]]);
  else if (s.tail === 'up') tail.parts.push(['capsule', [0.05, 0.4], c, [0, 0.2, -0.1], [-30, 0, 0]]);
  else if (s.tail === 'pom') tail.parts.push(['sphere', [0.12], '#fff', [0, 0, -0.05]]);
  else if (s.tail === 'tuft') tail.parts.push(['capsule', [0.035, 0.6], c, [0, 0.1, -0.3], [-60, 0, 0]], ['sphere', [0.1], s.mane || '#b45309', [0, 0.2, -0.62]]);
  else if (s.tail === 'bushy') tail.parts.push(['sphere', [0.22], c, [0, 0.1, -0.3], 0, [0.7, 0.7, 1.3]], ['sphere', [0.12], '#fff', [0, 0.1, -0.58]]);
  else if (s.tail === 'hair') tail.parts.push(['cone', [0.12, 0.6, 8], s.mane || DARK, [0, -0.2, -0.05], [20, 0, 0]]);
  else if (s.tail === 'long') tail.parts.push(['cone', [by * 0.55, bz * 1.2, 8], c, [0, 0, -bz * 0.55], [-80, 0, 0]]);
  if (tail.parts.length) parts.push(tail);
  // wings
  if (s.wings || s.wingsBig) {
    const big = s.wingsBig, wc = key === 'butterfly' ? (color || '#ec4899') : key === 'bee' ? { c: '#e0f2fe', o: 0.7 } : key === 'dragon' ? '#065f46' : c;
    for (const side of [-1, 1]) {
      const w = { name: side < 0 ? 'wingL' : 'wingR', at: [side * bx * 0.6, bodyY + by * 0.4, 0], parts: [] };
      if (big) w.parts.push(['sphere', [1], wc, [side * 0.55, 0.1, 0], 0, [0.55, 0.05, 0.42]], ['sphere', [1], wc, [side * 0.45, 0.05, -0.35], 0, [0.4, 0.05, 0.3]]);
      else w.parts.push(['sphere', [1], wc, [side * 0.28, 0.05, 0], 0, [0.3, 0.04, 0.2]]);
      if (key === 'butterfly') w.parts.push(['sphere', [0.1], '#fde68a', [side * 0.5, 0.12, 0.05], 0, [1, 0.3, 1]]);
      parts.push(w);
    }
  }
  if (s.fin) parts.push(['cone', [by * 0.8, bx * 0.7, 4], c, [-bx * 1.2, bodyY, 0], [0, 0, 90], [1, 1, 0.3], 'tail'], ['cone', [0.15, by * 0.8, 4], c, [0, bodyY + by * 0.9, 0], 0, [1, 1, 0.4]]);
  if (s.spout) parts.push(['sphere', [0.14], { c: '#bfe9ff', o: 0.7 }, [bx * 0.3, bodyY + by + 0.3, 0]], ['sphere', [0.1], { c: '#bfe9ff', o: 0.7 }, [bx * 0.3 + 0.15, bodyY + by + 0.5, 0]]);
  if (s.udder) parts.push(['sphere', [0.14], '#f9a8d4', [0, legH - 0.05, -bz * 0.2]]);
  if (s.perch) parts.push(['cyl', [0.04, 0.04, 0.8], WOOD, [0, legH - 0.1, 0], [0, 0, 90]]);
  return parts;
}

// ---------- people ----------
export const PEOPLE = {
  doctor: { shirt: '#fff', pants: '#cbd5e1', hair: '#3b2f2f', hat: 'mirror', prop: 'stethoscope', coat: true },
  waiter: { shirt: '#111827', pants: '#111827', hair: '#2b1b12', bow: true, apron: '#fff', prop: 'tray' },
  shopkeeper: { shirt: '#60a5fa', pants: '#1f2937', apron: '#f59e0b', hair: '#1f2937' },
  teacher: { shirt: '#a78bfa', pants: '#374151', glasses: true, prop: 'book', hairStyle: 'bun', hair: '#4a2c17' },
  friend: { child: true, shirt: '#f472b6', pants: '#3b82f6', hair: '#5b3a1a' },
  mom: { shirt: '#ec4899', pants: '#7c3aed', hair: '#3f1d0f', hairStyle: 'long' },
  dad: { shirt: '#2563eb', pants: '#374151', hair: '#1f2937' },
  grandma: { shirt: '#c084fc', pants: '#6b7280', hair: '#e5e7eb', hairStyle: 'bun', glasses: true },
  grandpa: { shirt: '#9ca3af', pants: '#4b5563', hair: '#e5e7eb', prop: 'cane', glasses: true, beard: '#e5e7eb' },
  baby: { baby: true, shirt: '#fde68a', pants: '#fde68a', hair: '#a16207' },
  police: { shirt: '#1e3a8a', pants: '#1e3a8a', hat: 'cap', hatColor: '#1e3a8a', badge: true, hair: '#1f2937' },
  firefighter: { shirt: '#dc2626', pants: '#dc2626', hat: 'helmet', hatColor: '#facc15', stripes: '#fde68a', hair: '#1f2937' },
  princess: { dress: '#f9a8d4', hat: 'hennin', hair: '#fbbf24', hairStyle: 'long' },
  prince: { shirt: '#3b82f6', pants: '#f8fafc', cape: '#dc2626', hat: 'crown', hair: '#78350f' },
  king: { shirt: '#7c3aed', pants: '#4c1d95', cape: '#dc2626', hat: 'crown', beard: '#78350f', hair: '#78350f' },
  queen: { dress: '#7c3aed', hat: 'crown', hair: '#78350f', hairStyle: 'long' },
  pirate: { shirt: '#fff', pants: '#111827', hat: 'pirate', eyepatch: true, prop: 'sword', hair: '#1f2937' },
  astronaut: { shirt: '#f8fafc', pants: '#f8fafc', helmet: true, backpack: true, hair: '#1f2937' },
  fairy: { dress: '#a7f3d0', wings: true, prop: 'wand', hair: '#fde68a', hairStyle: 'long', float: true },
  wizard: { robe: '#4c1d95', hat: 'wizard', beard: '#e5e7eb', prop: 'staff', hair: '#e5e7eb' },
  superhero: { shirt: '#dc2626', pants: '#1d4ed8', cape: '#dc2626', mask: true, hair: '#1f2937' },
  clown: { shirt: '#facc15', pants: '#22c55e', hair: '#ef4444', hairStyle: 'puff', nose: '#ef4444', hat: 'tiny' },
  santa: { shirt: '#dc2626', pants: '#dc2626', hat: 'santa', beard: '#fff', belt: true, hair: '#fff' },
  farmer: { shirt: '#60a5fa', pants: '#1e3a8a', hat: 'straw', prop: 'fork', hair: '#78350f' },
  driver: { shirt: '#374151', pants: '#111827', hat: 'cap', hatColor: '#374151', hair: '#1f2937' },
  singer: { dress: '#f43f5e', prop: 'mic', hair: '#1f2937', hairStyle: 'long' },
  guard: { shirt: '#dc2626', pants: '#111827', hat: 'bearskin', hair: '#1f2937' },
  mermaid: { mermaid: true, shirt: '#a855f7', tail: '#14b8a6', hair: '#f43f5e', hairStyle: 'long' },
  elf: { shirt: '#16a34a', pants: '#dc2626', hat: 'elf', hair: '#a16207' },
  zombie: { skin: '#86efac', shirt: '#6b7280', pants: '#374151', armsOut: true, hair: '#1f2937' },
  genie: { skin: '#60a5fa', genie: true, shirt: '#fbbf24', hat: 'turban', float: true },
  chef: { shirt: '#fff', pants: '#374151', hat: 'toque', apron: '#fff', hair: '#1f2937' },
  nurse: { shirt: '#fff', pants: '#60a5fa', hat: 'nursecap', hair: '#78350f', hairStyle: 'bun' },
  person: { shirt: '#60a5fa', pants: '#374151', hair: '#3b2f2f' },
  shopper: { shirt: '#38bdf8', pants: '#334155', hair: '#7c4a2d', hairHigh: true },   // hair high on the head: the face stays open for our eyes
};

export function personParts(key, { color = null, seed = 0, sit = false } = {}) {
  const s = PEOPLE[key] || PEOPLE.person;
  const sd = typeof seed === 'number' ? Math.abs(seed | 0) : String(seed).split('').reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const skin = s.skin || SKIN[sd % SKIN.length];
  const shirt = color || s.shirt || '#60a5fa', pants = s.pants || '#374151', hair = s.hair || '#3b2f2f';
  const parts = [];
  const H = 0.26; // head radius
  const legH = 0.5, torsoY = legH + 0.32;
  // legs or dress/tail
  if (s.mermaid) parts.push(['cone', [0.3, 1.1, 10], s.tail, [0, 0.35, 0.3], [70, 0, 0]], ['sphere', [0.25], s.tail, [0, 0.2, 0.85], 0, [1.4, 0.3, 1]]);
  else if (s.genie) parts.push(['cone', [0.45, 1.2, 12], { c: '#93c5fd', o: 0.6 }, [0, 0.55, 0], [180, 0, 0]]);
  else if (s.dress || s.robe) parts.push(['cone', [0.5, 1.1, 14], s.dress || s.robe, [0, 0.55, 0]]);
  else if (!s.baby) for (const side of [-1, 1]) parts.push({ name: side < 0 ? 'legL' : 'legR', at: [side * 0.13, legH, 0], parts: [['cyl', [0.09, 0.09, legH], pants, [0, -legH / 2, 0]], ['box', [0.2, 0.08, 0.28], DARK, [0, -legH + 0.04, 0.04]]] });
  // torso
  const torsoColor = s.coat ? '#fff' : (s.robe || shirt);
  parts.push(['capsule', [0.24, 0.34], torsoColor, [0, s.baby ? 0.45 : torsoY, 0], 0, 1, 'torso']);
  if (s.coat) parts.push(['capsule', [0.12, 0.3], shirt === '#fff' ? '#bfe9ff' : shirt, [0, torsoY + 0.02, 0.16]]);
  if (s.apron) parts.push(['box', [0.36, 0.5, 0.04], s.apron, [0, torsoY - 0.1, 0.24]]);
  if (s.belt) parts.push(['torus', [0.26, 0.04, 6, 20], '#111827', [0, torsoY - 0.1, 0], [90, 0, 0]]);
  if (s.stripes) parts.push(['torus', [0.25, 0.03, 6, 20], s.stripes, [0, torsoY + 0.05, 0], [90, 0, 0]], ['torus', [0.25, 0.03, 6, 20], s.stripes, [0, torsoY - 0.15, 0], [90, 0, 0]]);
  if (s.bow) parts.push(['box', [0.1, 0.06, 0.04], '#ef4444', [0, torsoY + 0.3, 0.22]], ['box', [0.22, 0.1, 0.04], '#ef4444', [0, torsoY + 0.3, 0.21]]);
  if (s.badge) parts.push(['octa', [0.05], { c: '#fbbf24', m: 0.5, r: 0.3 }, [-0.12, torsoY + 0.15, 0.24]]);
  if (s.backpack) parts.push(['box', [0.4, 0.5, 0.2], '#cbd5e1', [0, torsoY, -0.3]]);
  if (s.cape) parts.push({ name: 'cape', at: [0, torsoY + 0.3, -0.2], parts: [['plane', [0.6, 1.1], { c: s.cape, side: 2 }, [0, -0.55, 0], [8, 0, 0]]] });
  if (s.wings) for (const side of [-1, 1]) parts.push({ name: side < 0 ? 'wingL' : 'wingR', at: [side * 0.1, torsoY + 0.2, -0.22], parts: [['sphere', [1], { c: '#e0f2fe', o: 0.75 }, [side * 0.35, 0.1, 0], 0, [0.35, 0.3, 0.05]], ['sphere', [1], { c: '#e0f2fe', o: 0.75 }, [side * 0.3, -0.25, 0], 0, [0.25, 0.2, 0.05]]] });
  // arms
  const armRot = s.armsOut ? [-80, 0, 0] : [0, 0, 0];
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'armL' : 'armR';
    const prop = side > 0 ? s.prop : null;
    const arm = { name, at: [side * 0.3, torsoY + 0.22, 0], rot: armRot, parts: [['capsule', [0.07, 0.34], torsoColor, [side * 0.02, -0.22, 0], [0, 0, side * 8]], ['sphere', [0.08], skin, [side * 0.05, -0.47, 0]]] };
    if (prop === 'tray') arm.parts.push(['cyl', [0.3, 0.3, 0.03, 20], '#e5e7eb', [side * 0.05, -0.47, 0.25]], ['cyl', [0.12, 0.12, 0.15, 12], '#fff', [side * 0.05, -0.38, 0.25]]);
    if (prop === 'book') arm.parts.push(['box', [0.28, 0.36, 0.06], '#2563eb', [side * 0.05, -0.45, 0.14], [0, 0, 0]]);
    if (prop === 'cane') arm.parts.push(['cyl', [0.02, 0.02, 0.9], WOOD, [side * 0.05, -0.85, 0.05]]);
    if (prop === 'sword') arm.parts.push(['box', [0.06, 0.8, 0.02], { c: '#cbd5e1', m: 0.5, r: 0.3 }, [side * 0.05, -0.2, 0.1], [-90, 0, 0]], ['box', [0.2, 0.05, 0.05], '#fbbf24', [side * 0.05, -0.47, 0.15]]);
    if (prop === 'wand') arm.parts.push(['cyl', [0.015, 0.015, 0.5], '#fff', [side * 0.05, -0.47, 0.25], [90, 0, 0]], ['octa', [0.07], { c: '#fde68a', e: '#facc15', ei: 0.8 }, [side * 0.05, -0.47, 0.52], 0, [1, 1, 0.4]]);
    if (prop === 'staff') arm.parts.push(['cyl', [0.025, 0.025, 1.6], WOOD, [side * 0.05, -0.6, 0.1]], ['sphere', [0.1], { c: '#60a5fa', e: '#3b82f6', ei: 0.7 }, [side * 0.05, 0.25, 0.1]]);
    if (prop === 'mic') arm.parts.push(['cyl', [0.03, 0.03, 0.3], DARK, [side * 0.05, -0.4, 0.15], [-60, 0, 0]], ['sphere', [0.07], '#6b7280', [side * 0.05, -0.28, 0.25]]);
    if (prop === 'fork') arm.parts.push(['cyl', [0.02, 0.02, 1.5], WOOD, [side * 0.05, -0.5, 0.05]], ...[-1, 0, 1].map((i) => ['box', [0.02, 0.2, 0.02], '#9ca3af', [side * 0.05 + i * 0.05, 0.3, 0.05]]));
    parts.push(arm);
  }
  if (s.prop === 'stethoscope') parts.push(['torus', [0.2, 0.025, 6, 20, Math.PI], '#111827', [0, torsoY + 0.22, 0.2], [0, 0, 180]], ['cyl', [0.06, 0.06, 0.03, 12], '#9ca3af', [0.12, torsoY - 0.05, 0.24], [90, 0, 0]]);
  // head
  const headY = (s.baby ? 0.45 : torsoY) + 0.34 + H;
  const face = s.baby ? 'baby' : 'person';
  const head = { name: 'head', at: [0, headY, 0], parts: [['sphere', [H], skin, [0, 0, 0]]] };
  const hairStyle = s.hairStyle || 'short';
  if (!s.helmet || true) {
    if (hairStyle === 'puff') head.parts.push(['sphere', [H * 0.7], hair, [-H * 0.8, H * 0.5, 0]], ['sphere', [H * 0.7], hair, [H * 0.8, H * 0.5, 0]], ['sphere', [H * 0.6], hair, [0, H * 0.9, -H * 0.3]]);
    else if (s.hairBack) head.parts.push(['sphere', [H * 1.02], hair, [0, H * 0.28, -H * 0.16], 0, [1, 0.66, 0.86]]);   // hair clear of the face
    else if (s.hairHigh) head.parts.push(['sphere', [H * 0.96], hair, [0, H * 0.52, -H * 0.16], 0, [1, 0.48, 0.82]]);
    else {
      head.parts.push(['sphere', [H * 1.04], hair, [0, H * 0.18, -H * 0.08], 0, [1, 0.62, 1]]);
      if (hairStyle === 'long') head.parts.push(['box', [H * 1.6, H * 1.6, H * 0.5], hair, [0, -H * 0.3, -H * 0.75]]);
      if (hairStyle === 'bun') head.parts.push(['sphere', [H * 0.45], hair, [0, H * 1.05, -H * 0.4]]);
    }
  }
  if (s.earsPoint) for (const side of [-1, 1]) head.parts.push(['cone', [0.05, 0.18, 4], skin, [side * H, H * 0.1, 0], [0, 0, side * -70]]);
  // hats
  const hc = s.hatColor || '#1f2937';
  switch (s.hat) {
    case 'cap': head.parts.push(['sphere', [H * 1.06], hc, [0, H * 0.25, 0], 0, [1, 0.6, 1]], ['box', [H * 1.2, 0.03, H * 0.9], hc, [0, H * 0.3, H * 0.9]]); break;
    case 'helmet': head.parts.push(['sphere', [H * 1.12], hc, [0, H * 0.25, 0], 0, [1, 0.8, 1]], ['cyl', [H * 1.3, H * 1.3, 0.04, 20], hc, [0, H * 0.1, 0]]); break;
    case 'crown': head.parts.push(['cyl', [H * 0.8, H * 0.7, 0.18, 8], { c: '#fbbf24', m: 0.5, r: 0.4 }, [0, H * 1.05, 0]], ...[0, 1, 2, 3, 4, 5].map((i) => ['cone', [0.05, 0.14, 4], { c: '#fbbf24', m: 0.5, r: 0.4 }, [Math.cos(i * Math.PI / 3) * H * 0.75, H * 1.2, Math.sin(i * Math.PI / 3) * H * 0.75]])); break;
    case 'hennin': head.parts.push(['cone', [H * 0.7, 0.9, 12], '#f9a8d4', [0, H * 1.4, 0]], ['plane', [0.3, 0.8], { c: '#fff', o: 0.7, side: 2 }, [0, H * 1.2, -0.25], [20, 0, 0]]); break;
    case 'pirate': head.parts.push(['cyl', [H * 1.1, H * 0.9, 0.22, 12], '#111827', [0, H * 1, 0]], ['box', [H * 2.6, 0.05, H * 0.5], '#111827', [0, H * 0.9, 0], [0, 0, 0]], ['circle', [0.06], { c: '#fff', side: 2 }, [0, H * 1.0, H * 1.0]]); break;
    case 'wizard': head.parts.push(['cone', [H * 0.9, 1, 12], '#4c1d95', [0, H * 1.45, 0]], ['cyl', [H * 1.6, H * 1.6, 0.04, 20], '#4c1d95', [0, H * 0.95, 0]], ['octa', [0.06], { c: '#fde68a', e: '#facc15', ei: 0.7 }, [0, H * 1.5, H * 0.55]]); break;
    case 'santa': head.parts.push(['cone', [H * 0.95, 0.7, 12], '#dc2626', [0, H * 1.25, -0.05], [-15, 0, 0]], ['torus', [H * 0.95, 0.06, 8, 20], '#fff', [0, H * 0.95, 0], [90, 0, 0]], ['sphere', [0.08], '#fff', [0, H * 1.6, -0.3]]); break;
    case 'straw': head.parts.push(['cyl', [H * 1.7, H * 1.7, 0.04, 20], '#fde68a', [0, H * 0.85, 0]], ['cyl', [H * 0.9, H * 0.9, 0.3, 20], '#fde68a', [0, H * 1.05, 0]], ['torus', [H * 0.9, 0.03, 6, 20], '#dc2626', [0, H * 0.95, 0], [90, 0, 0]]); break;
    case 'bearskin': head.parts.push(['cyl', [H * 0.95, H * 1.05, 0.9, 16], '#111827', [0, H * 1.4, 0]], ['torus', [H * 1, 0.03, 6, 20], '#fbbf24', [0, H * 0.95, 0], [90, 0, 0]]); break;
    case 'elf': head.parts.push(['cone', [H * 0.9, 0.7, 10], '#16a34a', [0, H * 1.2, -0.05], [-25, 0, 0]], ['sphere', [0.06], '#fff', [0, H * 1.5, -0.35]]); break;
    case 'turban': head.parts.push(['sphere', [H * 1.12], '#f8fafc', [0, H * 0.45, 0], 0, [1, 0.75, 1]], ['octa', [0.07], { c: '#ef4444', e: '#ef4444', ei: 0.4 }, [0, H * 0.75, H * 0.95]]); break;
    case 'toque': head.parts.push(['cyl', [H * 0.8, H * 0.8, 0.25, 16], '#fff', [0, H * 1.05, 0]], ['sphere', [H * 0.95], '#fff', [0, H * 1.45, 0], 0, [1, 0.7, 1]]); break;
    case 'nursecap': head.parts.push(['box', [H * 1.2, 0.18, H * 0.9], '#fff', [0, H * 1.05, -0.02]], ['box', [0.12, 0.04, 0.02], '#ef4444', [0, H * 1.1, H * 0.43]], ['box', [0.04, 0.12, 0.02], '#ef4444', [0, H * 1.1, H * 0.43]]); break;
    case 'mirror': head.parts.push(['torus', [H * 1.02, 0.025, 6, 24], '#111827', [0, H * 0.5, 0], [78, 0, 0]], ['cyl', [0.09, 0.09, 0.03, 16], { c: '#e5e7eb', m: 0.7, r: 0.2 }, [0, H * 0.8, H * 0.8], [70, 0, 0]]); break;
    case 'tiny': head.parts.push(['cyl', [H * 0.4, H * 0.4, 0.2, 12], '#3b82f6', [H * 0.4, H * 1.15, 0], [0, 0, -15]]); break;
    default: break;
  }
  if (s.helmet) head.parts.push(['sphere', [H * 1.35], { c: '#bfe9ff', o: 0.35, r: 0.1 }, [0, 0.05, 0]]);
  if (s.mask) head.parts.push(['box', [H * 1.6, H * 0.5, 0.05], '#111827', [0, H * 0.2, H * 0.78]]);
  if (s.eyepatch) head.parts.push(['circle', [0.07], DARK, [-H * 0.4, H * 0.2, H * 0.92]]);
  if (s.nose) head.parts.push(['sphere', [0.07], s.nose, [0, -H * 0.1, H * 0.95]]);
  head.parts.push(['__face', H, { mouth: 'smile', eyes: 'open', blush: !s.zombie, glasses: !!s.glasses, beard: s.beard || null, kind: face }]);
  parts.push(head);
  const scale = s.baby ? 0.55 : s.child ? 0.78 : 1;
  // ---- sitting pose: thighs forward, shins down (used by restaurant guests) ----
  if (sit) {
    for (const side of [-1, 1]) {
      const leg = parts.find((x) => x && x.name === (side < 0 ? 'legL' : 'legR'));
      if (leg) { leg.rot = [-84, 0, 0]; leg.at = [leg.at[0], leg.at[1] - 0.06, leg.at[2] + 0.1]; }
    }
    parts.push({ name: 'shinL', at: [0.13, legH, 0], rot: [-4, 0, 0], parts: [['cyl', [0.085, 0.085, 0.46], pants, [0, 0.23, 0]], ['box', [0.2, 0.09, 0.28], DARK, [0, 0.03, 0.06]]] });
    parts.push({ name: 'shinR', at: [-0.13, legH, 0], rot: [-4, 0, 0], parts: [['cyl', [0.085, 0.085, 0.46], pants, [0, 0.23, 0]], ['box', [0.2, 0.09, 0.28], DARK, [0, 0.03, 0.06]]] });
  }
  return { parts, scale, float: !!s.float, sit };
}

/** Build a person group with named parts and a face decal. */
export function makePerson(key, opts = {}) {
  const spec = personParts(key, opts);
  const faces = [];
  const strip = (list) => list.map((p) => { if (Array.isArray(p) && p[0] === '__face') { faces.push(p); return null; } if (p && !Array.isArray(p)) return { ...p, parts: strip(p.parts || []) }; return p; }).filter(Boolean);
  const parts = strip(spec.parts);
  const { group, named } = build(parts);
  if (named.head && faces[0]) { const f = faceMesh(faces[0][1], faces[0][2]); named.head.add(f); named.face = f; }
  group.scale.setScalar(spec.scale * (opts.scale || 1));
  group.userData.float = spec.float; group.userData.sit = !!spec.sit;
  return { group, named };
}
export function makeAnimal(key, { color = null, scale = 1 } = {}) {
  const parts = animalParts(key, color); if (!parts) return null;
  const spec = ANIMALS[key];
  const { group, named } = build(parts);
  group.scale.setScalar((spec.scale || 1) * scale);
  group.userData.fly = spec.fly === true; group.userData.swim = !!spec.swim; group.userData.maybeFly = spec.fly === 'maybe';
  return { group, named };
}
export const isAnimal = (k) => Boolean(ANIMALS[k]);
export const isPerson = (k) => Boolean(PEOPLE[k]);
export { mat, D2R };
