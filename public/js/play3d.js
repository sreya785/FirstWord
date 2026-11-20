// Gameplay screen: 3D pet + living world + voice loop + HUD (quests, stickers, chips, pause menu).
import * as THREE from 'three';
import { api } from './api.js';
import { speech } from './speech.js';
import { petSVG, PET_META } from './pet.js';
import { sfx } from './sfx.js';
import { t } from './i18n.js';
import { Pet3D } from './pet3d.js';
import { clamp } from './engine.js';

const SCENE_OPTIONS = [
  ['restaurant', '🍽️', { en: 'Restaurant', bn: 'রেস্টুরেন্ট', descEn: 'Cook, serve tables & take orders!', descBn: 'অর্ডার নাও ও টেবিল পরিবেশন করো!' }],
  ['shop', '🛍️', { en: 'Shop', bn: 'দোকান', descEn: 'Be the shopkeeper, scan & take cash!', descBn: 'দোকানদার হও ও স্ক্যান করো!' }],
  ['hospital', '🩺', { en: 'Doctor Clinic', bn: 'হাসপাতাল', descEn: 'Visit Doctor Mitu & care for friends', descBn: 'ডাক্তার মিতুর কাছে চিকিৎসা নাও' }],
  ['stage', '🎭', { en: 'Stage Show', bn: 'মঞ্চ', descEn: 'Perform, sing songs & tell stories', descBn: 'গান গাও ও নাটক করো' }],
  ['home', '🏠', { en: 'Home Sweet Home', bn: 'বাড়ি', descEn: 'Relax, cook & play at home', descBn: 'বাড়িতে আনন্দ ও খেলা' }],
  ['emergency', '🆘', { en: 'Help My Pet', bn: 'সাহায্য', descEn: 'Help your pet feeling sick or sad', descBn: 'অসুস্থ বন্ধুকে সাহায্য করো' }],
  ['create', '🌈', { en: 'Our Own World', bn: 'নিজের জগৎ', descEn: 'Magical sandbox where words come alive', descBn: 'যা বলবে তাই তৈরি হবে' }],
  ['park', '🌳', { en: 'Sunny Park', bn: 'পার্ক', descEn: 'Green trees, birds & sunny paths', descBn: 'সবুজ গাছপালা ও খেলাধূলা' }],
  ['beach', '🏖️', { en: 'Ocean Beach', bn: 'সমুদ্র সৈকত', descEn: 'Waves, sandcastles & sea shells', descBn: 'সাগরের ঢেউ ও বালুকাবেলা' }],
  ['space', '🚀', { en: 'Outer Space', bn: 'মহাকাশ', descEn: 'Float among stars, rockets & the moon', descBn: 'চাঁদ, রকেট ও তারাদের জগৎ' }],
];
const SCENE_BUTTONS = SCENE_OPTIONS.map(([k, e]) => [k, e]);
export const LOC_EMOJI = { home: '🏠', restaurant: '🍽️', shop: '🛍️', hospital: '🩺', stage: '🎭', emergency: '🌳', create: '🌈', park: '🌳', beach: '🏖️', space: '🚀', garden: '🌷', school: '🏫', forest: '🌲', castle: '🏰', farm: '🚜', city: '🏙️', underwater: '🐠', mountain: '⛰️', zoo: '🦁', kitchen: '🍳', party: '🎉', snow: '⛄', pirate: '🏴‍☠️' };
const MOOD_EMOTE = { love: '💖', excited: '✨', proud: '🌟', surprised: '❗', thinking: '💭', silly: '😜', sleepy: '💤', worried: '💧', sick: '🤒', relieved: '😮‍💨', sad: '💧' };
const ACTION_SFX = { jump: 'jump', bounce: 'bounce', dance: 'music', sleep: 'sleep', fly: 'swish', wave: 'pop', bow: 'applause_soft' };
const INDOOR = new Set(['restaurant', 'shop', 'hospital', 'kitchen', 'school', 'stage']);
const SILENCE_MS = 30000; // gentle check-in only after a long quiet spell (not while the child is tapping)
const WALK_SPEED = 3.4;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Mount the game for one child. `g` is the shared engine bundle { engine, world, fx, ui }.
 * Returns an async cleanup function.
 */
