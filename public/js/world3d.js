// 3D world: locations (ground, scenery, set pieces), live objects/characters from the server's world state,
// time of day, weather, and ambient animation.
import * as THREE from 'three';
import { makeObject, hasModel, build, mat, geo, groundTexture, repeatTex, blobShadow, treeParts, pineParts, palmParts, flowerParts, houseParts, tableParts, chairParts, signTexture, WOOD, DARK } from './models.js';
import { makePerson, makeAnimal, isAnimal, isPerson, setFace } from './creatures.js';

const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const SIZE = { small: 0.65, normal: 1, big: 1.5, huge: 2.1 };
const SLOTS = [[-2.6, -2.4], [2.6, -2.4], [-4.6, -3.6], [4.6, -3.6], [0, -4.6], [-6.2, -1.2], [6.2, -1.2], [-1.8, -5.6], [1.8, -5.6], [-7.5, -3.5], [7.5, -3.5]];
const ANCHORS = { restaurant: { waiter: [3.2, -8.05], customer: [1.2, -3.4], friend: [1.2, -3.4] }, shop: { shopkeeper: [-3.0, -5.4], customer: [0.4, -3.25] }, hospital: { doctor: [1.8, -3.4], nurse: [-1.8, -3.4] }, stage: { singer: [3.5, -1.5] }, school: { teacher: [0, -4.6] }, farm: { farmer: [-3, -3] }, kitchen: { chef: [0, -5.2], mom: [-2.6, -3] } };
// Restaurant layout shared by the 3D set and the seated guests: world [x, z] per table.
// Guest coords sent by the server land on these via toGround().
// Shop queue: the first person is at the counter, the others wait in a little line back toward the door.
export const SHOP_QUEUE = [[0.55, -3.25], [1.95, -2.15], [0.15, -1.0], [1.9, 0.1]];
export const SHOP_DOOR = [0, 3.6];
export const GUEST_TABLES = [[-4.5, -2.6], [4.5, -2.6], [0, -4.9]];
export const GUEST_WORLD = [[20, 72], [80, 72], [50, 61]];  // server x/y that maps onto the three tables
export const CHEF_WINDOW_WORLD = [80, 57];                    // the pass window on the kitchen's right
const FLY_CHARS = new Set(['fairy', 'genie', 'bird', 'butterfly', 'bee', 'dragon']);
const RING_COLORS = { grass: ['#4f9f4a', '#5faf58', '#4a9247'], sand: ['#e8cf96', '#d9bd82'], snow: ['#eaf2fb', '#dde9f6'], stone: ['#7d8597', '#8d95a7'], moon: ['#6f6f7c', '#5d5d6a'], dream: ['#c7b7ff', '#ffd0ef', '#bfeee2'] };

