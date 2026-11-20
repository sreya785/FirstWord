// FirstWord AI — game boot: one WebGL engine, screens drawn as DOM overlays on top of the 3D world.
import * as THREE from 'three';
import { Engine } from './engine.js';
import { World } from './world3d.js';
import { FX3D } from './fx3d.js';
import { Pet3D } from './pet3d.js';
import { mountPlay3D } from './play3d.js';
import { mountParent } from './parent.js';
import { api } from './api.js';
import { PET_META } from './pet.js';
import { t } from './i18n.js';
import { sfx } from './sfx.js';
import { mat, geo } from './models.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const canvas = document.getElementById('gl');
const ui = document.getElementById('ui');
let engine;
try { engine = new Engine(canvas); }
catch (err) {
  ui.innerHTML = `<div class="gate-card" style="max-width:420px"><h2>🐾 FirstWord AI needs WebGL</h2><p class="muted">This browser could not start 3D graphics (${esc(err.message || 'WebGL unavailable')}). Please enable hardware acceleration or open the game in an up-to-date Chrome, Edge, Safari or Firefox.</p></div>`;
  throw err;
}
const world = new World(engine);
const fx = new FX3D(engine);
const g = { engine, world, fx, ui };
engine.start();

let uiLang = localStorage.getItem('fw_ui_lang') || 'en';
const L = (k) => t(uiLang, k);
let unmount = null;      // cleanup of the current screen
let unlocked = false;    // audio unlocked by a user gesture
let navToken = 0;

