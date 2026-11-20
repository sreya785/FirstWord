// 3D visual effects: confetti, sparkles, hearts, poofs, emotes, applause, weather and ambient particles.
import * as THREE from 'three';
import { emojiTexture } from './models.js';

const texCache = {};
function softTex(kind = 'circle') {
  if (texCache[kind]) return texCache[kind];
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  if (kind === 'circle') { const g = x.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  else if (kind === 'star') { x.fillStyle = '#fff'; x.translate(32, 32); x.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? 7 : 26, a = i * Math.PI / 4; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); x.fill(); }
  else if (kind === 'heart') { x.fillStyle = '#ff4d7a'; x.translate(32, 36); x.beginPath(); x.moveTo(0, 22); x.bezierCurveTo(-34, -4, -18, -30, 0, -10); x.bezierCurveTo(18, -30, 34, -4, 0, 22); x.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache[kind] = t; return t;
}
const spriteMat = (tex, color = '#ffffff', additive = false) => new THREE.SpriteMaterial({ map: tex, color, transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });

export class FX3D {
  constructor(engine) { this.e = engine; this.scene = engine.scene; this.systems = []; this.weatherSys = null; this.ambientSys = null; this.zzzSys = null; }
  #add(sys) { this.systems.push(sys); return sys; }
  #sprites(n, tex, { color = '#fff', size = 0.3, additive = false } = {}) {
    const g = new THREE.Group(); const list = [];
    for (let i = 0; i < n; i++) { const s = new THREE.Sprite(spriteMat(tex, Array.isArray(color) ? color[i % color.length] : color, additive)); s.scale.setScalar(size); g.add(s); list.push(s); }
    this.scene.add(g); return { g, list };
  }
  // ---------- bursts ----------
  confetti(pos, n = 160) {
    const geo = new THREE.PlaneGeometry(0.16, 0.11), mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.frustumCulled = false;
    const cols = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#f472b6', '#a855f7', '#fb923c', '#ffffff'];
    const P = []; const d = new THREE.Object3D(); const col = new THREE.Color();
    for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 4; P.push({ p: new THREE.Vector3(pos.x, pos.y + 1.5, pos.z), v: new THREE.Vector3(Math.cos(a) * sp, 4 + Math.random() * 5, Math.sin(a) * sp), r: new THREE.Euler(Math.random() * 6, Math.random() * 6, 0), rv: (Math.random() - 0.5) * 12 }); col.set(cols[i % cols.length]); mesh.setColorAt(i, col); }
    mesh.instanceColor.needsUpdate = true; this.scene.add(mesh);
    let life = 0;
    this.#add({ update: (dt) => { life += dt; for (let i = 0; i < n; i++) { const q = P[i]; q.v.y -= 9 * dt; q.v.multiplyScalar(1 - dt * 1.4); q.p.addScaledVector(q.v, dt); if (q.p.y < 0.03) { q.p.y = 0.03; q.v.set(0, 0, 0); } q.r.x += q.rv * dt; q.r.y += q.rv * 0.7 * dt; d.position.copy(q.p); d.rotation.copy(q.r); d.updateMatrix(); mesh.setMatrixAt(i, d.matrix); } mesh.instanceMatrix.needsUpdate = true; mat.opacity = life > 3.2 ? Math.max(0, 1 - (life - 3.2) / 0.8) : 1; mat.transparent = life > 3.2; return life < 4.1; }, dispose: () => { this.scene.remove(mesh); geo.dispose(); mat.dispose(); } });
  }
  sparkles(pos, n = 26, color = '#fff6b0') {
    const { g, list } = this.#sprites(n, softTex('star'), { color: [color, '#ffffff', '#ffd1f0'], size: 0.28, additive: true });
    const V = list.map(() => new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 3 + 1, (Math.random() - 0.5) * 4));
    list.forEach((s) => s.position.copy(pos));
    let life = 0;
    this.#add({ update: (dt) => { life += dt; list.forEach((s, i) => { s.position.addScaledVector(V[i], dt); V[i].y -= 3 * dt; s.material.opacity = Math.max(0, 1 - life / 1.1); s.material.rotation += dt * 4; s.scale.setScalar(0.28 * (1 + life)); }); return life < 1.1; }, dispose: () => { this.scene.remove(g); } });
  }
  hearts(pos, n = 9) {
    const { g, list } = this.#sprites(n, softTex('heart'), { size: 0.4 });
    const ph = list.map(() => Math.random() * 6), spd = list.map(() => 0.8 + Math.random() * 0.8);
    list.forEach((s, i) => { s.position.set(pos.x + (Math.random() - 0.5) * 1.2, pos.y + Math.random() * 0.5, pos.z + (Math.random() - 0.5) * 0.6); s.userData.delay = i * 0.12; });
    let life = 0;
    this.#add({ update: (dt, t) => { life += dt; list.forEach((s, i) => { const l = life - s.userData.delay; if (l < 0) { s.material.opacity = 0; return; } s.position.y += spd[i] * dt; s.position.x += Math.sin(t * 3 + ph[i]) * dt * 0.5; s.material.opacity = Math.min(1, l * 4) * Math.max(0, 1 - l / 2.2); s.scale.setScalar(0.3 + Math.min(l, 0.4)); }); return life < 3.4; }, dispose: () => this.scene.remove(g) });
  }
  poof(pos, color = '#ffffff') {
    const { g, list } = this.#sprites(7, softTex('circle'), { color, size: 0.6 });
    const V = list.map((_, i) => new THREE.Vector3(Math.cos(i) * 1.2, 0.6 + Math.random(), Math.sin(i) * 1.2));
    list.forEach((s) => s.position.set(pos.x, pos.y + 0.6, pos.z));
    let life = 0;
    this.#add({ update: (dt) => { life += dt; list.forEach((s, i) => { s.position.addScaledVector(V[i], dt); s.scale.setScalar(0.6 + life * 1.6); s.material.opacity = Math.max(0, 0.9 - life * 1.3); }); return life < 0.75; }, dispose: () => this.scene.remove(g) });
  }
  ring(pos, color = '#ffffff') {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 40), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide }));
    m.rotation.x = -Math.PI / 2; m.position.set(pos.x, 0.05, pos.z); this.scene.add(m);
    let life = 0;
    this.#add({ update: (dt) => { life += dt; m.scale.setScalar(1 + life * 5); m.material.opacity = Math.max(0, 0.9 - life * 1.3); return life < 0.7; }, dispose: () => { this.scene.remove(m); m.geometry.dispose(); } });
  }
  emoji(pos, emoji, { n = 1, size = 0.7, rise = 1.2, dur = 1.8, spread = 0 } = {}) {
    const { g, list } = this.#sprites(n, emojiTexture(emoji), { size });
    list.forEach((s, i) => { s.position.set(pos.x + (Math.random() - 0.5) * spread, pos.y + (Math.random() - 0.5) * spread * 0.5, pos.z + (Math.random() - 0.5) * spread * 0.4); s.userData.delay = i * 0.15; s.userData.ph = Math.random() * 6; });
    let life = 0;
    this.#add({ update: (dt, t) => { life += dt; list.forEach((s) => { const l = life - s.userData.delay; if (l < 0) { s.material.opacity = 0; return; } const p = Math.min(1, l / dur); s.position.y += rise * dt * (1 - p * 0.5); s.position.x += Math.sin(t * 2.5 + s.userData.ph) * dt * 0.3; s.material.opacity = Math.min(1, l * 5) * (1 - Math.pow(p, 3)); s.scale.setScalar(size * (1 + Math.sin(Math.min(l, 0.3) / 0.3 * Math.PI) * 0.25)); }); return life < dur + n * 0.15; }, dispose: () => this.scene.remove(g) });
  }
  /** One emoji that pops above a moving anchor (pet head). */
  emote(getPos, emoji, dur = 1.7) {
    const s = new THREE.Sprite(spriteMat(emojiTexture(emoji))); s.scale.setScalar(0.001); this.scene.add(s);
    let life = 0;
    this.#add({ update: (dt) => { life += dt; const p = life / dur; const pos = getPos(); s.position.set(pos.x + 0.35, pos.y + 0.2 + Math.min(p, 0.3) * 0.8 + Math.sin(life * 3) * 0.05, pos.z); const sc = p < 0.15 ? 0.9 * (p / 0.15) * 1.2 : 0.9; s.scale.setScalar(sc); s.material.opacity = p > 0.75 ? 1 - (p - 0.75) / 0.25 : 1; return life < dur; }, dispose: () => this.scene.remove(s) });
  }
  zzz(getPos, on) {
    if (!on) { if (this.zzzSys) { this.zzzSys.stop = true; this.zzzSys = null; } return; }
    if (this.zzzSys) return;
    const { g, list } = this.#sprites(3, emojiTexture('💤'), { size: 0.45 });
    const sys = this.#add({ update: (dt, t) => { const pos = getPos(); list.forEach((s, i) => { const l = ((t * 0.5 + i / 3) % 1); s.position.set(pos.x + 0.4 + l * 0.6, pos.y + 0.2 + l * 1.2, pos.z); s.material.opacity = Math.sin(l * Math.PI); s.scale.setScalar(0.3 + l * 0.4); }); return !sys.stop; }, dispose: () => this.scene.remove(g) });
    this.zzzSys = sys;
  }
  // ---------- event mapping ----------
  playEvents(events, { petPos, focusPos, audiencePositions = [] } = {}) {
    for (const ev of events || []) {
      const at = focusPos || petPos;
      switch (ev) {
        case 'sparkle': this.sparkles(at.clone().setY(at.y + 1)); break;
        case 'confetti': this.confetti(petPos); break;
        case 'hearts': this.hearts(petPos.clone().setY(petPos.y + 1.4)); break;
        case 'heal': this.sparkles(petPos.clone().setY(petPos.y + 1), 30, '#86efac'); this.ring(petPos, '#86efac'); this.emoji(petPos.clone().setY(petPos.y + 2), '💚', { n: 3, spread: 1 }); break;
        case 'applause': case 'applause_soft': { const pts = audiencePositions.length ? audiencePositions : [petPos.clone().add(new THREE.Vector3(2, 1, 2)), petPos.clone().add(new THREE.Vector3(-2, 1, 2))]; pts.slice(0, ev === 'applause' ? 12 : 5).forEach((p, i) => setTimeout(() => this.emoji(p.clone().setY(p.y + 1.8), '👏', { size: 0.5, rise: 0.8, dur: 1.4 }), i * 90)); break; }
        case 'phone': this.emoji(petPos.clone().setY(petPos.y + 2.2), '📞', { size: 0.8, rise: 0.2, dur: 2.2 }); break;
        case 'pop': this.sparkles(at.clone().setY(at.y + 0.8), 14); this.ring(at, '#fff'); break;
        case 'poof': this.poof(at); break;
        case 'swish': this.sparkles(petPos.clone().setY(petPos.y + 1), 16, '#bae6fd'); break;
        case 'music': this.emoji(petPos.clone().setY(petPos.y + 2), '🎵', { n: 5, spread: 1.4, rise: 1.4, dur: 2.2, size: 0.55 }); break;
        case 'spotlight': this.sparkles(petPos.clone().setY(petPos.y + 1.5), 30, '#fff7c2'); break;
        case 'child_leaves': this.emoji(petPos.clone().setY(petPos.y + 2), '💧', { n: 2, size: 0.4, rise: -0.6, dur: 1.5 }); break;
        default: break;
      }
    }
  }
  // ---------- weather & ambience ----------
  setWeather(kind) {
    if (this.weatherSys?.kind === kind) return;
    if (this.weatherSys) { this.weatherSys.stop = true; this.weatherSys = null; }
    if (!kind) return;
    const n = kind === 'rain' ? 700 : 400, box = 34, h = 18;
    const pos = new Float32Array(n * (kind === 'rain' ? 6 : 3)), P = [];
    for (let i = 0; i < n; i++) P.push({ x: (Math.random() - 0.5) * box, y: Math.random() * h, z: (Math.random() - 0.5) * box, v: kind === 'rain' ? 12 + Math.random() * 5 : 0.8 + Math.random() * 0.8, ph: Math.random() * 6 });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const obj = kind === 'rain' ? new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#cfe3ff', transparent: true, opacity: 0.55 })) : new THREE.Points(g, new THREE.PointsMaterial({ map: softTex('circle'), color: '#ffffff', size: 0.22, transparent: true, opacity: 0.95, depthWrite: false }));
    obj.frustumCulled = false; this.scene.add(obj);
    const sys = this.#add({ kind, update: (dt, t) => { const c = this.e.cam.target; const a = g.attributes.position.array; for (let i = 0; i < n; i++) { const q = P[i]; q.y -= q.v * dt; if (q.y < 0) { q.y = h; q.x = (Math.random() - 0.5) * box; q.z = (Math.random() - 0.5) * box; } const sx = kind === 'snow' ? Math.sin(t + q.ph) * 0.6 : 0; if (kind === 'rain') { a[i * 6] = c.x + q.x; a[i * 6 + 1] = q.y; a[i * 6 + 2] = c.z + q.z; a[i * 6 + 3] = c.x + q.x; a[i * 6 + 4] = q.y + 0.5; a[i * 6 + 5] = c.z + q.z; } else { a[i * 3] = c.x + q.x + sx; a[i * 3 + 1] = q.y; a[i * 3 + 2] = c.z + q.z; } } g.attributes.position.needsUpdate = true; return !sys.stop; }, dispose: () => { this.scene.remove(obj); g.dispose(); } });
    this.weatherSys = sys;
  }
  setAmbient(kind) {
    if (this.ambientSys?.kind === kind) return;
    if (this.ambientSys) { this.ambientSys.stop = true; this.ambientSys = null; }
    if (!kind) return;
    const n = kind === 'bubbles' ? 120 : 60, box = 26;
    const pos = new Float32Array(n * 3), P = [];
    for (let i = 0; i < n; i++) P.push({ x: (Math.random() - 0.5) * box, y: Math.random() * 6, z: (Math.random() - 0.5) * box, ph: Math.random() * 6, v: 0.3 + Math.random() * 0.6 });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = kind === 'fireflies' ? '#ffe27a' : kind === 'bubbles' ? '#dff4ff' : kind === 'petals' ? '#ffc4e0' : '#fff7c2';
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: softTex('circle'), color, size: kind === 'bubbles' ? 0.16 : 0.2, transparent: true, opacity: 0.9, depthWrite: false, blending: kind === 'fireflies' ? THREE.AdditiveBlending : THREE.NormalBlending }));
    pts.frustumCulled = false; this.scene.add(pts);
    const sys = this.#add({ kind, update: (dt, t) => { const a = g.attributes.position.array; for (let i = 0; i < n; i++) { const q = P[i]; if (kind === 'bubbles') { q.y += q.v * dt * 2; if (q.y > 9) q.y = 0; a[i * 3] = q.x + Math.sin(t + q.ph) * 0.3; } else if (kind === 'petals') { q.y -= q.v * dt; if (q.y < 0) q.y = 7; a[i * 3] = q.x + Math.sin(t * 0.8 + q.ph) * 1.2; } else { a[i * 3] = q.x + Math.sin(t * 0.5 + q.ph) * 1.5; q.y = 1 + Math.sin(t * 0.4 + q.ph) * 0.8 + (q.ph % 2); } a[i * 3 + 1] = q.y; a[i * 3 + 2] = q.z + Math.cos(t * 0.4 + q.ph) * 0.8; } g.attributes.position.needsUpdate = true; if (kind === 'fireflies') pts.material.opacity = 0.6 + Math.sin(t * 3) * 0.3; return !sys.stop; }, dispose: () => { this.scene.remove(pts); g.dispose(); } });
    this.ambientSys = sys;
  }
  update(dt, t) {
    for (let i = this.systems.length - 1; i >= 0; i--) { const s = this.systems[i]; if (!s.update(dt, t)) { s.dispose(); this.systems.splice(i, 1); } }
  }
}
