// The 3D pet: a chibi character built from primitives with a hand-drawn expressive face,
// procedural animation (idle, walk, talk, 12 moods, 10 actions) and outfits.
import * as THREE from 'three';
import { build, mat, geo, blobShadow, DARK, WOOD } from './models.js';
import { facePatch } from './creatures.js';

const PETS = {
  cat: { body: '#8b5cf6', belly: '#ddd6fe', inner: '#f9a8d4', nose: '#f472b6', ears: 'cat', tail: 'cat', whiskers: true },
  bunny: { body: '#f9a8d4', belly: '#fdf2f8', inner: '#f472b6', nose: '#ec4899', ears: 'bunny', tail: 'pom' },
  dino: { body: '#34d399', belly: '#d1fae5', inner: '#059669', nose: null, ears: 'dino', tail: 'dino' },
};
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (cur, target, k, dt) => lerp(cur, target, 1 - Math.exp(-k * dt));

// ---------- face ----------
const faceCache = new Map();
function drawFace({ type = 'cat', mood = 'happy', blink = false, talk = 0, listen = false }) {
  const key = [type, mood, blink, talk, listen].join('|');
  if (faceCache.has(key)) return faceCache.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.clearRect(0, 0, 256, 256);
  const P = PETS[type];
  const EY = 108, EX = [86, 170], ER = mood === 'surprised' ? 30 : mood === 'excited' ? 28 : 25;
  const closedHappy = mood === 'relieved' || mood === 'proud' || (mood === 'happy' && talk === 0 && false);
  const sleepy = mood === 'sleepy' || mood === 'sick';
  // blush
  if (!['sad', 'worried', 'sick', 'thinking'].includes(mood)) { x.fillStyle = mood === 'love' ? 'rgba(255,90,140,.5)' : 'rgba(255,120,150,.32)'; for (const bx of [48, 208]) { x.beginPath(); x.ellipse(bx, 150, 20, 11, 0, 0, 7); x.fill(); } }
  if (mood === 'sick') { x.fillStyle = 'rgba(120,200,120,.35)'; for (const bx of [48, 208]) { x.beginPath(); x.ellipse(bx, 150, 20, 11, 0, 0, 7); x.fill(); } }
  // eyes
  x.lineCap = 'round'; x.lineJoin = 'round';
  EX.forEach((ex, i) => {
    const wink = mood === 'silly' && i === 1;
    if (blink || closedHappy || wink) {
      x.strokeStyle = '#2b2140'; x.lineWidth = 7; x.beginPath();
      if (closedHappy || wink) x.arc(ex, EY + 6, ER * 0.8, Math.PI * 1.1, Math.PI * 1.9); else { x.moveTo(ex - ER * 0.8, EY + 4); x.lineTo(ex + ER * 0.8, EY + 4); }
      x.stroke(); return;
    }
    // white
    x.fillStyle = '#fff'; x.beginPath(); x.ellipse(ex, EY, ER, ER * 1.15, 0, 0, 7); x.fill();
    // pupil
    const look = mood === 'thinking' ? [8, -10] : listen ? [0, -3] : [0, 2];
    const pr = mood === 'surprised' ? ER * 0.5 : mood === 'worried' || mood === 'sad' ? ER * 0.55 : ER * 0.72;
    if (mood === 'love') {
      x.fillStyle = '#ef4466'; const hx = ex + look[0], hy = EY + look[1] + 2, s = ER * 0.5;
      x.beginPath(); x.moveTo(hx, hy + s); x.bezierCurveTo(hx - s * 1.6, hy - s * 0.2, hx - s * 0.9, hy - s * 1.3, hx, hy - s * 0.4); x.bezierCurveTo(hx + s * 0.9, hy - s * 1.3, hx + s * 1.6, hy - s * 0.2, hx, hy + s); x.fill();
    } else {
      x.fillStyle = '#2b2140'; x.beginPath(); x.ellipse(ex + look[0], EY + look[1], pr, pr * 1.1, 0, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(ex + look[0] + pr * 0.35, EY + look[1] - pr * 0.4, pr * 0.3, 0, 7); x.fill();
      x.beginPath(); x.arc(ex + look[0] - pr * 0.3, EY + look[1] + pr * 0.4, pr * 0.14, 0, 7); x.fill();
    }
    // lids
    if (sleepy) { x.fillStyle = P.body; x.beginPath(); x.ellipse(ex, EY - ER * 0.55, ER + 2, ER * 0.75, 0, 0, 7); x.fill(); }
    if (mood === 'sad' || mood === 'worried') { x.fillStyle = P.body; x.save(); x.translate(ex, EY - ER * 0.9); x.rotate((i ? -1 : 1) * 0.35); x.beginPath(); x.ellipse(0, 0, ER + 4, ER * 0.6, 0, 0, 7); x.fill(); x.restore(); }
    if (mood === 'proud') { /* handled by closedHappy */ }
  });
  // brows
  x.strokeStyle = '#2b2140'; x.lineWidth = 6;
  if (mood === 'thinking' || mood === 'surprised') { x.beginPath(); x.moveTo(EX[1] - 22, EY - 44); x.lineTo(EX[1] + 20, EY - 52); x.stroke(); }
  if (mood === 'worried' || mood === 'sad') EX.forEach((ex, i) => { x.beginPath(); x.moveTo(ex - 20, EY - 40 + (i ? 8 : 0)); x.lineTo(ex + 20, EY - 40 + (i ? 0 : 8)); x.stroke(); });
  // nose
  if (P.nose) { x.fillStyle = P.nose; x.beginPath(); if (type === 'cat') { x.moveTo(128 - 9, 142); x.lineTo(128 + 9, 142); x.lineTo(128, 152); } else { x.ellipse(128, 145, 9, 6, 0, 0, 7); } x.fill(); }
  else { x.fillStyle = 'rgba(0,0,0,.35)'; for (const nx of [118, 138]) { x.beginPath(); x.ellipse(nx, 146, 4, 3, 0, 0, 7); x.fill(); } }
  // mouth
  const my = 170;
  x.strokeStyle = '#6b2140'; x.fillStyle = '#6b2140'; x.lineWidth = 6;
  if (talk > 0) { x.beginPath(); x.ellipse(128, my + 8, 12 + talk * 6, 8 + talk * 12, 0, 0, 7); x.fill(); x.fillStyle = '#ff8fa3'; x.beginPath(); x.ellipse(128, my + 14 + talk * 6, 8, 4 + talk * 4, 0, 0, 7); x.fill(); }
  else if (mood === 'surprised') { x.beginPath(); x.ellipse(128, my + 6, 11, 14, 0, 0, 7); x.fill(); }
  else if (mood === 'sad' || mood === 'worried') { x.beginPath(); x.arc(128, my + 22, 16, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
  else if (mood === 'sick') { x.beginPath(); x.moveTo(108, my + 4); x.quadraticCurveTo(118, my - 6, 128, my + 4); x.quadraticCurveTo(138, my + 14, 148, my + 4); x.stroke(); }
  else if (mood === 'thinking') { x.beginPath(); x.moveTo(114, my + 6); x.lineTo(140, my + 2); x.stroke(); }
  else if (mood === 'silly') { x.beginPath(); x.arc(128, my - 2, 20, 0.1 * Math.PI, 0.9 * Math.PI); x.stroke(); x.fillStyle = '#ff6b8a'; x.beginPath(); x.ellipse(140, my + 16, 10, 14, -0.3, 0, 7); x.fill(); }
  else if (mood === 'excited' || mood === 'love') { x.beginPath(); x.arc(128, my - 4, 22, 0.05 * Math.PI, 0.95 * Math.PI); x.fill(); x.fillStyle = '#ff8fa3'; x.beginPath(); x.ellipse(128, my + 12, 12, 7, 0, 0, 7); x.fill(); }
  else if (mood === 'sleepy') { x.beginPath(); x.ellipse(128, my + 6, 7, 5, 0, 0, 7); x.fill(); }
  else { const w = type === 'cat' ? 14 : 18; x.beginPath(); x.arc(128 - w * 0.5, my - 2, w * 0.55, 0.1 * Math.PI, 0.95 * Math.PI); x.stroke(); x.beginPath(); x.arc(128 + w * 0.5, my - 2, w * 0.55, 0.05 * Math.PI, 0.9 * Math.PI); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  faceCache.set(key, t); return t;
}

// ---------- outfits ----------
function outfitParts(kind, P) {
  const G = { c: '#fbbf24', m: 0.5, r: 0.4 };
  switch (kind) {
    case 'chef': return { head: [['cyl', [0.42, 0.42, 0.28, 18], '#fff', [0, 0.52, 0]], ['sphere', [0.5], '#fff', [0, 0.78, 0], 0, [1, 0.7, 1]]] };
    case 'party': return { head: [['cone', [0.3, 0.7, 14], '#f472b6', [0, 0.78, 0]], ['torus', [0.21, 0.04, 6, 16], '#fde68a', [0, 0.78, 0], [90, 0, 0]], ['torus', [0.11, 0.035, 6, 16], '#fde68a', [0, 1.0, 0], [90, 0, 0]], ['sphere', [0.08], '#60a5fa', [0, 1.15, 0]]] };
    case 'doctor': return { body: [['capsule', [0.5, 0.34], '#fff', [0, 0.52, -0.04]], ['capsule', [0.14, 0.3], '#bfe9ff', [0, 0.58, 0.42]], ['torus', [0.3, 0.03, 6, 20, Math.PI], '#111827', [0, 0.8, 0.3], [0, 0, 180]], ['cyl', [0.07, 0.07, 0.03, 12], '#9ca3af', [0.16, 0.58, 0.46], [90, 0, 0]]], head: [['torus', [0.54, 0.03, 6, 24], '#111827', [0, 0.25, 0], [80, 0, 0]], ['cyl', [0.11, 0.11, 0.03, 16], { c: '#e5e7eb', m: 0.7, r: 0.2 }, [0, 0.42, 0.42], [70, 0, 0]]] };
    case 'crown': return { head: [['cyl', [0.34, 0.3, 0.22, 8], G, [0, 0.58, 0]], ...[0, 1, 2, 3, 4, 5].map((i) => ['cone', [0.06, 0.16, 4], G, [Math.cos(i * Math.PI / 3) * 0.32, 0.76, Math.sin(i * Math.PI / 3) * 0.32]]), ['sphere', [0.05], '#ef4444', [0, 0.6, 0.33]]] };
    case 'bandage': return { head: [['torus', [0.53, 0.06, 8, 24], '#fff', [0, 0.1, 0], [75, 0, 0]], ['box', [0.2, 0.08, 0.02], '#f87171', [0.3, 0.18, 0.43]]], body: [['torus', [0.14, 0.05, 6, 16], '#fff', [-0.5, 0.62, 0.05], [0, 0, 90]]] };
    case 'pirate': return { head: [['cyl', [0.42, 0.38, 0.2, 12], '#111827', [0, 0.5, 0]], ['box', [1.1, 0.05, 0.4], '#111827', [0, 0.42, 0]], ['circle', [0.08], { c: '#fff', side: 2 }, [0, 0.5, 0.4]], ['circle', [0.1], DARK, [-0.2, 0.12, 0.5]], ['torus', [0.5, 0.02, 6, 24], DARK, [0, 0.2, 0], [80, 0, 0]]] };
    case 'cape': return { back: [{ name: 'cape', at: [0, 0.85, -0.4], parts: [['plane', [0.9, 1], { c: '#dc2626', side: 2 }, [0, -0.5, 0], [10, 0, 0]]] }, ['torus', [0.46, 0.04, 6, 20, Math.PI], '#fbbf24', [0, 0.85, -0.05], [0, 0, 180]]] };
    case 'police': return { head: [['sphere', [0.55], '#1e3a8a', [0, 0.14, -0.02], 0, [1, 0.55, 1]], ['box', [0.6, 0.04, 0.4], '#111827', [0, 0.2, 0.45]], ['octa', [0.06], G, [0, 0.32, 0.5]]] };
    case 'firefighter': return { head: [['sphere', [0.58], '#facc15', [0, 0.12, 0], 0, [1, 0.75, 1]], ['cyl', [0.66, 0.66, 0.05, 20], '#facc15', [0, 0.08, 0.05]], ['box', [0.16, 0.14, 0.04], '#dc2626', [0, 0.35, 0.56]]], body: [['box', [0.9, 0.06, 0.5], '#fde68a', [0, 0.55, 0]], ['box', [0.9, 0.06, 0.5], '#fde68a', [0, 0.38, 0]]] };
    case 'glasses': return { head: [['torus', [0.15, 0.025, 8, 20], DARK, [-0.2, 0.05, 0.5]], ['torus', [0.15, 0.025, 8, 20], DARK, [0.2, 0.05, 0.5]], ['box', [0.1, 0.02, 0.02], DARK, [0, 0.05, 0.5]], ['box', [0.4, 0.02, 0.02], DARK, [-0.45, 0.07, 0.3], [0, 60, 0]], ['box', [0.4, 0.02, 0.02], DARK, [0.45, 0.07, 0.3], [0, -60, 0]]] };
    case 'wizard': return { head: [['cone', [0.42, 0.9, 14], '#4c1d95', [0, 0.85, 0]], ['cyl', [0.7, 0.7, 0.05, 20], '#4c1d95', [0, 0.42, 0]], ['octa', [0.07], { c: '#fde68a', e: '#facc15', ei: 0.8 }, [0.1, 0.9, 0.3], 0, [1, 1, 0.4]], ['octa', [0.05], { c: '#fde68a', e: '#facc15', ei: 0.8 }, [-0.15, 1.1, 0.15], 0, [1, 1, 0.4]]] };
    case 'wings': return { back: [{ name: 'wingL', at: [-0.15, 0.75, -0.3], parts: [['sphere', [1], { c: '#e0f2fe', o: 0.8 }, [-0.4, 0.15, 0], 0, [0.42, 0.3, 0.05]], ['sphere', [1], { c: '#e0f2fe', o: 0.8 }, [-0.3, -0.2, 0], 0, [0.3, 0.2, 0.05]]] }, { name: 'wingR', at: [0.15, 0.75, -0.3], parts: [['sphere', [1], { c: '#e0f2fe', o: 0.8 }, [0.4, 0.15, 0], 0, [0.42, 0.3, 0.05]], ['sphere', [1], { c: '#e0f2fe', o: 0.8 }, [0.3, -0.2, 0], 0, [0.3, 0.2, 0.05]]] }] };
    case 'astronaut': return { head: [['sphere', [0.68], { c: '#bfe9ff', o: 0.3, r: 0.1 }, [0, 0.02, 0.02]], ['torus', [0.6, 0.06, 8, 24], '#e5e7eb', [0, -0.45, 0], [90, 0, 0]]], back: [['box', [0.6, 0.6, 0.25], '#e5e7eb', [0, 0.65, -0.45]]] };
    default: return null;
  }
}

export class Pet3D {
  constructor(type = 'cat') {
    this.type = PETS[type] ? type : 'cat';
    const P = PETS[this.type]; this.P = P;
    this.group = new THREE.Group();
    this.group.name = 'pet';
    this.mood = 'happy'; this.state = 'normal'; this.outfit = null;
    this.speaking = false; this.listening = false; this.speed = 0;
    this.t = 0; this.blink = false; this.nextBlink = 2 + Math.random() * 3; this.talkPhase = 0; this.talkLevel = 0;
    this.action = null; this.lookYaw = 0; this.lookTargetYaw = 0; this.nextLook = 3; this.faceKey = '';
    this.facing = 0; this.targetFacing = 0; this.bob = 0;
    this.shiver = 0;
    this.#buildBody();
  }
  #buildBody() {
    const P = this.P;
    const S = { c: P.body };
    const parts = [
      { name: 'body', at: [0, 0, 0], parts: [
        ['sphere', [0.5], P.body, [0, 0.55, 0], 0, [1, 0.92, 0.92], 'torso'],
        ['sphere', [0.36], P.belly, [0, 0.5, 0.2], 0, [0.9, 0.85, 0.55]],
        { name: 'legL', at: [-0.2, 0.22, 0.05], parts: [['sphere', [0.17], P.body, [0, -0.1, 0.05], 0, [1, 0.7, 1.2]]] },
        { name: 'legR', at: [0.2, 0.22, 0.05], parts: [['sphere', [0.17], P.body, [0, -0.1, 0.05], 0, [1, 0.7, 1.2]]] },
        { name: 'armL', at: [-0.46, 0.7, 0.05], parts: [['capsule', [0.1, 0.22], P.body, [-0.02, -0.2, 0.02], [0, 0, 20]]] },
        { name: 'armR', at: [0.46, 0.7, 0.05], parts: [['capsule', [0.1, 0.22], P.body, [0.02, -0.2, 0.02], [0, 0, -20]]] },
        { name: 'tail', at: [0, 0.45, -0.42], parts: P.tail === 'cat' ? [['sphere', [0.09], P.body, [0, 0, -0.1]], ['sphere', [0.085], P.body, [0, 0.16, -0.22]], ['sphere', [0.08], P.body, [0, 0.36, -0.26]], ['sphere', [0.075], P.body, [0, 0.54, -0.18]], ['sphere', [0.08], P.belly, [0, 0.66, -0.06]]] : P.tail === 'pom' ? [['sphere', [0.14], '#fff', [0, 0, -0.08]]] : [['cone', [0.2, 0.7, 10], P.body, [0, -0.05, -0.3], [-100, 0, 0]], ['cone', [0.05, 0.12, 4], P.inner, [0, 0.15, -0.3]]] },
        { name: 'head', at: [0, 1.12, 0.02], parts: [
          ['sphere', [0.52], P.body, [0, 0, 0], 0, [1.05, 1, 0.98], 'skull'],
          ...(P.ears === 'cat' ? [{ name: 'earL', at: [-0.32, 0.36, 0], parts: [['cone', [0.17, 0.36, 4], P.body, [0, 0.12, 0], [0, 45, 18]], ['cone', [0.09, 0.2, 4], P.inner, [0, 0.1, 0.04], [0, 45, 18]]] }, { name: 'earR', at: [0.32, 0.36, 0], parts: [['cone', [0.17, 0.36, 4], P.body, [0, 0.12, 0], [0, 45, -18]], ['cone', [0.09, 0.2, 4], P.inner, [0, 0.1, 0.04], [0, 45, -18]]] }]
            : P.ears === 'bunny' ? [{ name: 'earL', at: [-0.2, 0.42, -0.05], parts: [['capsule', [0.11, 0.5], P.body, [0, 0.3, 0], [0, 0, 10]], ['capsule', [0.06, 0.36], P.inner, [0, 0.3, 0.06], [0, 0, 10]]] }, { name: 'earR', at: [0.2, 0.42, -0.05], parts: [['capsule', [0.11, 0.5], P.body, [0, 0.3, 0], [0, 0, -10]], ['capsule', [0.06, 0.36], P.inner, [0, 0.3, 0.06], [0, 0, -10]]] }]
            : [{ name: 'earL', at: [0, 0.4, -0.1], parts: [['cone', [0.09, 0.2, 4], P.inner, [0, 0.1, 0.1]], ['cone', [0.08, 0.18, 4], P.inner, [0, 0.05, -0.1]], ['cone', [0.07, 0.15, 4], P.inner, [0, -0.02, -0.28]]] }, { name: 'earR', at: [0, 0, 0], parts: [] }]),
          ...(P.whiskers ? [-1, 1].flatMap((s) => [['box', [0.5, 0.012, 0.012], '#f5f3ff', [s * 0.55, -0.1, 0.3], [0, s * -25, s * 6]], ['box', [0.5, 0.012, 0.012], '#f5f3ff', [s * 0.55, -0.18, 0.3], [0, s * -25, s * -6]]]) : []),
          ...(this.type === 'dino' ? [['box', [0.04, 0.04, 0.04], DARK, [0, 0, 0], 0, 0.01]] : []),
        ] },
      ] },
    ];
    const { group, named } = build(parts);
    this.group.add(group); this.n = named;
    this.face = facePatch(0.52, drawFace({ type: this.type, mood: 'happy' }), { phi: 1.9, theta: 1.6 });
    this.face.scale.set(1.05, 1, 0.98);
    this.n.head.add(this.face);
    this.shadow = blobShadow(0.75); this.group.add(this.shadow);
    this.outfitGroups = [];
    this.emoteAnchor = new THREE.Object3D(); this.emoteAnchor.position.set(0, 2.05, 0); this.group.add(this.emoteAnchor);
    this.zzz = null;
    // base pose cache
    this.base = {}; for (const k of ['armL', 'armR', 'legL', 'legR', 'head', 'tail', 'earL', 'earR', 'body']) this.base[k] = { p: this.n[k].position.clone(), r: this.n[k].rotation.clone() };
    this.torsoMat = this.n.torso.material = this.n.torso.material.clone();
    this.skullMat = this.n.skull.material = this.n.skull.material.clone();
    this.baseColor = new THREE.Color(P.body); this.sickColor = new THREE.Color(P.body).lerp(new THREE.Color('#9ccc9c'), 0.45);
  }
  get position() { return this.group.position; }
  headWorld(out = new THREE.Vector3()) { return this.n.head.getWorldPosition(out); }
  emoteWorld(out = new THREE.Vector3()) { return this.emoteAnchor.getWorldPosition(out); }

  setMood(m) { if (m && m !== this.mood) { this.mood = m; if (m === 'surprised') this.play('hop'); } }
  setState(s) { this.state = s || 'normal'; }
  setOutfit(kind) {
    if (kind === this.outfit) return;
    this.outfit = kind;
    for (const g of this.outfitGroups) g.parent?.remove(g);
    this.outfitGroups = []; this.wings = null; this.cape = null;
    const spec = outfitParts(kind, this.P); if (!spec) return;
    for (const [slot, parts] of Object.entries(spec)) {
      const { group, named } = build(parts);
      const parent = slot === 'head' ? this.n.head : this.n.body;
      parent.add(group); this.outfitGroups.push(group);
      if (named.wingL) this.wings = [named.wingL, named.wingR];
      if (named.cape) this.cape = named.cape;
    }
  }
  setSpeaking(on) { this.speaking = on; if (!on) this.talkLevel = 0; }
  setListening(on) { this.listening = on; }
  setMoving(speed, heading) { this.speed = speed; if (speed > 0.01 && heading != null) this.targetFacing = heading; }
  faceToward(yaw) { this.targetFacing = yaw; }
  play(action) {
    const DUR = { bounce: 1.3, jump: 1.1, dance: 2.6, fly: 3.2, hide: 2.6, wave: 1.8, sway: 2.2, wobble: 1.5, bow: 1.8, hop: 0.5, spin: 1, nod: 0.8, shake: 0.8, sleep: 0, cheer: 1.6 };
    if (!action || DUR[action] == null) return;
    if (action === 'sleep') { this.state = 'sleeping'; return; }
    this.action = { name: action, t0: this.t, dur: DUR[action] };
  }

  #applyFace() {
    const talk = this.speaking ? this.talkLevel : 0;
    const blink = this.blink || this.state === 'sleeping';
    const mood = this.state === 'sleeping' ? 'sleepy' : this.state === 'sick' && !['relieved', 'happy', 'excited', 'proud'].includes(this.mood) ? 'sick' : this.mood;
    const key = [mood, blink, talk, this.listening].join('|');
    if (key === this.faceKey) return; this.faceKey = key;
    this.face.material.map = drawFace({ type: this.type, mood, blink, talk, listen: this.listening });
    this.face.material.needsUpdate = true;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.t += dt; const t = this.t, n = this.n, B = this.base;
    // reset to base pose, then layer animations
    for (const k of Object.keys(B)) { n[k].position.copy(B[k].p); n[k].rotation.copy(B[k].r); }
    n.body.scale.set(1, 1, 1); this.group.scale.setScalar(1); n.body.position.y = 0;
    let rootRotX = 0, rootRotZ = 0, bodyY = 0;
    // blink
    this.nextBlink -= dt; if (this.nextBlink <= 0) { this.blink = true; this.nextBlink = 2.5 + Math.random() * 3; setTimeout(() => { this.blink = false; }, 130); }
    // talking mouth
    if (this.speaking) { this.talkPhase += dt; if (this.talkPhase > 0.09) { this.talkPhase = 0; this.talkLevel = Math.random() < 0.25 ? 0 : (Math.random() < 0.5 ? 1 : 2); } }
    // facing
    let d = this.targetFacing - this.facing; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * (1 - Math.exp(-8 * dt)); this.group.rotation.y = this.facing;
    // breathing + idle
    const breathe = Math.sin(t * 2.4) * 0.02;
    n.body.scale.y = 1 + breathe; n.torso.scale.set(1, 0.92, 0.92);
    const moodSpeed = this.mood === 'excited' || this.mood === 'happy' ? 1.6 : this.mood === 'sad' || this.mood === 'sleepy' ? 0.5 : 1;
    n.tail.rotation.y += Math.sin(t * 3.2 * moodSpeed) * 0.45 * (this.P.tail === 'pom' ? 0.2 : 1);
    n.tail.rotation.x += Math.sin(t * 1.5) * 0.08;
    // head look
    this.nextLook -= dt; if (this.nextLook <= 0) { this.nextLook = 2 + Math.random() * 4; this.lookTargetYaw = (Math.random() - 0.5) * 0.7; }
    if (this.speaking || this.listening) this.lookTargetYaw = 0;
    this.lookYaw = damp(this.lookYaw, this.lookTargetYaw, 4, dt);
    n.head.rotation.y += this.lookYaw;
    if (this.speaking) { n.head.rotation.x += Math.sin(t * 11) * 0.035; n.head.rotation.z += Math.sin(t * 5.3) * 0.03; n.armR.rotation.z += Math.sin(t * 6) * 0.25 - 0.3; n.armL.rotation.z += -Math.sin(t * 6 + 1) * 0.2 + 0.2; }
    if (this.listening) { n.head.rotation.z += 0.18; n.earL.rotation.z += 0.15; n.earR.rotation.z -= 0.15; }
    // mood postures
    switch (this.mood) {
      case 'sad': n.head.rotation.x += 0.28; n.earL.rotation.z -= 0.35; n.earR.rotation.z += 0.35; n.armL.rotation.z += 0.3; n.armR.rotation.z -= 0.3; break;
      case 'worried': n.head.rotation.x += 0.12; n.earL.rotation.z -= 0.25; n.earR.rotation.z += 0.25; this.shiver = Math.sin(t * 30) * 0.015; n.head.position.x += this.shiver; n.armL.rotation.x -= 1.2; n.armR.rotation.x -= 1.2; break;
      case 'sleepy': n.head.rotation.x += 0.15 + Math.sin(t * 1.2) * 0.1; n.head.rotation.z += Math.sin(t * 0.8) * 0.12; break;
      case 'sick': n.head.rotation.z += Math.sin(t * 1.4) * 0.18; n.head.rotation.x += 0.1; rootRotZ += Math.sin(t * 1.4) * 0.05; break;
      case 'excited': bodyY += Math.abs(Math.sin(t * 6)) * 0.08; n.earL.rotation.z += Math.sin(t * 12) * 0.1; n.earR.rotation.z -= Math.sin(t * 12) * 0.1; break;
      case 'love': n.head.rotation.z += Math.sin(t * 2) * 0.15; n.armL.rotation.x -= 1.5; n.armR.rotation.x -= 1.5; n.armL.rotation.z += 0.6; n.armR.rotation.z -= 0.6; break;
      case 'proud': n.head.rotation.x -= 0.18; n.body.rotation.x -= 0.06; n.armL.rotation.x -= 0.4; n.armR.rotation.x -= 0.4; n.armL.position.x += 0.04; n.armR.position.x -= 0.04; break;
      case 'thinking': n.head.rotation.z += 0.22; n.head.rotation.y += 0.3; n.armR.rotation.x -= 2.3; n.armR.rotation.z -= 0.5; break;
      case 'silly': n.head.rotation.z += Math.sin(t * 7) * 0.25; n.head.rotation.x += Math.sin(t * 3) * 0.1; break;
      case 'surprised': n.earL.rotation.z += 0.3; n.earR.rotation.z -= 0.3; n.armL.rotation.z += 1.6; n.armR.rotation.z -= 1.6; break;
      case 'relieved': n.head.rotation.x += 0.06; n.armL.rotation.z += 0.2; n.armR.rotation.z -= 0.2; break;
      default: break;
    }
    // body tint for sickness
    const sick = this.state === 'sick' || this.mood === 'sick';
    this.torsoMat.color.lerp(sick ? this.sickColor : this.baseColor, 1 - Math.exp(-3 * dt)); this.skullMat.color.copy(this.torsoMat.color);
    // walking
    if (this.speed > 0.02) {
      const w = t * 11;
      n.legL.rotation.x += Math.sin(w) * 0.7; n.legR.rotation.x += -Math.sin(w) * 0.7;
      n.armL.rotation.x += -Math.sin(w) * 0.5; n.armR.rotation.x += Math.sin(w) * 0.5;
      bodyY += Math.abs(Math.sin(w)) * 0.07; n.head.rotation.z += Math.sin(w) * 0.04; n.body.rotation.x += 0.08;
    }
    // sleeping
    if (this.state === 'sleeping') { rootRotZ += 0.1; n.head.rotation.x += 0.3; n.head.rotation.z += 0.25; n.body.scale.y = 0.95 + breathe * 2; n.armL.rotation.z += 0.5; n.armR.rotation.z -= 0.5; }
    // actions
    const a = this.action;
    if (a) {
      const p = (t - a.t0) / a.dur;
      if (p >= 1) this.action = null;
      else {
        const s = Math.sin(p * Math.PI);
        switch (a.name) {
          case 'bounce': { const h = Math.abs(Math.sin(p * Math.PI * 3)); bodyY += h * 0.45; const sq = 1 - (1 - h) * 0.12; n.body.scale.set(2 - sq, sq, 2 - sq); break; }
          case 'hop': bodyY += s * 0.3; n.body.scale.y *= 1 + s * 0.08; break;
          case 'jump': { if (p < 0.2) { const q = p / 0.2; n.body.scale.set(1 + q * 0.12, 1 - q * 0.18, 1 + q * 0.12); } else { const q = (p - 0.2) / 0.8; const h = Math.sin(q * Math.PI); bodyY += h * 1.3; n.body.scale.set(1 - h * 0.08, 1 + h * 0.14, 1 - h * 0.08); n.armL.rotation.z += h * 2.4; n.armR.rotation.z -= h * 2.4; n.legL.rotation.x -= h * 0.6; n.legR.rotation.x -= h * 0.6; } break; }
          case 'dance': { const w = p * Math.PI * 7; n.body.rotation.y += Math.sin(w) * 0.55; bodyY += Math.abs(Math.sin(w)) * 0.22; n.armL.rotation.z += 2.2 + Math.sin(w) * 0.5; n.armR.rotation.z -= 2.2 - Math.sin(w) * 0.5; n.head.rotation.z += Math.sin(w) * 0.2; n.legL.rotation.x += Math.sin(w) * 0.5; n.legR.rotation.x -= Math.sin(w) * 0.5; break; }
          case 'cheer': { bodyY += Math.abs(Math.sin(p * Math.PI * 2)) * 0.3; n.armL.rotation.z += 2.6; n.armR.rotation.z -= 2.6; n.head.rotation.x -= 0.2; break; }
          case 'fly': { const up = p < 0.15 ? p / 0.15 : p > 0.85 ? (1 - p) / 0.15 : 1; bodyY += up * 1.5 + Math.sin(t * 4) * 0.08 * up; n.armL.rotation.z += up * 1.5; n.armR.rotation.z -= up * 1.5; n.body.rotation.x += up * 0.25; n.legL.rotation.x += up * 0.5; n.legR.rotation.x += up * 0.5; if (this.wings) { this.wings[0].rotation.y = Math.sin(t * 18) * 0.7; this.wings[1].rotation.y = -Math.sin(t * 18) * 0.7; } break; }
          case 'wave': { n.armR.rotation.z -= 2.5; n.armR.rotation.x += Math.sin(p * Math.PI * 6) * 0.45; n.head.rotation.z -= 0.15; break; }
          case 'sway': rootRotZ += Math.sin(p * Math.PI * 4) * 0.12; n.head.rotation.z -= Math.sin(p * Math.PI * 4) * 0.08; break;
          case 'wobble': rootRotZ += Math.sin(p * Math.PI * 8) * 0.28 * (1 - p); break;
          case 'bow': rootRotX += s * 0.65; n.armL.rotation.x -= s * 0.6; n.armR.rotation.x -= s * 0.6; break;
          case 'hide': { const q = p < 0.25 ? p / 0.25 : p > 0.75 ? (1 - p) / 0.25 : 1; n.body.scale.set(1 + q * 0.1, 1 - q * 0.42, 1 + q * 0.1); n.armL.rotation.x -= q * 2.6; n.armR.rotation.x -= q * 2.6; n.armL.rotation.z += q * 0.9; n.armR.rotation.z -= q * 0.9; n.head.rotation.x += q * 0.35; break; }
          case 'spin': n.body.rotation.y += p * Math.PI * 2; bodyY += s * 0.4; break;
          case 'nod': n.head.rotation.x += Math.sin(p * Math.PI * 4) * 0.25; break;
          case 'shake': n.head.rotation.y += Math.sin(p * Math.PI * 4) * 0.35; break;
          default: break;
        }
      }
    }
    if (this.wings && !(a && a.name === 'fly')) { this.wings[0].rotation.y = Math.sin(t * 6) * 0.25; this.wings[1].rotation.y = -Math.sin(t * 6) * 0.25; }
    if (this.cape) this.cape.rotation.x = 0.1 + Math.sin(t * 3) * 0.08 + this.speed * 0.5;
    n.body.position.y = bodyY; this.group.rotation.x = rootRotX; this.group.rotation.z = rootRotZ;
    this.shadow.scale.setScalar(Math.max(0.5, 1 - bodyY * 0.35)); this.shadow.material.opacity = Math.max(0.25, 1 - bodyY * 0.4);
    this.#applyFace();
  }
}
export const PET_COLORS = PETS;