export async function mountPlay3D(g, childId, { navigate, toast, remount, openParent }) {
  const { engine, world, fx, ui } = g;
  let child;
  try { child = await api.child(childId); } catch { navigate('#/select'); return () => {}; }
  const lang = child.lang || 'en';
  const L = (k) => t(lang, k);
  const petName = child.petName || PET_META[child.petType]?.name || 'Momo';
  const S = {
    child, lang, sessionId: null, world: null, last: null, busy: false, listening: false, speaking: false,
    autoListen: child.settings?.autoListen !== false, voiceControlActive: true, silenceTimer: null, silenceCount: 0, muted: false, destroyed: false,
    curMood: 'happy', stickerCount: 0, questDoneTitle: null, typer: null, heardHtml: '', walkTarget: null, paused: false,
    speakerKey: null, bubbleText: '', tags: new Map(),
  };
  speech.setLang(lang);

  // ---------- 3D actors ----------
  const pet = new Pet3D(child.petType || 'cat');
  pet.group.userData.pick = { kind: 'pet' };
  engine.scene.add(pet.group); g.pet = pet;
  engine.follow(() => pet.position);
  engine.cam.homeYaw = 0; engine.cam.orbitIdle = false; engine.cam.lockDist = null; engine.cam.lockPitch = null; engine.setViewShift(0.09, 0.15);
  world.reset();
  world.setLocation('home', { time: 'day', weather: 'clear', colors: {} });
  engine.input.pickables = [pet.group, ...world.pickables()];
  engine.intro();

  // ---------- HUD ----------
  const hud = document.createElement('div');
  hud.className = 'hud-root';
  hud.innerHTML = `
    <div id="tags"></div>
    <div id="bubble3d" class="bubble3d hidden"><span></span></div>
    <div class="voice-feedback-banner hidden" id="voiceBadge"></div>
    <header class="hud-top">
      <div class="hud-left">
        <button class="places-menu-btn" id="placesBtn" title="${lang === 'bn' ? 'স্থানসমূহ মেনু (৩-বার)' : 'Places Menu (3 bars)'}">
          <span class="three-bars-icon"><i></i><i></i><i></i></span>
          <span class="places-btn-text">${lang === 'bn' ? 'স্থানসমূহ' : 'Places'}</span>
        </button>
        <div class="loc-badge" id="loc"><span class="ic">🏠</span><span class="lbl"></span></div>
        <button class="hud-btn" id="settingsBtn" title="${L('settings')}">⚙️</button>
      </div>
      <button class="quest-pill hidden" id="questPill"><span class="q-emoji">🎯</span><span class="q-title">${L('quest')}</span><span class="q-dots"></span></button>
      <div class="hud-right">
        <button class="voice-status-pill listening" id="voiceToggleBtn" title="${lang === 'bn' ? 'হ্যান্ডস-ফ্রি ভয়েস কন্ট্রোল (শুনছি)' : 'Hands-Free Voice Control (Active)'}">
          <span class="wave-bars"><i></i><i></i><i></i><i></i></span>
          <span class="voice-lbl">${lang === 'bn' ? 'ভয়েস কন্ট্রোল' : 'Voice ON'}</span>
        </button>
        <button class="sticker-counter" id="stickerBtn" title="${L('stickerBook')}">⭐ <b id="stickerCount">0</b></button>
        <button class="hud-btn" id="soundBtn" title="${L('mute')}">🔊</button>
      </div>
    </header>
    <aside class="quest-card hidden" id="questCard">
      <div class="qc-head"><span id="qcEmoji">🎯</span><b id="qcTitle"></b><button class="x" id="qcClose">✕</button></div>
      <ul id="qcSteps"></ul>
    </aside>
    <div class="modal-bg hidden" id="placesModal">
      <div class="panel places-panel">
        <div class="places-head">
          <div class="places-title-wrap">
            <span class="places-title-icon">🗺️</span>
            <div>
              <h3>${lang === 'bn' ? 'স্থানসমূহ বেছে নাও (৩-বার মেনু)' : 'Explore Places (3-Bar Menu)'}</h3>
              <p class="muted small">${lang === 'bn' ? 'যেকোনো স্থান চাপো বা মুখে বলো: "চলো রেস্টুরেন্টে যাই"' : 'Tap any place or say by voice: "Take me to restaurant", "Go to shop"…'}</p>
            </div>
          </div>
          <button class="x" id="placesCloseBtn">✕</button>
        </div>
        <div class="places-grid" id="rail">
          ${SCENE_OPTIONS.map(([k, e, meta]) => `
            <button class="scene-card" data-scene="${k}" title="${esc(meta[lang] || meta.en)}">
              <span class="sc-emoji">${e}</span>
              <div class="sc-info">
                <b class="sc-name">${esc(meta[lang] || meta.en)}</b>
                <small class="sc-desc">${esc(lang === 'bn' ? meta.descBn : meta.descEn)}</small>
              </div>
            </button>
          `).join('')}
        </div>
        <div class="places-voice-footer">
          <span class="pv-icon">🎙️</span>
          <span><b>${lang === 'bn' ? 'ভয়েস কন্ট্রোল সক্রিয়:' : 'Full Voice Control:'}</b> ${lang === 'bn' ? 'মুখে বলো: "রেস্টুরেন্ট", "দোকান", "হাসপাতাল", "মঞ্চ", "বাড়ি", "জুম ইন"' : 'Say anytime: "Take me to restaurant", "Go to shop", "Doctor", "Stage", "Zoom in" or "Jump"!'}</span>
        </div>
      </div>
    </div>
    <div class="joy" id="joy"><div class="joy-base"><div class="joy-nub"></div></div></div>
    <div class="bottom">
      <div class="heard-chip hidden" id="transcript"></div>
      <section class="dialogue" id="dialogue">
        <div class="portrait" id="portrait"></div>
        <div class="dlg-body">
          <div class="speaker"><span id="speaker">${esc(petName)}</span><span class="speaking-dots" id="dots"><i></i><i></i><i></i></span></div>
          <div class="dlg-text" id="bubbleText"></div>
          <div class="recast hidden" id="recast"></div>
        </div>
        <button class="replay" id="replayBtn" title="Replay">🔁</button>
        <div class="your-turn" id="yourTurn">🎤 ${L('yourTurn')}</div>
      </section>
      <div class="chips hidden" id="chips"></div>
      <div class="typebox hidden" id="typebox"><div class="typebox-note" id="typeboxNote"></div><div class="typebox-row"><input id="typeInput" placeholder="${L('typeInstead')}…" autocomplete="off"><button class="btn sm" id="sendBtn">${L('send')}</button></div></div>
      <div class="main-controls">
        <div class="zoom-controls">
          <button class="round" id="zoomOutBtn" title="${lang === 'bn' ? 'দূরে দেখো' : 'Zoom out'}">➖</button>
          <button class="round" id="zoomInBtn" title="${lang === 'bn' ? 'কাছে দেখো' : 'Zoom in'}">➕</button>
        </div>
        <button class="round" id="hintBtn">💡<span>${L('hint')}</span></button>
        <button class="mic" id="mic"><span class="ring"></span><span class="ring r2"></span><span class="mic-ic">🎤</span><small id="micLabel">${L('listen')}</small></button>
        <div class="side-right">
          <button class="round hidden" id="typeBtn" title="${L('typeInstead')}">⌨️</button>
          <button class="round ${S.autoListen ? 'on' : ''}" id="autoBtn" title="${L('autoListen')}">🔁</button>
        </div>
      </div>
    </div>
    <div class="toasts" id="toasts"></div>
    <div class="banner hidden" id="banner"></div>
    <div class="modal-bg hidden" id="stickerBook"><div class="panel"><h3>⭐ ${L('stickerBook')}</h3><div class="sticker-grid" id="stickerGrid"></div><div class="row end"><button class="btn ghost sm" id="closeStickers">${L('cancel')}</button></div></div></div>
    <div class="modal-bg hidden" id="pauseMenu"><div class="panel pause">
      <h3>⚙️ ${L('settings')}</h3>
      <div class="voice-preview-card">
        <div class="voice-preview-row">
          <div>
            <div class="small" style="font-weight:800;color:var(--brand)">🎙️ ${lang === 'bn' ? 'এআই গল্প বলার কণ্ঠ:' : 'AI Storytelling Voice:'}</div>
            <div class="small" id="activeVoiceDisplay" style="font-weight:700">${lang === 'bn' ? 'বাংলা উষ্ণ কণ্ঠ' : 'Warm Female Storyteller'}</div>
          </div>
          <button class="btn sm secondary" id="testVoiceBtn">▶ ${lang === 'bn' ? 'কণ্ঠ শুনুন' : 'Test Voice'}</button>
        </div>
      </div>
      <label class="switch"><span>🎙️ ${lang === 'bn' ? 'হ্যান্ডস-ফ্রি ভয়েস কন্ট্রোল' : 'Hands-Free Voice Control'}</span><input type="checkbox" id="setVoiceControl" checked></label>
      <label class="switch"><span>${L('autoListenSetting')}</span><input type="checkbox" id="setAuto" ${S.autoListen ? 'checked' : ''}></label>
      <label class="switch"><span>🔊 ${L('mute')}</span><input type="checkbox" id="setSound" checked></label>
      <label class="switch"><span>🎵 Ambience</span><input type="checkbox" id="setAmb" checked></label>
      <div class="drawer-lang"><span>${L('language')}</span><div class="lang-toggle"><button data-lang="en" class="${lang === 'en' ? 'active' : ''}">EN</button><button data-lang="bn" class="${lang === 'bn' ? 'active' : ''}">বাং</button></div></div>
      <p class="muted small">${speech.supported ? (lang === 'bn' ? 'কথা বলো, টাইপ করো বা ফ্রেজ ট্যাপ করো — সবই ঠিক। ভয়েস দিয়ে বলতে পারো "রেস্টুরেন্টে চলো", "দোকানে চলো", "জুম ইন" ইত্যাদি।' : 'Talk, type or tap a phrase. With voice control you can simply say "Go to restaurant", "Take me to shop", "Zoom in", "Dance", etc.') : L('noMic')}</p>
      <div class="pause-actions">
        <button class="btn big" id="resumeBtn">▶ ${lang === 'bn' ? 'খেলা চালাও' : 'Resume'}</button>
        <button class="btn secondary" id="parentLink">👪 ${L('parents')}</button>
        <button class="btn ghost" id="switchBtn">🔁 ${lang === 'bn' ? 'অন্য খেলোয়াড়' : 'Switch player'}</button>
        <button class="btn ghost" id="quitBtn">🚪 ${L('end')}</button>
      </div>
    </div></div>
    <div class="fade" id="fade"></div>`;
  ui.appendChild(hud);
  const $ = (id) => hud.querySelector('#' + id);
  const el = {
    tags: $('tags'), bubble3d: $('bubble3d'), portrait: $('portrait'), speaker: $('speaker'), bubbleText: $('bubbleText'), recast: $('recast'), dialogue: $('dialogue'),
    rail: $('rail'), transcript: $('transcript'), mic: $('mic'), micLabel: $('micLabel'), chips: $('chips'), typebox: $('typebox'), typeInput: $('typeInput'), loc: $('loc'),
    autoBtn: $('autoBtn'), soundBtn: $('soundBtn'), questPill: $('questPill'), questCard: $('questCard'), toasts: $('toasts'), banner: $('banner'), stickerCount: $('stickerCount'),
    yourTurn: $('yourTurn'), joy: $('joy'), fade: $('fade'), pauseMenu: $('pauseMenu'), stickerBook: $('stickerBook'),
    zoomIn: $('zoomInBtn'), zoomOut: $('zoomOutBtn'),
    placesBtn: $('placesBtn'), placesModal: $('placesModal'), placesCloseBtn: $('placesCloseBtn'),
    voiceToggleBtn: $('voiceToggleBtn'), voiceBadge: $('voiceBadge'),
    testVoiceBtn: $('testVoiceBtn'), setVoiceControl: $('setVoiceControl'), activeVoiceDisplay: $('activeVoiceDisplay'),
  };
  hud.classList.toggle('touch', engine.isMobile || matchMedia('(pointer: coarse)').matches);

  // ---------- pet helpers ----------
  const petEmote = (emoji) => { if (emoji) fx.emote(() => pet.emoteWorld(), emoji); };
  function setPetMood(mood) {
    S.curMood = mood || S.curMood; pet.setMood(S.curMood);
    el.portrait.innerHTML = petSVG({ type: S.child.petType, mood: S.curMood, outfit: S.world?.petOutfit, state: S.world?.petState });
  }
  function petAction(action) {
    if (!action) return;
    pet.play(action);
    if (ACTION_SFX[action]) sfx.play(ACTION_SFX[action]);
  }
  const bounds = (p) => {
    const loc = S.world?.location || 'home';
    if (INDOOR.has(loc)) { p.x = clamp(p.x, -7, 7); p.z = clamp(p.z, loc === 'stage' ? -5.5 : -6.6, 3.6); }
    else { const d = Math.hypot(p.x, p.z); if (d > 9.5) { p.x *= 9.5 / d; p.z *= 9.5 / d; } p.z = Math.min(p.z, 4.2); }
  };

  // ---------- dialogue / typewriter ----------
  function stopTyper() { if (S.typer) { clearInterval(S.typer.timer); S.typer = null; } }
  function setBubble3d(text) { S.bubbleText = text || ''; el.bubble3d.querySelector('span').textContent = S.bubbleText.length > 70 ? S.bubbleText.slice(0, 68) + '…' : S.bubbleText; el.bubble3d.classList.toggle('hidden', !S.bubbleText); }
  function showLine(item, { instant = false } = {}) {
    stopTyper();
    const isPet = item.who === 'pet';
    el.dialogue.classList.toggle('char', !isPet);
    el.dialogue.classList.toggle('doctor', !isPet && /doctor|ডাক্তার/i.test(item.key || item.name || ''));
    el.speaker.textContent = isPet ? S.last?.pet.name || petName : item.name || '';
    if (isPet) el.portrait.innerHTML = petSVG({ type: S.child.petType, mood: S.curMood, outfit: S.world?.petOutfit, state: S.world?.petState });
    else {
      const c = (S.world?.characters || []).find((x) => x.key === item.key || x.name === item.name);
      el.portrait.innerHTML = `<div class="char-portrait" style="${c?.color ? `--tint:${c.color}` : ''}">${c?.emoji || '🙂'}</div>`;
    }
    const text = item.text;
    setBubble3d(text);
    if (instant || !text) { el.bubbleText.textContent = text || ''; return; }
    el.bubbleText.textContent = '';
    const cps = lang === 'bn' ? 22 : 28;
    const typer = { i: 0, text, timer: null };
    typer.timer = setInterval(() => { typer.i = Math.min(text.length, typer.i + 1); el.bubbleText.textContent = text.slice(0, typer.i); if (typer.i >= text.length) stopTyper(); }, 1000 / cps);
    S.typer = typer;
  }
  function pullTyper(charIndex) { if (!S.typer) return; const txt = S.typer.text; let end = txt.indexOf(' ', charIndex); if (end < 0) end = txt.length; if (end > S.typer.i) { S.typer.i = end; el.bubbleText.textContent = txt.slice(0, end); } }
  function finishTyper() { if (S.typer) { el.bubbleText.textContent = S.typer.text; stopTyper(); } }
  function setChips(list) {
    S.suggestions = list || [];
    el.chips.innerHTML = '';
  }
  function setMicState() {
    el.mic.classList.toggle('listening', S.listening);
    el.mic.classList.toggle('speaking', S.speaking && !S.listening);
    el.mic.classList.toggle('disabled', S.busy);
    el.mic.querySelector('.mic-ic').textContent = S.listening ? '👂' : (S.speaking ? '💬' : (S.busy ? '…' : '🎤'));
    el.micLabel.textContent = S.listening ? L('listening') : S.speaking ? L('speaking') : S.busy ? L('thinking') : L('listen');
    el.dialogue.classList.toggle('your-turn-on', S.listening);
    el.dialogue.classList.toggle('talking', S.speaking);
    hud.classList.toggle('is-listening', S.listening);
    pet.setListening(S.listening);
  }
  function clearSilence() { if (S.silenceTimer) { clearTimeout(S.silenceTimer); S.silenceTimer = null; } }
  function armSilence() {
    clearSilence();
    if (S.silenceCount >= 2 || S.destroyed || S.paused) return; // never nag: after two gentle check-ins the pet simply waits
    // a child who is busy tapping tables / walking must not be interrupted by a silence prompt
    if (S.tapAt && performance.now() - S.tapAt < 12000) { S.silenceTimer = setTimeout(armSilence, 4000); return; }
    S.silenceTimer = setTimeout(() => { if (S.busy || S.listening || S.speaking || S.destroyed || S.paused) return; if (S.tapAt && performance.now() - S.tapAt < 12000) { armSilence(); return; } S.silenceCount++; send('', 'silence'); }, SILENCE_MS);
  }
  function normItems(res) {
    if (!res) return [];
    const raw = (res.speech && res.speech.length) ? res.speech
      : (res.items && res.items.length) ? res.items
      : [{ who: 'pet', text: res.pet?.text || res.reply?.text || '' }];
    return raw.filter((i) => i && i.text).map((i) => ({ ...i, name: i.who === 'pet' ? (res.pet?.name || 'Momo') : (i.name ? i.name.charAt(0).toUpperCase() + i.name.slice(1) : '') }));
  }

  // ---------- HUD: quest, stickers, banner ----------
  function renderQuest(q) {
    if (!q) { el.questPill.classList.add('hidden'); return; }
    el.questPill.classList.remove('hidden');
    const done = q.steps.filter((s) => s.done).length;
    el.questPill.querySelector('.q-emoji').textContent = q.emoji || '🎯';
    el.questPill.querySelector('.q-title').textContent = q.title;
    el.questPill.querySelector('.q-dots').innerHTML = q.steps.map((s) => `<i class="${s.done ? 'on' : ''}"></i>`).join('');
    $('qcEmoji').textContent = q.emoji || '🎯'; $('qcTitle').textContent = q.title;
    $('qcSteps').innerHTML = q.steps.map((s) => `<li class="${s.done ? 'done' : ''}"><span class="box">${s.done ? '✓' : ''}</span>${esc(s.label)}</li>`).join('');
    const complete = q.steps.length && done === q.steps.length;
    el.questPill.classList.toggle('complete', complete);
    if (complete && S.questDoneTitle !== q.title) { S.questDoneTitle = q.title; showBanner(`${q.emoji || '🎯'} ${L('missionDone')}`); fx.confetti(pet.position, 200); sfx.play('success'); pet.play('cheer'); }
  }
  function showBanner(text) { el.banner.textContent = text; el.banner.classList.remove('hidden', 'pop'); void el.banner.offsetWidth; el.banner.classList.add('pop'); setTimeout(() => el.banner.classList.add('hidden'), 2600); }
  function setStickerCount(n, bump) { S.stickerCount = n ?? S.stickerCount; el.stickerCount.textContent = S.stickerCount; if (bump) { const b = $('stickerBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
  async function showRewards(rewards) {
    for (const r of rewards || []) {
      const tEl = document.createElement('div'); tEl.className = 'sticker-toast';
      tEl.innerHTML = `<div class="st-emoji">${r.emoji}</div><div><small>${L('newSticker')}</small><b>${esc(r.label)}</b><span>${esc(r.hint || '')}</span></div>`;
      el.toasts.appendChild(tEl);
      sfx.play('unlock_sticker'); fx.confetti(pet.position, 90); fx.sparkles(pet.emoteWorld(), 20);
      setStickerCount(S.stickerCount + 1, true);
      setTimeout(() => { tEl.classList.add('out'); setTimeout(() => tEl.remove(), 500); }, 3800);
      await sleep(900);
    }
  }
  async function openStickerBook() {
    const grid = $('stickerGrid'); grid.innerHTML = '<p class="muted">…</p>'; el.stickerBook.classList.remove('hidden'); clearSilence();
    try {
      const data = await api.stickers(S.child.id); const list = Array.isArray(data) ? data : data.stickers || [];
      grid.innerHTML = list.map((s) => `<div class="sticker ${s.unlocked ? 'on' : ''}" title="${esc(s.hint || '')}"><span>${s.unlocked ? s.emoji : '❔'}</span><small>${esc(s.unlocked ? s.label : (lang === 'bn' ? 'এখনও গোপন' : 'Still secret'))}</small></div>`).join('');
      setStickerCount(list.filter((s) => s.unlocked).length);
    } catch (e) { grid.innerHTML = `<p class="error">${esc(e.message)}</p>`; }
  }

  // ---------- world / response ----------
  // Camera style per place. In the shop we are the shopkeeper: we stand behind the counter at the
  // eye of the child and look out at the door. Dragging turns us a full 360° around our own spot.
  const SHOP_STAND = new THREE.Vector3(0.35, 0, -7.4);
  const SHOP_YAW = Math.PI + 0.06;
  function scannerProp() {
    const ink = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.5, metalness: 0.4 });
    const shine = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.3, metalness: 0.7 });
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 14), ink);
    handle.position.set(0, -0.09, 0); g.add(handle);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.32), ink);
    body.position.set(0, 0.05, 0.08); g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.125, 0.03, 0.24), shine);
    stripe.position.set(0, 0.06, 0.08); g.add(stripe);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 14), new THREE.MeshBasicMaterial({ color: '#b91c1c' }));
    lens.position.set(0, 0.075, 0.245); lens.rotation.x = -Math.PI / 2; g.add(lens);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.05), new THREE.MeshBasicMaterial({ color: '#38bdf8' }));
    screen.position.set(0, 0.1, 0.06); screen.rotation.x = -Math.PI / 2; g.add(screen);
    g.userData.lens = lens;
    // held low in our right hand, nose toward the counter (the red eye points where we scan)
    g.position.set(0.3, -0.2, -0.58);
    g.rotation.set(-0.55, -0.95, 0.3);   // seen across our view, not end-on
    g.scale.setScalar(0.5);
    const hand = handProp(1); hand.position.set(0.0, -0.1, 0.005); hand.rotation.set(0.4, 0, 0); hand.scale.setScalar(1.15); g.add(hand);
    g.userData.basePos = g.position.clone(); g.userData.baseRot = g.rotation.clone();
    g.userData.spin = 0;
    return g;
  }
  /** A small first-person hand — so the props really look like they are held in our hand. */
  function handProp(flip = 1) {
    const skin = new THREE.MeshStandardMaterial({ color: '#f4c9a6', roughness: 0.95 });
    const sleeve = new THREE.MeshStandardMaterial({ color: '#a855f7', roughness: 0.85 });
    const g = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.038, 12, 10), skin);
    palm.scale.set(1.05, 0.75, 0.95); g.add(palm);
    for (let i = 0; i < 4; i++) {   // fingers curling over the top
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.0115, 0.038, 4, 8), skin);
      f.position.set((i - 1.5) * 0.021 * flip, 0.03, -0.01);
      f.rotation.set(-0.9, 0, 0.1 * flip); g.add(f);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.04, 4, 8), skin);
    thumb.position.set(-0.045 * flip, -0.005, -0.03); thumb.rotation.set(0.6, 0, 0.9 * flip); g.add(thumb);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.11, 12), sleeve);
    cuff.position.set(0, -0.05, 0.05); cuff.rotation.x = 0.5; g.add(cuff);
    return g;
  }
  function makeBanknoteTexture({ amount = '৳ 100', color = '#15803d', bg = '#dcfce7', sub = 'BANGLADESH BANK' } = {}) {
    if (typeof document === 'undefined') return null;
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');

    // Rich banknote background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);

    // Decorative outer guilloche borders
    ctx.strokeStyle = color;
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, 488, 232);
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 472, 216);

    // Corner rosettes
    ctx.font = 'bold 32px sans-serif';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(amount, 30, 58);
    ctx.fillText(amount, 30, 225);
    ctx.textAlign = 'right';
    ctx.fillText(amount, 482, 58);
    ctx.fillText(amount, 482, 225);

    // Bank title
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sub, 256, 48);

    // Central ornamental oval
    ctx.beginPath();
    ctx.ellipse(256, 130, 96, 68, 0, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.fill();

    // Bold center denomination
    ctx.fillStyle = color;
    ctx.font = 'bold 46px sans-serif';
    ctx.fillText(amount, 256, 146);

    // Golden metallic foil security thread
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(390, 12, 14, 232);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(394, 12, 5, 232);

    // Serial number
    ctx.font = '16px monospace';
    ctx.fillStyle = '#1f2937';
    ctx.textAlign = 'left';
    ctx.fillText('BD 74928103 ★', 32, 185);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  /** The customer's banknote in our outstretched hand, when it is time to take the money. */
  function moneyProp() {
    const g = new THREE.Group();
    const tex1 = makeBanknoteTexture({ amount: '৳ 100', color: '#166534', bg: '#dcfce7' });
    const note1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.006, 0.14), new THREE.MeshStandardMaterial({ map: tex1, roughness: 0.5 }));
    g.add(note1);

    const tex2 = makeBanknoteTexture({ amount: '৳ 50', color: '#0369a1', bg: '#e0f2fe' });
    const note2 = new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.006, 0.135), new THREE.MeshStandardMaterial({ map: tex2, roughness: 0.5 }));
    note2.position.set(-0.015, -0.007, 0.015);
    note2.rotation.y = 0.12;
    g.add(note2);

    const hand = handProp(-1);
    hand.position.set(0.04, -0.03, 0.06);
    hand.rotation.set(-0.95, 0.2, 0);
    hand.scale.setScalar(1.3);
    g.add(hand);

    g.position.set(-0.24, -0.24, -0.56);
    g.rotation.set(-0.2, 0.25, -0.08);
    g.userData.basePos = g.position.clone();
    g.userData.baseRot = g.rotation.clone();
    return g;
  }
  function makeCounterMoneyMesh() {
    const g = new THREE.Group();
    // Green 100 Taka banknote
    const tex1 = makeBanknoteTexture({ amount: '৳ 100', color: '#166534', bg: '#dcfce7' });
    const note1 = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.008, 0.20), new THREE.MeshStandardMaterial({ map: tex1, roughness: 0.45 }));
    g.add(note1);

    // Blue 50 Taka banknote fanned underneath
    const tex2 = makeBanknoteTexture({ amount: '৳ 50', color: '#0369a1', bg: '#e0f2fe' });
    const note2 = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.008, 0.19), new THREE.MeshStandardMaterial({ map: tex2, roughness: 0.45 }));
    note2.position.set(0.04, 0.009, 0.02);
    note2.rotation.y = 0.18;
    g.add(note2);

    // Stack of shiny gold coins
    const coinMat = new THREE.MeshStandardMaterial({ color: '#facc15', metalness: 0.92, roughness: 0.18 });
    const coinRimMat = new THREE.MeshStandardMaterial({ color: '#eab308', metalness: 0.95, roughness: 0.15 });

    for (let i = 0; i < 3; i++) {
      const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.015, 24), coinMat);
      coin.position.set(-0.14 + (i * 0.025), 0.018 + (i * 0.014), 0.03 - (i * 0.01));
      g.add(coin);
      const coinRim = new THREE.Mesh(new THREE.TorusGeometry(0.044, 0.004, 8, 24), coinRimMat);
      coinRim.rotation.x = Math.PI / 2;
      coinRim.position.copy(coin.position);
      coinRim.position.y += 0.008;
      g.add(coinRim);
    }

    g.position.set(0.48, 1.085, -3.85);
    g.rotation.y = -0.15;
    g.userData.pick = { kind: 'counter_money', name: 'Money on Counter' };
    g.traverse((m) => { m.userData.pick = g.userData.pick; });
    return g;
  }
  function receiptProp() {
    const g = new THREE.Group();
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.3), new THREE.MeshBasicMaterial({ color: '#fffdf5', side: THREE.DoubleSide }));
    g.add(paper);
    for (let i = 0; i < 5; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.15 - i * 0.012, 0.012), new THREE.MeshBasicMaterial({ color: '#94a3b8', side: THREE.DoubleSide }));
      line.position.set(0, 0.1 - i * 0.045, 0.001); g.add(line);
    }
    g.position.set(0.22, -0.2, -0.5); g.rotation.set(-0.2, -0.5, 0.1);
    g.userData.basePos = g.position.clone(); g.userData.baseRot = g.rotation.clone();
    return g;
  }
  function applySceneView(loc) {
    engine.setViewShift(0.09, 0.15);
    engine.cam.lockDist = null; engine.cam.lockPitch = null; engine.cam.homeYaw = 0; engine.cam.sceneView = null;
    engine.clearViewProps();
    if (loc === 'shop') {
      // third person: the camera sits just behind our shoulder, so the pet standing at our side and the
      // kid's scanner hand are both in shot. Dragging turns us and the camera around our own spot.
      pet.position.set(SHOP_STAND.x + 2.35, 0.5, SHOP_STAND.z + 2.35);   // the pet stands on its crate at our side, clear of the counter view
      pet.faceToward(Math.atan2(0.55 - pet.position.x, -3.25 - pet.position.z));   // look across the counter at the customer
      engine.cam.homeYaw = SHOP_YAW;
      engine.cam.sceneView = {
        center: new THREE.Vector3(SHOP_STAND.x, 1.3, SHOP_STAND.z + 0.7),
        dist: 4.2, pitch: 0.1, orbit: true, maxPitch: 0.4, maxDist: 6.4, fov: 62,
      };
      engine.cam.yaw = SHOP_YAW; engine.cam.pitch = 0.1; engine.cam.dist = 4.2; engine.cam.lastDrag = -10;
      engine.cam.introUntil = 0; engine.cam.firstSight = 0.28;
      S.walkTarget = null; S.shopStand = SHOP_STAND.clone(); S.shopYaw = SHOP_YAW;
      engine.setViewProp('scanner', scannerProp());
      engine.setViewProp('money', null);
    }
  }
  async function travel(worldState) {
    el.fade.classList.add('on'); sfx.play('travel'); await sleep(380);
    if (S.destroyed) return;
    world.setLocation(worldState.location, worldState);
    pet.position.set(0, 0, 0); pet.faceToward(0); S.walkTarget = null;
    engine.cam.yaw = 0.7; engine.cam.dist = 15; engine.cam.pitch = 0.5; engine.cam.lastDrag = -10; engine.cam.focus = null; engine.cam.fastReturnUntil = engine.time + 6;
    // inside our own shop we look FROM behind the counter out to the door (customers walk up to us)
    applySceneView(worldState.location);
    await sleep(60);
    el.fade.classList.remove('on');
  }
  function ambientFor(w) {
    const loc = w.location;
    if (loc === 'underwater') return 'bubbles';
    if (loc === 'space') return null;
    if (w.time === 'night' && !INDOOR.has(loc)) return 'fireflies';
    if (['garden', 'create', 'party'].includes(loc)) return 'petals';
    return null;
  }
  async function applyResponse(res) {
    if (!res) res = {};
    if (!res.world) res.world = { location: S.world?.location || 'home', time: 'day', weather: 'clear', colors: {} };
    if (!res.pet) res.pet = { mood: 'happy', name: S.last?.pet?.name || 'Momo' };
    if (!res.items) res.items = res.speech || (res.reply ? [res.reply] : []);
    const prevLoc = S.world?.location;
    S.last = res; S.world = res.world; S.sceneState = res.sceneState || S.sceneState || {}; S.curMood = res.pet.mood || S.curMood;
    const w = res.world;
    const changed = res.sceneChanged || (prevLoc && prevLoc !== w.location) || !prevLoc && w.location !== 'home';
    if (changed) await travel(w);
    if (S.destroyed) return;
    const prevIds = new Set(world.actors.keys());
    world.applyWorld(w, { petPos: pet.position });
    engine.input.pickables = [pet.group, ...world.pickables()];
    const newIds = [...world.actors.keys()].filter((id) => !prevIds.has(id));
    fx.setWeather(w.weather === 'rain' || w.weather === 'storm' ? 'rain' : w.weather === 'snow' ? 'snow' : null);
    fx.setAmbient(ambientFor(w));
    sfx.setScene?.(w.location);
    pet.setOutfit(w.petOutfit || null); pet.setState(w.petState || 'normal');
    fx.zzz(() => pet.emoteWorld(), w.petState === 'sleeping');
    // entrance FX + camera attention for new things
    let focusPos = null;
    if (newIds.length) {
      const pts = [pet.position.clone()];
      for (const id of newIds) { const a = world.actors.get(id); if (!a) continue; const p = a.g.position.clone(); pts.push(p); fx.sparkles(p.clone().setY(p.y + 1), 14); fx.ring(p, '#ffffff'); if (!focusPos) focusPos = p; }
      sfx.play('pop');
      if (!changed && S.world?.location !== 'shop') engine.frame(pts, { seconds: 3.5 });   // the shop keeps its behind-counter view
    }
    // the scanner: beep when the customer's item is scanned, receipt when the sale is done
    if (w.location === 'shop') {
      const scene = S.sceneState || {};
      if (scene.scanned && !S.wasScanned) {
        engine.swingViewProp('scanner', 0.6);
        sfx.play('scan');
        fx.sparkles(pet.position.clone().setY(1.3), 12);
      }
      if (scene.stage === 'payment') {
        if (!S.counterMoneyMesh) {
          S.counterMoneyMesh = makeCounterMoneyMesh();
          world.root.add(S.counterMoneyMesh);
          engine.input.pickables.push(S.counterMoneyMesh);
          fx.sparkles(new THREE.Vector3(0.48, 1.2, -3.85), 14);
        }
        engine.setViewProp('money', null);
        engine.setViewProp('scanner', scannerProp());
      } else if (scene.stage === 'money_held') {
        if (S.counterMoneyMesh) {
          world.root.remove(S.counterMoneyMesh);
          S.counterMoneyMesh = null;
        }
        engine.setViewProp('money', moneyProp());
        engine.setViewProp('scanner', null);
        engine.swingViewProp('money', 0.7);
        sfx.play('unlock_sticker');
      } else {
        if (S.counterMoneyMesh) {
          world.root.remove(S.counterMoneyMesh);
          S.counterMoneyMesh = null;
        }
        engine.setViewProp('money', null);
        engine.setViewProp('scanner', scannerProp());
      }

      if (scene.stage === 'sold' && S.lastShopStage !== 'sold') {
        engine.setViewProp('receipt', receiptProp());
        setTimeout(() => engine.setViewProp('receipt', null), 4200);
      }
      if (scene.stage !== 'sold' || scene.customerCount !== S.lastShopCount) engine.setViewProp('receipt', null);

      if ((scene.customerServed || 0) !== S.servedCount) {
        S.servedCount = scene.customerServed || 0;
      }
      S.wasScanned = !!scene.scanned;
      S.lastShopStage = scene.stage; S.lastShopCount = scene.customerCount;
    } else if (S.counterMoneyMesh) {
      world.root.remove(S.counterMoneyMesh);
      S.counterMoneyMesh = null;
    }
    el.loc.querySelector('.ic').textContent = LOC_EMOJI[w.location] || '✨';
    el.loc.querySelector('.lbl').textContent = w.label || '';
    el.rail.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.scene === (res.scene === 'home' ? w.location : res.scene)));
    setPetMood(res.pet.mood);
    petAction(res.pet.action);
    petEmote(MOOD_EMOTE[res.pet.mood]);
    // after serving, walk back to the dining area so every table is in view again
    if (res.sceneState?.workflow === 'table-service' && res.sceneState.stage === 'returned' && S.lastStage !== 'returned') {
      S.stage = 'returned';
      engine.cam.focus = { center: new THREE.Vector3(0, 1.1, -3.2), dist: 9.6, pitch: 0.42, until: engine.time + 6 };
      S.walkTarget = new THREE.Vector3(0, 0, -1.6);
      fx.ring(S.walkTarget, '#ffffff');
    }
    S.lastStage = res.sceneState?.stage || null;
    const events = res.events || [];
    fx.playEvents(events, { petPos: pet.position.clone(), focusPos, audiencePositions: world.audiencePositions() });
    if (events.includes('applause') || events.includes('applause_soft')) world.clap();
    if (events.includes('confetti')) engine.shake(0.08);
    sfx.playEvents(events);
    if (res.recast) { el.recast.classList.remove('hidden'); el.recast.innerHTML = `${esc(L('trySaying'))}: <b>${esc(res.recast)}</b>`; } else el.recast.classList.add('hidden');
    setChips(res.suggestions, false);
    renderQuest(res.quest);
    if (typeof res.stickerCount === 'number' && !(res.rewards || []).length) setStickerCount(res.stickerCount);
    if (res.sceneChanged && navigator.vibrate) navigator.vibrate(30);
    const items = normItems(res);
    if (items[0]) { showLine(items[0]); setSpeaker(items[0]); }   // show the newest line immediately
    const speakP = speakItems(items);
    if ((res.rewards || []).length) { await sleep(600); showRewards(res.rewards); if (typeof res.stickerCount === 'number') setTimeout(() => setStickerCount(res.stickerCount), 1200 * res.rewards.length); }
    await speakP;
  }
  if (window.__fw) window.__fw.isBusy = () => !!(S.busy || S.speaking);
  if (window.__fw) window.__fw.playState = () => ({ sceneState: S.sceneState, location: S.world && S.world.location, speaker: S.speakerKey, stage: S.sceneState && S.sceneState.stage });
  function setSpeaker(item) {
    if (!item) { S.speakerKey = null; world.setSpeaking(null); pet.setSpeaking(false); setBubble3d(''); return; }
    if (item.who === 'pet') { S.speakerKey = '__pet'; world.setSpeaking(null); pet.setSpeaking(true); }
    else {
      S.speakerKey = item.key || item.name; world.setSpeaking(S.speakerKey); pet.setSpeaking(false);
      const a = world.findActor(S.speakerKey);
      if (a) {
        // in the shop we have our own behind-the-counter camera; elsewhere frame the conversation
        if (S.world?.location !== 'shop') engine.frame([pet.position.clone(), a.g.position.clone()], { seconds: 4 });
        pet.faceToward(Math.atan2(a.g.position.x - pet.position.x, a.g.position.z - pet.position.z));
      }
    }
  }
  async function speakItems(items) {
    const token = (S.speakToken = (S.speakToken || 0) + 1);   // a newer response silences an older one
    speech.abort(); // never listen while someone talks (avoids echo)
    S.speaking = true; setMicState(); sfx.duck(true);
    const petItems = items.filter((i) => i.who === 'pet'); const lastPet = petItems[petItems.length - 1];
    if (items[0]) { showLine(items[0]); setSpeaker(items[0]); }
    let current = items[0];
    const ttsOn = speech.ttsSupported && !speech.muted && !S.muted;
    if (ttsOn) {
      await speech.speakAll(items.map((i) => ({ text: i.text, who: i.who === 'pet' ? 'pet' : (i.key === 'doctor' ? 'doctor' : 'char'), name: i.name, key: i.key })), lang, {
        onStart: (item) => { if (S.destroyed) return; if (item !== current) { finishTyper(); showLine(item); current = item; } setSpeaker(item); },
        onBoundary: (item, charIndex) => { if (!S.destroyed) pullTyper(charIndex); },
        onEnd: () => finishTyper(),
      });
    } else {
      // no voice on this device (or sound is off): still let each line be "spoken" for as long as it
      // takes to read, so the character's mouth moves and the child can follow who is talking
      for (const item of items) {
        if (S.destroyed || token !== S.speakToken) return;
        if (item !== current) { finishTyper(); current = item; }
        showLine(item); setSpeaker(item);
        await sleep(clamp(700 + (item.text || '').length * 38, 900, 4200));
      }
      finishTyper();
    }
    if (S.destroyed || token !== S.speakToken) return;
    setSpeaker(null);
    if (lastPet) showLine(lastPet, { instant: true });
    setBubble3d('');
    S.speaking = false; setMicState(); sfx.duck(false);
    if (S.voiceControlActive && speech.supported && !S.muted && !S.paused) {
      setTimeout(startListening, 300);
    } else if (S.autoListen && speech.supported && !S.muted && !S.paused) {
      startListening();
    }
    armSilence();
  }

  // ---------- turns ----------
  function showHeard(text, corrected) {
    if (!text) { S.heardHtml = ''; el.transcript.classList.add('hidden'); return; }
    let html = `<span class="k">${esc(L('youSaid'))}</span> “${esc(text)}”`;
    if (corrected && corrected.length) html += ` <span class="fix">✨ ${esc(L('iThinkYouMeant'))}: ${corrected.map((c) => `<b>${esc(c.to)}</b>`).join(', ')}</span>`;
    S.heardHtml = html; el.transcript.innerHTML = html; el.transcript.className = 'heard-chip heard'; el.transcript.classList.remove('hidden');
  }
  async function send(text, source) {
    if (S.busy || S.destroyed) return;
    if (source !== 'silence') { S.silenceCount = 0; clearSilence(); }
    speech.cancel(); speech.abort();
    S.busy = true; S.speaking = false; setMicState();
    if (text) { showHeard(text); pet.setMood('thinking'); }
    else el.transcript.classList.add('hidden');
    try {
      const res = await api.say(S.sessionId, text, source, { childId: S.child?.id, lang, location: S.world?.location });
      S.busy = false; setMicState();
      if (text) showHeard(text, res.corrected);
      await applyResponse(res);
    } catch (e) {
      console.error('turn failed:', e);
      S.busy = false; setMicState();
      if (e.data?.expired) { await startSession(); } else toast(e.message || 'Oops');
      armSilence();
    }
  }
  async function startSession() {
    clearSilence(); S.busy = true; setMicState();
    try {
      const data = await api.startSession(S.child?.id, lang);
      S.sessionId = data.sessionId;
      if (data.child) S.child = data.child;
      S.busy = false; setMicState();
      await applyResponse(data.response);
    } catch (e) {
      console.warn('startSession fallback:', e);
      S.busy = false; setMicState();
      await applyResponse({
        sceneChanged: false,
        world: { location: 'home', time: 'day', weather: 'clear', colors: {} },
        pet: { mood: 'happy', action: 'wave' },
        reply: { who: 'pet', text: lang === 'bn' ? 'হ্যালো! আমি মোমো! চলো খেলি!' : 'Hello! I am Momo! Let us play!' },
        items: [{ who: 'pet', text: lang === 'bn' ? 'হ্যালো! আমি মোমো! চলো খেলি!' : 'Hello! I am Momo! Let us play!' }]
      });
    }
  }
  async function switchScene(scene) {
    if (S.busy) return;
    closePlacesModal();
    sfx.play('click'); S.silenceCount = 0; clearSilence(); speech.cancel(); speech.abort();
    S.busy = true; setMicState();
    try {
      const res = await api.scene(S.sessionId, scene, { childId: S.child?.id, lang });
      S.busy = false; setMicState();
      await applyResponse(res);
    } catch (e) {
      console.warn('switchScene fallback:', e);
      S.busy = false; setMicState();
      await applyResponse({
        sceneChanged: true,
        world: { location: scene, time: 'day', weather: 'clear', colors: {} },
        pet: { mood: 'excited', action: 'bounce' },
        reply: { who: 'pet', text: lang === 'bn' ? `চলো ${scene} এ যাই!` : `Let's go to ${scene}!` },
        items: [{ who: 'pet', text: lang === 'bn' ? `চলো ${scene} এ যাই!` : `Let's go to ${scene}!` }]
      });
    }
  }

  // ---------- Places Modal & Voice HUD helpers ----------
  function openPlacesModal() {
    clearSilence();
    el.placesModal?.classList.remove('hidden');
    sfx.play('click');
  }
  function closePlacesModal() {
    el.placesModal?.classList.add('hidden');
    armSilence();
  }
  function showVoiceBadge(label) {
    if (!el.voiceBadge) return;
    el.voiceBadge.textContent = '🎙️ ' + label;
    el.voiceBadge.classList.remove('hidden', 'pop');
    void el.voiceBadge.offsetWidth;
    el.voiceBadge.classList.add('pop');
    sfx.play('pop');
    setTimeout(() => {
      el.voiceBadge?.classList.add('hidden');
      el.voiceBadge?.classList.remove('pop');
    }, 2400);
  }
  const updateVoiceDisplay = () => {
    if (el.activeVoiceDisplay) {
      const v = speech.activeVoice || speech.pickVoice(lang);
      el.activeVoiceDisplay.textContent = v ? `${v.name}` : (lang === 'bn' ? 'বাংলা গল্প বলা কণ্ঠ' : 'Warm Female Storyteller');
    }
  };

  // ---------- Full Voice Control Engine ----------
  function handleVoiceCommand(raw) {
    if (!raw) return false;
    const t = raw.trim().toLowerCase();

    // 1. Places & Scenes navigation
    if (/restaurant|resturant|food|kitchen|cafe|রেস্টুরেন্ট|খাবার|রান্নাঘর/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'রেস্টুরেন্টে যাচ্ছি 🍽️' : 'Going to Restaurant 🍽️');
      switchScene('restaurant');
      return true;
    }
    if (/\bshop\b|store|supermarket|market|দোকান|কেনাকাটা/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'দোকানে যাচ্ছি 🛍️' : 'Going to Shop 🛍️');
      switchScene('shop');
      return true;
    }
    if (/hospital|doctor|clinic|sick|ডাক্তার|হাসপাতাল|অসুস্থ/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'ডাক্তারের কাছে যাচ্ছি 🩺' : 'Going to Doctor 🩺');
      switchScene('hospital');
      return true;
    }
    if (/stage|theater|theatre|concert|show|sing|মঞ্চ|গান/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'মঞ্চে যাচ্ছি 🎭' : 'Going to Stage 🎭');
      switchScene('stage');
      return true;
    }
    if (/(^|\s)(home|house)(\s|$)|বাড়ি|বাসা/i.test(t) && !/homework/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'বাড়ি যাচ্ছি 🏠' : 'Going Home 🏠');
      switchScene('home');
      return true;
    }
    if (/help my pet|emergency|সাহায্য/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'সাহায্য করছি 🆘' : 'Help My Pet 🆘');
      switchScene('emergency');
      return true;
    }
    if (/create|my world|build world|sandbox|নিজের জগৎ/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'নিজের জগৎ 🌈' : 'Our World 🌈');
      switchScene('create');
      return true;
    }
    if (/park|garden|পার্ক|বাগান/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'পার্কে যাচ্ছি 🌳' : 'Going to Park 🌳');
      switchScene('park');
      return true;
    }
    if (/beach|ocean|sea\b|সমুদ্র/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'সমুদ্রে যাচ্ছি 🏖️' : 'Going to Beach 🏖️');
      switchScene('beach');
      return true;
    }
    if (/space|rocket|moon|stars|মহাকাশ/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'মহাকাশে যাচ্ছি 🚀' : 'Going to Space 🚀');
      switchScene('space');
      return true;
    }

    // 2. 3-bar / 3-dot Menu commands
    if (/open menu|show menu|\bmenu\b|show places|\bplaces\b|three bars|three dots|3 bar|3 dot|মেনু|স্থান/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'স্থানসমূহ মেনু 🗺️' : 'Opening Places 🗺️');
      openPlacesModal();
      return true;
    }
    if (/close menu|hide menu|close places|hide places|মেনু বন্ধ/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'মেনু বন্ধ ✕' : 'Closing Menu ✕');
      closePlacesModal();
      return true;
    }

    // 3. Camera / Zoom / Movement Controls
    if (/zoom in|closer|get closer|কাছে আসো|কাছে দেখো|জুম ইন/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'কাছে দেখা ➕' : 'Zoom In ➕');
      engine.zoomIn();
      sfx.play('click');
      return true;
    }
    if (/zoom out|further|step back|দূরে যাও|দূরে দেখো|জুম আউট/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'দূরে দেখা ➖' : 'Zoom Out ➖');
      engine.zoomOut();
      sfx.play('click');
      return true;
    }
    if (/turn left|look left|rotate left|বামে তাকাও|বামে ঘুরো/i.test(t)) {
      showVoiceBadge('↺ Turn Left');
      engine.cam.yaw += 0.55;
      return true;
    }
    if (/turn right|look right|rotate right|ডানে তাকাও|ডানে ঘুরো/i.test(t)) {
      showVoiceBadge('↻ Turn Right');
      engine.cam.yaw -= 0.55;
      return true;
    }

    // 4. Pet action controls
    if (/\bjump\b|লাফ/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'লাফ দাও ✨' : 'Jump! ✨');
      petAction('jump'); petEmote('✨');
      return true;
    }
    if (/\bdance\b|নাচ/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'নাচ করো 🎵' : 'Dance! 🎵');
      petAction('dance'); petEmote('🎵');
      return true;
    }
    if (/\bspin\b|ঘোরো/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'ঘোরো 🌀' : 'Spin! 🌀');
      petAction('spin'); petEmote('🌀');
      return true;
    }
    if (/\bcheer\b|yay|hurray|সাবাশ/i.test(t)) {
      showVoiceBadge('🌟 Cheer');
      petAction('cheer'); petEmote('🌟');
      return true;
    }
    if (/\bsleep\b|take a nap|ঘুমাও/i.test(t)) {
      showVoiceBadge(lang === 'bn' ? 'ঘুমাও 💤' : 'Sleep 💤');
      petAction('sleep'); petEmote('💤');
      return true;
    }

    // 5. In-scene jobs via voice
    if (S.world?.location === 'shop' && /scan|beep|স্ক্যান/i.test(t)) {
      showVoiceBadge('📟 Scan Item');
      engine.swingViewProp('scanner', 0.6); sfx.play('scan'); fx.sparkles(new THREE.Vector3(0.5, 1.2, -3.6), 10);
      send('Scan it', 'voice');
      return true;
    }

    // 6. UI controls
    if (/\bhint\b|give me a hint|সাহায্য|আইডিয়া/i.test(t)) {
      showVoiceBadge('💡 Hint');
      $('hintBtn').click();
      return true;
    }
    if (/sticker book|stickers|stars|স্টিকার/i.test(t)) {
      showVoiceBadge('⭐ Sticker Book');
      openStickerBook();
      return true;
    }
    if (/close stickers|close sticker/i.test(t)) {
      showVoiceBadge('✕ Close');
      $('closeStickers').click();
      return true;
    }
    if (/^mute$|turn off sound|sound off|শব্দ বন্ধ/i.test(t)) {
      showVoiceBadge('🔇 Muted');
      setSound(false);
      return true;
    }
    if (/^unmute$|turn on sound|sound on|শব্দ চালু/i.test(t)) {
      showVoiceBadge('🔊 Unmuted');
      setSound(true);
      return true;
    }
    if (/^pause$|pause game|থামো/i.test(t)) {
      showVoiceBadge('⏸ Paused');
      pause(true);
      return true;
    }
    if (/^resume$|continue|চালিয়ে যাও/i.test(t)) {
      showVoiceBadge('▶ Resumed');
      pause(false);
      return true;
    }
    if (/^repeat$|^replay$|say again|আবার বলো/i.test(t)) {
      showVoiceBadge('🔁 Replaying');
      if (S.last && !S.busy) speakItems(normItems(S.last));
      return true;
    }

    return false;
  }

  // ---------- speech input ----------
  function startListening() {
    if (!speech.supported) {
      showTypebox(true, lang === 'bn' ? 'মাইক্রোফোন পাওয়া যায়নি — এখানে লিখে বলতে পারো:' : 'Microphone unavailable — type your words here:');
      toast(L('noMic'));
      return;
    }
    if (S.busy || S.speaking || S.paused) return;
    clearSilence();
    if (speech.start()) sfx.play('listen_on');
  }
  speech.onStateChange = (on) => {
    S.listening = on;
    setMicState();
    if (!on && el.transcript.classList.contains('live')) {
      if (S.heardHtml) {
        el.transcript.innerHTML = S.heardHtml;
        el.transcript.className = 'heard-chip heard';
      } else {
        el.transcript.classList.add('hidden');
      }
    }
    // Hands-free continuous voice control loop: restart if idle
    if (!on && S.voiceControlActive && !S.busy && !S.speaking && !S.paused && !S.destroyed) {
      setTimeout(() => {
        if (!S.listening && S.voiceControlActive && !S.busy && !S.speaking && !S.paused && !S.destroyed) {
          startListening();
        }
      }, 320);
    } else if (!on && !S.busy && !S.speaking) {
      armSilence();
    }
  };
  speech.onInterim = (txt) => {
    if (!txt) return;
    el.transcript.innerHTML = `🎤 “${esc(txt)}”`;
    el.transcript.className = 'heard-chip live';
    el.transcript.classList.remove('hidden');
  };
  speech.onFinal = (txt, info) => {
    if (txt) {
      sfx.play('listen_off');
      if (handleVoiceCommand(txt)) {
        if (S.voiceControlActive && !S.busy && !S.speaking && !S.paused && !S.destroyed) {
          setTimeout(startListening, 380);
        }
        return;
      }
      send(txt, 'voice');
    } else if (info.noSpeech) {
      el.transcript.classList.add('hidden');
      if (S.voiceControlActive && !S.busy && !S.speaking && !S.paused && !S.destroyed) {
        setTimeout(startListening, 300);
      } else {
        armSilence();
      }
    }
  };
  speech.onError = (err) => {
    if (err === 'not-allowed' || err === 'service-not-allowed') {
      S.autoListen = false;
      S.voiceControlActive = false;
      el.autoBtn?.classList.remove('on');
      toast(L('micDenied'));
      showTypebox(true, lang === 'bn' ? 'মাইক্রোফোনের অনুমতি মেলেনি — এখানে লিখে বলতে পারো:' : 'Microphone access denied — type your words here:');
    }
    else if (err === 'network') toast('Speech service needs internet in this browser.');
    else if (err !== 'aborted') toast('Mic: ' + err);
  };

  // ---------- wiring ----------
  if (el.zoomIn) el.zoomIn.addEventListener('click', () => { sfx.play('click'); engine.zoomIn(); });
  if (el.zoomOut) el.zoomOut.addEventListener('click', () => { sfx.play('click'); engine.zoomOut(); });
  if (el.placesBtn) el.placesBtn.addEventListener('click', openPlacesModal);
  if (el.placesCloseBtn) el.placesCloseBtn.addEventListener('click', closePlacesModal);
  if (el.placesModal) {
    el.placesModal.addEventListener('click', (e) => {
      if (e.target === el.placesModal) closePlacesModal();
    });
  }
  if (el.voiceToggleBtn) {
    el.voiceToggleBtn.addEventListener('click', () => {
      sfx.play('click');
      S.voiceControlActive = !S.voiceControlActive;
      setMicState();
      if (S.voiceControlActive) {
        startListening();
        toast(lang === 'bn' ? '🎙️ ভয়েস কন্ট্রোল চালু' : '🎙️ Voice Control Active (Always Listening)');
      } else {
        speech.abort();
        toast(lang === 'bn' ? 'ভয়েস কন্ট্রোল বন্ধ' : 'Voice Control Paused (Tap Mic to Talk)');
      }
    });
  }
  if (el.testVoiceBtn) {
    el.testVoiceBtn.addEventListener('click', () => {
      speech.testWarmVoice(lang);
    });
  }
  if (el.setVoiceControl) {
    el.setVoiceControl.checked = S.voiceControlActive;
    el.setVoiceControl.addEventListener('change', (e) => {
      S.voiceControlActive = e.target.checked;
      setMicState();
      if (S.voiceControlActive) startListening();
      else speech.abort();
    });
  }
  el.mic.addEventListener('click', () => { if (S.listening) { speech.stop(); return; } if (S.speaking) { speech.cancel(); return; } startListening(); });
  const showTypebox = (on, msg = '') => {
    el.typebox.classList.toggle('hidden', !on);
    const note = $('typeboxNote');
    if (note && msg) note.textContent = msg;
    $('typeBtn')?.classList.toggle('hidden', !on);
    $('typeBtn')?.classList.toggle('on', on);
    if (on) el.typeInput.focus();
  };
  $('typeBtn').addEventListener('click', () => { sfx.play('click'); showTypebox(el.typebox.classList.contains('hidden')); });
  const sendTyped = () => { const v = el.typeInput.value.trim(); if (!v) return; el.typeInput.value = ''; send(v, 'typed'); };
  $('sendBtn').addEventListener('click', sendTyped);
  el.typeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendTyped(); e.stopPropagation(); });
  el.typeInput.addEventListener('focus', clearSilence);
  $('hintBtn').addEventListener('click', () => {
    sfx.play('click');
    setPetMood('thinking'); pet.play('sway'); petEmote('💭');
    const hints = S.last?.suggestions || S.suggestions || [];
    const hint = hints[0];
    const text = hint
      ? (lang === 'bn' ? `তুমি বলতে পারো: ${hint}` : `You can say: ${hint}`)
      : (lang === 'bn' ? 'তোমার যা খুশি বলো, আমি শুনছি!' : 'Say anything you like, I am listening!');
    showLine({ who: 'pet', text });
    speakItems([{ who: 'pet', text }]);
  });
  const saveAuto = () => api.updateChild(S.child.id, { settings: { autoListen: S.autoListen } }).catch(() => {});
  el.autoBtn.addEventListener('click', () => { S.autoListen = !S.autoListen; el.autoBtn.classList.toggle('on', S.autoListen); $('setAuto').checked = S.autoListen; saveAuto(); });
  $('setAuto').addEventListener('change', (e) => { S.autoListen = e.target.checked; el.autoBtn.classList.toggle('on', S.autoListen); saveAuto(); });
  const setSound = (on) => { S.muted = !on; speech.muted = !on; sfx.setEnabled(on); el.soundBtn.textContent = on ? '🔊' : '🔇'; $('setSound').checked = on; if (!on) speech.cancel(); };
  el.soundBtn.addEventListener('click', () => setSound(S.muted));
  $('setSound').addEventListener('change', (e) => setSound(e.target.checked));
  $('setAmb').addEventListener('change', (e) => sfx.setAmbience(e.target.checked));
  const pause = (on) => {
    S.paused = on;
    el.pauseMenu.classList.toggle('hidden', !on);
    if (on) {
      clearSilence(); speech.cancel(); speech.abort();
      updateVoiceDisplay();
    } else {
      armSilence();
      if (S.voiceControlActive) setTimeout(startListening, 300);
    }
  };
  $('settingsBtn').addEventListener('click', () => { sfx.play('click'); pause(true); });
  $('resumeBtn').addEventListener('click', () => { sfx.play('click'); pause(false); });
  el.pauseMenu.addEventListener('click', (e) => { if (e.target === el.pauseMenu) pause(false); });
  $('stickerBtn').addEventListener('click', () => { sfx.play('click'); openStickerBook(); });
  $('closeStickers').addEventListener('click', () => { el.stickerBook.classList.add('hidden'); armSilence(); });
  el.stickerBook.addEventListener('click', (e) => { if (e.target === el.stickerBook) { el.stickerBook.classList.add('hidden'); armSilence(); } });
  $('parentLink').addEventListener('click', () => { el.pauseMenu.classList.add('hidden'); S.paused = true; clearSilence(); speech.cancel(); speech.abort(); openParent(S.child.id, () => { if (S.destroyed) return; S.paused = false; armSilence(); }); });
  $('replayBtn').addEventListener('click', () => { if (S.last && !S.busy) speakItems(normItems(S.last)); });
  el.questPill.addEventListener('click', () => { sfx.play('quest'); el.questCard.classList.toggle('hidden'); });
  $('qcClose').addEventListener('click', () => el.questCard.classList.add('hidden'));
  $('quitBtn').addEventListener('click', async () => { await endSession(); navigate('#/'); });
  $('switchBtn').addEventListener('click', async () => { await endSession(); navigate('#/select'); });
  el.rail.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => switchScene(b.dataset.scene)));
  hud.querySelectorAll('.lang-toggle button').forEach((b) => b.addEventListener('click', async () => {
    if (b.dataset.lang === lang) return;
    speech.setLang(b.dataset.lang);
    await api.updateChild(S.child.id, { lang: b.dataset.lang }).catch(() => {});
    await endSession();
    remount();
  }));
  const onKey = (e) => {
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); el.mic.click(); }
    else if (e.code === 'Escape') {
      if (el.placesModal && !el.placesModal.classList.contains('hidden')) closePlacesModal();
      else pause(!S.paused);
    }
    else if (e.code === 'KeyM') {
      if (el.placesModal?.classList.contains('hidden')) openPlacesModal();
      else closePlacesModal();
    }
    else if (e.code === 'Enter') showTypebox(true);
  };
  window.addEventListener('keydown', onKey);

  // tap-to-walk / tap characters
  // walk to a spot BESIDE a table/window — always to the side of the camera→target line, so the
  // pet never stands between the camera and the guest (children need to SEE the customer).
  // In the shop we are the shopkeeper behind the counter: taps do jobs, we do not walk away.
  function shopTap(hit) {
    const p = hit.pick || hit.data || {};
    const d = hit.data || {};
    const st = S.sceneState || {};

    // 1. Tapped the counter money (placed on counter by customer)
    if (p.kind === 'counter_money' || /money/i.test(p.name || '')) {
      sfx.play('unlock_sticker');
      fx.sparkles(new THREE.Vector3(0.48, 1.2, -3.85), 14);
      if (S.counterMoneyMesh) {
        world.root.remove(S.counterMoneyMesh);
        S.counterMoneyMesh = null;
      }
      engine.setViewProp('money', moneyProp());
      engine.setViewProp('scanner', null);
      send('Take the money', 'tap').catch(() => {});
      return;
    }

    // 2. Tapped the laptop / cash register box on the desk
    const isDeskCash = p.kind === 'cashbox'
      || /cash|register|laptop|drawer|box/i.test(p.name || '')
      || (hit.point && hit.point.z < -3.8 && hit.point.z > -5.2 && hit.point.x < 0.2 && hit.point.x > -3.2);

    if (isDeskCash) {
      if (st.stage === 'payment' || st.stage === 'money_held') {
        sfx.play('unlock_sticker');
        fx.sparkles(new THREE.Vector3(-1.75, 1.35, -4.4), 22);
        fx.sparkles(new THREE.Vector3(0.48, 1.2, -3.85), 16);
        if (S.counterMoneyMesh) {
          world.root.remove(S.counterMoneyMesh);
          S.counterMoneyMesh = null;
        }
        engine.setViewProp('money', null);
        engine.setViewProp('scanner', scannerProp());
        if (st.stage === 'payment') {
          send('Take the money', 'tap').then(() => send('Put in box', 'tap')).catch(() => {});
        } else {
          send('Put in box', 'tap').catch(() => {});
        }
        return;
      }
      if (st.stage === 'change_needed') {
        sfx.play('unlock_sticker');
        fx.sparkles(new THREE.Vector3(-1.75, 1.35, -4.4), 16);
        send('Give change', 'tap').catch(() => {});
        return;
      }
      if (st.stage === 'sold' || st.changeDue === 0) {
        // Offer change when not needed: customer politely refuses
        send('Give change', 'tap').catch(() => {});
        return;
      }
    }

    // 3. Tapped customer
    if (hit.kind === 'character' && (d.role === 'customer' || p.role === 'customer')) {
      if (st.stage === 'customer_waiting') {
        const hintPrice = (st.tag || 60);
        const promptText = lang === 'bn'
          ? `ক্রেতাকে দাম বলো! মুখে বলো: ${hintPrice} টাকা`
          : `Tell the customer the price! Say: ${hintPrice} taka`;
        showLine({ who: 'pet', text: promptText });
        speakItems([{ who: 'pet', text: promptText }]);
      } else if (st.stage === 'priced') {
        const promptText = lang === 'bn' ? 'স্ক্যানার দিয়ে জিনিসটা স্ক্যান করো!' : 'Scan the item with the scanner!';
        showLine({ who: 'pet', text: promptText });
        speakItems([{ who: 'pet', text: promptText }]);
      } else if (st.stage === 'payment') {
        const promptText = lang === 'bn' ? 'ক্রেতা কাউন্টারে টাকা রেখেছেন — টাকাতে চাপ দিয়ে হাতে নাও!' : 'The customer placed the money on the counter — tap the money to take it!';
        showLine({ who: 'pet', text: promptText });
        speakItems([{ who: 'pet', text: promptText }]);
      } else if (st.stage === 'money_held') {
        const promptText = lang === 'bn' ? 'ডেস্কের ল্যাপটপ ক্যাশ বক্সে চাপ দিয়ে টাকা রাখো।' : 'Tap the laptop cash box to store the money.';
        showLine({ who: 'pet', text: promptText });
        speakItems([{ who: 'pet', text: promptText }]);
      } else if (st.stage === 'change_needed') {
        const promptText = lang === 'bn' ? `ক্রেতাকে ${st.changeDue} টাকা ফেরত দাও — ক্যাশ বক্সে চাপো!` : `Give the customer ${st.changeDue} taka change — tap the cash box!`;
        showLine({ who: 'pet', text: promptText });
        speakItems([{ who: 'pet', text: promptText }]);
      } else if (st.stage === 'sold') {
        send('Next customer', 'tap').catch(() => {});
      }
      return;
    }
    if (hit.kind === 'character' && (d.role === 'shopkeeper' || hit.key === 'shopkeeper')) {
      const promptText = lang === 'bn' ? 'আমরাই দোকানদার! কাউন্টারের পিছনে দাঁড়িয়ে সেবা দিই।' : 'We are the shopkeepers behind the counter!';
      showLine({ who: 'pet', text: promptText });
      speakItems([{ who: 'pet', text: promptText }]);
      return;
    }

    // 4. Tapped item on counter or scanner
    if (st.stage === 'priced') {
      engine.swingViewProp('scanner', 0.6);
      sfx.play('scan');
      fx.sparkles(new THREE.Vector3(0.3, 1.2, -3.85), 10);
      send('Scan it', 'tap').catch(() => {});
      return;
    }
    if (st.stage === 'customer_waiting') {
      const hintPrice = (st.tag || 60);
      const promptText = lang === 'bn'
        ? `আগে ক্রেতাকে মুখে দাম বলো! যেমন: ${hintPrice} টাকা`
        : `Say the price out loud first! You can say: ${hintPrice} taka`;
      showLine({ who: 'pet', text: promptText });
      speakItems([{ who: 'pet', text: promptText }]);
      return;
    }
    if (st.stage === 'payment') {
      const promptText = lang === 'bn' ? 'কাউন্টার থেকে টাকাতে চাপো!' : 'Tap the money on the counter!';
      showLine({ who: 'pet', text: promptText });
      speakItems([{ who: 'pet', text: promptText }]);
      return;
    }
    if (st.stage === 'money_held') {
      const promptText = lang === 'bn' ? 'ডেস্কের ক্যাশ বক্সে চাপ দিয়ে টাকা রাখো।' : 'Tap the cash box to put the money inside!';
      showLine({ who: 'pet', text: promptText });
      speakItems([{ who: 'pet', text: promptText }]);
      return;
    }
    if (st.stage === 'change_needed') {
      const promptText = lang === 'bn' ? `ক্যাশ বক্সে চাপ দিয়ে ${st.changeDue} টাকা ফেরত দাও।` : `Tap the cash box to give ${st.changeDue} taka change.`;
      showLine({ who: 'pet', text: promptText });
      speakItems([{ who: 'pet', text: promptText }]);
      return;
    }
    if (st.stage === 'sold') {
      send('Next customer', 'tap').catch(() => {});
      return;
    }
  }
  const goTo = (pos, stopAt = 1.9, sideSign = 1) => {
    const camToTarget = pos.clone().sub(engine.camera.position).setY(0);
    if (camToTarget.lengthSq() < 0.0001) camToTarget.set(0, 0, 1);
    camToTarget.normalize();
    // perpendicular in the ground plane, swung toward whichever side the pet already is
    const perp = new THREE.Vector3(-camToTarget.z, 0, camToTarget.x);
    const petSide = pet.position.clone().sub(pos).setY(0);
    const sign = perp.dot(petSide) >= 0 ? 1 : -1;
    S.walkTarget = pos.clone().add(perp.multiplyScalar(stopAt * sideSign * sign));
    bounds(S.walkTarget);
    fx.ring(S.walkTarget, '#ffffff');
  };
  // In the restaurant the child and the pet serve tables: click a table to hear the guest's
  // order (camera zooms in on them), click the chef's window to walk up and tell the chef.
  let lastTap = { t: 0, name: '' };
  // the food word the seated guest actually ordered (used when the player tells the chef)
  const orderedFood = () => {
    const st = S.sceneState || {};
    const key = st.customerOrder;
    const NAMES = { rice: ['rice', 'ভাত'], chicken: ['chicken', 'মুরগি'], burger: ['burger', 'বার্গার'], pizza: ['pizza', 'পিৎজা'], noodles: ['noodles', 'নুডলস'], juice: ['juice', 'জুস'], biryani: ['biryani', 'বিরিয়ানি'], icecream: ['ice cream', 'icecream'], cake: ['cake', 'কেক'], fish: ['fish', 'মাছ'], soup: ['soup', 'স্যুপ'] };
    const pair = NAMES[key] || [key || 'rice'];
    return lang === 'bn' ? pair[1] || pair[0] : pair[0];
  };
  const restaurantTap = (p) => {
    if (S.world?.location !== 'restaurant') return false;
    const name = String(p.name || '');
    const tableMatch = /^Table\s*(\d)/i.exec(name);
    const isWindow = /chef window/i.test(name);
    if (!tableMatch && !isWindow) return false;
    const now = performance.now();
    if (now - lastTap.t < 600 && lastTap.name === name) return true; // ignore accidental double taps
    lastTap = { t: now, name };
    engine.cam.focus = { center: new THREE.Vector3(), dist: 6.6, pitch: 0.5, until: engine.time + 6 };
    const obj = world.actors.get(p.id) || world.actors.get('o' + p.id) || world.actors.get('c' + p.id);
    if (obj) {
      goTo(obj.g.position.clone(), isWindow ? 2.0 : 2.5, 1);
      // frame the guest/chef AND the serving pet together
      // keep the guest in the middle of the frame and the serving pet beside them
      const mid = obj.g.position.clone().lerp(S.walkTarget || obj.g.position, 0.18);
      engine.cam.focus.center = mid.setY(isWindow ? 1.4 : 0.85);
      engine.cam.focus.dist = isWindow ? 5.4 : 6.6;
      engine.cam.focus.pitch = isWindow ? 0.3 : 0.42;
    }
    else if (isWindow) { engine.cam.focus.center = new THREE.Vector3(0, 1.5, -6.4); }
    if (isWindow) {
      petEmote('🧑‍🍳');
      const st = S.sceneState || {};
      S.walkTarget = new THREE.Vector3((S.walkTarget?.x ?? 0) * 0.25, 0, -5.4);
      fx.sparkles(new THREE.Vector3(0, 1.3, -6.3), 8);

      if (st.workflow === 'table-service' && (st.stage === 'at_chef' || st.stage === 'chef_mismatch')) {
        const dish = orderedFood();
        const promptText = lang === 'bn'
          ? `শেফকে অতিথির অর্ডার বলো! মুখে বলো: ${dish}`
          : `Tell Chef Rafi what the guest ordered! Say: ${dish}`;
        showLine({ who: 'pet', text: promptText });
        speakItems([{ who: 'pet', text: promptText }]);
        return true;
      }

      if (st.workflow === 'table-service' && st.stage === 'order_heard') {
        st.stage = 'at_chef';
        const dish = orderedFood();
        const promptText = lang === 'bn'
          ? `শেফের জানালায় এসে গেছি! শেফকে বলো: ${dish}`
          : `We are at the chef's window! Tell Chef Rafi: ${dish}`;
        showLine({ who: 'pet', text: promptText });
        speakItems([{ who: 'pet', text: promptText }]);
        return true;
      }

      const promptText = lang === 'bn' ? 'শেফের জানালা! এখানে এসে অতিথির অর্ডার বলবে।' : "Chef window! Come here and tell the chef each order.";
      showLine({ who: 'pet', text: promptText });
      speakItems([{ who: 'pet', text: promptText }]);
    } else {
      petEmote('👂');
      const tableNum = tableMatch ? tableMatch[1] : '1';
      const promptText = lang === 'bn'
        ? `টেবিল ${tableNum}-এর অতিথিকে অর্ডার জিজ্ঞেস করো! মুখে বলো: আপনি কী খাবেন?`
        : `Ask table ${tableNum} for their order! Say: What would you like?`;
      showLine({ who: 'pet', text: promptText });
      speakItems([{ who: 'pet', text: promptText }]);
    }
    return true;
  };
  engine.input.onTap = (hit) => {
    if (S.paused) return;
    S.tapAt = performance.now();
    if (S.world?.location === 'shop') { shopTap(hit); return; }
    if (hit.kind === 'ground') { S.walkTarget = hit.point.clone(); bounds(S.walkTarget); fx.ring(S.walkTarget, '#ffffff'); return; }
    // forgiving tap: in the restaurant, a tap near a table / the chef window counts even when the
    // ray misses the object (small hands, moving camera)
    if (S.world?.location === 'restaurant' && hit.x != null) {
      let best = null, bestD = 95;
      for (const a of world.actors.values()) {
        const nm = String(a.data?.name || '');
        const isTable = /^Table \d$/.test(nm), isWin = /^Chef window$/.test(nm);
        if (!isTable && !isWin) continue;
        const pr = engine.project(a.g.position.clone().setY(a.g.position.y + (isTable ? 0.35 : 0)));
        if (!pr.visible) continue;
        const d = Math.hypot(pr.x - hit.x, pr.y - hit.y);
        if (d < bestD) { bestD = d; best = { kind: 'object', id: a.data.id, key: isWin ? 'window' : 'table', name: nm }; }
      }
      if (best && restaurantTap(best)) return;
    }
    const p = hit.pick || {};
    if (restaurantTap(p)) return;
    if (p.kind === 'pet') { pet.play('bounce'); fx.hearts(pet.emoteWorld()); sfx.play('pop'); petEmote('💖'); return; }
    const a = world.actors.get(p.id);
    if (a) {
      const pos = a.g.position.clone(); fx.sparkles(pos.clone().setY(pos.y + 1), 10); sfx.play('pop');
      const dir = pos.clone().sub(pet.position); const d = dir.length();
      if (d > 2.2) { dir.multiplyScalar((d - 1.8) / d); S.walkTarget = pet.position.clone().add(dir); bounds(S.walkTarget); }
      if (p.kind === 'character') { pet.play('wave'); petEmote('👋'); }
    }
  };
  // virtual joystick
  (() => {
    const base = el.joy.querySelector('.joy-base'), nub = el.joy.querySelector('.joy-nub'); let id = null, cx = 0, cy = 0;
    const set = (x, y) => { engine.input.joy.x = x; engine.input.joy.y = y; nub.style.transform = `translate(${x * 34}px, ${-y * 34}px)`; };
    base.addEventListener('pointerdown', (e) => { id = e.pointerId; base.setPointerCapture(id); const r = base.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; S.walkTarget = null; });
    base.addEventListener('pointermove', (e) => { if (e.pointerId !== id) return; let x = (e.clientX - cx) / 42, y = -(e.clientY - cy) / 42; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } set(x, y); });
    const end = (e) => { if (e.pointerId !== id) return; id = null; set(0, 0); };
    base.addEventListener('pointerup', end); base.addEventListener('pointercancel', end);
  })();

  // ---------- per-frame: movement, nameplates, bubble ----------
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  function updateTags() {
    const seen = new Set();
    const place = (key, label, pos, cls = '') => {
      seen.add(key);
      let tag = S.tags.get(key);
      if (!tag) { tag = document.createElement('div'); tag.className = 'tag ' + cls; tag.innerHTML = `<b></b><i></i>`; el.tags.appendChild(tag); S.tags.set(key, tag); }
      if (tag.firstChild.textContent !== label) tag.firstChild.textContent = label;
      const pr = engine.project(pos);
      tag.style.display = pr.visible ? '' : 'none';
      if (pr.visible) { tag.style.transform = `translate(-50%,-100%) translate(${pr.x.toFixed(0)}px,${pr.y.toFixed(0)}px)`; tag.style.opacity = pr.depth > 0.993 ? 0.5 : 1; }
      tag.classList.toggle('speaking', S.speakerKey === key);
      return pr;
    };
    pet.headWorld(tmp); tmp.y += 0.55;
    const petPr = place('__pet', S.last?.pet.name || petName, tmp, 'pet');
    for (const a of world.actors.values()) {
      if (a.kind === 'object') continue;
      if (a.named?.head) a.named.head.getWorldPosition(tmp2); else { tmp2.copy(a.g.position); tmp2.y += 1.6; }
      tmp2.y += 0.45;
      const c = a.data; const label = c.role && c.role !== c.name ? `${c.name} · ${c.role}` : c.name;
      place(a.key, label, tmp2, 'char');
    }
    for (const [k, tag] of S.tags) if (!seen.has(k)) { tag.remove(); S.tags.delete(k); }
    // 3D speech bubble above whoever talks
    if (S.bubbleText && S.speakerKey) {
      let pr = null;
      if (S.speakerKey === '__pet') pr = petPr;
      else { const a = world.findActor(S.speakerKey); if (a) { if (a.named?.head) a.named.head.getWorldPosition(tmp2); else { tmp2.copy(a.g.position); tmp2.y += 1.6; } tmp2.y += 0.5; pr = engine.project(tmp2); } }
      if (pr && pr.visible) { el.bubble3d.style.display = ''; el.bubble3d.style.transform = `translate(-50%,-100%) translate(${pr.x.toFixed(0)}px,${(pr.y - 26).toFixed(0)}px)`; }
      else el.bubble3d.style.display = 'none';
    }
  }
  const offFrame = engine.onFrame((dt, time) => {
    if (S.destroyed) return;
    // movement: keys/joystick win over tap target
    let v = S.paused ? null : engine.moveVector();
    // in the shop we are the shopkeeper: we stay behind our counter, only the pet can step out a little
    if (v && S.world?.location === 'shop') {
      const st = S.shopStand; if (st) { const nx = pet.position.x + v.x * WALK_SPEED * dt, nz = pet.position.z + v.z * WALK_SPEED * dt; v = new THREE.Vector3(nx, 0, nz).sub(pet.position); if (new THREE.Vector3(nx - st.x, 0, nz - st.z).length() > 2.2) v = v.clone().multiplyScalar(0); }
    }
    if (v) { S.walkTarget = null; S.tapAt = performance.now(); }
    else if (S.walkTarget) { tmp.copy(S.walkTarget).sub(pet.position); tmp.y = 0; const d = tmp.length(); if (d < 0.25) { S.walkTarget = null; } else { v = tmp.multiplyScalar(Math.min(1, d / 1.2) / d); } }
    if (v && (S.world?.petState === 'sleeping')) v = null;
    if (v) {
      const spd = v.length(); const step = v.clone().multiplyScalar(WALK_SPEED * dt);
      pet.position.add(step); bounds(pet.position);
      pet.setMoving(spd, Math.atan2(v.x, v.z));
    } else pet.setMoving(0, null);
    pet.update(dt);
    world.update(dt, time, pet.position, engine.camera);
    fx.update(dt, time);
    updateTags();
  });

  async function endSession() { clearSilence(); speech.cancel(); speech.abort(); if (S.sessionId) { try { await api.endSession(S.sessionId); } catch {} S.sessionId = null; } }
  const onVis = () => { if (document.hidden) { clearSilence(); speech.cancel(); speech.abort(); } };
  document.addEventListener('visibilitychange', onVis);

  setMicState();
  el.portrait.innerHTML = petSVG({ type: child.petType, mood: 'happy' });
  sfx.startAmbience();
  startSession().catch((e) => toast(e.message));

  return async () => {
    S.destroyed = true; clearSilence(); stopTyper(); speech.cancel(); speech.abort(); sfx.stopAmbience();
    speech.onFinal = speech.onInterim = speech.onStateChange = speech.onError = null;
    document.removeEventListener('visibilitychange', onVis); window.removeEventListener('keydown', onKey);
    engine.input.onTap = null; engine.input.joy.x = engine.input.joy.y = 0; engine.input.pickables = [];
    offFrame(); fx.setWeather(null); fx.setAmbient(null); fx.zzz(null, false);
    if (S.counterMoneyMesh) { try { world.root.remove(S.counterMoneyMesh); } catch {} S.counterMoneyMesh = null; }
    world.reset(); world.setSpeaking(null); engine.scene.remove(pet.group); if (g.pet === pet) g.pet = null; engine.setViewShift(0, 0);
    hud.remove();
    await endSession();
  };
}