export class World {
  constructor(engine) {
    this.e = engine; this.scene = engine.scene;
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.groundG = new THREE.Group(); this.setG = new THREE.Group(); this.actorG = new THREE.Group(); this.fxG = new THREE.Group();
    this.root.add(this.groundG, this.setG, this.actorG, this.fxG);
    this.actors = new Map(); this.animated = []; this.waters = []; this.audience = []; this.spots = []; this.islands = []; this.clouds = [];
    this.location = null; this.speakingKey = null; this.clapUntil = 0; this.t = 0;
    this.extraPickables = [];
    this.speakRing = new THREE.Mesh(geo('ring', [0.7, 0.95, 40]), new THREE.MeshBasicMaterial({ color: '#fff7c2', transparent: true, opacity: 0, depthWrite: false }));
    this.speakRing.rotation.x = -Math.PI / 2; this.speakRing.position.y = 0.03; this.scene.add(this.speakRing);
    this.seed = 1;
    this.#clouds();
  }
  // ---------- helpers ----------
  put(key, x, z, { s = 1, ry = 0, c = null, group = this.setG } = {}) {
    const { group: g, named } = makeObject(key, { color: c, scale: s });
    g.position.set(x, 0, z); g.rotation.y = ry * Math.PI / 180; group.add(g);
    this.#registerAnim(key, named, g);
    return g;
  }
  scatter(key, n, rMin, rMax, { s = 1, jitter = 0.3, seed = 7, c = null, arc = [0, Math.PI * 2] } = {}) {
    const r = rnd(seed * 31 + n);
    for (let i = 0; i < n; i++) {
      const a = arc[0] + (arc[1] - arc[0]) * ((i + 0.5) / n) + (r() - 0.5) * 0.5, d = rMin + r() * (rMax - rMin);
      this.put(key, Math.cos(a) * d, Math.sin(a) * d, { s: s * (1 - jitter / 2 + r() * jitter), ry: r() * 360, c });
    }
  }
  fence(x1, x2, z, c = '#f8fafc') {
    const parts = []; for (let x = x1; x <= x2; x += 1.2) parts.push(['box', [0.12, 0.9, 0.12], c, [x, 0.45, z]], ['cone', [0.1, 0.15, 4], c, [x, 0.95, z], [0, 45, 0]]);
    parts.push(['box', [x2 - x1, 0.1, 0.06], c, [(x1 + x2) / 2, 0.65, z]], ['box', [x2 - x1, 0.1, 0.06], c, [(x1 + x2) / 2, 0.3, z]]);
    this.setG.add(build(parts).group);
  }
  pond(x, z, r) { const m = new THREE.Mesh(geo('circle', [r, 40]), new THREE.MeshStandardMaterial({ map: repeatTex(groundTexture('water'), 2, 2), roughness: 0.3, transparent: true, opacity: 0.92 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.04, z); m.receiveShadow = true; this.setG.add(m); this.waters.push(m.material.map); const rim = new THREE.Mesh(geo('ring', [r, r + 0.35, 40]), mat('#d6c39a')); rim.rotation.x = -Math.PI / 2; rim.position.set(x, 0.03, z); this.setG.add(rim); }
  sea(z = -14) { const g = new THREE.PlaneGeometry(260, 140, 40, 20); const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: repeatTex(groundTexture('water'), 30, 16), roughness: 0.25, transparent: true, opacity: 0.95 })); m.rotation.x = -Math.PI / 2; m.position.set(0, 0.08, z - 70); m.receiveShadow = true; this.setG.add(m); this.waters.push(m.material.map); this.seaMesh = m; }
  counter(x, z, w = 4, c = '#c084fc') { this.setG.add(build([['box', [w, 1.1, 0.9], c, [x, 0.55, z]], ['box', [w + 0.2, 0.1, 1.1], WOOD, [x, 1.12, z]]]).group); }
  shelf(x, z, c = '#60a5fa', seed = 1, ry = 0) { const r = rnd(seed); const parts = [['box', [2.4, 2.4, 0.5], c, [0, 1.2, 0]]]; for (let row = 0; row < 3; row++) { parts.push(['box', [2.3, 0.06, 0.6], '#fff', [0, 0.5 + row * 0.75, 0.05]]); for (let i = 0; i < 4; i++) parts.push(['box', [0.35, 0.3 + r() * 0.3, 0.35], ['#ef4444', '#facc15', '#22c55e', '#f472b6', '#3b82f6', '#fb923c'][Math.floor(r() * 6)], [-0.8 + i * 0.55, 0.53 + row * 0.75 + 0.2, 0.1]]); } const g = build(parts).group; g.position.set(x, 0, z); g.rotation.y = ry * Math.PI / 180; this.setG.add(g); }
  sign(text, x, y, z, { bg = '#fff', fg = '#2b2140', w = 3, ry = 0 } = {}) { const m = new THREE.Mesh(geo('plane', [w, w / 4]), new THREE.MeshBasicMaterial({ map: signTexture(text, { bg, fg }), transparent: true, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry * Math.PI / 180; this.setG.add(m); return m; }
  ring(kind, n = 14, rMin = 34, rMax = 52, seed = 3) {
    const r = rnd(seed), cols = RING_COLORS[kind] || RING_COLORS.grass;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.4, d = rMin + r() * (rMax - rMin), s = 6 + r() * 9; const m = new THREE.Mesh(geo('sphere', [1, 18, 12]), mat(cols[i % cols.length])); m.position.set(Math.cos(a) * d, -s * 0.55, Math.sin(a) * d); m.scale.set(s * 1.6, s, s * 1.3); m.receiveShadow = true; this.setG.add(m); }
  }
  mountainsRing(n = 9) { const r = rnd(11); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.4, d = 44 + r() * 14, s = 2.2 + r() * 2; this.put('mountain', Math.cos(a) * d, Math.sin(a) * d, { s }); } }
  cityRing(n = 18) { const r = rnd(5); for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + r() * 0.3, d = 24 + r() * 16, w = 3 + r() * 3, h = 6 + r() * 12; const m = new THREE.Mesh(geo('box', [1, 1, 1]), new THREE.MeshStandardMaterial({ map: repeatTex(groundTexture('window'), 1, Math.round(h / 4)), roughness: 0.8 })); m.position.set(Math.cos(a) * d, h / 2, Math.sin(a) * d); m.scale.set(w, h, w); m.castShadow = true; this.setG.add(m); } }
  trees(kind, n, rMin, rMax, seed = 9, s = 1) { this.scatter(kind, n, rMin, rMax, { s, seed }); }
  #registerAnim(key, named, g) {
    if (named.rotor || named.blades || named.wheel || named.flame || named.float || named.smoke || named.seat || named.kite || g.userData.billboard || key === 'balloons' || key === 'cloud') this.animated.push({ key, named, g, phase: Math.random() * 6 });
  }
  #clouds() {
    const r = rnd(21);
    for (let i = 0; i < 9; i++) { const { group } = makeObject('cloud', { scale: 1.6 + r() * 1.8 }); group.position.set((r() - 0.5) * 90, 13 + r() * 9, (r() - 0.5) * 90); group.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.material = mat({ c: '#ffffff', o: 0.92 }); } }); this.scene.add(group); this.clouds.push({ g: group, v: 0.3 + r() * 0.5 }); }
  }
  // ---------- locations ----------
  clearSet() {
    this.extraPickables = [];
    for (const g of [this.groundG, this.setG]) { while (g.children.length) { const c = g.children[g.children.length - 1]; g.remove(c); c.traverse((o) => { if (o.isMesh && o.material?.map && this.waters.includes(o.material.map)) o.material.dispose(); }); } }
    for (const s of this.spots) { this.scene.remove(s.light, s.light.target, s.cone); }
    this.spots = []; this.audience = []; this.waters = []; this.islands = []; this.seaMesh = null;
    this.animated = this.animated.filter((a) => a.g.parent === this.actorG || this.actorG.children.includes(a.g));
  }
  ground(kind, { tint = null, repeat = 26, radius = 80 } = {}) {
    const m = new THREE.Mesh(geo('circle', [radius, 72]), new THREE.MeshStandardMaterial({ map: repeatTex(groundTexture(kind), repeat, repeat), roughness: 1, color: tint || '#ffffff' }));
    m.rotation.x = -Math.PI / 2; m.receiveShadow = true; this.groundG.add(m); this.groundMesh = m;
    return m;
  }
  setLocation(loc, world) {
    this.clearSet(); this.location = loc;
    const L = LOCS[loc] || LOCS.park;
    this.ground(L.ground, { tint: world?.colors?.ground || world?.colors?.room || null });
    L.set(this);
    this.sceneKind = L.kind || 'outdoor';
    this.applyAtmosphere(world);
  }
  applyAtmosphere(world) {
    const L = LOCS[this.location] || LOCS.park, time = world?.time || 'day', weather = world?.weather || 'clear';
    let sky = L.sky || 'auto', light = L.light || 'auto';
    if (sky === 'auto') sky = time === 'night' ? 'night' : time === 'sunset' ? 'sunset' : (weather === 'rain' ? 'rainy' : 'day');
    if (light === 'auto') light = time === 'night' ? 'night' : time === 'sunset' ? 'sunset' : 'day';
    const override = {};
    if (sky === 'rainy') { sky = 'day'; Object.assign(override, { top: '#6b7fa3', horizon: '#aab6c8' }); }
    if (world?.colors?.sky && world.colors.sky !== 'rainbow') { const c = new THREE.Color(world.colors.sky); override.top = '#' + c.getHexString(); override.horizon = '#' + c.clone().lerp(new THREE.Color('#ffffff'), 0.55).getHexString(); }
    this.e.setSky(sky, override);
    this.e.setLight(light, { lamp: time === 'night' && this.location !== 'stage' ? 16 : 0 });
    if (this.location === 'underwater') this.e.setFog(6, 48); else if (this.location === 'space') this.e.setFog(80, 400); else this.e.setFog(38, 150);
    for (const s of this.spots) s.on = !!world?.spotlight || this.location === 'stage';
    this.groundMesh.material.color.set(world?.colors?.ground || world?.colors?.room || '#ffffff');
    this.rainbowOn = weather === 'rainbow';
    if (this.rainbowOn && !this.rainbow) { this.rainbow = makeObject('rainbow', { scale: 2.6 }).group; this.rainbow.position.set(0, 0, -30); this.scene.add(this.rainbow); }
    if (this.rainbow) this.rainbow.visible = this.rainbowOn;
    this.windy = weather === 'wind';
    for (const c of this.clouds) c.g.visible = !['space', 'underwater', 'stage'].includes(this.location);
  }
  // ---------- live world (objects / characters) ----------
  toGround(o) {
    let x = ((o.x ?? 50) - 50) / 50 * 7.5, z = -7 + Math.max(0, Math.min(1, ((o.y ?? 75) - 55) / 40)) * 8.5;
    // keep a clear circle around the pet's home spot so new things never cover it
    const d = Math.hypot(x, z); if (d < 2.2) { const k = 2.2 / Math.max(d, 0.001); x = d < 0.01 ? 2.2 : x * k; z = d < 0.01 ? -0.5 : z * k; }
    return [x, z];
  }
  toSky(o) { return [((o.x ?? 50) - 50) / 50 * 10, 3.5 + Math.max(0, Math.min(1, (40 - (o.y ?? 20)) / 35)) * 6.5, -7]; }
  applyWorld(world, { petPos } = {}) {
    const seen = new Set(), added = [];
    // objects
    for (const o of world.objects || []) {
      const id = 'o' + o.id; seen.add(id);
      let a = this.actors.get(id);
      if (a && (a.color !== (o.color || null))) { this.#remove(id, true); a = null; }
      if (!a) {
        const scale = SIZE[o.size] || 1;
        let built = isAnimal(o.key) ? makeAnimal(o.key, { color: o.color, scale }) : null;
        if (!built) built = makeObject(o.key, { color: o.color, emoji: o.emoji, scale });
        const g = built.group; g.userData.pick = { kind: 'object', id: o.id, key: o.key, name: o.name };
        let pos;
        if (o.sky) { const [x, y, z] = this.toSky(o); pos = new THREE.Vector3(x, y, z); if (!isAnimal(o.key) && !['kite', 'balloons', 'plane', 'helicopter', 'rocket'].includes(o.key)) g.traverse((m) => { if (m.isMesh) m.castShadow = false; }); }
        else { const [x, z] = this.toGround(o); pos = new THREE.Vector3(x, 0, z); }
        // the stuck kite sits in the big tree
        if (o.key === 'kite' && this.location === 'emergency') { const tree = (world.objects || []).find((t) => t.key === 'tree'); if (tree) { const [tx, tz] = this.toGround(tree); pos.set(tx + 0.6, 2.6 * (SIZE[tree.size] || 1) + 1.2, tz + 0.4); } }
        if (this.location === 'shop' && /customer item/i.test(o.name || '')) { pos.set(0.3, 1.06, -3.85); g.scale.setScalar(0.3); }
        if (this.location === 'restaurant' && o.key === 'window' && /chef window/i.test(o.name || '')) {
          pos.set(3.2, 1.6, -7.66); g.scale.setScalar(1.3);
          // see the chef through the opening: keep the pick target, fade the glass
          g.traverse((m) => { if (m.isMesh && m.material) { m.material = m.material.clone(); m.material.transparent = true; m.material.opacity = 0.12; m.material.depthWrite = false; } });
          // generous, invisible tap area so small hands always hit the window
          if (!g.userData.pickPad) {
            const pad = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
            pad.position.set(0, 0, 0.02); pad.userData.pickPad = true; g.add(pad); g.userData.pickPad = true;
          }
        }
        g.position.copy(pos);
        if (!o.sky) g.rotation.y = (Math.random() - 0.5) * 0.8;
        a = { id, key: o.key, kind: 'object', g, named: built.named, data: o, color: o.color || null, sky: !!o.sky, fly: g.userData.fly || o.sky, swim: g.userData.swim, baseY: pos.y, phase: Math.random() * 6, born: this.t, scale: g.scale.x };
        if (!o.sky && (g.userData.swim)) { const puddle = new THREE.Mesh(geo('circle', [1.1, 24]), mat({ c: '#7dd3fc', o: 0.85 })); puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.02; g.add(puddle); }
        if (!o.sky && !g.userData.billboard) { const sh = blobShadow(0.7 * (SIZE[o.size] || 1)); sh.scale.setScalar(1 / g.scale.x); g.add(sh); }
        this.actorG.add(g); this.actors.set(id, a); added.push(a);
        g.scale.setScalar(0.001); a.pop = { t0: this.t, target: a.scale };
        this.#registerAnim(o.key, built.named, g);
      }
    }
    // characters
    const chars = world.characters || [];
    chars.forEach((c, idx) => {
      const id = 'c' + c.id; seen.add(id);
      let a = this.actors.get(id);
      if (a && a.color !== (c.color || null)) { this.#remove(id, true); a = null; }
      if (!a) {
        let built = null, kind = 'person';
        const seated = this.location === 'restaurant' && (c.role === 'customer' || c.role === 'diner');
        let personKey = c.key;
        if (this.location === 'restaurant' && c.role === 'chef') personKey = 'chef';
        else if (this.location === 'shop' && c.role === 'customer') personKey = 'shopper';   // grown-up shoppers
        const SHOP_SHIRTS = ['#38bdf8', '#f472b6', '#4ade80', '#fbbf24', '#a78bfa'];
        const shopColor = this.location === 'shop' && c.role === 'customer' ? (c.color || SHOP_SHIRTS[(idx + (c.id || 0)) % SHOP_SHIRTS.length]) : c.color;
        if (isPerson(personKey)) built = makePerson(personKey, { color: shopColor, seed: c.id || idx, sit: seated });
        else if (isAnimal(c.key)) { built = makeAnimal(c.key, { color: c.color }); kind = 'animal'; }
        else if (hasModel(c.key)) built = makeObject(c.key, { color: c.color, emoji: c.emoji });
        else built = makeObject(c.key, { emoji: c.emoji });
        const g = built.group; g.userData.pick = { kind: 'character', id: c.id, key: c.key, name: c.name };
        const anch = ANCHORS[this.location] || {};
        let anchored = anch[c.role] || anch[c.key];
        // shop customers queue up in front of the counter, in the order they arrived
        if (this.location === 'shop' && c.role === 'customer') {
          const n = Math.min(SHOP_QUEUE.length - 1, Math.max(0, (c.queue ?? 0)));
          anchored = SHOP_QUEUE[n];
        }
        const custom = this.location === 'restaurant' && (c.role === 'customer' || c.role === 'diner' || c.role === 'chef') && typeof c.x === 'number' && typeof c.y === 'number';
        const slot = custom ? this.toGround(c) : (anchored || SLOTS[idx % SLOTS.length]);
        let seatY = 0;   // guests sit ON the chair
        if (seated) { const n = GUEST_WORLD.findIndex(([gx, gy]) => Math.abs(gx - c.x) < 25 && Math.abs(gy - c.y) < 8); if (n >= 0) { slot[0] = GUEST_TABLES[n][0] + 1.15; slot[1] = GUEST_TABLES[n][1]; seatY = 0.42; } }
        const target = new THREE.Vector3(slot[0], seatY, slot[1]);
        const fly = FLY_CHARS.has(c.key) || g.userData.fly || g.userData.float;
        if (fly) target.y = c.key === 'fairy' || c.key === 'genie' ? 1.2 : 2.2;
        const from = target.clone();
        if (this.location === 'shop' && c.role === 'customer') from.set(SHOP_DOOR[0] + (idx % 3 - 1) * 0.9, 0, SHOP_DOOR[1]);   // walk in through the door
        else if (this.location === 'shop' && (c.key === 'friend' || c.key === 'shopkeeper')) { from.copy(target); from.z += 0.4; }
        else { const dir = new THREE.Vector3(Math.sign(slot[0] || 1), 0, 0); from.add(dir.multiplyScalar(14)); }
        if (fly) from.y += 6;
        g.position.copy(from);
        g.rotation.set(0, Math.PI, 0);
        if (seated) g.rotation.y = -Math.PI / 2;   // chair on the right side faces the table (leftwards)
        if (!g.userData.billboard && !fly) { const sh = blobShadow(0.6); sh.scale.setScalar(1 / g.scale.x); g.add(sh); }
        this.actorG.add(g);
        if (this.location === 'shop' && c.role === 'customer') {
          const yaw = Math.atan2(0 - from.x, -4.8 - from.z);
          g.rotation.set(0, yaw, 0);
        }
        if (this.location === 'shop' && (c.role === 'shopkeeper' || c.role === 'friend')) g.rotation.set(0, 0, 0);
        a = { id, key: c.key, kind, g, named: built.named, data: c, color: c.color || null, target, from, walk: { t0: this.t, dur: 1.9 }, fly, phase: Math.random() * 6, born: this.t, scale: g.scale.x, baseY: target.y };
        this.actors.set(id, a); added.push(a);
        this.#registerAnim(c.key, built.named, g);
      } else {
        a.data = c;
        if (this.location === 'shop' && c.role === 'customer' && a.g) {
          const n = Math.min(SHOP_QUEUE.length - 1, Math.max(0, c.queue ?? 0));
          const qx = SHOP_QUEUE[n][0], qz = SHOP_QUEUE[n][1];
          if (!a.target || Math.abs(a.target.x - qx) > 0.05 || Math.abs(a.target.z - qz) > 0.05) {
            a.from = a.g.position.clone();
            a.target = new THREE.Vector3(qx, 0, qz);
            a.walk = { t0: this.t, dur: 1.2 };
          }
          const yaw = Math.atan2(0 - a.g.position.x, -4.8 - a.g.position.z);
          a.g.rotation.set(0, yaw, 0);
        }
        // customers / chefs with custom world coords slide to their new spot instead of teleporting
        const roleCustom = this.location === 'restaurant' && (c.role === 'customer' || c.role === 'diner' || c.role === 'chef');
        if (roleCustom && typeof c.x === 'number' && typeof c.y === 'number') {
          const [sx, sz] = this.toGround(c);
          // guests are snapped onto the chair beside their table; the chef stays inside the kitchen
          let gx = sx, gz = sz, gy = 0;
          if (c.role === 'customer' || c.role === 'diner') { const n = GUEST_WORLD.findIndex(([wx, wy]) => Math.abs(wx - c.x) < 25 && Math.abs(wy - c.y) < 8); if (n >= 0) { gx = GUEST_TABLES[n][0] + 1.15; gz = GUEST_TABLES[n][1]; gy = 0.42; } }
          const moved = !a.target || Math.abs(a.target.x - gx) > 0.05 || Math.abs(a.target.z - gz) > 0.05;
          if (moved) { a.from = a.g.position.clone(); a.target = new THREE.Vector3(gx, gy, gz); a.walk = { t0: this.t, dur: 1.2 }; }
          else if (a.target.y !== gy) a.target.y = gy;
          if (a.g) a.g.rotation.set(0, c.role === 'chef' ? Math.PI : -Math.PI / 2, 0);
        }
      }
    });
    for (const id of [...this.actors.keys()]) if (!seen.has(id)) this.#remove(id);
    this.applyAtmosphere(world);
    return added;
  }
  #remove(id, instant = false) {
    const a = this.actors.get(id); if (!a) return;
    this.actors.delete(id);
    const kill = () => { this.actorG.remove(a.g); this.animated = this.animated.filter((x) => x.g !== a.g); };
    if (instant) kill(); else { a.dying = { t0: this.t }; a.kill = kill; this.dying = this.dying || []; this.dying.push(a); }
  }
  /** Remove every live actor immediately (used when leaving the game). */
  reset() { this.extraPickables = []; for (const id of [...this.actors.keys()]) this.#remove(id, true); this.dying = []; this.speakingKey = null; this.version = -1; }
  audiencePositions() { return this.audience.map((p) => p.g.position.clone()); }
  actorPos(idOrKey, out = new THREE.Vector3()) {
    for (const a of this.actors.values()) if (a.id === idOrKey || a.key === idOrKey || a.data.name === idOrKey) { a.g.getWorldPosition(out); out.y += 1.4 * a.scale; return out; }
    return null;
  }
  findActor(key) { for (const a of this.actors.values()) if (a.id === key || a.key === key || a.data.name === key) return a; return null; }
  pickables() { return [...this.actors.values()].map((a) => a.g).concat(this.extraPickables || []); }
  setSpeaking(key) {
    // a speaking line may name an actor by its id (shop customers) or by key/name (the chef, the doctor...)
    this.speakingKey = key;
    for (const a of this.actors.values()) { if (a.named?.face && a.faceTalk) setFace(a.named.face, { talk: false }); a.faceTalk = false; }
  }
  /** Is this actor the one whose line is playing right now? */
  #isSpeaking(a) {
    const k = this.speakingKey;
    if (!k) return false;
    if (a.id === k || a.key === k || a.data?.name === k) return true;
    // the shop rebuilds its line of customers on every turn, so a line may name a customer who
    // has just been replaced: fall back to the person we are actually serving at the counter
    if (this.location === 'shop' && !this.#speaks(k)) return a.data?.role === 'customer' && (a.data.queue ?? 0) === 0;
    return false;
  }
  /** Talking mouths: the face decal flaps while the character speaks, with a bob and a gesture. */
  #animateMouth(a, n, speaking, dt, t) {
    if (!n.face) return;
    a.talkT = speaking ? (a.talkT || 0) + dt : 0;
    const open = speaking && Math.sin(a.talkT * 15 + a.phase) > -0.15;
    if (open !== a.faceTalk) { a.faceTalk = open; setFace(n.face, { talk: open }); }
    if (speaking) {
      if (n.head) n.head.rotation.x += Math.sin(t * 9 + a.phase) * 0.05;
      if (n.armR) n.armR.rotation.x += Math.sin(t * 7 + a.phase) * 0.5 - 0.4;
    }
  }
  #speaks(key) {
    for (const a of this.actors.values()) if (a.id === key || a.key === key || a.data?.name === key) return true;
    return false;
  }
  clap() { this.clapUntil = this.t + 2.8; }
  // ---------- per-frame ----------
  update(dt, t, petPos, camera) {
    this.t = t;
    const k = 1 - Math.exp(-6 * dt);
    for (const w of this.waters) { w.offset.x += dt * 0.015; w.offset.y += dt * 0.01; }
    if (this.seaMesh) this.seaMesh.position.y = 0.08 + Math.sin(t * 0.8) * 0.05;
    for (const c of this.clouds) { c.g.position.x += dt * c.v * (this.windy ? 4 : 1); if (c.g.position.x > 60) c.g.position.x = -60; }
    for (const isl of this.islands) isl.g.position.y = isl.y + Math.sin(t * 0.6 + isl.phase) * 0.35;
    for (const s of this.spots) { const want = s.on ? s.base : 0; s.light.intensity += (want - s.light.intensity) * k; s.cone.material.opacity += ((s.on ? 0.07 : 0) - s.cone.material.opacity) * k; s.light.target.position.x = Math.sin(t * 0.7 + s.phase) * 1.5; s.cone.lookAt(s.light.target.position); s.cone.rotateX(-Math.PI / 2); }
    // ambient part animation
    for (const an of this.animated) {
      const n = an.named, g = an.g;
      if (n.rotor) n.rotor.rotation.x += dt * 20; if (n.blades) n.blades.rotation.z += dt * 1.6; if (n.wheel) n.wheel.rotation.z += dt * 0.35;
      if (n.flame) { n.flame.scale.set(1 + Math.sin(t * 17 + an.phase) * 0.12, 1 + Math.sin(t * 23) * 0.18, 1); }
      if (n.float) { n.float.position.y = (n.float.userData.y ?? (n.float.userData.y = n.float.position.y)) + Math.sin(t * 2 + an.phase) * 0.15; n.float.rotation.y += dt * 1.2; }
      if (n.smoke) { n.smoke.position.y = 4.2 + ((t + an.phase) % 2) * 0.8; n.smoke.scale.setScalar(0.6 + ((t + an.phase) % 2) * 0.5); }
      if (n.seat) n.seat.rotation.x = Math.sin(t * 1.6 + an.phase) * 0.4;
      if (n.kite) { n.kite.rotation.z = Math.sin(t * 1.5 + an.phase) * 0.2; n.kite.position.y = 1.5 + Math.sin(t * 2.2 + an.phase) * 0.15; }
      if (an.key === 'balloons' || an.key === 'balloon') g.position.y = (g.userData.y ?? (g.userData.y = g.position.y)) + Math.sin(t * 1.4 + an.phase) * 0.12;
      if (g.userData.billboard && camera) { g.rotation.y = Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z); }
    }
    // audience
    for (const p of this.audience) {
      const clap = t < this.clapUntil;
      const n = p.named; const w = Math.sin(t * (clap ? 16 : 1.5) + p.phase);
      if (n.armL && n.armR) { n.armL.rotation.x = clap ? -2.2 + w * 0.3 : 0; n.armR.rotation.x = clap ? -2.2 - w * 0.3 : 0; n.armL.rotation.z = clap ? 0.6 : 0; n.armR.rotation.z = clap ? -0.6 : 0; }
      if (n.head) n.head.rotation.y = Math.sin(t * 0.5 + p.phase) * 0.2;
      p.g.position.y = p.baseY + (clap ? Math.abs(w) * 0.06 : 0);
    }
    // actors
    for (const a of this.actors.values()) this.#animateActor(a, dt, t, petPos, camera);
    if (this.dying) { for (const a of this.dying) { const p = (t - a.dying.t0) / 0.45; if (p >= 1) { a.kill(); a.dead = true; } else a.g.scale.setScalar(a.scale * (1 - p) * (1 + Math.sin(p * Math.PI) * 0.2)); } this.dying = this.dying.filter((a) => !a.dead); }
    // speaking ring
    const sp = this.speakingKey ? this.findActor(this.speakingKey) : null;
    if (sp) { sp.g.getWorldPosition(this.speakRing.position); this.speakRing.position.y = (sp.fly ? 0 : 0) + 0.03; this.speakRing.material.opacity += (0.75 + Math.sin(t * 6) * 0.2 - this.speakRing.material.opacity) * k; this.speakRing.scale.setScalar(1 + Math.sin(t * 6) * 0.08); }
    else this.speakRing.material.opacity += (0 - this.speakRing.material.opacity) * k;
  }
  #animateActor(a, dt, t, petPos, camera) {
    const g = a.g, n = a.named || {};
    const speakingNow = this.#isSpeaking(a);
    this.#animateMouth(a, n, speakingNow, dt, t);
    // pop-in
    if (a.pop) { const p = Math.min(1, (t - a.pop.t0) / 0.55); const s = p < 1 ? a.pop.target * (1.2 * Math.sin(p * Math.PI * 0.5 + 0.1) - 0.2 * Math.sin(p * Math.PI)) : a.pop.target; g.scale.setScalar(Math.max(0.001, s)); if (p >= 1) a.pop = null; }
    // walk-in
    if (a.walk) {
      const p = Math.min(1, (t - a.walk.t0) / a.walk.dur);
      const e = 1 - Math.pow(1 - p, 2);
      g.position.lerpVectors(a.from, a.target, e);
      if (a.fly) g.position.y = a.from.y + (a.target.y - a.from.y) * e + Math.sin(t * 5) * 0.1;
      const w = t * 12; if (n.legL && n.legR) { n.legL.rotation.x = Math.sin(w) * 0.8; n.legR.rotation.x = -Math.sin(w) * 0.8; }
      if (n.armL && n.armR && !a.fly) { n.armL.rotation.x = -Math.sin(w) * 0.6; n.armR.rotation.x = Math.sin(w) * 0.6; }
      if (n.legFL && n.legFR) { n.legFL.rotation.x = Math.sin(w) * 0.6; n.legFR.rotation.x = -Math.sin(w) * 0.6; if (n.legBL && n.legBR) { n.legBR.rotation.x = Math.sin(w) * 0.6; n.legBL.rotation.x = -Math.sin(w) * 0.6; } }
      if (!a.fly) g.position.y = Math.abs(Math.sin(w)) * 0.05;
      if (p >= 1) {
        a.walk = null; a.baseY = a.target.y; g.position.copy(a.target);
        if (this.location === 'shop' && a.data?.role === 'customer') {
          const yaw = Math.atan2(0 - g.position.x, -4.8 - g.position.z);
          g.rotation.set(0, yaw, 0);
        }
        if (n.legL) { n.legL.rotation.x = n.legR.rotation.x = 0; }
        for (const l of ['legFL', 'legFR', 'legBL', 'legBR']) if (n[l]) n[l].rotation.x = 0;
      }
      if (this.location === 'shop' && a.data?.role === 'customer') {
        const yaw = Math.atan2(0 - g.position.x, -4.8 - g.position.z);
        g.rotation.set(0, yaw, 0);
      }
      return;
    }
    if (this.location === 'shop' && a.data && a.data.role === 'customer') this.shopCustomerPos = g.position;
    const speaking = speakingNow;
    // face the counter / pet / camera
    if (this.location === 'shop' && a.data?.role === 'customer') {
      const yaw = Math.atan2(0 - g.position.x, -4.8 - g.position.z);
      g.rotation.set(0, yaw, 0);
    } else if (a.kind !== 'object' && petPos) {
      let facePt = petPos;
      if (this.location === 'shop' && a.data) {
        const cust = this.shopCustomerPos;
        facePt = cust || (camera ? camera.position : petPos);
      }
      const want = Math.atan2(facePt.x - g.position.x, facePt.z - g.position.z);
      let d = want - g.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      const newY = g.rotation.y + d * (1 - Math.exp(-3 * dt));
      g.rotation.set(0, newY, 0);
    }
    if (g.userData.billboard && camera) g.rotation.set(0, Math.atan2(camera.position.x - g.position.x, camera.position.z - g.position.z), 0);
    // idle
    const ph = a.phase;
    if (a.fly) { g.position.y = a.baseY + Math.sin(t * 2.2 + ph) * 0.25; if (n.wingL) { n.wingL.rotation.z = Math.sin(t * 14 + ph) * 0.6; n.wingR.rotation.z = -Math.sin(t * 14 + ph) * 0.6; } if (a.kind === 'object' && a.sky && !['kite', 'cloud', 'sun', 'moon', 'star', 'rainbow'].includes(a.key)) { g.position.x += Math.cos(t * 0.4 + ph) * dt * 0.8; } }
    else if (a.swim) { g.position.y = a.baseY + Math.sin(t * 2 + ph) * 0.15; g.rotation.z = Math.sin(t * 2 + ph) * 0.08; }
    else if (n.wingL && n.wingR) { n.wingL.rotation.z = Math.sin(t * 3 + ph) * 0.2; n.wingR.rotation.z = -Math.sin(t * 3 + ph) * 0.2; }
    if (n.tail && a.kind === 'animal') n.tail.rotation.y = Math.sin(t * 4 + ph) * 0.35;
    if (n.trunk) n.trunk.rotation.x = Math.sin(t * 1.5 + ph) * 0.25;
    if (n.head) {
      n.head.rotation.x = speaking ? Math.sin(t * 10) * 0.06 : Math.sin(t * 1.3 + ph) * 0.04;
      n.head.rotation.z = speaking ? Math.sin(t * 4) * 0.05 : 0;
      n.head.rotation.y = speaking ? 0 : Math.sin(t * 0.7 + ph) * 0.15;
    }
    if (n.torso) n.torso.scale.y = 1 + Math.sin(t * 2.5 + ph) * 0.015;
    if (n.armL && n.armR && a.kind === 'person') {
      if (speaking) { n.armR.rotation.x = -0.8 + Math.sin(t * 5) * 0.35; n.armL.rotation.x = -0.3 + Math.sin(t * 4 + 1) * 0.2; n.armR.rotation.z = -0.4; }
      else { n.armR.rotation.x += (0 - n.armR.rotation.x) * (1 - Math.exp(-4 * dt)); n.armL.rotation.x += (0 - n.armL.rotation.x) * (1 - Math.exp(-4 * dt)); n.armR.rotation.z += (0 - n.armR.rotation.z) * (1 - Math.exp(-4 * dt)); n.armL.rotation.z = Math.sin(t * 1.4 + ph) * 0.04; }
    }
    if (g.userData.float) g.position.y = a.baseY + 0.3 + Math.sin(t * 1.8 + ph) * 0.15;
    if (n.face) { const talk = speaking && Math.sin(t * 22) > 0; if (n.face.userData.faceOpts.talk !== talk) setFace(n.face, { talk }); }
    if (a.kind === 'animal' && speaking && n.head) n.head.position.y = (n.head.userData.y ?? (n.head.userData.y = n.head.position.y)) + Math.abs(Math.sin(t * 10)) * 0.05;
  }
}

