// WebGL engine wrapper: renderer, sky dome, lighting presets, third-person camera, input and the frame loop.
import * as THREE from 'three';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 900);

export const SKY = {
  day: { top: '#3f9df5', horizon: '#cfeeff', ground: '#6cc26a', stars: 0 },
  sunset: { top: '#4c3d9e', horizon: '#ffb27a', ground: '#5a7d4f', stars: 0.15 },
  night: { top: '#070b2a', horizon: '#2a3372', ground: '#1a2a1e', stars: 1 },
  space: { top: '#02030c', horizon: '#0b1030', ground: '#1a1a22', stars: 1 },
  underwater: { top: '#0a4f9c', horizon: '#2a8fdc', ground: '#1b5d8f', stars: 0 },
  dream: { top: '#8ec5ff', horizon: '#ffd6f2', ground: '#bfe8d6', stars: 0.1 },
  stage: { top: '#0b0620', horizon: '#3b1d6e', ground: '#1a0b2e', stars: 0.8 },
  snow: { top: '#9fc2e8', horizon: '#eef4fb', ground: '#eef4fb', stars: 0 },
};
export const LIGHT = {
  day: { hemiSky: '#cfe8ff', hemiGround: '#86a86a', hemiI: 1.1, sun: '#fff1d6', sunI: 2.6, sunPos: [14, 20, 10], amb: 0.3 },
  sunset: { hemiSky: '#ffc49a', hemiGround: '#7a5e78', hemiI: 0.95, sun: '#ffac63', sunI: 2.1, sunPos: [-18, 7, 8], amb: 0.35 },
  night: { hemiSky: '#2b3d8a', hemiGround: '#0f1424', hemiI: 0.7, sun: '#9fb4ff', sunI: 0.9, sunPos: [-8, 16, -8], amb: 0.3 },
  space: { hemiSky: '#20244a', hemiGround: '#0b0b14', hemiI: 0.6, sun: '#ffffff', sunI: 2.0, sunPos: [14, 12, 6], amb: 0.25 },
  underwater: { hemiSky: '#4fb0f0', hemiGround: '#0b3a66', hemiI: 1.0, sun: '#cfeeff', sunI: 1.4, sunPos: [2, 20, 2], amb: 0.45 },
  stage: { hemiSky: '#4a2a8a', hemiGround: '#120a24', hemiI: 0.75, sun: '#ffe6ff', sunI: 1.1, sunPos: [0, 18, 10], amb: 0.35 },
  snow: { hemiSky: '#e6f0ff', hemiGround: '#b8c8dc', hemiI: 1.2, sun: '#ffffff', sunI: 2.2, sunPos: [10, 16, 12], amb: 0.4 },
};

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
    this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.08;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
    this.lastT = 0;
    this.updaters = new Set(); this.tweens = new Set();
    this.isMobile = isMobile;
    this.#lights(); this.#sky();
    this.cam = { yaw: 0, pitch: 0.38, dist: isMobile ? 10 : 7.8, target: new THREE.Vector3(0, 0.9, 0), goal: new THREE.Vector3(0, 0.9, 0), homeYaw: 0, follow: null, focus: null, lastDrag: -10, shake: 0, lockPitch: null, offsetX: 0, lockDist: null, offsetX: 0 };
    this.input = { keys: new Set(), joy: { x: 0, y: 0 }, onTap: null, pickables: [] };
    this.#input();
    this.viewShift = { landscape: 0, portrait: 0 };
    this.resize(); window.addEventListener('resize', () => this.resize());
    this.running = false; this.time = 0;
    this.loopFn = () => this.#loop();
  }
  // ---------- lights ----------
  #lights() {
    this.hemi = new THREE.HemisphereLight('#cfe8ff', '#86a86a', 1.1); this.scene.add(this.hemi);
    this.amb = new THREE.AmbientLight('#ffffff', 0.3); this.scene.add(this.amb);
    this.sun = new THREE.DirectionalLight('#fff1d6', 2.6); this.sun.position.set(14, 20, 10); this.sun.castShadow = true;
    const s = this.sun.shadow; s.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048); s.camera.near = 1; s.camera.far = 80; s.camera.left = s.camera.bottom = -16; s.camera.right = s.camera.top = 16; s.bias = -0.0008; s.normalBias = 0.03; s.radius = 3;
    this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.lamp = new THREE.PointLight('#ffd9a0', 0, 9, 2); this.lamp.position.set(0, 2.5, 1); this.scene.add(this.lamp);
    this.lightGoal = { ...LIGHT.day }; this.lightCur = { hemiSky: new THREE.Color(LIGHT.day.hemiSky), hemiGround: new THREE.Color(LIGHT.day.hemiGround), sun: new THREE.Color(LIGHT.day.sun), hemiI: 1.1, sunI: 2.6, amb: 0.3, sunPos: new THREE.Vector3(14, 20, 10), lamp: 0 };
  }
  setLight(name, { lamp = 0 } = {}) { const L = LIGHT[name] || LIGHT.day; this.lightGoal = { ...L, lamp }; }
  #updateLights(dt) {
    const k = 1 - Math.exp(-2.2 * dt), G = this.lightGoal, C = this.lightCur;
    C.hemiSky.lerp(new THREE.Color(G.hemiSky), k); C.hemiGround.lerp(new THREE.Color(G.hemiGround), k); C.sun.lerp(new THREE.Color(G.sun), k);
    C.hemiI += (G.hemiI - C.hemiI) * k; C.sunI += (G.sunI - C.sunI) * k; C.amb += (G.amb - C.amb) * k; C.lamp += ((G.lamp || 0) - C.lamp) * k;
    C.sunPos.lerp(new THREE.Vector3(...G.sunPos), k);
    this.hemi.color.copy(C.hemiSky); this.hemi.groundColor.copy(C.hemiGround); this.hemi.intensity = C.hemiI;
    this.sun.color.copy(C.sun); this.sun.intensity = C.sunI; this.amb.intensity = C.amb; this.lamp.intensity = C.lamp;
    // shadow camera follows the camera target
    const t = this.cam.target;
    this.sun.position.copy(t).add(C.sunPos.clone().normalize().multiplyScalar(34)); this.sun.target.position.copy(t);
    this.lamp.position.set(t.x, 2.6, t.z + 1.2);
  }
  // ---------- sky ----------
  #sky() {
    const g = new THREE.SphereGeometry(380, 32, 20);
    const colors = new Float32Array(g.attributes.position.count * 3);
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.skyMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.skyMesh.renderOrder = -10; this.scene.add(this.skyMesh);
    this.skyCur = { top: new THREE.Color(SKY.day.top), horizon: new THREE.Color(SKY.day.horizon), ground: new THREE.Color(SKY.day.ground), stars: 0 };
    this.skyGoal = { ...SKY.day };
    this.scene.fog = new THREE.Fog(SKY.day.horizon, 40, 160);
    // stars
    const n = 900, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const th = Math.random() * Math.PI * 2, ph = Math.acos(Math.random() * 0.95); const r = 350; pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph) + 5; pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.scene.add(this.stars);
    // sun & moon discs
    const disc = (c, e, r) => { const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), new THREE.MeshBasicMaterial({ color: c, fog: false })); m.material.transparent = true; return m; };
    this.sunDisc = disc('#fff3b0', 1, 14); this.moonDisc = disc('#f3f0d6', 1, 9); this.scene.add(this.sunDisc, this.moonDisc);
    this.#paintSky(true);
  }
  setSky(name, override = null) { const S = SKY[name] || SKY.day; this.skyGoal = { ...S, ...(override || {}) }; }
  #paintSky(force = false) {
    const C = this.skyCur, g = this.skyMesh.geometry, pos = g.attributes.position, col = g.attributes.color;
    const top = C.top, hor = C.horizon, gr = C.ground, tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 380;
      if (y < -0.02) tmp.copy(gr).lerp(hor, Math.max(0, 1 + y * 8) * 0.5);
      else tmp.copy(hor).lerp(top, Math.pow(clamp(y, 0, 1), 0.55));
      col.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    col.needsUpdate = true;
    this.scene.fog.color.copy(hor);
    this.stars.material.opacity = C.stars;
  }
  #updateSky(dt) {
    const k = 1 - Math.exp(-1.8 * dt), G = this.skyGoal, C = this.skyCur;
    const before = C.top.getHex() + C.horizon.getHex() + C.ground.getHex() + Math.round(C.stars * 100);
    C.top.lerp(new THREE.Color(G.top), k); C.horizon.lerp(new THREE.Color(G.horizon), k); C.ground.lerp(new THREE.Color(G.ground), k); C.stars += (G.stars - C.stars) * k;
    const after = C.top.getHex() + C.horizon.getHex() + C.ground.getHex() + Math.round(C.stars * 100);
    if (before !== after) this.#paintSky();
    // celestial discs sit opposite the camera-independent sun direction
    const sp = this.lightCur.sunPos.clone().normalize();
    this.sunDisc.position.copy(this.cam.target).add(sp.clone().multiplyScalar(330)); this.sunDisc.lookAt(this.camera.position);
    this.moonDisc.position.copy(this.cam.target).add(sp.clone().multiplyScalar(-1).setY(Math.abs(sp.y) + 0.2).normalize().multiplyScalar(330)); this.moonDisc.lookAt(this.camera.position);
    this.sunDisc.material.opacity = clamp((sp.y - 0.05) * 3, 0, 1) * (1 - C.stars * 0.9); this.moonDisc.material.opacity = C.stars;
    this.skyMesh.position.copy(this.camera.position); this.stars.position.copy(this.camera.position);
  }
  setFog(near, far) { this.scene.fog.near = near; this.scene.fog.far = far; }
  // ---------- camera ----------
  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.portrait = w / h < 0.8;
    this.camera.aspect = w / h; this.camera.fov = w / h < 0.8 ? 64 : w / h < 1.25 ? 56 : 48;
    // Shift the view so the hero sits above the HUD that covers the bottom of the screen
    const shift = (this.portrait ? this.viewShift.portrait : this.viewShift.landscape) || 0;
    if (shift) this.camera.setViewOffset(w, h, 0, Math.round(h * shift), w, h); else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
  }
  /** Fraction of the screen height to push the world upwards (room for the HUD). */
  setViewShift(landscape, portrait = landscape) { this.viewShift = { landscape, portrait }; this.resize(); }
  follow(getter) { this.cam.follow = getter; }
  /** Temporarily frame several points (e.g. pet + a new character). */
  frame(points, { seconds = 4, minDist = 7 } = {}) {
    if (!points.length) return;
    const c = new THREE.Vector3(); for (const p of points) c.add(p); c.multiplyScalar(1 / points.length);
    let spread = 0; for (const p of points) spread = Math.max(spread, p.distanceTo(c));
    c.lerp(points[0], 0.35); // keep the hero (first point) comfortably in frame
    this.cam.focus = { center: c.setY(c.y + 0.8), dist: clamp(spread * 3.1 + 6, minDist, 16), until: this.time + seconds };
  }
  intro() { this.cam.yaw = 1.2; this.cam.pitch = 0.9; this.cam.dist = 22; this.cam.introUntil = this.time + 2.6; }
  orbitIdle(on) { this.cam.orbitIdle = on; }
  /** Easy zoom: pinch, mouse wheel, or the on-screen +/- buttons. Works in every place. */
  #zoomBy(f) {
    if (!isFinite(f) || f <= 0) return;
    if (this.cam.sceneView) {
      const max = this.cam.sceneView.maxDist ?? 9;
      this.cam.zoomOffset = clamp((this.cam.zoomOffset ?? 0) + (f - 1) * 0.55, -0.55, max - 1);
    } else this.cam.lockDist = clamp((this.cam.lockDist ?? this.cam.dist) * f, 4.5, 16);
  }
  zoomIn(step = 0.85) { this.#zoomBy(step); }
  zoomOut(step = 1.18) { this.#zoomBy(step); }
  shake(a = 0.25) { this.cam.shake = a; }
  #updateCamera(dt) {
    const C = this.cam;
    if (C.follow) { const p = C.follow(); C.goal.set(p.x, p.y + 0.95, p.z); }
    let goal = C.goal, distGoal = C.lockDist ?? (this.portrait ? 8.8 : 7.8);
    let viewPitch = null;
    if (C.focus) { if (this.time > C.focus.until) C.focus = null; else { goal = C.focus.center; distGoal = Math.max(4.6, C.focus.dist || distGoal); if (C.focus.pitch != null) viewPitch = C.focus.pitch; } }
    // a place can define its own camera style (e.g. standing behind the shop counter); it resumes
    // as soon as a transient focus (someone talking) ends
    else if (C.sceneView) {
      goal = C.sceneView.follow ? C.sceneView.centerFn() : C.sceneView.center;
      distGoal = C.sceneView.dist * (1 + (C.zoomOffset || 0)); viewPitch = C.sceneView.pitch;
    }
    const k = 1 - Math.exp(-4 * dt);
    C.target.lerp(goal, k);
    if (C.introUntil && this.time < C.introUntil) { const kk = 1 - Math.exp(-1.6 * dt); C.yaw += (C.homeYaw - C.yaw) * kk; C.pitch += (0.38 - C.pitch) * kk; C.dist += (distGoal - C.dist) * kk; }
    else if (C.firstSight != null) {
      // settle into the place's own view the first time it is shown (e.g. the shop's counter view)
      const kk = 1 - Math.exp(-3.2 * dt);
      C.yaw += (C.homeYaw - C.yaw) * kk; C.pitch += (C.firstSight - C.pitch) * kk; C.lastDrag = -10; C.zoomOffset = 0;
      if (Math.abs(C.homeYaw - C.yaw) < 0.02 && Math.abs(C.firstSight - C.pitch) < 0.02) C.firstSight = null;
    }
    else {
      C.introUntil = 0;
      if (C.orbitIdle === 'sway') { const want = C.homeYaw + Math.sin(this.time * 0.22) * 0.35; C.yaw += (want - C.yaw) * (1 - Math.exp(-1.5 * dt)); }
      else if (C.orbitIdle) C.yaw += dt * 0.12;
      else if (this.time - C.lastDrag > 7) { let d = C.homeYaw - C.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; const rate = this.time < (C.fastReturnUntil || 0) ? 1.6 : 0.5; C.yaw += d * (1 - Math.exp(-rate * dt)); }
      if (C.sceneView && C.sceneView.orbit) {
        // an anchored look-around view: dragging turns us around our own spot, and we stay put
        // (no slow drift back while the child is exploring the shop)
        const maxPitch = C.sceneView.maxPitch ?? 0.62;
        C.pitch = clamp(C.pitch, 0.02, maxPitch);
        C.lockPitch = null;
      }
      C.dist += (distGoal - C.dist) * (1 - Math.exp(-2.5 * dt));
      const focusPitch = viewPitch;
      const pitchGoal = C.lockPitch ?? focusPitch ?? C.pitch;
      if (!(C.sceneView && C.sceneView.orbit)) C.pitch += (pitchGoal - C.pitch) * (1 - Math.exp(-3 * dt));
    }
    const cp = Math.cos(C.pitch), sp = Math.sin(C.pitch);
    const off = new THREE.Vector3(Math.sin(C.yaw) * cp * C.dist, sp * C.dist, Math.cos(C.yaw) * cp * C.dist);
    const pos = C.target.clone().add(off);
    if (pos.y < 0.6) pos.y = 0.6;
    if (C.shake > 0.001) { pos.x += (Math.random() - 0.5) * C.shake; pos.y += (Math.random() - 0.5) * C.shake; C.shake *= Math.exp(-6 * dt); }
    this.camera.position.copy(pos);
    const look = C.target.clone(); look.x += C.offsetX;
    this.camera.lookAt(look);
    // a place can widen the lens (we are standing inside a small room)
    const wantFov = (C.sceneView && C.sceneView.fov) || null;
    if (wantFov && Math.abs(this.camera.fov - wantFov) > 0.01) { this.camera.fov = wantFov; this.camera.updateProjectionMatrix(); }
    else if (!wantFov && this.sceneFovFixed) { this.sceneFovFixed = false; this.resize(); }
    this.sceneFovFixed = !!wantFov;
    this.#updateViewProps(dt);
  }
  /**
   * Props the child holds while standing in a place (the shop scanner). They live under the camera so the
   * camera can freely orbit and they stay in shot; the scene must contain the camera for them to render.
   */
  setViewProp(name, obj) {
    this.viewProps = this.viewProps || {};
    const old = this.viewProps[name];
    if (old && old.parent) old.parent.remove(old);
    if (obj) { this.camera.add(obj); if (!this.camera.parent) this.scene.add(this.camera); this.viewProps[name] = obj; }
    else delete this.viewProps[name];
  }
  clearViewProps() { for (const k of Object.keys(this.viewProps || {})) this.setViewProp(k, null); }
  /** Play the "beep" swing of the hand prop once. */
  swingViewProp(name, seconds = 0.55) { const p = (this.viewProps || {})[name]; if (p) { p.userData.swingT = seconds; p.userData.swingDur = seconds; } }
  #updateViewProps(dt) {
    for (const [name, p] of Object.entries(this.viewProps || {})) {
      const base = p.userData.basePos, rot = p.userData.baseRot;
      if (!base) continue;
      const st = p.userData.swingT || 0;
      p.userData.swingT = Math.max(0, st - dt);
      const k = st > 0 ? Math.sin((1 - st / (p.userData.swingDur || 0.55)) * Math.PI) : 0;
      p.position.set(base.x - k * 0.05, base.y + k * 0.03, base.z + k * 0.12);
      if (rot) p.rotation.set(rot.x - k * 0.5, rot.y, rot.z);
      if (p.userData.spin) p.rotation.y += dt * p.userData.spin;
    }
  }
  /** Screen position of a world point: { x, y, visible } in CSS pixels relative to the canvas. */
  project(v3, out = {}) {
    const v = v3.clone().project(this.camera);
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    out.x = (v.x * 0.5 + 0.5) * w; out.y = (-v.y * 0.5 + 0.5) * h; out.visible = v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2; out.depth = v.z;
    return out;
  }
  /** Camera-relative movement vector from keys + joystick, in world XZ. */
  moveVector() {
    const K = this.input.keys; let x = 0, y = 0;
    if (K.has('KeyW') || K.has('ArrowUp')) y += 1; if (K.has('KeyS') || K.has('ArrowDown')) y -= 1;
    if (K.has('KeyA') || K.has('ArrowLeft')) x -= 1; if (K.has('KeyD') || K.has('ArrowRight')) x += 1;
    x += this.input.joy.x; y += this.input.joy.y;
    const len = Math.hypot(x, y); if (len < 0.08) return null; if (len > 1) { x /= len; y /= len; }
    // forward = away from camera on the XZ plane
    const fwd = new THREE.Vector3(-Math.sin(this.cam.yaw), 0, -Math.cos(this.cam.yaw));
    const right = new THREE.Vector3(fwd.z, 0, -fwd.x).multiplyScalar(-1);
    return fwd.multiplyScalar(y).add(right.multiplyScalar(x));
  }
  // ---------- input ----------
  #input() {
    const c = this.canvas; let down = null, moved = false, pinch = null;
    const ptrs = new Map();
    c.addEventListener('pointerdown', (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (ptrs.size === 1) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = false; } else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); } c.setPointerCapture?.(e.pointerId); });
    c.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) return;
      const prev = ptrs.get(e.pointerId); const dx = e.clientX - prev.x, dy = e.clientY - prev.y; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch) { this.#zoomBy(pinch / d); } pinch = d; return; }
      if (!down) return;
      if (Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) > 6) moved = true;
      if (moved) { this.cam.yaw -= dx * 0.006; this.cam.pitch = clamp(this.cam.pitch + dy * 0.004, 0.1, 1.15); this.cam.lastDrag = this.time; }
    });
    const up = (e) => { ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null; if (down && !moved && performance.now() - down.t < 500 && ptrs.size === 0) this.#tap(e.clientX, e.clientY); if (ptrs.size === 0) down = null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.#zoomBy(1 + e.deltaY * 0.0016); }, { passive: false });
    window.addEventListener('keydown', (e) => { if (e.target && /input|textarea|select/i.test(e.target.tagName)) return; this.input.keys.add(e.code); });
    window.addEventListener('keyup', (e) => this.input.keys.delete(e.code));
    window.addEventListener('blur', () => this.input.keys.clear());
    this.raycaster = new THREE.Raycaster(); this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  }
  #tap(cx, cy) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.input.pickables.length ? this.raycaster.intersectObjects(this.input.pickables, true) : [];
    if (hits.length) { let o = hits[0].object; while (o && !o.userData.pick) o = o.parent; if (o) { this.input.onTap?.({ kind: 'actor', pick: o.userData.pick, object: o, point: hits[0].point, x: cx, y: cy }); return; } }
    const pt = new THREE.Vector3(); if (this.raycaster.ray.intersectPlane(this.groundPlane, pt)) this.input.onTap?.({ kind: 'ground', point: pt, x: cx, y: cy });
    else this.input.onTap?.({ kind: 'ground', point: null, x: cx, y: cy });
  }
  // ---------- loop ----------
  onFrame(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }
  tween(seconds, fn, ease = easeInOut) { return new Promise((res) => this.tweens.add({ t: 0, seconds, fn, ease, res })); }
  start() { if (this.running) return; this.running = true; this.lastT = performance.now(); requestAnimationFrame(this.loopFn); }
  stop() { this.running = false; }
  #loop() {
    if (!this.running) return;
    requestAnimationFrame(this.loopFn);
    if (document.hidden) return;
    const now = performance.now(); const dt = Math.min((now - this.lastT) / 1000, 0.1); this.lastT = now; this.time += dt;
    for (const tw of this.tweens) { tw.t += dt; const p = Math.min(1, tw.t / tw.seconds); tw.fn(tw.ease(p), p); if (p >= 1) { this.tweens.delete(tw); tw.res(); } }
    for (const fn of this.updaters) fn(dt, this.time);
    this.#updateCamera(dt); this.#updateLights(dt); this.#updateSky(dt);
    this.renderer.render(this.scene, this.camera);
  }
}
export { clamp, easeOut, easeInOut, isMobile };
