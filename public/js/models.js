// Procedural low-poly model kit. Everything in the game is built from primitives at runtime:
// no downloaded assets, no paid libraries. Models stand on y=0 and face +Z.
import * as THREE from 'three';

// ---------- materials / geometry caches ----------
const matCache = new Map();
export function mat(c) {
  if (c && typeof c === 'object' && c.isMaterial) return c;
  const key = typeof c === 'string' ? c : JSON.stringify(c);
  if (matCache.has(key)) return matCache.get(key);
  let m;
  if (typeof c === 'string') m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, metalness: 0 });
  else {
    m = new THREE.MeshStandardMaterial({ color: c.c || '#fff', roughness: c.r ?? 0.9, metalness: c.m ?? 0, emissive: c.e || '#000', emissiveIntensity: c.ei ?? 1, transparent: c.o != null, opacity: c.o ?? 1, side: c.side === 2 ? THREE.DoubleSide : THREE.FrontSide, flatShading: !!c.flat, depthWrite: c.o == null || c.o > 0.95 });
    if (c.map) m.map = c.map;
  }
  matCache.set(key, m);
  return m;
}
const geoCache = new Map();
export function geo(type, p = []) {
  const key = type + ':' + p.join(',');
  if (geoCache.has(key)) return geoCache.get(key);
  let g;
  switch (type) {
    case 'box': g = new THREE.BoxGeometry(p[0] ?? 1, p[1] ?? 1, p[2] ?? 1); break;
    case 'sphere': g = new THREE.SphereGeometry(p[0] ?? 0.5, p[1] ?? 20, p[2] ?? 14); break;
    case 'cyl': g = new THREE.CylinderGeometry(p[0] ?? 0.5, p[1] ?? 0.5, p[2] ?? 1, p[3] ?? 18, p[4] ?? 1, p[5] ?? false, p[6] ?? 0, p[7] ?? Math.PI * 2); break;
    case 'cone': g = new THREE.ConeGeometry(p[0] ?? 0.5, p[1] ?? 1, p[2] ?? 18); break;
    case 'torus': g = new THREE.TorusGeometry(p[0] ?? 0.5, p[1] ?? 0.1, p[2] ?? 10, p[3] ?? 28, p[4] ?? Math.PI * 2); break;
    case 'capsule': g = new THREE.CapsuleGeometry(p[0] ?? 0.3, p[1] ?? 0.5, 6, 14); break;
    case 'plane': g = new THREE.PlaneGeometry(p[0] ?? 1, p[1] ?? 1); break;
    case 'circle': g = new THREE.CircleGeometry(p[0] ?? 0.5, p[1] ?? 32); break;
    case 'ring': g = new THREE.RingGeometry(p[0] ?? 0.3, p[1] ?? 0.5, p[2] ?? 32); break;
    case 'tetra': g = new THREE.TetrahedronGeometry(p[0] ?? 0.5, 0); break;
    case 'octa': g = new THREE.OctahedronGeometry(p[0] ?? 0.5, 0); break;
    case 'dodeca': g = new THREE.DodecahedronGeometry(p[0] ?? 0.5, 0); break;
    case 'ico': g = new THREE.IcosahedronGeometry(p[0] ?? 0.5, p[1] ?? 0); break;
    default: g = new THREE.BoxGeometry(1, 1, 1);
  }
  geoCache.set(key, g);
  return g;
}
const D2R = Math.PI / 180;

/**
 * Build a group from a compact part list.
 * part = [type, params, color, pos, rot(deg)?, scale?]  or  { name, at, rot?, parts:[...] } (a pivot sub-group)
 * returns { group, named } — named pivots/meshes can be animated by the caller.
 */
export function build(parts, group = new THREE.Group(), named = {}) {
  for (const part of parts) {
    if (!part) continue;
    if (!Array.isArray(part)) {
      const sub = new THREE.Group();
      if (part.at) sub.position.set(...part.at);
      if (part.rot) sub.rotation.set(part.rot[0] * D2R, part.rot[1] * D2R, part.rot[2] * D2R);
      if (part.scale != null) { const s = part.scale; if (Array.isArray(s)) sub.scale.set(...s); else sub.scale.setScalar(s); }
      build(part.parts || [], sub, named);
      if (part.name) { named[part.name] = sub; sub.name = part.name; }
      group.add(sub);
      continue;
    }
    const [type, params, color, pos, rot, scale, name] = part;
    const m = new THREE.Mesh(geo(type, params), mat(color));
    m.castShadow = true; m.receiveShadow = true;
    if (pos) m.position.set(pos[0], pos[1], pos[2]);
    if (rot) m.rotation.set(rot[0] * D2R, rot[1] * D2R, rot[2] * D2R);
    if (scale != null) { if (Array.isArray(scale)) m.scale.set(...scale); else m.scale.setScalar(scale); }
    if (name) { named[name] = m; m.name = name; }
    group.add(m);
  }
  return { group, named };
}