// ---------- location definitions ----------
export const LOCS = {
  home: { ground: 'grass', kind: 'outdoor', set: (W) => { W.ring('grass'); W.put('house', 0, -9, { s: 1.5 }); W.put('tree', -7, -6.5); W.put('tree', 7.5, -7, { s: 0.9 }); W.fence(-6.5, 6.5, -5.4); W.put('bench', 5.2, -3.4, { ry: -25 }); W.put('flowers', -4.5, -4.2); W.put('flowers', 4.2, -4.8); W.put('lamp', -7.5, -2.5); W.put('swing', 8.6, -3, { s: 0.9, ry: 20 }); W.put('garden_pot', -2.8, -5.8); W.put('garden_pot', 2.8, -5.8); W.trees('tree', 10, 16, 30, 4, 1.1); W.scatter('flower', 16, 9, 15, { seed: 8 }); } },
  park: { ground: 'grass', set: (W) => { W.ring('grass'); W.trees('tree', 14, 11, 30, 2, 1.1); W.put('slide', -5.5, -6, { ry: 15 }); W.put('swing', 5.5, -6.5, { ry: -10 }); W.put('bench', -7.5, -2.5, { ry: 35 }); W.put('bench', 7.8, -2.2, { ry: -35 }); W.pond(8, -10, 3.2); W.put('lamp', -3, -8); W.put('lamp', 3, -8); W.scatter('flower', 22, 8.5, 14, { seed: 3 }); W.put('tree', -9, -8, { s: 1.4 }); W.put('mushroom', -8, -5.5, { s: 0.7 }); } },
  emergency: { ground: 'grass', set: (W) => { W.ring('grass'); W.trees('tree', 12, 12, 30, 6, 1.1); W.put('bench', -7, -2.5, { ry: 30 }); W.put('lamp', 4, -8); W.scatter('flower', 16, 8.5, 14, { seed: 5 }); W.pond(-9, -9, 2.6); W.put('slide', 7, -7, { ry: -15 }); } },
  garden: { ground: 'grass', set: (W) => { W.ring('grass'); W.fence(-9, 9, -8); W.scatter('flower', 30, 3, 9, { seed: 2 }); W.scatter('rose', 8, 9, 13, { seed: 4 }); W.scatter('sunflower', 6, 9, 14, { seed: 6 }); W.put('garden_pot', -3, -6); W.put('garden_pot', 3, -6); W.put('tree', -8, -5, { s: 1.2 }); W.put('tree', 8, -5, { s: 1.1 }); W.put('bench', 0, -6.8); W.trees('tree', 10, 16, 30, 7); } },
  restaurant: {
    ground: 'tile', kind: 'indoor', set: (W) => {
      W.ring('grass', 10, 40, 56); W.trees('tree', 8, 18, 32, 12);
      // ---- the kitchen house at the back: chef works inside, with the pass window on its RIGHT side ----
      // frame only around the pass window (no glass) so the chef can be seen and talked to
      W.setG.add(build([
        ['box', [0.12, 2.2, 0.5], '#a16207', [2.1, 1.85, -7.6]],
        ['box', [0.12, 2.2, 0.5], '#a16207', [4.3, 1.85, -7.6]],
        ['box', [2.3, 0.12, 0.5], '#a16207', [3.2, 2.9, -7.6]],
      ]).group);
      W.setG.add(build([
        ['box', [12.6, 0.2, 3.6], '#e7d8a8', [0, 0.1, -9.4]],                                // kitchen floor (open front)
        ['box', [12.6, 4.8, 0.4], '#fef3c7', [0, 2.4, -11.2]],                               // back wall
        ['box', [0.4, 4.8, 3.6], '#fef3c7', [-6.3, 2.4, -9.4]],                              // left wall
        ['box', [0.4, 4.8, 3.6], '#fef3c7', [6.3, 2.4, -9.4]],                               // right wall
        ['box', [6.4, 0.9, 1.1], '#d6d3d1', [-2.6, 0.45, -9.6]],                             // stove counter inside
        ['cyl', [0.5, 0.5, 0.06, 16], '#374151', [-4.2, 0.93, -9.6]],                        // pan
        ['cyl', [0.5, 0.5, 0.06, 16], '#374151', [-1.2, 0.93, -9.6]],                        // pan
        ['box', [13.2, 0.5, 4.6], '#dc2626', [0, 5.05, -9.2]],                               // roof
        ['box', [13.4, 0.32, 4.8], '#b91c1c', [0, 5.4, -9.2]],
        ['box', [8.3, 4.8, 0.42], '#fde68a', [-2.15, 2.4, -7.6]],                            // front wall left of the pass window
        ['box', [2.0, 4.8, 0.42], '#fde68a', [5.3, 2.4, -7.6]],                              // front wall right of the pass window
        ['box', [2.2, 1.9, 0.42], '#fde68a', [3.2, 3.85, -7.6]],                             // wall above the pass window
        ['box', [2.2, 0.6, 0.42], '#fde68a', [3.2, 0.3, -7.6]],                              // sill below the pass window
        ['box', [1.0, 1.1, 0.12], '#7dd3fc', [-4.6, 2.9, -7.37]],                            // little side window
        ['box', [0.9, 2.1, 0.12], '#7c2d12', [0, 1.05, -7.37]],                              // door (chef's way in)
      ]).group);
      // pass counter the chef serves on (not in front of the door!)
      W.setG.add(build([
        ['box', [2.3, 0.16, 0.62], '#a16207', [3.2, 1.02, -7.15]],                           // pass counter
        ['box', [2.0, 0.5, 0.5], '#92400e', [3.2, 0.75, -7.15]],
      ]).group);
      W.sign('Kitchen', -3.2, 3.9, -7.34, { bg: '#dc2626', fg: '#fff', w: 3 });
      W.sign('Order here', 3.2, 0.62, -6.82, { bg: '#fde68a', fg: '#7c2d12', w: 2.0 });
      // ---- dining floor: tables with a chair on the left and right (guests sit on them) ----
      GUEST_TABLES.forEach(([x, z], i) => {
        W.put('table', x, z);
        W.setG.add(build([chairParts(WOOD, x - 1.15, z, 90), chairParts(WOOD, x + 1.15, z, -90)]).group);
        W.setG.add(build([['cyl', [0.12, 0.12, 0.3, 10], '#fff', [x, 0.95, z]], ...flowerParts('#f472b6', x, z, 1.25, 0.06)]).group);
        // a big table number on a stand, readable from across the room
        W.sign(String(i + 1), x, 1.52, z + 0.02, { bg: '#ffffff', fg: '#7c2d12', w: 1.05 });
        W.setG.add(build([['cyl', [0.05, 0.06, 0.55, 10], '#a16207', [x, 1.2, z]]]).group);
      });
      for (const lx of [-4.6, 1.0]) { const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff7cc' })); bulb.position.set(lx, 3.1, -9.2); W.setG.add(bulb); const pl = new THREE.PointLight('#fff1c9', 14, 9); pl.position.set(lx, 3.0, -9.0); W.setG.add(pl); }
      W.put('pizza', -8.4, 2.6, { s: 0.7 }); W.put('cake', 8.4, 2.6, { s: 0.7 });
      W.put('garden_pot', -7, -6.4); W.put('garden_pot', -5.4, -2.2);
      W.put('lamp', -9.5, 0.5); W.put('lamp', 9.5, 0.5);
      W.put('sofa', -9.2, 3.4, { ry: 90 });
    }
  },
  shop: {
    ground: 'tile', kind: 'indoor', set: (W) => {
      W.ring('grass', 10, 40, 56);
      // -----------------------------------------------------------------------------------
      // Our shop. We (and the pet) stand BEHIND the counter in the middle of the room and look
      // out at the door: customers walk in one by one, join the little line, hold up an item and
      // ask its price. No roof, so the camera always sees inside.
      // Layout (z grows toward the door at the front):
      //   back wall  z = -8.2   | staff area  z -8 .. -4.4 | counter z = -4.2 | shop floor -4 .. 2.2 | door z = 2.4
      // -----------------------------------------------------------------------------------
      W.setG.add(build([
        ['box', [15, 0.12, 15.6], '#f3e8d6', [0, 0.06, -4.6]],                              // shop floor
        ['box', [15, 4.8, 0.45], '#fbcfe8', [0, 2.4, -11.4]],                               // back wall
        ['box', [0.45, 4.8, 14], '#fbcfe8', [-7.5, 2.4, -4.4]],                             // left wall
        ['box', [0.45, 4.8, 14], '#fbcfe8', [7.5, 2.4, -4.4]],                              // right wall
        ['box', [15.4, 0.42, 0.42], '#be185d', [0, 4.6, -8.2]],                             // back trim
        ['box', [0.42, 0.42, 14], '#be185d', [-7.5, 4.6, -4.4]],
        ['box', [0.42, 0.42, 14], '#be185d', [7.5, 4.6, -4.4]],
        // shop-front: two big windows with a real open doorway between them
        ['box', [4.6, 3.3, 0.16], '#dbeafe', [-5.0, 1.65, 2.3]],
        ['box', [4.6, 3.3, 0.16], '#dbeafe', [5.0, 1.65, 2.3]],
        ['box', [0.26, 3.4, 0.3], '#f8fafc', [-2.6, 1.7, 2.3]],                             // door posts
        ['box', [0.26, 3.4, 0.3], '#f8fafc', [2.6, 1.7, 2.3]],
        ['box', [5.6, 0.3, 0.4], '#be185d', [0, 3.55, 2.3]],                                // door lintel
        ['box', [7.8, 0.1, 2.6], '#e7d8c3', [0, 0.07, 3.5]],                                // step outside
        ['box', [1.5, 0.1, 5.6], '#c084fc', [0, 0.09, -0.1]],                               // queue line painted on the floor
        ['box', [7, 0.1, 1.0], '#a855f7', [0, 0.09, 1.9]],                                  // welcome mat
      ]).group);
      // ---- the counter: we stand behind it, customers in front ----
      W.setG.add(build([
        ['box', [7.4, 0.95, 0.95], '#c084fc', [0, 0.48, -4.2]],                             // counter body
        ['box', [7.7, 0.12, 1.15], '#f5d0fe', [0, 1.0, -4.2]],                              // counter top
        ['box', [7.4, 0.42, 0.1], '#9333ea', [0, 0.3, -3.7]],                               // front stripe
        ['box', [7.5, 0.07, 0.18], '#fbbf24', [0, 0.66, -3.68]],                            // trim
      ]).group);
      // ---- desk equipment: monitor/laptop + cash drawer box facing child behind counter ----
      const deskG = new THREE.Group();
      const laptop = build([
        ['box', [0.85, 0.05, 0.55], '#334155', [-0.65, 1.05, -4.45]],
        ['box', [0.82, 0.54, 0.04], '#1e293b', [-0.65, 1.34, -4.16], [-16, 0, 0]],
        ['plane', [0.76, 0.46], { c: '#0284c7', emissive: '#0369a1', side: 2 }, [-0.65, 1.34, -4.20], [-16, 0, 0]],
        ['box', [0.72, 0.02, 0.26], '#1e293b', [-0.65, 1.08, -4.38]],
        ['box', [0.26, 0.015, 0.16], '#475569', [-0.65, 1.08, -4.60]],
      ]).group;
      laptop.userData.pick = { kind: 'cashbox', name: 'Shop Laptop Monitor' };
      laptop.traverse((m) => { m.userData.pick = laptop.userData.pick; });
      deskG.add(laptop);

      const cashbox = build([
        ['box', [0.90, 0.30, 0.65], '#1e293b', [-1.75, 1.16, -4.35]],
        // Cash drawer front facing player at -Z
        ['box', [0.84, 0.18, 0.04], '#334155', [-1.75, 1.12, -4.68]],
        ['box', [0.26, 0.04, 0.05], '#fbbf24', [-1.75, 1.12, -4.71]], // gold drawer handle
        // Register display & keypad angled toward player
        ['box', [0.42, 0.04, 0.24], '#0f172a', [-1.75, 1.33, -4.35], [-20, 0, 0]],
        ['plane', [0.36, 0.12], { c: '#22c55e', emissive: '#16a34a', side: 2 }, [-1.75, 1.35, -4.38], [-20, 0, 0]],
        ['sphere', [0.05], '#22c55e', [-1.45, 1.34, -4.42]], // green action button
        // Play money visible on drawer
        ['box', [0.24, 0.02, 0.12], '#22c55e', [-1.90, 1.22, -4.55]],
        ['box', [0.24, 0.02, 0.12], '#38bdf8', [-1.62, 1.22, -4.55]],
        ['cyl', [0.04, 0.04, 0.02, 12], '#fbbf24', [-1.76, 1.23, -4.45]],
      ]).group;
      cashbox.userData.pick = { kind: 'cashbox', name: 'Cash Register Box' };
      cashbox.traverse((m) => { m.userData.pick = cashbox.userData.pick; });
      deskG.add(cashbox);

      deskG.add(build([
        ['box', [0.38, 0.26, 0.08], '#0ea5e9', [-2.5, 1.18, -4.3], [20, 180, 0]],
        ['sphere', [0.04], '#38bdf8', [-2.5, 1.32, -4.34]],
      ]).group);
      W.setG.add(deskG);
      W.extraPickables = [laptop, cashbox];
      W.put('computer', 5.0, -6.2, { s: 0.5 });
      W.setG.add(build([['box', [1.2, 0.46, 1.0], '#a16207', [2.7, 0.23, -5.05]], ['box', [1.26, 0.07, 1.06], '#ca8a04', [2.7, 0.48, -5.05]]]).group);   // the pet's crate
      W.put('clock', -7.2, -1.2, { s: 1, ry: 90 });
      // ---- staff area behind us: shelves of things to sell, boxes, a lamp ----
      // (the back of the staff area is kept clear, so the camera can pull back behind us without
      //  ending up inside a shelf — the stock lives along the side walls and up on the back wall)
      W.shelf(-7.1, -8.4, '#4ade80', 4, 90); W.shelf(7.1, -8.4, '#fb923c', 5, -90);
      W.shelf(-7.1, -3.6, '#60a5fa', 1, 90); W.shelf(7.1, -3.6, '#f472b6', 2, -90);
      W.shelf(-5.2, -11.1, '#facc15', 3); W.shelf(5.2, -11.1, '#a78bfa', 6);
      W.put('table', -4.4, -8.9, { c: '#fef3c7', s: 0.9 }); W.put('teddy', -4.4, -8.9, { s: 0.6 });
      W.put('gift', -6.4, -6.6, { s: 0.7 }); W.put('balloons', 6.3, -7.2, { s: 0.8 });
      W.put('treasure', 4.6, -9.6, { s: 0.6 });
      // ---- shop floor: displays the customers look at while they wait ----
      W.put('table', -5.2, -1.3, { c: '#fef3c7', s: 0.9 }); W.put('teddy', -5.2, -1.3, { s: 0.7 });
      W.put('table', 5.2, -1.3, { c: '#fef3c7', s: 0.9 }); W.put('ball', 5.2, -1.3, { s: 0.5 });
      W.put('balloons', -6.6, 0.6, { s: 0.75 }); W.put('gift', 6.6, 0.4, { s: 0.7 });
      W.put('garden_pot', -6.9, 1.6); W.put('garden_pot', 6.9, 1.6);
      W.put('lamp', -6.6, -0.6); W.put('lamp', 6.6, -0.6);
      W.sign('Rainbow Mall', 0, 4.1, -11.12, { bg: '#be185d', fg: '#fff', w: 3.6 });   // above the shelves, in our line of sight
      W.sign('Thank you!', 0, 2.6, -11.14, { bg: '#fde68a', fg: '#7c2d12', w: 2.6 });  // back-wall poster behind the staff
      W.sign('Open', 3.6, 2.9, 2.28, { bg: '#16a34a', fg: '#fff', w: 1.4, ry: 180 });
      // warm bulbs over the counter so the inside is bright and shop-like
      for (const lx of [-3.6, 0, 3.6]) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#fff7cc' }));
        bulb.position.set(lx, 3.7, -4.6); W.setG.add(bulb);
        const pl = new THREE.PointLight('#fff1c9', 12, 11); pl.position.set(lx, 3.4, -4.4); W.setG.add(pl);
      }
      const doorLight = new THREE.PointLight('#fff7d6', 8, 12); doorLight.position.set(0, 2.6, 1.6); W.setG.add(doorLight);
    }
  },
  hospital: {
    ground: 'clinic', kind: 'indoor', set: (W) => {
      W.ring('grass', 10, 40, 56); W.trees('tree', 6, 20, 32, 13);
      W.setG.add(build([['box', [14, 4, 0.5], '#f8fafc', [0, 2, -9]], ['box', [0.5, 4, 10], '#f8fafc', [-7.5, 2, -4]], ['box', [0.5, 4, 10], '#f8fafc', [7.5, 2, -4]], ['box', [1.6, 0.4, 0.12], '#ef4444', [0, 3.2, -8.7]], ['box', [0.4, 1.6, 0.12], '#ef4444', [0, 3.2, -8.7]], ['box', [3, 2, 0.1], '#bfe9ff', [-4, 2, -8.7]], ['box', [3, 2, 0.1], '#bfe9ff', [4, 2, -8.7]]]).group);
      W.put('bed', -0.5, -6, { s: 1.1, ry: 90 }); W.put('computer', 4.5, -7.5, { s: 0.9 }); W.setG.add(build([['box', [1.4, 1.2, 0.6], '#e5e7eb', [-5, 0.6, -7.5]], ['box', [1.2, 0.3, 0.5], '#60a5fa', [-5, 1.35, -7.5]]]).group); W.put('medicine', -5, -7.5, { s: 0.6 }).position.y = 1.5; W.put('garden_pot', 6.5, -2, {}); W.put('garden_pot', -6.5, -2, {}); W.setG.add(build([chairParts('#60a5fa', 5.5, -4, 180), chairParts('#60a5fa', 6.3, -4, 180)]).group); W.put('lamp', -6.5, 1.5); W.put('lamp', 6.5, 1.5);
    }
  },
  stage: {
    ground: 'wood', kind: 'indoor', sky: 'stage', light: 'stage', set: (W) => {
      W.setG.add(build([['box', [18, 7, 0.4], { c: '#1e1b4b', map: repeatTex(groundTexture('stars'), 4, 2) }, [0, 3.5, -9]], ['box', [2.4, 7.5, 1.2], '#b91c1c', [-8.5, 3.75, -5]], ['box', [2.4, 7.5, 1.2], '#b91c1c', [8.5, 3.75, -5]], ['box', [20, 1.2, 1.2], '#b91c1c', [0, 7.2, -5]], ['box', [20, 0.4, 20], '#fbbf24', [0, 7.9, 0]], ['box', [20, 0.35, 0.5], '#fbbf24', [0, 0.15, 3.6]], ...[-7, -5, -3, -1, 1, 3, 5, 7].map((x) => ['sphere', [0.14], { c: '#fff7c2', e: '#fde68a', ei: 1.2 }, [x, 0.4, 3.6]])]).group);
      W.put('microphone', 0, 1.2, { s: 1 }); W.put('piano', -5, -4, { s: 0.9, ry: 30 }); W.put('drum', 5, -4.5, { s: 0.9 }); W.put('balloons', -7, -2, { s: 0.8 }); W.put('balloons', 7, -2, { s: 0.8, c: '#a855f7' });
      // audience arc
      const r = rnd(44), shirts = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#f472b6', '#a855f7', '#fb923c'];
      for (let row = 0; row < 2; row++) for (let i = 0; i < 9; i++) { const a = (-70 + i * 17.5) * Math.PI / 180, d = 7.6 + row * 1.9; const { group, named } = makePerson(['friend', 'mom', 'dad', 'grandma', 'teacher', 'person'][Math.floor(r() * 6)], { color: shirts[Math.floor(r() * shirts.length)], seed: i + row * 9 }); group.position.set(Math.sin(a) * d, -0.15, Math.cos(a) * d); group.rotation.y = Math.PI + a; group.scale.setScalar(0.85 + r() * 0.1); W.setG.add(group); W.audience.push({ g: group, named, phase: r() * 6, baseY: -0.15 }); }
      // spotlights
      for (const [x, c] of [[-5, '#ff9ecf'], [5, '#9ed0ff'], [0, '#fff3b0']]) { const light = new THREE.SpotLight(c, 0, 30, 0.42, 0.5, 1); light.position.set(x, 7.5, 2); light.target.position.set(0, 0, 0); light.castShadow = false; W.scene.add(light, light.target); const cone = new THREE.Mesh(new THREE.ConeGeometry(2.4, 8, 24, 1, true), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); cone.position.set(x, 3.6, 1); W.scene.add(cone); W.spots.push({ light, cone, base: 70, on: true, phase: x }); }
    }
  },
  create: {
    ground: 'check', sky: 'dream', set: (W) => {
      W.ring('dream', 12, 36, 54); const r = rnd(19);
      for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.4, d = 15 + r() * 8, y = 3.5 + r() * 4; const g = build([['cyl', [2.6, 1.6, 1.2, 10], '#a16207', [0, -0.6, 0]], ['cyl', [2.7, 2.7, 0.3, 10], '#86efac', [0, 0.1, 0]], ...(r() < 0.5 ? treeParts('#4ade80', 0.8) : pineParts('#22c55e', 0.7)).map((p) => { const q = [...p]; q[3] = [p[3][0], p[3][1] + 0.25, p[3][2]]; return q; })]).group; g.position.set(Math.cos(a) * d, y, Math.sin(a) * d); W.setG.add(g); W.islands.push({ g, y, phase: r() * 6 }); }
      W.put('rainbow', 0, -24, { s: 2.2 }); W.scatter('flower', 20, 6, 13, { seed: 9 }); W.put('painting', -6, -6, { ry: 20 }); W.put('blocks', 6, -6, { s: 1.4 }); W.put('star', -4, -8, { s: 1.2 }); W.put('star', 5, -9, { s: 0.9 });
    }
  },
  beach: { ground: 'sand', set: (W) => { W.sea(-11); W.ring('sand', 8, 36, 50, 8); W.put('palm', -7, -6, { s: 1.1 }); W.put('palm', 7.5, -7, { s: 1.2, ry: 60 }); W.put('palm', -10, -1, { s: 0.9, ry: 120 }); W.put('umbrella', 5, -2.5); W.put('sandcastle', -4, -3.5, { s: 0.9 }); W.put('ball', 2.5, -4.5, { c: '#f472b6' }); W.put('shell', -1.5, 1.5, { s: 0.7 }); W.put('shell', 6.5, 1, { s: 0.6, c: '#fde68a' }); W.put('boat', 6, -12, { s: 1.2, ry: -20 }); W.setG.add(build([['plane', [2, 1.4], { c: '#f472b6', side: 2 }, [4.8, 0.02, -1.2], [-90, 0, 25]]]).group); const { group } = makeAnimal('crab', { scale: 0.7 }); group.position.set(-6.5, 0, 0.5); W.setG.add(group); } },
  space: { ground: 'moon', sky: 'space', light: 'space', set: (W) => { W.ring('moon', 10, 30, 50, 2); W.put('rocket', -5.5, -6, { s: 1.4 }); W.put('flag', 3, -4, { c: '#ef4444' }); W.put('satellite', 6, -2, { s: 0.8 }); const p = W.put('planet', -16, 12, { s: 3, c: '#fb923c' }); p.traverse((m) => { m.castShadow = false; }); const e = W.put('earth', 18, 14, { s: 2.6 }); e.traverse((m) => { m.castShadow = false; }); for (const [x, z, s] of [[4, 3, 1.4], [-3, 4, 1], [-8, -2, 2], [8, -7, 1.6]]) { const c = new THREE.Mesh(geo('torus', [s, 0.25, 8, 24]), mat('#7a7a88')); c.rotation.x = -Math.PI / 2; c.position.set(x, 0.05, z); c.receiveShadow = true; W.setG.add(c); } W.put('robot', 7, -5, { s: 0.9, ry: -30 }); } },
  school: { ground: 'grass', set: (W) => { W.ring('grass'); W.put('school', 0, -9, { s: 1.4 }); W.put('slide', -7, -5, { ry: 20 }); W.put('swing', 7, -5.5); W.put('bench', -4, -4.5, { ry: 10 }); W.put('bench', 4, -4.5, { ry: -10 }); W.put('tree', -9.5, -8, { s: 1.2 }); W.put('tree', 9.5, -8); W.put('book', 2, -3, { s: 0.9 }); W.put('soccer', -2, -2.5, { s: 0.8 }); W.trees('tree', 10, 16, 30, 3); } },
  forest: { ground: 'grass', set: (W) => { W.ring('grass', 12, 30, 50, 4); W.trees('pine', 22, 9, 30, 5, 1.2); W.trees('tree', 10, 11, 26, 6, 1.1); W.scatter('mushroom', 10, 4, 9, { seed: 7, s: 0.8 }); W.put('tent', 5, -6, { ry: 20 }); W.put('fire', 2.5, -4.5, { s: 0.9 }); W.setG.add(build([['cyl', [0.3, 0.3, 2.2, 10], '#6b4423', [-4, 0.3, -4], [0, 30, 90]]]).group); W.scatter('flower', 10, 5, 12, { seed: 12 }); const { group } = makeAnimal('fox', { scale: 0.9 }); group.position.set(-6, 0, -7); group.rotation.y = 0.6; W.setG.add(group); } },
  castle: { ground: 'grass', set: (W) => { W.ring('grass', 14, 36, 56, 9); W.mountainsRing(7); W.put('castle', 0, -11, { s: 2 }); W.setG.add(build([['box', [4, 0.25, 7], WOOD, [0, 0.12, -6]]]).group); W.pond(0, -7, 1); W.put('flag', -4, -6, { c: '#3b82f6' }); W.put('flag', 4, -6, { c: '#ef4444' }); W.put('tree', -9, -4, { s: 1.3 }); W.put('tree', 9, -4, { s: 1.3 }); W.put('treasure', 6, -2.5, { s: 0.8 }); W.scatter('flower', 14, 5, 12, { seed: 13 }); W.trees('pine', 8, 16, 30, 14); } },
  farm: { ground: 'grass', set: (W) => { W.ring('grass'); W.put('house', 0, -10, { s: 1.6, c: '#dc2626' }); W.put('windmill', -9, -9, { s: 1.2 }); W.fence(-9, 9, -6); W.put('tractor', 6, -4, { ry: -40 }); for (let i = 0; i < 5; i++) W.setG.add(build([['cyl', [0.5, 0.5, 0.8, 12], '#fde68a', [-7 + i * 0.9, 0.5, -3 + (i % 2) * 0.6], [0, 0, 90]]]).group); for (const [k, x, z, ry] of [['cow', -5, -8, 20], ['chicken', 3, -7.5, 0], ['chicken', 3.8, -8, 40], ['goat', 7, -8, -30], ['horse', -2.5, -8.5, 10]]) { const { group } = makeAnimal(k); group.position.set(x, 0, z); group.rotation.y = ry * Math.PI / 180; W.setG.add(group); } W.scatter('sunflower', 10, 9, 14, { seed: 15 }); W.trees('tree', 8, 16, 30, 16); } },
  city: { ground: 'road', set: (W) => { W.cityRing(20); W.put('car', -5, -5, { c: '#ef4444', ry: 90 }); W.put('bus', 5, -6, { ry: 90 }); W.put('lamp', -7, -2); W.put('lamp', 7, -2); W.put('lamp', -7, -9); W.put('lamp', 7, -9); W.put('shop', -8, -12, { s: 1.4 }); W.put('hospital', 8, -13, { s: 1.3 }); W.put('bench', 0, -8); W.put('tree', -3, -9, { s: 0.9 }); W.put('tree', 3, -9, { s: 0.9 }); W.setG.add(build([['box', [0.12, 3, 0.12], DARK, [-9, 1.5, 1]], ['box', [0.4, 1, 0.3], DARK, [-9, 3.2, 1]], ['sphere', [0.1], { c: '#ef4444', e: '#ef4444' }, [-9, 3.5, 1.16]], ['sphere', [0.1], { c: '#facc15', e: '#facc15' }, [-9, 3.2, 1.16]], ['sphere', [0.1], { c: '#22c55e', e: '#22c55e' }, [-9, 2.9, 1.16]]]).group); } },
  underwater: { ground: 'sand', sky: 'underwater', light: 'underwater', set: (W) => { W.ring('sand', 8, 30, 46, 6); const r = rnd(33); for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = 6 + r() * 12; const c = ['#f472b6', '#fb923c', '#a855f7', '#facc15'][i % 4]; const coral = build([['sphere', [0.5], c, [0, 0.4, 0]], ['sphere', [0.35], c, [0.4, 0.8, 0.1]], ['sphere', [0.3], c, [-0.35, 0.75, -0.1]], ['cyl', [0.08, 0.12, 1.2], c, [0.1, 0.9, 0.3], [0, 0, 15]]]).group; coral.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); W.setG.add(coral); } for (let i = 0; i < 18; i++) { const a = r() * Math.PI * 2, d = 4 + r() * 14; const g = build([['box', [0.18, 2.2 + r() * 1.5, 0.05], '#16a34a', [0, 1.2, 0]]]).group; g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d); g.rotation.y = r() * 6; W.setG.add(g); W.animated.push({ key: 'seaweed', named: { seat: g }, g, phase: r() * 6 }); } W.put('treasure', 4, -5, { s: 0.9 }); W.put('anchor', -5, -6, { s: 0.9 }); W.put('shell', 2, 2, { s: 0.8 }); for (const [k, x, y, z] of [['fish', -4, 2.5, -3], ['fish', 5, 3, -2], ['turtle', 0, 1.8, -6], ['octopus', -7, 0, -2]]) { const { group } = makeAnimal(k); group.position.set(x, y, z); W.setG.add(group); } } },
  mountain: { ground: 'stone', set: (W) => { W.mountainsRing(10); W.ring('grass', 8, 26, 40, 10); W.trees('pine', 14, 9, 24, 17, 1.1); W.put('tent', -5, -5, { ry: 25, c: '#3b82f6' }); W.put('fire', -2.5, -4); W.put('river', 6, -4, { s: 1.2 }); W.put('bridge', 6, -4, { s: 0.9, ry: 90 }); W.put('telescope', 3, -7, {}); W.scatter('mushroom', 5, 6, 10, { seed: 18, s: 0.7 }); const { group } = makeAnimal('deer', { scale: 0.9 }); group.position.set(8, 0, -8); group.rotation.y = -0.5; W.setG.add(group); } },
  zoo: { ground: 'grass', set: (W) => { W.ring('grass'); W.trees('tree', 10, 16, 30, 19); const pens = [['lion', -7, -7, '#fbbf24'], ['elephant', 0, -9, '#9ca3af'], ['monkey', 7, -7, '#92400e'], ['giraffe', -8, -1, '#fde68a'], ['penguin', 8, -1, '#60a5fa']]; for (const [k, x, z] of pens) { W.fence(x - 2.2, x + 2.2, z + 2.2, '#a16207'); W.fence(x - 2.2, x + 2.2, z - 2.2, '#a16207'); const { group } = makeAnimal(k); group.position.set(x, 0, z); W.setG.add(group); const s = W.sign(k.toUpperCase(), x, 1.4, z + 2.3, { bg: '#fde68a', fg: '#7c2d12', w: 1.6 }); } W.put('icecream', 0, -4, { s: 1.4 }); W.put('bench', -3.5, -3.5, { ry: 15 }); W.put('bench', 3.5, -3.5, { ry: -15 }); } },
  kitchen: { ground: 'tile', kind: 'indoor', set: (W) => { W.ring('grass', 8, 40, 56); W.setG.add(build([['box', [14, 4, 0.5], '#fef3c7', [0, 2, -9]], ['box', [0.5, 4, 10], '#fef3c7', [-7.5, 2, -4]], ['box', [0.5, 4, 10], '#fef3c7', [7.5, 2, -4]], ['box', [6, 1, 0.9], '#e5e7eb', [-3, 0.5, -8.3]], ['box', [6.2, 0.12, 1], '#9ca3af', [-3, 1.05, -8.3]], ['cyl', [0.35, 0.35, 0.06, 20], DARK, [-4.5, 1.12, -8.3]], ['cyl', [0.35, 0.35, 0.06, 20], DARK, [-2.5, 1.12, -8.3]], ['box', [1.6, 3, 1], '#bfe9ff', [4, 1.5, -8.2]], ['box', [1.5, 0.08, 0.9], '#60a5fa', [4, 1.7, -8.18]], ['box', [3, 2, 0.1], '#bfe9ff', [0, 2.2, -8.7]]]).group); W.put('table', 0, -3.5, { c: '#fde68a' }); W.setG.add(build([chairParts(WOOD, -1.1, -3.5, 90), chairParts(WOOD, 1.1, -3.5, -90)]).group); W.put('cake', 0, -3.5, { s: 0.6 }); W.put('apple', -1, -8.3, { s: 0.6 }).position.y = 1.1; W.put('garden_pot', -6.5, -1, {}); W.put('lamp', 6.5, -1); } },
  party: { ground: 'grass', set: (W) => { W.ring('grass'); W.put('house', 0, -10, { s: 1.4, c: '#fbcfe8' }); W.put('party', 0, -6.5, { s: 1.2 }); W.put('table', -5, -4, { c: '#f9a8d4' }); W.put('cake', -5, -4, { s: 0.7 }); W.put('gift', 5, -4, { s: 1.1 }); W.put('gift', 6.2, -3.2, { s: 0.8, c: '#3b82f6' }); W.put('balloons', -8, -3); W.put('balloons', 8, -5, { c: '#a855f7' }); W.put('tree', -8.5, -8); W.put('tree', 8.5, -8.5); W.scatter('flower', 16, 8, 14, { seed: 21 }); W.trees('tree', 8, 16, 30, 22); } },
  snow: { ground: 'snow', sky: 'snow', light: 'snow', set: (W) => { W.ring('snow', 12, 30, 50, 2); W.mountainsRing(8); W.trees('pine', 16, 9, 28, 23, 1.1); W.put('snowman', -4, -5); W.put('snowman', 5, -6, { s: 0.8 }); W.setG.add(build([['sphere', [1.8], '#f8fafc', [7, 0, -3], 0, [1, 0.7, 1]], ['box', [1, 1, 0.8], '#f8fafc', [7, 0.5, -1.4]], ['box', [0.7, 0.8, 0.3], '#cbd5e1', [7, 0.45, -1]]]).group); W.put('tent', -7, -3, { c: '#ef4444', ry: 20 }); W.put('fire', -5, -2); } },
  pirate: { ground: 'sand', set: (W) => { W.sea(-11); W.ring('sand', 8, 36, 50, 8); W.put('ship', 4, -16, { s: 1.8, ry: -15 }); W.put('palm', -7, -6, { s: 1.1 }); W.put('palm', 8, -5, { s: 1.0, ry: 90 }); W.put('treasure', -3, -4, { s: 1 }); W.put('map', 2, -3, { s: 0.9 }); W.put('flag', -5, -2, { c: '#111827' }); W.put('anchor', 6, -2, { s: 0.8 }); W.setG.add(build([['cyl', [0.45, 0.4, 0.9, 12], '#7c4a1d', [-7, 0.45, -1]], ['cyl', [0.45, 0.4, 0.9, 12], '#7c4a1d', [-6, 0.45, -1.5]]]).group); W.put('sandcastle', 7, -7, { s: 0.8 }); const { group } = makeAnimal('crab', { scale: 0.7 }); group.position.set(-1, 0, 1.5); W.setG.add(group); } },
};