function toast(msg) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 3200); }
const navigate = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };
const unlock = () => { if (!unlocked) { unlocked = true; sfx.unlock(); } };
const langToggle = (id) => `<div class="lang-toggle" id="${id}"><button data-lang="en" class="${uiLang === 'en' ? 'active' : ''}">EN</button><button data-lang="bn" class="${uiLang === 'bn' ? 'active' : ''}">বাং</button></div>`;
function wireLang(root) { root.querySelectorAll('.lang-toggle button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.lang === uiLang) return; uiLang = b.dataset.lang; localStorage.setItem('fw_ui_lang', uiLang); route(); })); }
function screen(cls, html) { const el = document.createElement('div'); el.className = 'screen ' + cls; el.innerHTML = html; ui.appendChild(el); return el; }

// ---------- showcase helpers (title + select) ----------
function showcasePets(specs) {
  const pets = specs.map((s) => { const p = new Pet3D(s.type); p.position.set(s.x, s.y || 0, s.z); p.faceToward(s.yaw || 0); p.group.userData.pick = { kind: 'choose', type: s.type }; engine.scene.add(p.group); return p; });
  let next = 2;
  const off = engine.onFrame((dt, time) => {
    for (const p of pets) p.update(dt);
    world.update(dt, time, pets[0]?.position || new THREE.Vector3(), engine.camera);
    fx.update(dt, time);
    if (time > next) { next = time + 2.5 + Math.random() * 3; const p = pets[Math.floor(Math.random() * pets.length)]; p.play(['wave', 'hop', 'dance', 'spin', 'nod', 'bounce'][Math.floor(Math.random() * 6)]); }
  });
  return { pets, dispose: () => { off(); for (const p of pets) engine.scene.remove(p.group); } };
}
function pedestal(x, z, color) {
  const grp = new THREE.Group();
  const base = new THREE.Mesh(geo('cyl', [1.15, 1.3, 0.28, 32]), mat(color)); base.position.y = 0.14; base.receiveShadow = true; base.castShadow = true; grp.add(base);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.45, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; grp.add(ring);
  grp.position.set(x, 0, z); engine.scene.add(grp); return { grp, ring };
}

// ---------- TITLE ----------
async function showTitle() {
  world.reset(); world.setLocation('park', { time: 'sunset', weather: 'clear', colors: {} });
  fx.setWeather(null); fx.setAmbient('petals');
  const show = showcasePets([{ type: 'cat', x: 0, z: 0.4 }, { type: 'bunny', x: -2.6, z: -0.8, yaw: 0.4 }, { type: 'dino', x: 2.6, z: -1, yaw: -0.4 }]);
  const center = new THREE.Vector3(engine.portrait ? 0 : -2.2, 0.2, -0.3);
  engine.setViewShift(0, 0.12);
  engine.follow(() => center); engine.cam.homeYaw = 0.25; engine.cam.yaw = 0.6; engine.cam.pitch = 0.26; engine.cam.lockPitch = 0.26; engine.cam.lockDist = engine.portrait ? 11 : 9.5; engine.cam.dist = 13; engine.orbitIdle('sway');
  engine.input.pickables = show.pets.map((p) => p.group);
  engine.input.onTap = (hit) => { if (hit.kind === 'actor') { const p = show.pets.find((q) => q.group === hit.object); if (p) { p.play('bounce'); fx.hearts(p.emoteWorld()); sfx.play('pop'); } } };
  const el = screen('title', `
    <div class="title-card">
      <div class="logo-block"><div class="logo-paw">🐾</div><h1>FirstWord <span>AI</span></h1><p class="tagline">${esc(L('tagline'))}</p></div>
      <div class="title-actions">
        <button class="btn big play" id="playBtn">▶ ${esc(L('play'))}</button>
        <button class="btn secondary" id="parentsBtn">👪 ${esc(L('parents'))}</button>
      </div>
      <div class="title-foot">${langToggle('titleLang')}<span class="muted small">${uiLang === 'bn' ? 'ফ্রি • পেইড API নেই • অডিও সংরক্ষিত হয় না' : 'Free • no paid APIs • no audio stored'}</span></div>
    </div>
    <div class="title-hint">${uiLang === 'bn' ? 'টেনে দেখো • পোষা বন্ধুকে ট্যাপ করো' : 'Drag to look around • tap a pet'}</div>`);
  wireLang(el);
  el.querySelector('#playBtn').addEventListener('click', () => { unlock(); sfx.play('success'); fx.confetti(center, 120); navigate('#/select'); });
  el.querySelector('#parentsBtn').addEventListener('click', () => { unlock(); navigate('#/select?parent=1'); });
  unmount = () => { show.dispose(); el.remove(); engine.orbitIdle(false); engine.cam.lockPitch = null; engine.cam.lockDist = null; engine.input.onTap = null; engine.input.pickables = []; fx.setAmbient(null); };
}

// ---------- SELECT ----------
async function showSelect(parentMode = false) {
  world.reset(); world.setLocation('home', { time: 'day', weather: 'clear', colors: {} });
  fx.setWeather(null); fx.setAmbient(null);
  const types = ['cat', 'bunny', 'dino'], xs = [-2.6, 0, 2.6];
  const show = showcasePets(types.map((type, i) => ({ type, x: xs[i], z: 0, y: 0.28 })));
  const peds = types.map((type, i) => pedestal(xs[i], 0, PET_META[type].color));
  const center = new THREE.Vector3(engine.portrait ? 0 : 2.1, 0.5, 0);
  engine.setViewShift(0, 0.26);
  engine.follow(() => center); engine.cam.homeYaw = 0; engine.cam.yaw = 0; engine.cam.pitch = 0.22; engine.cam.lockPitch = 0.22; engine.cam.lockDist = engine.portrait ? 10.5 : 8.8; engine.cam.dist = 14; engine.orbitIdle(false);
  let petType = 'cat';
  const choose = (type, loud = true) => {
    petType = type;
    show.pets.forEach((p, i) => { const on = types[i] === type; peds[i].ring.material.opacity = on ? 0.9 : 0; if (on && loud) { p.play('cheer'); fx.sparkles(p.emoteWorld(), 18); sfx.play('pop'); } });
    const lbl = el.querySelector('#petChosen'); if (lbl) lbl.textContent = `${PET_META[type].emoji} ${PET_META[type].name} ${uiLang === 'bn' ? '' : 'the ' + type}`;
    const pn = el.querySelector('input[name=petName]'); if (pn && !pn.dataset.touched) pn.value = PET_META[type].name;
    el.querySelectorAll('.pet-choice button').forEach((b) => b.classList.toggle('active', b.dataset.pet === type));
  };
  engine.input.pickables = show.pets.map((p) => p.group);
  engine.input.onTap = (hit) => { if (hit.kind === 'actor' && hit.pick?.type) { unlock(); choose(hit.pick.type); const f = el.querySelector('#newForm'); if (f.classList.contains('hidden')) openForm(); } };
  let kids = [];
  try { kids = await api.children(); } catch (e) { console.warn(e); }
  if (!Array.isArray(kids)) kids = [];
  if (kids.length === 0) {
    kids = [{ id: 'sreya', name: 'sreya', age: '4', lang: uiLang || 'bn', petType: 'cat', petName: 'Momo', isPreview: true }];
  }
  const el = screen('select', `
    <button class="hud-btn back" id="backTitle" title="${esc(L('back'))}">←</button>
    <div class="select-card ${parentMode ? 'parent-mode' : ''}">
      <h2>${parentMode ? '👪 ' + esc(L('parents')) : esc(L('whoPlays'))}</h2>
      ${parentMode ? `<p class="muted small">${uiLang === 'bn' ? 'ড্যাশবোর্ড দেখতে একজন খেলোয়াড় বেছে নিন বা নতুন প্রোফাইল তৈরি করুন।' : 'Pick a player to open their dashboard or create a new child profile below.'}</p>` : ''}
      <div class="player-list" id="players">
        ${kids.map((k) => `<button class="player ${k.isPreview ? 'preview-player' : ''}" data-id="${k.id}"><span class="av" style="--c:${PET_META[k.petType]?.color || '#8b5cf6'}">${PET_META[k.petType]?.emoji || '🐱'}</span><span class="pname">${esc(k.name)}${k.isPreview ? ` <span class="preview-badge" style="background:#e0e7ff;color:#4338ca;padding:2px 8px;border-radius:12px;font-size:0.75rem;margin-left:6px;font-weight:600;">${uiLang === 'bn' ? '⭐ নমুনা' : '⭐ Preview'}</span>` : ''}</span><span class="pmeta">${esc(k.petName || PET_META[k.petType]?.name || '')} · ${k.lang === 'bn' ? 'বাংলা' : 'EN'}</span></button>`).join('')}
        ${kids.length ? '' : `<p class="muted small">${uiLang === 'bn' ? 'এখনও কেউ নেই — নিচে নতুন খেলোয়াড় তৈরি করো।' : 'Nobody yet — create the first player below.'}</p>`}
      </div>
      <button class="btn secondary" id="newBtn">${parentMode ? (uiLang === 'bn' ? '+ নতুন প্রোফাইল তৈরি করো' : '+ Create New Child Profile') : esc(L('newFriend'))}</button>
      <form id="newForm" class="new-form hidden">
        <label class="field"><span>${esc(L('name'))}</span><input name="name" required maxlength="24" autocomplete="off"></label>
        <div class="grid2">
          <label class="field"><span>${esc(L('age'))}</span><select name="age"><option value="">—</option>${[2, 3, 4, 5, 6, 7, 8].map((a) => `<option>${a}</option>`).join('')}</select></label>
          <label class="field"><span>${esc(L('language'))}</span><select name="lang"><option value="en" ${uiLang === 'en' ? 'selected' : ''}>English</option><option value="bn" ${uiLang === 'bn' ? 'selected' : ''}>বাংলা</option></select></label>
        </div>
        <div class="field"><span>${esc(L('pet'))}</span><div class="pet-choice">${types.map((tp) => `<button type="button" data-pet="${tp}" class="${tp === 'cat' ? 'active' : ''}" style="--c:${PET_META[tp].color}">${PET_META[tp].emoji} ${PET_META[tp].name}</button>`).join('')}</div><small class="muted">${uiLang === 'bn' ? 'জগতে পোষা বন্ধুকে ট্যাপ করেও বেছে নেওয়া যায়:' : 'You can also tap a pet in the world:'} <b id="petChosen"></b></small></div>
        <div class="grid2">
          <label class="field"><span>${esc(L('petName'))}</span><input name="petName" maxlength="20" autocomplete="off"></label>
          <label class="field"><span>${esc(L('pin'))}</span><input name="pin" inputmode="numeric" maxlength="8" pattern="[0-9]*" autocomplete="off" placeholder="••••"></label>
        </div>
        <p class="error hidden" id="formErr"></p>
        <div class="row end"><button type="button" class="btn ghost" id="cancelNew">${esc(L('cancel'))}</button><button class="btn big">▶ ${esc(L('create'))}</button></div>
      </form>
    </div>`);
  const openForm = () => { el.querySelector('#newForm').classList.remove('hidden'); el.querySelector('#newBtn')?.classList.add('hidden'); el.querySelector('input[name=name]').focus(); };
  el.querySelector('#backTitle').addEventListener('click', () => navigate('#/'));
  el.querySelector('#newBtn')?.addEventListener('click', () => { unlock(); openForm(); });
  el.querySelector('#cancelNew').addEventListener('click', () => { el.querySelector('#newForm').classList.add('hidden'); el.querySelector('#newBtn')?.classList.remove('hidden'); });
  el.querySelectorAll('.pet-choice button').forEach((b) => b.addEventListener('click', () => choose(b.dataset.pet)));
  el.querySelector('input[name=petName]').addEventListener('input', (e) => { e.target.dataset.touched = '1'; });
  el.querySelectorAll('.player').forEach((b) => b.addEventListener('click', () => { unlock(); sfx.play('click'); navigate(parentMode ? `#/parent/${b.dataset.id}` : `#/play/${b.dataset.id}`); }));
  el.querySelector('#newForm').addEventListener('submit', async (e) => {
    e.preventDefault(); unlock();
    const fd = new FormData(e.target); const err = el.querySelector('#formErr'); err.classList.add('hidden');
    const pin = String(fd.get('pin') || '').trim();
    if (pin && !/^\d{4,8}$/.test(pin)) { err.textContent = L('pinHelp'); err.classList.remove('hidden'); return; }
    try {
      const child = await api.createChild({ name: fd.get('name'), age: fd.get('age') || null, lang: fd.get('lang'), petType, petName: fd.get('petName') || PET_META[petType].name, pin: pin || undefined });
      sfx.play('success'); navigate(parentMode ? `#/parent/${child.id}` : `#/play/${child.id}`);
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
  });
  choose('cat', false);
  unmount = () => { show.dispose(); peds.forEach((p) => engine.scene.remove(p.grp)); el.remove(); engine.cam.lockPitch = null; engine.cam.lockDist = null; engine.input.onTap = null; engine.input.pickables = []; };
}

// ---------- PLAY ----------
async function showPlay(id) {
  if (!unlocked) {
    // Deep link: browsers need one tap before audio can play — make it feel like "press start".
    let child = null;
    try { child = await api.child(id); } catch {}
    if (!child) child = { id, name: id, petType: 'cat', petName: 'Momo', lang: uiLang || 'bn' };
    world.reset(); world.setLocation('home', { time: 'day', weather: 'clear', colors: {} });
    const show = showcasePets([{ type: child.petType || 'cat', x: 0, z: 0 }]);
    const center = new THREE.Vector3(0, 0.6, 0); engine.setViewShift(0, 0); engine.follow(() => center); engine.cam.lockDist = 7; engine.cam.dist = 10; engine.orbitIdle('sway');
    const gate = screen('gate', `<div class="gate-card"><h2>${esc(child.petName || PET_META[child.petType]?.name || 'Momo')} ${uiLang === 'bn' ? 'তোমার জন্য অপেক্ষা করছে!' : 'is waiting for you!'}</h2><button class="btn big play" id="gateBtn">▶ ${esc(L('tapToStart'))}</button></div>`);
    await new Promise((res) => gate.querySelector('#gateBtn').addEventListener('click', res, { once: true }));
    unlock(); sfx.play('success');
    show.dispose(); gate.remove(); engine.orbitIdle(false); engine.cam.lockDist = null;
  }
  const token = navToken;
  const cleanup = await mountPlay3D(g, id, {
    navigate, toast,
    remount: async () => { const u = unmount; unmount = null; if (u) await u(); showPlay(id); },
    openParent: (cid, onClose) => openParentOverlay(cid, onClose),
  });
  if (token !== navToken) { await cleanup(); return; }
  unmount = cleanup;
}

// ---------- PARENT overlay ----------
let parentOverlay = null;
async function openParentOverlay(childId, onClose) {
  closeParentOverlay();
  const ov = document.createElement('div'); ov.className = 'parent-overlay'; ov.innerHTML = '<div class="parent-inner" id="parentRoot"></div>'; ui.appendChild(ov);
  parentOverlay = { el: ov, onClose };
  ov.addEventListener('click', (e) => { if (e.target.closest('#closeParent')) { closeParentOverlay(); } });
  await mountParent(ov.querySelector('#parentRoot'), childId, { navigate: (h) => { closeParentOverlay(); navigate(h); }, toast, embedded: true });
}
function closeParentOverlay() { if (!parentOverlay) return; const { el, onClose } = parentOverlay; parentOverlay = null; el.remove(); onClose?.(); }
async function showParentFull(id) {
  world.reset(); world.setLocation('garden', { time: 'day', weather: 'clear', colors: {} });
  const show = showcasePets([{ type: 'cat', x: 0, z: 0 }]);
  const center = new THREE.Vector3(0, 0.6, 0); engine.setViewShift(0, 0); engine.follow(() => center); engine.cam.lockDist = 8; engine.orbitIdle('sway');
  await openParentOverlay(id, () => navigate('#/select?parent=1'));
  unmount = () => { show.dispose(); engine.orbitIdle(false); engine.cam.lockDist = null; if (parentOverlay) { const o = parentOverlay; parentOverlay = null; o.el.remove(); } };
}

// ---------- router ----------
async function route() {
  const hash = location.hash || '#/';
  const [path, query] = hash.slice(1).split('?');
  const parts = path.split('/').filter(Boolean);
  const token = ++navToken;
  if (unmount) { const u = unmount; unmount = null; await u(); }
  if (token !== navToken) return;
  closeParentOverlay();
  if (!parts.length) return showTitle();
  if (parts[0] === 'select' || parts[0] === 'profiles') return showSelect(new URLSearchParams(query || '').get('parent') === '1');
  if (parts[0] === 'play' && parts[1]) return showPlay(parts[1]);
  if (parts[0] === 'parent' && parts[1]) return showParentFull(parts[1]);
  return showTitle();
}
window.addEventListener('hashchange', route);
route();
window.__fw = g; // handy for debugging / smoke tests
g.getState = () => (g.playState ? g.playState() : null);