// ---------- canvas textures ----------
const texCache = new Map();
function canvasTex(key, w, h, draw) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}
export function emojiTexture(emoji, size = 128) {
  return canvasTex('emoji:' + emoji + size, size, size, (ctx, w, h) => {
    ctx.font = `${Math.round(size * 0.78)}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(emoji, w / 2, h / 2 + size * 0.04);
  });
}
export function textTexture(text, { bg = '#fff', fg = '#2b2140', w = 512, h = 128, font = 'bold 72px Fredoka, "Baloo Da 2", sans-serif', radius = 24 } = {}) {
  return canvasTex('txt:' + [text, bg, fg, w, h, font].join('|'), w, h, (ctx) => {
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(0, 0, w, h, radius); ctx.fill();
    ctx.fillStyle = fg; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w / 2, h / 2 + 4);
  });
}
function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export function groundTexture(kind) {
  return canvasTex('ground:' + kind, 256, 256, (ctx, w, h) => {
    const r = rnd(kind.length * 977);
    const dots = (n, colors, rad) => { for (let i = 0; i < n; i++) { ctx.fillStyle = colors[Math.floor(r() * colors.length)]; ctx.beginPath(); ctx.arc(r() * w, r() * h, rad * (0.5 + r()), 0, 7); ctx.fill(); } };
    switch (kind) {
      case 'grass': ctx.fillStyle = '#6cc26a'; ctx.fillRect(0, 0, w, h); dots(260, ['#5fb95d', '#7dd17a', '#58ad57', '#8ad987'], 7);
        ctx.strokeStyle = '#4fa84f'; ctx.lineWidth = 2; for (let i = 0; i < 160; i++) { const x = r() * w, y = r() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + (r() - 0.5) * 6, y - 6 - r() * 6); ctx.stroke(); } break;
      case 'sand': ctx.fillStyle = '#f3dba3'; ctx.fillRect(0, 0, w, h); dots(300, ['#ead08f', '#f8e6b7', '#e9cf95'], 4); break;
      case 'snow': ctx.fillStyle = '#f4f8ff'; ctx.fillRect(0, 0, w, h); dots(200, ['#e6eefc', '#ffffff', '#dfe9fa'], 6); break;
      case 'moon': ctx.fillStyle = '#8f8f9c'; ctx.fillRect(0, 0, w, h); dots(60, ['#7c7c8a', '#a1a1ae', '#6e6e7b'], 12); break;
      case 'stone': ctx.fillStyle = '#9aa38f'; ctx.fillRect(0, 0, w, h); dots(120, ['#8b957f', '#a9b29c', '#7f8875'], 10); break;
      case 'tile': { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = (i + j) % 2 ? '#f7efe4' : '#e9dccb'; ctx.fillRect(i * s, j * s, s, s); } ctx.strokeStyle = '#d9c9b4'; ctx.lineWidth = 3; for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, h); ctx.moveTo(0, i * s); ctx.lineTo(w, i * s); ctx.stroke(); } break; }
      case 'clinic': { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = (i + j) % 2 ? '#eef6ff' : '#dbe9f7'; ctx.fillRect(i * s, j * s, s, s); } break; }
      case 'check': { const n = 4, s = w / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { ctx.fillStyle = (i + j) % 2 ? '#d8f3e5' : '#e9d8f7'; ctx.fillRect(i * s, j * s, s, s); } break; }
      case 'wood': { ctx.fillStyle = '#b5703f'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#ad683a' : '#bd7846'; ctx.fillRect(0, i * (h / 6), w, h / 6 - 3); } ctx.strokeStyle = '#8d5330'; ctx.lineWidth = 2; for (let i = 0; i < 30; i++) { const y = r() * h; ctx.beginPath(); ctx.moveTo(r() * w, y); ctx.lineTo(r() * w, y + (r() - 0.5) * 4); ctx.stroke(); } break; }
      case 'road': ctx.fillStyle = '#4b5563'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f8fafc'; for (let i = 0; i < 4; i++) ctx.fillRect(i * 64 + 8, h / 2 - 5, 40, 10); break;
      case 'water': { const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#48b0ff'); g.addColorStop(1, '#2d8fe6'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; for (let i = 0; i < 26; i++) { const x = r() * w, y = r() * h; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 14, y - 6, x + 30 + r() * 20, y); ctx.stroke(); } break; }
      case 'carpet': ctx.fillStyle = '#c084fc'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#a855f7'; for (let i = 0; i < 8; i++) ctx.fillRect(0, i * 32, w, 16); break;
      case 'lava': ctx.fillStyle = '#7c2d12'; ctx.fillRect(0, 0, w, h); dots(80, ['#9a3412', '#431407'], 12); break;
      case 'stars': ctx.fillStyle = '#1e1b4b'; ctx.fillRect(0, 0, w, h); dots(120, ['#fff', '#fde68a', '#c7d2fe'], 2); break;
      case 'window': { ctx.fillStyle = '#3f3f5a'; ctx.fillRect(0, 0, w, h); for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) { ctx.fillStyle = r() < 0.6 ? '#fde68a' : '#5b5b7a'; ctx.fillRect(14 + i * 60, 10 + j * 40, 36, 26); } break; }
      case 'brick': { ctx.fillStyle = '#c2410c'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#ea580c'; for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) ctx.fillRect(((j % 2) * 32 + i * 64) % w, j * 32 + 2, 58, 26); break; }
      case 'bricksoft': { ctx.fillStyle = '#e7d4c0'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#f3e4d4'; for (let j = 0; j < 8; j++) for (let i = 0; i < 4; i++) ctx.fillRect(((j % 2) * 32 + i * 64) % w, j * 32 + 2, 58, 26); break; }
      case 'pizza': { ctx.fillStyle = '#f59e0b'; ctx.beginPath(); ctx.arc(128, 128, 126, 0, 7); ctx.fill(); ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(128, 128, 108, 0, 7); ctx.fill(); ctx.fillStyle = '#fde68a'; ctx.beginPath(); ctx.arc(128, 128, 100, 0, 7); ctx.fill(); ctx.fillStyle = '#b91c1c'; for (let i = 0; i < 8; i++) { const a = i * 0.8; ctx.beginPath(); ctx.arc(128 + Math.cos(a) * 60, 128 + Math.sin(a) * 60, 14, 0, 7); ctx.fill(); } break; }
      case 'map': { ctx.fillStyle = '#fef3c7'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#b45309'; ctx.lineWidth = 6; ctx.setLineDash([12, 10]); ctx.beginPath(); ctx.moveTo(30, 200); ctx.bezierCurveTo(90, 60, 160, 220, 220, 60); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#dc2626'; ctx.font = 'bold 60px sans-serif'; ctx.fillText('X', 200, 80); break; }
      case 'painting': { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#93c5fd'); g.addColorStop(0.6, '#fde68a'); g.addColorStop(1, '#86efac'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fbbf24'; ctx.beginPath(); ctx.arc(190, 60, 30, 0, 7); ctx.fill(); ctx.fillStyle = '#15803d'; ctx.beginPath(); ctx.moveTo(40, 220); ctx.lineTo(110, 120); ctx.lineTo(180, 220); ctx.fill(); break; }
      default: ctx.fillStyle = '#9ca3af'; ctx.fillRect(0, 0, w, h);
    }
  });
}
export function repeatTex(tex, rx, ry) { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.needsUpdate = true; return t; }

/** Flat "sticker" of an emoji standing upright (fallback for things without a 3D model). */
export function emojiStandee(emoji, size = 1) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo('plane', [size, size]), new THREE.MeshBasicMaterial({ map: emojiTexture(emoji, 256), transparent: true, side: THREE.DoubleSide, alphaTest: 0.1 }));
  m.position.y = size / 2 + 0.02; m.castShadow = true; g.add(m); g.userData.billboard = true;
  return g;
}
export function spriteOf(emoji, size = 1, opts = {}) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(emoji, 128), transparent: true, depthWrite: false, ...opts }));
  s.scale.set(size, size, 1); return s;
}
export function blobShadow(r = 0.6) {
  const tex = canvasTex('blob', 128, 128, (ctx) => { const g = ctx.createRadialGradient(64, 64, 10, 64, 64, 64); g.addColorStop(0, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128); });
  const m = new THREE.Mesh(geo('plane', [r * 2, r * 2]), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.015; m.renderOrder = 1; return m;
}

// ---------- shared sub-assemblies ----------
const WOOD = '#8b5a2b', DARK = '#2f2f3a', GLASS = { c: '#bfe9ff', o: 0.7, r: 0.2 }, LEAF = '#3fa34d';
const wheel = (x, y, z, r = 0.22, w = 0.16) => ['cyl', [r, r, w, 16], DARK, [x, y, z], [0, 0, 90]];
const windowBox = (x, y, z, w = 0.5, h = 0.5) => ['box', [w, h, 0.06], '#bfe9ff', [x, y, z]];
function buildingSign(text, y, z, bg = '#fff', fg = '#2b2140', w = 2.2) {
  return ['plane', [w, w * 0.25], { c: '#fff', map: textTexture(text, { bg, fg }) }, [0, y, z]];
}
function flower(c, x = 0, z = 0, h = 0.6, petal = 0.12) {
  const parts = [['cyl', [0.025, 0.03, h], '#2f855a', [x, h / 2, z]], ['sphere', [petal * 0.8], '#fbbf24', [x, h, z + 0.02]]];
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; parts.push(['sphere', [petal], c, [x + Math.cos(a) * petal * 1.5, h + Math.sin(a) * petal * 1.5, z]]); }
  parts.push(['sphere', [0.1], LEAF, [x + 0.08, h * 0.45, z], 0, [1, 0.3, 0.5]]);
  return parts;
}
function tree(c = LEAF, s = 1) {
  return [['cyl', [0.18, 0.26, 1.3 * s], WOOD, [0, 0.65 * s, 0]], ['sphere', [1 * s], c, [0, 2 * s, 0]], ['sphere', [0.72 * s], c, [0.6 * s, 1.5 * s, 0.3 * s]], ['sphere', [0.66 * s], c, [-0.6 * s, 1.6 * s, -0.2 * s]], ['sphere', [0.6 * s], c, [0.1 * s, 2.6 * s, -0.3 * s]]];
}
function pine(c = '#2f855a', s = 1) {
  return [['cyl', [0.14, 0.2, 1 * s], WOOD, [0, 0.5 * s, 0]], ['cone', [1.1 * s, 1.2 * s, 10], c, [0, 1.4 * s, 0]], ['cone', [0.85 * s, 1.1 * s, 10], c, [0, 2.1 * s, 0]], ['cone', [0.58 * s, 1 * s, 10], c, [0, 2.75 * s, 0]]];
}
function palm(s = 1) {
  const parts = [['cyl', [0.13, 0.22, 2.8 * s, 10], '#a0714f', [0, 1.4 * s, 0], [0, 0, 6]], ['sphere', [0.14], '#6b4423', [0.2, 2.75 * s, 0.1]], ['sphere', [0.14], '#6b4423', [0.35, 2.7 * s, -0.1]]];
  for (let i = 0; i < 6; i++) { const a = i * 60; parts.push({ at: [0.28, 2.8 * s, 0], rot: [0, a, 0], parts: [['box', [0.42, 0.05, 1.7], '#2f9e44', [0, 0, 0.85], [-22, 0, 0]]] }); }
  return parts;
}
function person(shirt = '#60a5fa', pants = '#374151', skin = '#f6c9a8', hair = '#3b2f2f') {
  return [['cyl', [0.09, 0.09, 0.45], pants, [-0.12, 0.225, 0]], ['cyl', [0.09, 0.09, 0.45], pants, [0.12, 0.225, 0]], ['capsule', [0.22, 0.32], shirt, [0, 0.78, 0]], ['sphere', [0.24], skin, [0, 1.28, 0]], ['sphere', [0.25], hair, [0, 1.36, -0.03], 0, [1, 0.6, 1]], ['capsule', [0.07, 0.3], shirt, [-0.3, 0.8, 0], [0, 0, 15]], ['capsule', [0.07, 0.3], shirt, [0.3, 0.8, 0], [0, 0, -15]]];
}
function house(c = '#f8d9a8', roof = '#e2574c', s = 1) {
  return [['box', [2.4 * s, 1.7 * s, 2 * s], c, [0, 0.85 * s, 0]], ['cone', [1.95 * s, 1.2 * s, 4], roof, [0, 2.3 * s, 0], [0, 45, 0]], ['box', [0.5 * s, 0.9 * s, 0.08], '#8b5a2b', [0, 0.45 * s, 1.01 * s]], ['sphere', [0.05], '#fbbf24', [0.15 * s, 0.45 * s, 1.06 * s]], windowBox(-0.7 * s, 1.05 * s, 1.01 * s, 0.5 * s, 0.5 * s), windowBox(0.7 * s, 1.05 * s, 1.01 * s, 0.5 * s, 0.5 * s), ['box', [0.3 * s, 0.7 * s, 0.3 * s], '#9f6b53', [0.7 * s, 2.5 * s, -0.4 * s]]];
}
function table(c = '#fff', wood = WOOD) {
  return [['cyl', [0.85, 0.85, 0.08, 24], c, [0, 0.76, 0]], ['cyl', [0.1, 0.14, 0.72], wood, [0, 0.36, 0]], ['cyl', [0.4, 0.4, 0.05, 20], wood, [0, 0.03, 0]]];
}
function chair(c = WOOD, x = 0, z = 0, ry = 0) {
  return { at: [x, 0, z], rot: [0, ry, 0], parts: [['box', [0.45, 0.06, 0.45], c, [0, 0.45, 0]], ['box', [0.45, 0.5, 0.06], c, [0, 0.72, -0.2]], ['cyl', [0.03, 0.03, 0.45], c, [-0.18, 0.22, -0.18]], ['cyl', [0.03, 0.03, 0.45], c, [0.18, 0.22, -0.18]], ['cyl', [0.03, 0.03, 0.45], c, [-0.18, 0.22, 0.18]], ['cyl', [0.03, 0.03, 0.45], c, [0.18, 0.22, 0.18]]] };
}

// ---------- the model library ----------
// Each entry: (c) => parts, where c is an optional colour override from the child ("a red house").
export const MODELS = {
  house: (c) => house(c || '#f8d9a8'),
  bighouse: (c) => [['box', [3.4, 3, 2.4], c || '#fde68a', [0, 1.5, 0]], ['cone', [2.7, 1.4, 4], '#dc2626', [0, 3.7, 0], [0, 45, 0]], ['box', [0.6, 1.1, 0.08], WOOD, [0, 0.55, 1.21]], windowBox(-1, 1.1, 1.21), windowBox(1, 1.1, 1.21), windowBox(-1, 2.2, 1.21), windowBox(1, 2.2, 1.21), windowBox(0, 2.2, 1.21)],
  tree: (c) => tree(c || LEAF),
  palm: () => palm(),
  pine: (c) => pine(c || '#2f855a'),
  flower: (c) => flower(c || '#f472b6'), rose: (c) => flower(c || '#ef4444'), tulip: (c) => [['cyl', [0.03, 0.03, 0.7], '#2f855a', [0, 0.35, 0]], ['cyl', [0.16, 0.08, 0.3, 8], c || '#f43f5e', [0, 0.78, 0]], ['sphere', [0.12], LEAF, [0.1, 0.3, 0], 0, [1, 0.3, 0.5]]],
  sunflower: (c) => flower(c || '#facc15', 0, 0, 1.1, 0.16).concat([['sphere', [0.22], '#7c4a1d', [0, 1.1, 0.06]]]),
  grass: (c) => [0, 1, 2, 3, 4].map((i) => ['cone', [0.08, 0.5 + (i % 2) * 0.2, 5], c || '#4ade80', [(i - 2) * 0.14, 0.3, (i % 2) * 0.1], [0, 0, (i - 2) * 8]]),
  mushroom: (c) => [['cyl', [0.14, 0.18, 0.5], '#fef3c7', [0, 0.25, 0]], ['sphere', [0.46], c || '#ef4444', [0, 0.52, 0], 0, [1, 0.6, 1]], ['sphere', [0.07], '#fff', [0.2, 0.72, 0.2]], ['sphere', [0.06], '#fff', [-0.22, 0.7, 0.1]], ['sphere', [0.05], '#fff', [0, 0.78, -0.25]]],
  cactus: (c) => [['cyl', [0.3, 0.34, 0.3], '#c2410c', [0, 0.15, 0]], ['capsule', [0.22, 1.1], c || '#16a34a', [0, 0.95, 0]], ['capsule', [0.12, 0.4], c || '#16a34a', [-0.42, 0.95, 0], [0, 0, 20]], ['capsule', [0.12, 0.3], c || '#16a34a', [0.4, 1.15, 0], [0, 0, -20]]],
  car: (c) => [['box', [1.8, 0.5, 0.9], c || '#ef4444', [0, 0.5, 0]], ['box', [1, 0.45, 0.8], c || '#ef4444', [-0.1, 0.95, 0]], ['box', [0.9, 0.35, 0.82], GLASS, [-0.1, 0.98, 0]], wheel(-0.6, 0.25, 0.45), wheel(0.6, 0.25, 0.45), wheel(-0.6, 0.25, -0.45), wheel(0.6, 0.25, -0.45), ['sphere', [0.08], { c: '#fef3c7', e: '#fde68a' }, [0.9, 0.5, 0.3]], ['sphere', [0.08], { c: '#fef3c7', e: '#fde68a' }, [0.9, 0.5, -0.3]]],
  bus: (c) => [['box', [3.2, 1.4, 1.2], c || '#facc15', [0, 0.95, 0]], ['box', [3, 0.5, 1.22], '#bfe9ff', [0, 1.3, 0]], wheel(-1.1, 0.3, 0.6, 0.3, 0.2), wheel(1.1, 0.3, 0.6, 0.3, 0.2), wheel(-1.1, 0.3, -0.6, 0.3, 0.2), wheel(1.1, 0.3, -0.6, 0.3, 0.2), ['box', [0.5, 0.8, 0.08], '#374151', [0.6, 0.65, 0.61]]],
  truck: (c) => [['box', [1, 1, 1], c || '#3b82f6', [1, 0.8, 0]], ['box', [0.8, 0.4, 1.02], '#bfe9ff', [1.05, 1.05, 0]], ['box', [1.9, 1.1, 1.1], '#e5e7eb', [-0.55, 0.9, 0]], wheel(1, 0.3, 0.55, 0.3, 0.2), wheel(1, 0.3, -0.55, 0.3, 0.2), wheel(-0.9, 0.3, 0.55, 0.3, 0.2), wheel(-0.9, 0.3, -0.55, 0.3, 0.2)],
  rickshaw: (c) => [['box', [0.8, 0.4, 0.9], c || '#16a34a', [0, 0.7, 0]], ['box', [0.8, 0.5, 0.1], '#f472b6', [0, 1.1, -0.4]], ['cyl', [0.5, 0.5, 0.9, 12, 1, false, 0, Math.PI], '#fbbf24', [0, 1.25, -0.1], [0, 0, 90]], wheel(0, 0.4, 0.55, 0.4, 0.06), wheel(0, 0.4, -0.55, 0.4, 0.06), wheel(1, 0.3, 0, 0.3, 0.06), ['cyl', [0.03, 0.03, 1], DARK, [0.6, 0.6, 0], [0, 0, 60]]],
  boat: (c) => [['cyl', [0.9, 0.55, 0.5, 8], c || '#8b5a2b', [0, 0.25, 0], 0, [1, 1, 0.5]], ['cyl', [0.03, 0.03, 1.8], WOOD, [0, 1.3, 0]], ['plane', [0.9, 1.3], { c: '#fff', side: 2 }, [0.47, 1.4, 0]]],
  ship: (c) => [['cyl', [2.2, 1.4, 1.2, 10], c || '#7c4a1d', [0, 0.6, 0], 0, [1, 1, 0.45]], ['box', [1.4, 0.6, 0.8], '#a16207', [-0.5, 1.5, 0]], ['cyl', [0.05, 0.05, 3.2], WOOD, [0.4, 2.6, 0]], ['plane', [1.5, 1.6], { c: '#fef3c7', side: 2 }, [0.4, 2.9, 0], [0, 90, 0]], ['plane', [0.6, 0.35], { c: '#111827', side: 2 }, [0.72, 4.1, 0], [0, 90, 0]]],
  rocket: (c) => [['cyl', [0.4, 0.46, 1.8, 20], c || '#f8fafc', [0, 1.3, 0]], ['cone', [0.42, 0.8, 20], '#ef4444', [0, 2.6, 0]], ['box', [0.3, 0.7, 0.1], '#ef4444', [0.5, 0.55, 0], [0, 0, 20]], ['box', [0.3, 0.7, 0.1], '#ef4444', [-0.5, 0.55, 0], [0, 0, -20]], ['box', [0.1, 0.7, 0.3], '#ef4444', [0, 0.55, 0.5], [-20, 0, 0]], ['circle', [0.18], '#60a5fa', [0, 1.5, 0.47]], ['cone', [0.3, 0.6, 12], { c: '#fb923c', e: '#f97316' }, [0, 0.15, 0], [180, 0, 0], 1, 'flame']],
  plane: (c) => [['capsule', [0.3, 1.6], c || '#f8fafc', [0, 0, 0], [0, 0, 90]], ['box', [0.7, 0.06, 3], '#60a5fa', [0, 0, 0]], ['box', [0.5, 0.06, 1], '#60a5fa', [-1, 0.1, 0]], ['box', [0.5, 0.5, 0.06], '#60a5fa', [-1, 0.3, 0]], ['circle', [0.12], '#1f2937', [0.5, 0.12, 0.29]], ['box', [0.06, 1, 0.1], DARK, [1.15, 0, 0], 0, 1, 'rotor']],
  helicopter: (c) => [['sphere', [0.6], c || '#f59e0b', [0, 0, 0], 0, [1.2, 0.8, 0.9]], ['sphere', [0.5], GLASS, [0.35, 0.05, 0], 0, [1, 0.7, 0.8]], ['cyl', [0.12, 0.06, 1.8], c || '#f59e0b', [-1.3, 0.1, 0], [0, 0, 90]], ['box', [2.6, 0.05, 0.2], DARK, [0, 0.6, 0], 0, 1, 'rotor'], ['box', [0.1, 0.1, 1.6], '#4b5563', [0, -0.6, 0]]],
  train: (c) => [['cyl', [0.5, 0.5, 1.6, 16], c || '#ef4444', [0.3, 0.75, 0], [0, 0, 90]], ['box', [0.9, 1.2, 1], c || '#ef4444', [-0.9, 0.85, 0]], ['box', [0.6, 0.4, 1.02], '#bfe9ff', [-0.9, 1.1, 0]], ['cyl', [0.12, 0.18, 0.5], DARK, [0.7, 1.4, 0]], wheel(0.5, 0.3, 0.5, 0.3), wheel(-0.4, 0.3, 0.5, 0.3), wheel(-1.1, 0.3, 0.5, 0.3), wheel(0.5, 0.3, -0.5, 0.3), wheel(-0.4, 0.3, -0.5, 0.3), wheel(-1.1, 0.3, -0.5, 0.3), ['box', [1.6, 1, 1], '#3b82f6', [-2.4, 0.75, 0]], wheel(-2, 0.3, 0.5, 0.3), wheel(-2.8, 0.3, 0.5, 0.3), wheel(-2, 0.3, -0.5, 0.3), wheel(-2.8, 0.3, -0.5, 0.3)],
  bicycle: (c) => [['torus', [0.4, 0.04, 8, 24], DARK, [-0.5, 0.4, 0]], ['torus', [0.4, 0.04, 8, 24], DARK, [0.5, 0.4, 0]], ['box', [1, 0.06, 0.06], c || '#ef4444', [0, 0.65, 0], [0, 0, 20]], ['box', [0.6, 0.06, 0.06], c || '#ef4444', [0.2, 0.75, 0], [0, 0, -60]], ['box', [0.3, 0.05, 0.08], DARK, [-0.1, 1, 0]], ['box', [0.05, 0.05, 0.4], DARK, [0.5, 1.05, 0]]],
  cloud: () => [['sphere', [0.7], '#fff', [0, 0.5, 0]], ['sphere', [0.55], '#fff', [0.7, 0.4, 0.1]], ['sphere', [0.5], '#fff', [-0.7, 0.35, 0]], ['sphere', [0.45], '#fff', [0.2, 0.3, -0.5]]],
  rainbow: () => ['#ef4444', '#fb923c', '#facc15', '#22c55e', '#3b82f6', '#a855f7'].map((c, i) => ['torus', [5.2 - i * 0.28, 0.14, 8, 40, Math.PI], { c, e: c, ei: 0.25, side: 2 }, [0, 0, 0]]),
  river: () => [['plane', [14, 2.4], { c: '#4cc3ff', o: 0.85 }, [0, 0.03, 0], [-90, 0, 0]]],
  mountain: (c) => [['cone', [3, 4.2, 7], c || '#7d8597', [0, 2.1, 0]], ['cone', [0.95, 1.35, 7], '#f8fafc', [0, 3.55, 0]]],
  volcano: () => [['cyl', [0.9, 3, 3.4, 9], '#6b4423', [0, 1.7, 0]], ['circle', [0.85], { c: '#f97316', e: '#f97316' }, [0, 3.41, 0], [-90, 0, 0]], ['sphere', [0.5], { c: '#9ca3af', o: 0.6 }, [0.2, 4.2, 0], 0, 1, 'smoke']],
  castle: (c) => { const w = c || '#cbd5e1'; const t = (x, z) => [['cyl', [0.65, 0.7, 3.6, 12], w, [x, 1.8, z]], ['cone', [0.8, 1.2, 12], '#3b82f6', [x, 4.2, z]]]; return [['box', [3.4, 2.6, 2.6], w, [0, 1.3, 0]], ...t(-1.9, 1.5), ...t(1.9, 1.5), ...t(-1.9, -1.5), ...t(1.9, -1.5), ['box', [0.9, 1.4, 0.1], '#3f2a14', [0, 0.7, 1.31]], ['cyl', [0.02, 0.02, 1.2], DARK, [0, 5.3, 1.5]], ['plane', [0.6, 0.35], { c: '#ef4444', side: 2 }, [0.3, 5.7, 1.5]]]; },
  bridge: (c) => [['box', [4, 0.18, 1.2], c || WOOD, [0, 0.5, 0]], ['box', [0.12, 0.6, 0.12], c || WOOD, [-1.8, 0.8, 0.55]], ['box', [0.12, 0.6, 0.12], c || WOOD, [1.8, 0.8, 0.55]], ['box', [4, 0.06, 0.06], c || WOOD, [0, 1.05, 0.55]], ['box', [0.12, 0.6, 0.12], c || WOOD, [-1.8, 0.8, -0.55]], ['box', [0.12, 0.6, 0.12], c || WOOD, [1.8, 0.8, -0.55]], ['box', [4, 0.06, 0.06], c || WOOD, [0, 1.05, -0.55]], ['box', [0.5, 0.5, 1.3], '#9ca3af', [-1.6, 0.25, 0]], ['box', [0.5, 0.5, 1.3], '#9ca3af', [1.6, 0.25, 0]]],
  slide: (c) => [['box', [0.8, 0.1, 0.8], '#f59e0b', [-1.2, 1.5, 0]], ['cyl', [0.05, 0.05, 1.5], '#f59e0b', [-1.5, 0.75, 0.3]], ['cyl', [0.05, 0.05, 1.5], '#f59e0b', [-1.5, 0.75, -0.3]], ['cyl', [0.05, 0.05, 1.5], '#f59e0b', [-0.9, 0.75, 0.3]], ['cyl', [0.05, 0.05, 1.5], '#f59e0b', [-0.9, 0.75, -0.3]], ['box', [2.6, 0.08, 0.7], c || '#38bdf8', [0.45, 0.85, 0], [0, 0, 32]], ['box', [2.6, 0.2, 0.06], c || '#38bdf8', [0.45, 0.95, 0.35], [0, 0, 32]], ['box', [2.6, 0.2, 0.06], c || '#38bdf8', [0.45, 0.95, -0.35], [0, 0, 32]]],
  swing: (c) => [['cyl', [0.06, 0.06, 2.4], '#2563eb', [-1.1, 1.1, 0.5], [12, 0, 0]], ['cyl', [0.06, 0.06, 2.4], '#2563eb', [-1.1, 1.1, -0.5], [-12, 0, 0]], ['cyl', [0.06, 0.06, 2.4], '#2563eb', [1.1, 1.1, 0.5], [12, 0, 0]], ['cyl', [0.06, 0.06, 2.4], '#2563eb', [1.1, 1.1, -0.5], [-12, 0, 0]], ['cyl', [0.06, 0.06, 2.4], '#2563eb', [0, 2.25, 0], [0, 0, 90]], { name: 'seat', at: [0, 2.2, 0], parts: [['cyl', [0.015, 0.015, 1.5], '#e5e7eb', [-0.3, -0.75, 0]], ['cyl', [0.015, 0.015, 1.5], '#e5e7eb', [0.3, -0.75, 0]], ['box', [0.8, 0.06, 0.3], c || '#ef4444', [0, -1.5, 0]]] }],
  tent: (c) => [['cone', [1.5, 1.6, 4], c || '#f97316', [0, 0.8, 0], [0, 45, 0]], ['cone', [0.45, 0.8, 3], '#431407', [0, 0.4, 0.82], [0, 0, 0]]],
  table: (c) => table(c || '#fff'),
  bed: (c) => [['box', [1.3, 0.35, 2.1], WOOD, [0, 0.3, 0]], ['box', [1.2, 0.2, 2], '#f8fafc', [0, 0.57, 0]], ['box', [1.22, 0.16, 1.3], c || '#60a5fa', [0, 0.72, 0.3]], ['box', [0.7, 0.16, 0.4], '#fff', [0, 0.73, -0.7]], ['box', [1.3, 0.9, 0.1], WOOD, [0, 0.45, -1.05]]],
  sofa: (c) => [['box', [1.9, 0.5, 0.9], c || '#f472b6', [0, 0.35, 0]], ['box', [1.9, 0.6, 0.3], c || '#f472b6', [0, 0.9, -0.3]], ['box', [0.3, 0.7, 0.9], c || '#f472b6', [-0.95, 0.55, 0]], ['box', [0.3, 0.7, 0.9], c || '#f472b6', [0.95, 0.55, 0]]],
  lamp: (c) => [['cyl', [0.2, 0.3, 0.2], DARK, [0, 0.1, 0]], ['cyl', [0.05, 0.05, 2.4], DARK, [0, 1.3, 0]], ['cone', [0.4, 0.4, 10], c || '#1f2937', [0, 2.6, 0]], ['sphere', [0.18], { c: '#fef3c7', e: '#fde68a', ei: 1.2 }, [0, 2.45, 0]]],
  tv: () => [['box', [1.4, 0.9, 0.12], '#111827', [0, 1, 0]], ['plane', [1.25, 0.75], { c: '#60a5fa', e: '#3b82f6', ei: 0.6 }, [0, 1, 0.07]], ['box', [0.4, 0.6, 0.3], DARK, [0, 0.3, 0]]],
  computer: () => [['box', [1.4, 0.08, 0.7], WOOD, [0, 0.7, 0]], ['cyl', [0.04, 0.04, 0.7], DARK, [-0.6, 0.35, 0.25]], ['cyl', [0.04, 0.04, 0.7], DARK, [0.6, 0.35, 0.25]], ['box', [0.9, 0.6, 0.06], '#111827', [0, 1.15, -0.15]], ['plane', [0.8, 0.5], { c: '#a7f3d0', e: '#34d399', ei: 0.5 }, [0, 1.15, -0.11]], ['box', [0.6, 0.04, 0.22], '#e5e7eb', [0, 0.76, 0.15]]],
  door: (c) => [['box', [1.1, 2.1, 0.12], '#e5e7eb', [0, 1.05, 0]], ['box', [0.85, 1.9, 0.14], c || '#92400e', [0, 0.95, 0]], ['sphere', [0.06], '#fbbf24', [0.3, 0.95, 0.1]]],
  window: () => [['box', [1.4, 1.4, 0.12], '#e5e7eb', [0, 1, 0]], ['box', [1.15, 1.15, 0.14], GLASS, [0, 1, 0]], ['box', [0.06, 1.15, 0.16], '#e5e7eb', [0, 1, 0]], ['box', [1.15, 0.06, 0.16], '#e5e7eb', [0, 1, 0]]],
  cake: (c) => [['cyl', [0.7, 0.7, 0.45, 24], '#fef3c7', [0, 0.23, 0]], ['cyl', [0.5, 0.5, 0.35, 24], c || '#f9a8d4', [0, 0.62, 0]], ['torus', [0.5, 0.06, 8, 24], '#fff', [0, 0.8, 0], [90, 0, 0]], ...[0, 1, 2].map((i) => ['cyl', [0.03, 0.03, 0.3], ['#60a5fa', '#f87171', '#fbbf24'][i], [(i - 1) * 0.22, 0.95, 0]]), ...[0, 1, 2].map((i) => ['sphere', [0.05], { c: '#fde68a', e: '#f59e0b' }, [(i - 1) * 0.22, 1.14, 0]])],
  balloons: (c) => [['sphere', [0.4], c || '#ef4444', [-0.35, 2.2, 0], 0, [1, 1.15, 1]], ['sphere', [0.4], '#3b82f6', [0.35, 2.5, 0.1], 0, [1, 1.15, 1]], ['sphere', [0.4], '#facc15', [0, 2.75, -0.3], 0, [1, 1.15, 1]], ['cyl', [0.01, 0.01, 2], '#6b7280', [-0.2, 1, 0], [0, 0, 6]], ['cyl', [0.01, 0.01, 2.2], '#6b7280', [0.2, 1.2, 0.05], [0, 0, -6]], ['cyl', [0.01, 0.01, 2.4], '#6b7280', [0, 1.35, -0.15]], ['box', [0.3, 0.2, 0.3], '#9ca3af', [0, 0.1, 0]]],
  gift: (c) => [['box', [0.9, 0.7, 0.9], c || '#ef4444', [0, 0.35, 0]], ['box', [0.95, 0.72, 0.2], '#fde68a', [0, 0.36, 0]], ['box', [0.2, 0.72, 0.95], '#fde68a', [0, 0.36, 0]], ['torus', [0.12, 0.05, 8, 16], '#fde68a', [-0.12, 0.85, 0], [0, 0, 40]], ['torus', [0.12, 0.05, 8, 16], '#fde68a', [0.12, 0.85, 0], [0, 0, -40]]],
  party: (c) => [['cyl', [0.04, 0.04, 2.6], WOOD, [-2, 1.3, 0]], ['cyl', [0.04, 0.04, 2.6], WOOD, [2, 1.3, 0]], ['plane', [3.8, 0.9], { c: '#fff', map: textTexture('🎉 PARTY! 🎉', { bg: '#f472b6', fg: '#fff' }), side: 2 }, [0, 2.3, 0]], ...MODELS.balloons(c)],
  robot: (c) => [['box', [0.8, 0.9, 0.5], c || '#94a3b8', [0, 0.95, 0]], ['box', [0.6, 0.55, 0.5], '#cbd5e1', [0, 1.75, 0]], ['sphere', [0.08], { c: '#60a5fa', e: '#3b82f6' }, [-0.15, 1.8, 0.26]], ['sphere', [0.08], { c: '#60a5fa', e: '#3b82f6' }, [0.15, 1.8, 0.26]], ['box', [0.3, 0.06, 0.04], DARK, [0, 1.62, 0.26]], ['cyl', [0.02, 0.02, 0.35], DARK, [0, 2.15, 0]], ['sphere', [0.07], { c: '#f87171', e: '#ef4444' }, [0, 2.35, 0]], { name: 'armL', at: [-0.5, 1.3, 0], parts: [['box', [0.18, 0.7, 0.18], '#64748b', [0, -0.35, 0]]] }, { name: 'armR', at: [0.5, 1.3, 0], parts: [['box', [0.18, 0.7, 0.18], '#64748b', [0, -0.35, 0]]] }, ['box', [0.25, 0.5, 0.3], '#475569', [-0.22, 0.25, 0]], ['box', [0.25, 0.5, 0.3], '#475569', [0.22, 0.25, 0]]],
  snowman: () => [['sphere', [0.6], '#fff', [0, 0.55, 0]], ['sphere', [0.45], '#fff', [0, 1.4, 0]], ['sphere', [0.34], '#fff', [0, 2.05, 0]], ['cone', [0.06, 0.35, 8], '#f97316', [0, 2.05, 0.45], [90, 0, 0]], ['sphere', [0.04], DARK, [-0.1, 2.15, 0.3]], ['sphere', [0.04], DARK, [0.1, 2.15, 0.3]], ['sphere', [0.05], DARK, [0, 1.5, 0.42]], ['sphere', [0.05], DARK, [0, 1.3, 0.44]], ['cyl', [0.25, 0.25, 0.4], DARK, [0, 2.5, 0]], ['cyl', [0.4, 0.4, 0.05], DARK, [0, 2.32, 0]], ['cyl', [0.02, 0.02, 0.9], WOOD, [-0.7, 1.5, 0], [0, 0, 60]], ['cyl', [0.02, 0.02, 0.9], WOOD, [0.7, 1.5, 0], [0, 0, -60]]],
  fire: () => [['cyl', [0.07, 0.07, 1], '#6b4423', [0, 0.08, 0], [0, 0, 90]], ['cyl', [0.07, 0.07, 1], '#6b4423', [0, 0.08, 0], [0, 60, 90]], ['cyl', [0.07, 0.07, 1], '#6b4423', [0, 0.08, 0], [0, -60, 90]], { name: 'flame', at: [0, 0.1, 0], parts: [['cone', [0.35, 0.9, 8], { c: '#f97316', e: '#f97316', ei: 0.9 }, [0, 0.45, 0]], ['cone', [0.2, 0.6, 8], { c: '#fde047', e: '#facc15', ei: 1 }, [0.05, 0.35, 0.05]]] }],
  ball: (c) => [['sphere', [0.38], c || '#ef4444', [0, 0.38, 0]], ['torus', [0.38, 0.03, 6, 28], '#fff', [0, 0.38, 0], [0, 20, 0]]],
  kite: (c) => [{ name: 'kite', at: [0, 1.5, 0], parts: [['octa', [0.6], c || '#f59e0b', [0, 0, 0], [0, 0, 0], [0.75, 1.1, 0.06]], ['box', [0.02, 1.3, 0.02], WOOD, [0, 0, 0.04]], ['box', [0.9, 0.02, 0.02], WOOD, [0, 0.1, 0.04]], ...[0, 1, 2, 3].map((i) => ['box', [0.14, 0.1, 0.02], ['#ef4444', '#3b82f6', '#22c55e', '#f472b6'][i], [(i % 2 ? 0.1 : -0.1), -0.8 - i * 0.22, 0]])] }, ['cyl', [0.008, 0.008, 1.4], '#9ca3af', [0.1, 0.7, 0.1], [0, 0, 8]]],
  book: (c) => [['box', [0.9, 0.12, 0.7], c || '#2563eb', [0, 0.06, 0], [0, 15, 0]], ['box', [0.84, 0.08, 0.66], '#fff', [0, 0.14, 0], [0, 15, 0]], ['box', [0.9, 0.04, 0.7], c || '#2563eb', [0, 0.2, 0], [0, 15, 0]]],
  phone: (c) => [['box', [0.4, 0.8, 0.07], c || '#111827', [0, 0.4, 0], [-10, 0, 0]], ['plane', [0.33, 0.62], { c: '#60a5fa', e: '#3b82f6', ei: 0.5 }, [0, 0.42, 0.04], [-10, 0, 0]]],
  piano: () => [['box', [1.7, 1, 0.7], '#111827', [0, 0.9, 0]], ['box', [1.6, 0.08, 0.35], '#fff', [0, 0.95, 0.5]], ...[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ['box', [0.07, 0.1, 0.2], '#111827', [-0.7 + i * 0.18, 1.0, 0.42]]), ['box', [0.1, 0.9, 0.1], '#111827', [-0.8, 0.45, 0.3]], ['box', [0.1, 0.9, 0.1], '#111827', [0.8, 0.45, 0.3]], ['box', [0.5, 0.06, 0.4], '#111827', [0, 0.5, 1.1]], ['box', [0.06, 0.5, 0.06], '#111827', [0, 0.25, 1.1]]],
  guitar: (c) => [['sphere', [0.42], c || '#b45309', [0, 0.42, 0], 0, [1, 1, 0.3]], ['sphere', [0.33], c || '#b45309', [0, 0.95, 0], 0, [1, 1, 0.3]], ['circle', [0.12], '#1f2937', [0, 0.55, 0.13]], ['box', [0.14, 1.1, 0.08], '#6b4423', [0, 1.6, 0]], ['box', [0.18, 0.3, 0.1], DARK, [0, 2.2, 0]], ...[0, 1, 2].map((i) => ['box', [0.01, 1.7, 0.01], '#e5e7eb', [-0.04 + i * 0.04, 1.2, 0.13]])],
  drum: (c) => [['cyl', [0.55, 0.55, 0.55, 24], c || '#ef4444', [0, 0.28, 0]], ['cyl', [0.56, 0.56, 0.04, 24], '#fef3c7', [0, 0.57, 0]], ['cyl', [0.02, 0.02, 0.6], WOOD, [-0.2, 0.75, 0.1], [0, 0, 50]], ['cyl', [0.02, 0.02, 0.6], WOOD, [0.2, 0.75, 0.1], [0, 0, -50]]],
  treasure: () => [['box', [1.1, 0.6, 0.7], '#7c4a1d', [0, 0.3, 0]], ['cyl', [0.35, 0.35, 1.1, 12, 1, false, Math.PI, Math.PI], '#7c4a1d', [0, 0.6, -0.3], [-60, 0, 90]], ['box', [1.12, 0.1, 0.72], '#fbbf24', [0, 0.35, 0]], ...[0, 1, 2, 3, 4, 5].map((i) => ['cyl', [0.12, 0.12, 0.05, 12], { c: '#fcd34d', m: 0.4, r: 0.4 }, [(i % 3 - 1) * 0.3, 0.63 + Math.floor(i / 3) * 0.05, (i % 2) * 0.2 - 0.1]]), ['octa', [0.12], { c: '#f472b6', e: '#f472b6', ei: 0.4 }, [0.3, 0.7, 0.15]], ['octa', [0.1], { c: '#60a5fa', e: '#3b82f6', ei: 0.4 }, [-0.3, 0.7, 0.1]]],
  ladder: (c) => [{ at: [0, 0, 0], rot: [-14, 0, 0], parts: [['cyl', [0.04, 0.04, 3], c || WOOD, [-0.3, 1.5, 0]], ['cyl', [0.04, 0.04, 3], c || WOOD, [0.3, 1.5, 0]], ...[0, 1, 2, 3, 4, 5].map((i) => ['cyl', [0.03, 0.03, 0.6], c || WOOD, [0, 0.35 + i * 0.48, 0], [0, 0, 90]])] }],
  umbrella: (c) => [['cyl', [0.03, 0.03, 2], '#e5e7eb', [0, 1, 0]], ['cone', [1.3, 0.55, 10], c || '#f43f5e', [0, 2.1, 0]], ['sphere', [0.06], '#e5e7eb', [0, 2.4, 0]]],
  pool: () => [['torus', [1.6, 0.18, 10, 32], '#38bdf8', [0, 0.18, 0], [90, 0, 0]], ['circle', [1.55], { c: '#7dd3fc', map: groundTexture('water') }, [0, 0.2, 0], [-90, 0, 0]]],
  shop: (c) => [['box', [3, 2.2, 2], c || '#f9a8d4', [0, 1.1, 0]], ['box', [3.2, 0.1, 2.2], '#be185d', [0, 2.25, 0]], ['box', [3.3, 0.5, 0.6], '#fff', [0, 1.9, 1.2], [20, 0, 0]], ['box', [0.7, 1.2, 0.08], '#9d174d', [-0.9, 0.6, 1.01]], ['box', [1.2, 0.9, 0.08], GLASS, [0.6, 1, 1.01]], buildingSign('SHOP', 1.65, 1.02, '#fff', '#be185d', 1.5)],
  school: (c) => [['box', [4, 2.4, 2.2], c || '#fde68a', [0, 1.2, 0]], ['cone', [3.1, 1.2, 4], '#b45309', [0, 3, 0], [0, 45, 0]], ['box', [0.8, 1.3, 0.08], '#92400e', [0, 0.65, 1.11]], windowBox(-1.3, 1.3, 1.11, 0.6, 0.6), windowBox(1.3, 1.3, 1.11, 0.6, 0.6), ['cyl', [0.03, 0.03, 3.5], '#9ca3af', [2.6, 1.75, 0.8]], ['plane', [0.7, 0.45], { c: '#16a34a', side: 2 }, [2.95, 3.25, 0.8]], ['circle', [0.14], { c: '#dc2626', side: 2 }, [2.9, 3.25, 0.81]], buildingSign('SCHOOL', 2.1, 1.12, '#fff', '#92400e', 1.8)],
  hospital: (c) => [['box', [3.6, 2.6, 2.2], c || '#f8fafc', [0, 1.3, 0]], ['box', [1.2, 0.3, 0.1], '#ef4444', [0, 2.1, 1.11]], ['box', [0.3, 1.2, 0.1], '#ef4444', [0, 2.1, 1.11]], ['box', [1, 1.3, 0.08], GLASS, [0, 0.65, 1.11]], windowBox(-1.2, 1.5, 1.11), windowBox(1.2, 1.5, 1.11)],
  mosque: (c) => [['box', [3, 1.8, 2.2], c || '#f8fafc', [0, 0.9, 0]], ['sphere', [1.1], '#22c55e', [0, 2, 0], 0, [1, 0.8, 1]], ['cyl', [0.22, 0.26, 4], c || '#f8fafc', [-1.9, 2, 0.6]], ['cone', [0.3, 0.5, 12], '#22c55e', [-1.9, 4.25, 0.6]], ['cyl', [0.22, 0.26, 4], c || '#f8fafc', [1.9, 2, 0.6]], ['cone', [0.3, 0.5, 12], '#22c55e', [1.9, 4.25, 0.6]], ['torus', [0.18, 0.04, 8, 20, 4.5], '#fbbf24', [0, 3.1, 0], [0, 0, 60]], ['cyl', [0.5, 0.5, 1.4, 12, 1, false, 0, Math.PI], '#166534', [0, 0.7, 1.11], [0, 0, 0]]],
  temple: (c) => [['box', [2.6, 1.4, 2.2], c || '#fde68a', [0, 0.7, 0]], ['cone', [2.2, 0.8, 4], '#dc2626', [0, 1.8, 0], [0, 45, 0]], ['box', [1.6, 0.9, 1.4], c || '#fde68a', [0, 2.5, 0]], ['cone', [1.5, 0.7, 4], '#dc2626', [0, 3.3, 0], [0, 45, 0]], ['cone', [0.5, 0.9, 4], '#fbbf24', [0, 4.1, 0], [0, 45, 0]]],
  church: (c) => [['box', [2.4, 2, 3], c || '#f8fafc', [0, 1, 0]], ['cone', [1.9, 1, 4], '#64748b', [0, 2.5, 0], [0, 45, 0]], ['box', [0.9, 3.2, 0.9], c || '#f8fafc', [0, 1.6, 1.3]], ['cone', [0.7, 1.4, 4], '#64748b', [0, 3.9, 1.3], [0, 45, 0]], ['box', [0.08, 0.6, 0.08], '#fbbf24', [0, 4.9, 1.3]], ['box', [0.35, 0.08, 0.08], '#fbbf24', [0, 5, 1.3]]],
  statue: () => [['box', [1.2, 0.6, 1.2], '#9ca3af', [0, 0.3, 0]], { at: [0, 0.6, 0], parts: person('#94a3b8', '#94a3b8', '#94a3b8', '#94a3b8') }],
  ferris: (c) => [['box', [0.2, 2.6, 0.2], '#6b7280', [-0.9, 1.3, 0], [0, 0, 20]], ['box', [0.2, 2.6, 0.2], '#6b7280', [0.9, 1.3, 0], [0, 0, -20]], { name: 'wheel', at: [0, 2.6, 0], parts: [['torus', [2.2, 0.08, 8, 40], c || '#ef4444', [0, 0, 0]], ...[0, 1, 2, 3].map((i) => ['box', [0.06, 4.4, 0.06], '#9ca3af', [0, 0, 0], [0, 0, i * 45]]), ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ['box', [0.5, 0.5, 0.4], ['#f472b6', '#60a5fa', '#facc15', '#4ade80'][i % 4], [Math.cos(i * Math.PI / 4) * 2.2, Math.sin(i * Math.PI / 4) * 2.2, 0]])] }],
  rollercoaster: (c) => [...[0, 1, 2, 3, 4].map((i) => ['torus', [1 + (i % 2) * 0.5, 0.08, 8, 24, Math.PI], c || '#ef4444', [(i - 2) * 2.2, 0, 0]]), ...[0, 1, 2, 3, 4].map((i) => ['box', [0.08, 1, 0.08], '#9ca3af', [(i - 2) * 2.2 - 0.9, 0.5, 0]]), ['box', [0.9, 0.5, 0.6], '#3b82f6', [-1.1, 1.5, 0]]],
  tractor: (c) => [['box', [1.4, 0.8, 0.9], c || '#16a34a', [0.1, 0.8, 0]], ['box', [0.8, 0.8, 0.85], GLASS, [-0.4, 1.5, 0]], ['cyl', [0.08, 0.08, 0.6], DARK, [0.6, 1.4, 0]], wheel(-0.5, 0.55, 0.55, 0.55, 0.3), wheel(-0.5, 0.55, -0.55, 0.55, 0.3), wheel(0.65, 0.3, 0.5, 0.3, 0.2), wheel(0.65, 0.3, -0.5, 0.3, 0.2)],
  windmill: (c) => [['cyl', [0.6, 1, 3, 8], c || '#fef3c7', [0, 1.5, 0]], ['cone', [0.8, 0.8, 8], '#dc2626', [0, 3.4, 0]], { name: 'blades', at: [0, 2.8, 0.9], parts: [0, 1, 2, 3].map((i) => ['box', [0.3, 2.4, 0.04], '#f8fafc', [0, 0, 0], [0, 0, i * 90]].concat([])).concat([['box', [0.14, 0.14, 0.3], WOOD, [0, 0, 0]]]) }],
  bench: (c) => [['box', [1.6, 0.08, 0.45], c || WOOD, [0, 0.45, 0]], ['box', [1.6, 0.4, 0.08], c || WOOD, [0, 0.75, -0.2]], ['box', [0.08, 0.45, 0.4], DARK, [-0.7, 0.22, 0]], ['box', [0.08, 0.45, 0.4], DARK, [0.7, 0.22, 0]]],
  pizza: () => [['cyl', [0.65, 0.65, 0.08, 28], { c: '#fde68a', map: groundTexture('pizza') }, [0, 0.04, 0]], ['torus', [0.62, 0.05, 8, 28], '#d97706', [0, 0.08, 0], [90, 0, 0]]],
  icecream: (c) => [['cone', [0.28, 0.8, 12], '#d6a461', [0, 0.4, 0], [180, 0, 0]], ['sphere', [0.3], c || '#f9a8d4', [0, 0.95, 0]], ['sphere', [0.26], '#fef3c7', [0, 1.35, 0.05]], ['sphere', [0.07], '#ef4444', [0, 1.6, 0.08]]],
  apple: (c) => [['sphere', [0.36], c || '#ef4444', [0, 0.36, 0], 0, [1, 0.92, 1]], ['cyl', [0.03, 0.03, 0.2], WOOD, [0, 0.75, 0]], ['sphere', [0.1], LEAF, [0.1, 0.75, 0], 0, [1, 0.3, 0.5]]],
  banana: () => [['torus', [0.5, 0.11, 10, 20, 2.2], '#facc15', [0, 0.25, 0], [0, 0, -20]]],
  mango: () => [['sphere', [0.34], '#fbbf24', [0, 0.32, 0], 0, [0.9, 1, 0.75]], ['sphere', [0.08], LEAF, [0.1, 0.62, 0]]],
  orange: () => [['sphere', [0.33], '#fb923c', [0, 0.33, 0]], ['sphere', [0.07], LEAF, [0.05, 0.66, 0], 0, [1, 0.3, 0.6]]],
  watermelon: () => [['sphere', [0.5], '#16a34a', [0, 0.5, 0], 0, [1.25, 1, 1]], ['circle', [0.46], '#f43f5e', [0.63, 0.5, 0], [0, 90, 0]]],
  burger: () => [['sphere', [0.45], '#f59e0b', [0, 0.55, 0], 0, [1, 0.6, 1]], ['cyl', [0.44, 0.44, 0.12, 20], '#78350f', [0, 0.3, 0]], ['cyl', [0.47, 0.47, 0.05, 20], '#4ade80', [0, 0.39, 0]], ['box', [0.7, 0.05, 0.7], '#facc15', [0, 0.44, 0], [0, 20, 0]], ['cyl', [0.44, 0.44, 0.16, 20], '#f59e0b', [0, 0.14, 0]]],
  candy: (c) => [['sphere', [0.28], c || '#f472b6', [0, 0.3, 0]], ['cone', [0.14, 0.3, 8], c || '#f472b6', [0.4, 0.3, 0], [0, 0, 90]], ['cone', [0.14, 0.3, 8], c || '#f472b6', [-0.4, 0.3, 0], [0, 0, -90]], ['torus', [0.28, 0.04, 6, 20], '#fff', [0, 0.3, 0], [0, 90, 0]]],
  cookie: () => [['cyl', [0.45, 0.45, 0.1, 24], '#d6a461', [0, 0.06, 0]], ...[0, 1, 2, 3, 4].map((i) => ['sphere', [0.06], '#3f2a14', [Math.cos(i * 1.26) * 0.25, 0.12, Math.sin(i * 1.26) * 0.25]])],
  juice: (c) => [['box', [0.45, 0.8, 0.3], c || '#fb923c', [0, 0.4, 0]], ['box', [0.45, 0.15, 0.3], '#f8fafc', [0, 0.85, 0]], ['cyl', [0.03, 0.03, 0.6], '#ef4444', [0.1, 1.05, 0], [0, 0, -15]]],
  water: () => [['cyl', [0.2, 0.2, 0.9, 16], { c: '#bfe9ff', o: 0.6 }, [0, 0.45, 0]], ['cyl', [0.1, 0.1, 0.15, 12], '#3b82f6', [0, 0.97, 0]], ['cyl', [0.21, 0.21, 0.3, 16], '#38bdf8', [0, 0.3, 0]]],
  toy: () => [['sphere', [0.3], '#b45309', [0, 0.55, 0]], ['sphere', [0.25], '#b45309', [0, 1, 0]], ['sphere', [0.08], '#b45309', [-0.18, 1.2, 0]], ['sphere', [0.08], '#b45309', [0.18, 1.2, 0]], ['sphere', [0.04], DARK, [-0.08, 1.03, 0.22]], ['sphere', [0.04], DARK, [0.08, 1.03, 0.22]], ['sphere', [0.06], '#fde68a', [0, 0.94, 0.24]], ['capsule', [0.08, 0.2], '#b45309', [-0.32, 0.6, 0.1], [0, 0, 30]], ['capsule', [0.08, 0.2], '#b45309', [0.32, 0.6, 0.1], [0, 0, -30]]],
  teddy: () => MODELS.toy(),
  doll: () => [{ at: [0, 0, 0], scale: 0.6, parts: person('#f472b6', '#f9a8d4', '#f6c9a8', '#fbbf24') }],
  blocks: () => [['box', [0.5, 0.5, 0.5], '#ef4444', [0, 0.25, 0]], ['box', [0.5, 0.5, 0.5], '#3b82f6', [0.55, 0.25, 0.1]], ['box', [0.5, 0.5, 0.5], '#facc15', [0.25, 0.75, 0.05], [0, 15, 0]]],
  flag: (c) => [['cyl', [0.03, 0.03, 2.4], '#9ca3af', [0, 1.2, 0]], ['plane', [1.1, 0.7], { c: c || '#16a34a', side: 2 }, [0.57, 2, 0]], ['circle', [0.22], { c: '#dc2626', side: 2 }, [0.5, 2, 0.01]]],
  heart: (c) => [{ name: 'float', at: [0, 0.9, 0], parts: [['sphere', [0.28], { c: c || '#ef4444', e: c || '#ef4444', ei: 0.25 }, [-0.2, 0.15, 0]], ['sphere', [0.28], { c: c || '#ef4444', e: c || '#ef4444', ei: 0.25 }, [0.2, 0.15, 0]], ['box', [0.46, 0.46, 0.46], { c: c || '#ef4444', e: c || '#ef4444', ei: 0.25 }, [0, -0.05, 0], [0, 0, 45]]] }],
  magic: () => [['cyl', [0.03, 0.03, 1.2], '#111827', [0, 0.6, 0], [0, 0, -20]], ['octa', [0.18], { c: '#fde68a', e: '#facc15', ei: 0.8 }, [0.22, 1.2, 0], 0, [1, 1, 0.4], 'float']],
  crown: () => [['cyl', [0.45, 0.4, 0.4, 8], { c: '#fbbf24', m: 0.5, r: 0.4 }, [0, 0.3, 0]], ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ['cone', [0.1, 0.3, 4], { c: '#fbbf24', m: 0.5, r: 0.4 }, [Math.cos(i * Math.PI / 4) * 0.42, 0.6, Math.sin(i * Math.PI / 4) * 0.42]]), ['sphere', [0.08], '#ef4444', [0, 0.35, 0.43]]],
  sword: () => [['box', [0.12, 1.4, 0.04], { c: '#cbd5e1', m: 0.6, r: 0.3 }, [0, 1.1, 0]], ['box', [0.5, 0.08, 0.1], '#fbbf24', [0, 0.4, 0]], ['cyl', [0.05, 0.05, 0.4], '#7c4a1d', [0, 0.2, 0]]],
  shield: (c) => [['cyl', [0.6, 0.5, 0.1, 6], c || '#3b82f6', [0, 0.65, 0], [90, 0, 0]], ['box', [0.7, 0.14, 0.06], '#fbbf24', [0, 0.65, 0.08]], ['box', [0.14, 0.7, 0.06], '#fbbf24', [0, 0.65, 0.08]]],
  ghost: () => [{ name: 'float', at: [0, 0.6, 0], parts: [['capsule', [0.4, 0.6], { c: '#f8fafc', o: 0.85 }, [0, 0.4, 0]], ['sphere', [0.06], DARK, [-0.14, 0.7, 0.36]], ['sphere', [0.06], DARK, [0.14, 0.7, 0.36]], ['sphere', [0.07], DARK, [0, 0.5, 0.38], 0, [1, 1.4, 0.6]]] }],
  alien: (c) => [['sphere', [0.45], c || '#4ade80', [0, 1.3, 0], 0, [1, 1.2, 0.9]], ['capsule', [0.2, 0.4], c || '#4ade80', [0, 0.55, 0]], ['sphere', [0.12], DARK, [-0.18, 1.35, 0.38], 0, [1, 1.6, 0.5]], ['sphere', [0.12], DARK, [0.18, 1.35, 0.38], 0, [1, 1.6, 0.5]], ['cyl', [0.02, 0.02, 0.4], c || '#4ade80', [-0.15, 1.95, 0], [0, 0, 15]], ['cyl', [0.02, 0.02, 0.4], c || '#4ade80', [0.15, 1.95, 0], [0, 0, -15]], ['sphere', [0.06], { c: '#f472b6', e: '#f472b6' }, [-0.2, 2.15, 0]], ['sphere', [0.06], { c: '#f472b6', e: '#f472b6' }, [0.2, 2.15, 0]]],
  monster: (c) => [['sphere', [0.7], c || '#a855f7', [0, 0.8, 0]], ['sphere', [0.22], '#fff', [0, 0.95, 0.6]], ['sphere', [0.11], DARK, [0, 0.95, 0.78]], ['cone', [0.12, 0.35, 6], '#fde68a', [-0.35, 1.45, 0], [0, 0, 20]], ['cone', [0.12, 0.35, 6], '#fde68a', [0.35, 1.45, 0], [0, 0, -20]], ...[0, 1, 2].map((i) => ['cone', [0.06, 0.14, 4], '#fff', [(i - 1) * 0.16, 0.5, 0.64], [180, 0, 0]]), ['capsule', [0.1, 0.25], c || '#a855f7', [-0.3, 0.2, 0.2]], ['capsule', [0.1, 0.25], c || '#a855f7', [0.3, 0.2, 0.2]]],
  satellite: () => [['box', [0.6, 0.6, 0.6], '#cbd5e1', [0, 0, 0]], ['box', [1.6, 0.04, 0.6], '#1d4ed8', [1.3, 0, 0]], ['box', [1.6, 0.04, 0.6], '#1d4ed8', [-1.3, 0, 0]], ['cone', [0.4, 0.2, 16], '#e5e7eb', [0, 0.45, 0], [180, 0, 0]]],
  planet: (c) => [['sphere', [0.9], c || '#fb923c', [0, 0, 0]], ['torus', [1.4, 0.12, 6, 40], '#fde68a', [0, 0, 0], [75, 0, 20]]],
  earth: () => [['sphere', [0.9], '#3b82f6', [0, 0, 0]], ['sphere', [0.4], '#22c55e', [0.5, 0.4, 0.6], 0, [1, 0.6, 0.5]], ['sphere', [0.35], '#22c55e', [-0.6, -0.2, 0.55], 0, [1, 0.8, 0.5]], ['sphere', [0.3], '#22c55e', [0.1, -0.6, 0.7], 0, [1, 0.5, 0.4]]],
  comet: (c) => [['sphere', [0.4], { c: c || '#fde68a', e: '#facc15', ei: 0.8 }, [0, 0, 0]], ['cone', [0.35, 2, 12], { c: '#fef3c7', e: '#fde68a', ei: 0.4, o: 0.6 }, [-1.1, 0.3, 0], [0, 0, 80]]],
  sandcastle: () => [['box', [1.4, 0.8, 1.2], '#f3dba3', [0, 0.4, 0]], ...[[-0.6, 0.5], [0.6, 0.5], [-0.6, -0.5], [0.6, -0.5]].flatMap(([x, z]) => [['cyl', [0.25, 0.28, 1.3, 10], '#f3dba3', [x, 0.65, z]], ['cone', [0.3, 0.4, 10], '#f3dba3', [x, 1.5, z]]]), ['box', [0.4, 0.5, 0.1], '#c2a56c', [0, 0.25, 0.61]], ['cyl', [0.01, 0.01, 0.6], '#6b7280', [0, 1.1, 0]], ['plane', [0.25, 0.16], { c: '#ef4444', side: 2 }, [0.13, 1.3, 0]]],
  shell: (c) => [['sphere', [0.35], c || '#f9a8d4', [0, 0.18, 0], 0, [1, 0.5, 0.9]], ...[0, 1, 2, 3, 4].map((i) => ['box', [0.03, 0.2, 0.6], '#fbcfe8', [(i - 2) * 0.12, 0.2, 0], [0, (i - 2) * 12, 0]])],
  anchor: () => [['torus', [0.5, 0.07, 8, 24, Math.PI], '#475569', [0, 0.5, 0], [0, 0, 180]], ['box', [0.1, 1.5, 0.1], '#475569', [0, 0.8, 0]], ['box', [0.7, 0.1, 0.1], '#475569', [0, 1.45, 0]], ['torus', [0.14, 0.04, 6, 14], '#475569', [0, 1.7, 0]]],
  map: () => [['plane', [1.2, 0.9], { c: '#fef3c7', map: groundTexture('map'), side: 2 }, [0, 0.6, 0], [-30, 0, 0]], ['cyl', [0.05, 0.05, 1.2], WOOD, [0, 0.95, -0.2], [0, 0, 90]]],
  telescope: () => [['cyl', [0.03, 0.03, 1.4], DARK, [-0.4, 0.7, 0], [0, 0, 18]], ['cyl', [0.03, 0.03, 1.4], DARK, [0.4, 0.7, 0], [0, 0, -18]], ['cyl', [0.03, 0.03, 1.4], DARK, [0, 0.7, -0.4], [-18, 0, 0]], ['cyl', [0.14, 0.1, 1.4, 14], '#1d4ed8', [0, 1.5, 0.1], [-45, 0, 0]]],
  clock: () => [['cyl', [0.5, 0.5, 0.12, 28], '#fbbf24', [0, 1, 0], [90, 0, 0]], ['circle', [0.42], '#fff', [0, 1, 0.07]], ['box', [0.04, 0.3, 0.02], DARK, [0, 1.12, 0.09]], ['box', [0.04, 0.22, 0.02], DARK, [0.08, 1.05, 0.09], [0, 0, -70]], ['cyl', [0.06, 0.1, 0.9], DARK, [0, 0.45, 0]]],
  present_box: (c) => MODELS.gift(c),
  medicine: () => [['cyl', [0.22, 0.22, 0.7, 14], '#fff', [0, 0.35, 0]], ['cyl', [0.14, 0.14, 0.15, 14], '#ef4444', [0, 0.77, 0]], ['box', [0.3, 0.3, 0.02], '#60a5fa', [0, 0.35, 0.22]]],
  bandage: () => [['box', [0.8, 0.26, 0.06], '#fde68a', [0, 0.4, 0], [0, 0, 30]], ['box', [0.3, 0.3, 0.07], '#fef3c7', [0, 0.4, 0], [0, 0, 30]]],
  stethoscope: () => [['torus', [0.35, 0.04, 8, 24, Math.PI], '#111827', [0, 0.9, 0]], ['cyl', [0.02, 0.02, 0.6], '#111827', [0, 0.45, 0]], ['cyl', [0.12, 0.12, 0.06, 16], '#9ca3af', [0, 0.12, 0]]],
  soccer: () => [['sphere', [0.38], '#fff', [0, 0.38, 0]], ...[0, 1, 2, 3, 4].map((i) => ['sphere', [0.11], '#111827', [Math.cos(i * 1.26) * 0.33, 0.38 + (i % 2) * 0.2 - 0.1, Math.sin(i * 1.26) * 0.33], 0, [1, 1, 0.4]])],
  cricket: () => [['box', [0.18, 1.1, 0.07], '#d6a461', [0, 0.55, 0], [0, 0, -15]], ['cyl', [0.03, 0.03, 0.35], '#7c4a1d', [0.19, 1.26, 0], [0, 0, -15]], ['sphere', [0.14], '#dc2626', [0.5, 0.14, 0.2]]],
  trophy: () => [['cyl', [0.4, 0.2, 0.7, 16], { c: '#fbbf24', m: 0.5, r: 0.35 }, [0, 0.95, 0]], ['torus', [0.2, 0.04, 6, 16, Math.PI], { c: '#fbbf24', m: 0.5, r: 0.35 }, [-0.45, 1.05, 0], [0, 0, 90]], ['torus', [0.2, 0.04, 6, 16, Math.PI], { c: '#fbbf24', m: 0.5, r: 0.35 }, [0.45, 1.05, 0], [0, 0, -90]], ['cyl', [0.08, 0.08, 0.35], { c: '#fbbf24', m: 0.5, r: 0.35 }, [0, 0.45, 0]], ['box', [0.5, 0.25, 0.5], '#4b2e13', [0, 0.12, 0]]],
  microphone: () => [['cyl', [0.3, 0.4, 0.08, 16], DARK, [0, 0.04, 0]], ['cyl', [0.03, 0.03, 1.5], '#9ca3af', [0, 0.8, 0]], ['cyl', [0.04, 0.04, 0.3], DARK, [0, 1.6, 0.1], [50, 0, 0]], ['sphere', [0.14], '#6b7280', [0, 1.72, 0.22]]],
  camera: (c) => [['box', [0.8, 0.5, 0.4], c || '#374151', [0, 0.4, 0]], ['cyl', [0.17, 0.17, 0.25, 16], '#111827', [0, 0.4, 0.3], [90, 0, 0]], ['circle', [0.1], { c: '#60a5fa', e: '#3b82f6' }, [0, 0.4, 0.43]], ['box', [0.25, 0.1, 0.3], '#111827', [-0.2, 0.7, 0]]],
  painting: () => [['cyl', [0.03, 0.03, 1.8], WOOD, [-0.5, 0.9, 0.1], [0, 0, 10]], ['cyl', [0.03, 0.03, 1.8], WOOD, [0.5, 0.9, 0.1], [0, 0, -10]], ['cyl', [0.03, 0.03, 1.8], WOOD, [0, 0.9, -0.4], [-15, 0, 0]], ['plane', [1.1, 0.9], { c: '#fff', map: groundTexture('painting'), side: 2 }, [0, 1.1, 0.14], [-5, 0, 0]], ['box', [1.2, 1, 0.04], '#fde68a', [0, 1.1, 0.11], [-5, 0, 0]]],
  garden_pot: (c) => [['cyl', [0.35, 0.28, 0.5, 14], c || '#c2410c', [0, 0.25, 0]], ['sphere', [0.4], LEAF, [0, 0.75, 0]], ['sphere', [0.3], LEAF, [0.25, 0.95, 0.1]], ...flower('#f472b6', -0.1, 0.1, 0.9, 0.08)],
  star: () => [['octa', [0.5], { c: '#fde68a', e: '#facc15', ei: 0.9 }, [0, 0.6, 0], [0, 45, 0], [1, 1.3, 0.3], 'float']],
  sun: () => [['sphere', [0.9], { c: '#fde047', e: '#facc15', ei: 1 }, [0, 0.9, 0]], ...[0, 1, 2, 3, 4, 5, 6, 7].map((i) => ['cone', [0.14, 0.5, 6], { c: '#fde047', e: '#facc15', ei: 1 }, [Math.cos(i * Math.PI / 4) * 1.25, 0.9 + Math.sin(i * Math.PI / 4) * 1.25, 0], [0, 0, -i * 45 - 90]])],
  moon: () => [['sphere', [0.8], { c: '#fef9c3', e: '#fde68a', ei: 0.7 }, [0, 0.8, 0]], ['sphere', [0.15], '#e5d9a4', [0.3, 1, 0.65]], ['sphere', [0.1], '#e5d9a4', [-0.3, 0.6, 0.7]]],
  snowflake: () => [...[0, 1, 2].map((i) => ['box', [1.2, 0.08, 0.08], { c: '#e0f2fe', e: '#bae6fd', ei: 0.5 }, [0, 0.7, 0], [0, 0, i * 60]]), ...[0, 1, 2].map((i) => ['box', [0.08, 1.2, 0.08], { c: '#e0f2fe', e: '#bae6fd', ei: 0.5 }, [0, 0.7, 0], [0, 0, i * 60 + 30]])],
  wave: () => [['torus', [0.7, 0.2, 10, 24, 2.6], '#38bdf8', [0, 0.3, 0], [0, 0, 10]], ['sphere', [0.2], '#e0f2fe', [-0.6, 0.65, 0]]],
  rice: () => [['cyl', [0.5, 0.35, 0.3, 20], '#f8fafc', [0, 0.15, 0]], ['sphere', [0.42], '#fff', [0, 0.35, 0], 0, [1, 0.6, 1]]],
  noodles: () => [['cyl', [0.5, 0.35, 0.35, 20], '#ef4444', [0, 0.18, 0]], ['sphere', [0.42], '#fde68a', [0, 0.4, 0], 0, [1, 0.5, 1]], ['cyl', [0.02, 0.02, 0.9], '#d6a461', [0.1, 0.7, 0], [0, 0, 30]], ['cyl', [0.02, 0.02, 0.9], '#d6a461', [0.2, 0.7, 0], [0, 0, 20]]],
  soup: () => MODELS.noodles(),
  bread: () => [['capsule', [0.25, 0.6], '#d6a461', [0, 0.25, 0], [0, 0, 90]]],
  egg: () => [['cyl', [0.5, 0.5, 0.04, 20], '#fff', [0, 0.02, 0]], ['sphere', [0.2], '#facc15', [0, 0.1, 0], 0, [1, 0.6, 1]]],
  milk: () => [['box', [0.4, 0.7, 0.4], '#fff', [0, 0.35, 0]], ['cone', [0.3, 0.25, 4], '#fff', [0, 0.82, 0], [0, 45, 0]], ['box', [0.3, 0.3, 0.02], '#60a5fa', [0, 0.35, 0.21]]],
  tea: () => [['cyl', [0.25, 0.2, 0.3, 16], '#fff', [0, 0.15, 0]], ['torus', [0.1, 0.03, 6, 14, Math.PI], '#fff', [0.28, 0.15, 0], [0, 0, -90]], ['circle', [0.22], '#b45309', [0, 0.31, 0], [-90, 0, 0]], ['cyl', [0.45, 0.45, 0.03, 20], '#fff', [0, 0.015, 0]]],
  sandwich: () => [['box', [0.8, 0.1, 0.8], '#f5d6a7', [0, 0.05, 0]], ['box', [0.82, 0.05, 0.82], '#4ade80', [0, 0.13, 0]], ['box', [0.78, 0.06, 0.78], '#f87171', [0, 0.18, 0]], ['box', [0.8, 0.1, 0.8], '#f5d6a7', [0, 0.27, 0]]],
  fries: () => [['box', [0.6, 0.5, 0.35], '#ef4444', [0, 0.25, 0]], ...[0, 1, 2, 3, 4].map((i) => ['box', [0.08, 0.7, 0.08], '#facc15', [(i - 2) * 0.1, 0.55, (i % 2) * 0.1 - 0.05], [0, 0, (i - 2) * 6]])],
  donut: (c) => [['torus', [0.32, 0.14, 12, 28], '#d6a461', [0, 0.14, 0], [90, 0, 0]], ['torus', [0.32, 0.12, 12, 28], c || '#f472b6', [0, 0.2, 0], [90, 0, 0]]],
  strawberry: () => [['sphere', [0.3], '#ef4444', [0, 0.3, 0], 0, [1, 1.15, 1]], ['cone', [0.2, 0.15, 6], LEAF, [0, 0.66, 0]]],
  grapes: () => [...[0, 1, 2, 3, 4, 5, 6].map((i) => ['sphere', [0.14], '#a855f7', [(i % 3 - 1) * 0.22, 0.6 - Math.floor(i / 3) * 0.22, (i % 2) * 0.1]]), ['cyl', [0.02, 0.02, 0.3], WOOD, [0, 0.85, 0]]],
  carrot: () => [['cone', [0.15, 0.8, 10], '#fb923c', [0, 0.4, 0], [180, 0, 0]], ['cone', [0.1, 0.3, 5], LEAF, [0, 0.9, 0]]],
  corn: () => [['capsule', [0.14, 0.6], '#facc15', [0, 0.45, 0]], ['cone', [0.15, 0.5, 5], LEAF, [0.1, 0.4, 0], [0, 0, -20]]],
  coconut: () => [['sphere', [0.35], '#7c4a1d', [0, 0.35, 0]], ['circle', [0.14], '#fff', [0, 0.5, 0.3], [-30, 0, 0]]],
  popcorn: () => [['cyl', [0.3, 0.25, 0.6, 12], '#ef4444', [0, 0.3, 0]], ...[0, 1, 2, 3, 4].map((i) => ['sphere', [0.1], '#fef3c7', [(i % 3 - 1) * 0.15, 0.65 + (i % 2) * 0.1, (i % 2) * 0.12 - 0.06]])],
  hotdog: () => [['capsule', [0.14, 0.7], '#f5d6a7', [0, 0.18, 0], [0, 0, 90]], ['capsule', [0.09, 0.8], '#dc2626', [0, 0.3, 0], [0, 0, 90]], ['box', [0.7, 0.03, 0.05], '#facc15', [0, 0.4, 0], [0, 0, 0]]],
  cheese: () => [['cyl', [0.5, 0.5, 0.35, 3], '#facc15', [0, 0.18, 0], [0, 30, 0]], ['sphere', [0.07], '#eab308', [0.1, 0.36, 0.1]]],
  pie: () => [['cyl', [0.55, 0.45, 0.25, 20], '#d6a461', [0, 0.12, 0]], ['cyl', [0.5, 0.5, 0.08, 20], '#b45309', [0, 0.28, 0]]],
  chicken_food: () => [['capsule', [0.18, 0.4], '#d97706', [0, 0.25, 0], [0, 0, 60]], ['cyl', [0.04, 0.04, 0.3], '#fef3c7', [0.35, 0.4, 0], [0, 0, 60]]],
  bag: (c) => [['box', [0.7, 0.8, 0.35], c || '#f472b6', [0, 0.4, 0]], ['torus', [0.2, 0.03, 6, 16, Math.PI], DARK, [0, 0.8, 0]]],
  shoes: (c) => [['capsule', [0.14, 0.4], c || '#ef4444', [-0.2, 0.14, 0], [90, 0, 0]], ['capsule', [0.14, 0.4], c || '#ef4444', [0.2, 0.14, 0], [90, 0, 0]]],
  hat: (c) => [['cyl', [0.6, 0.6, 0.05, 20], c || '#7c3aed', [0, 0.03, 0]], ['cyl', [0.35, 0.38, 0.5, 20], c || '#7c3aed', [0, 0.28, 0]], ['torus', [0.36, 0.04, 6, 20], '#fbbf24', [0, 0.1, 0], [90, 0, 0]]],
  dress: (c) => [['cone', [0.6, 1.1, 14], c || '#f472b6', [0, 0.55, 0]], ['cyl', [0.22, 0.3, 0.5, 14], c || '#f472b6', [0, 1.35, 0]]],
  shirt: (c) => [['box', [0.8, 0.9, 0.2], c || '#3b82f6', [0, 0.5, 0]], ['box', [0.3, 0.5, 0.2], c || '#3b82f6', [-0.5, 0.75, 0], [0, 0, 20]], ['box', [0.3, 0.5, 0.2], c || '#3b82f6', [0.5, 0.75, 0], [0, 0, -20]]],
  watch: () => [['torus', [0.3, 0.08, 8, 24], '#111827', [0, 0.4, 0]], ['circle', [0.24], '#fff', [0, 0.4, 0.09]], ['box', [0.03, 0.18, 0.02], DARK, [0, 0.48, 0.1]]],
  pencil: (c) => [['cyl', [0.06, 0.06, 1.2, 6], c || '#facc15', [0, 0.6, 0], [0, 0, 20]], ['cone', [0.06, 0.2, 6], '#f5d6a7', [-0.24, 1.26, 0], [0, 0, 20]], ['cyl', [0.06, 0.06, 0.12, 6], '#f472b6', [0.22, -0.02, 0], [0, 0, 20]]],
  crayons: () => ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7'].map((c, i) => ['cyl', [0.05, 0.05, 0.7, 8], c, [(i - 2) * 0.13, 0.35, 0], [0, 0, (i - 2) * 5]]),
  puzzle: () => [['box', [0.5, 0.08, 0.5], '#ef4444', [-0.26, 0.04, 0.26]], ['box', [0.5, 0.08, 0.5], '#3b82f6', [0.26, 0.04, 0.26]], ['box', [0.5, 0.08, 0.5], '#22c55e', [-0.26, 0.04, -0.26]], ['box', [0.5, 0.08, 0.5], '#facc15', [0.3, 0.1, -0.3], [0, 20, 0]]],
  balloon: (c) => [['sphere', [0.4], c || '#ef4444', [0, 1.9, 0], 0, [1, 1.15, 1]], ['cyl', [0.01, 0.01, 1.5], '#6b7280', [0, 0.75, 0]]],
  flowers: () => [...flower('#f472b6', -0.2, 0), ...flower('#facc15', 0.2, 0.1, 0.7), ...flower('#60a5fa', 0, -0.2, 0.5)],
  glasses: () => [['torus', [0.2, 0.03, 8, 20], DARK, [-0.25, 0.4, 0]], ['torus', [0.2, 0.03, 8, 20], DARK, [0.25, 0.4, 0]], ['box', [0.1, 0.03, 0.03], DARK, [0, 0.4, 0]]],
  scarf: (c) => [['torus', [0.35, 0.1, 8, 24], c || '#ef4444', [0, 0.5, 0], [90, 0, 0]], ['box', [0.2, 0.6, 0.08], c || '#ef4444', [0.2, 0.2, 0.3]]],
  socks: (c) => [['capsule', [0.1, 0.4], c || '#3b82f6', [-0.15, 0.4, 0]], ['capsule', [0.1, 0.4], c || '#3b82f6', [0.15, 0.4, 0]], ['capsule', [0.1, 0.2], c || '#3b82f6', [-0.1, 0.1, 0.1], [90, 0, 0]], ['capsule', [0.1, 0.2], c || '#3b82f6', [0.2, 0.1, 0.1], [90, 0, 0]]],
};
export const ALIASES = { present_box: 'gift', teddy: 'toy', chicken: 'chicken_food', pasta: 'noodles', biryani: 'rice', dal: 'soup', salad: 'sandwich', kebab: 'hotdog', samosa: 'cheese', sweet: 'donut', pancake: 'pie', cola: 'juice', lemonade: 'juice', honey: 'juice', taco: 'sandwich', sushi: 'rice', meat: 'chicken_food', garden: 'garden_pot' };

export function hasModel(key) { return Boolean(MODELS[key] || MODELS[ALIASES[key]]); }
/** Build an object model (or an emoji standee fallback). Returns { group, named }. */
export function makeObject(key, { color = null, emoji = '✨', scale = 1 } = {}) {
  const fn = MODELS[key] || MODELS[ALIASES[key]];
  if (!fn) { const g = emojiStandee(emoji, 1.2); g.scale.setScalar(scale); return { group: g, named: {} }; }
  const built = build(fn(color && color !== 'rainbow' ? color : null));
  built.group.scale.setScalar(scale);
  return built;
}
export { person as personParts, tree as treeParts, pine as pineParts, palm as palmParts, flower as flowerParts, house as houseParts, table as tableParts, chair as chairParts, textTexture as signTexture, WOOD, DARK, GLASS, LEAF };
