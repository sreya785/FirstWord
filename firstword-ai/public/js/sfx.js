// Synthesised game sound effects + soft ambience with the Web Audio API (no audio files, no downloads).
let ctx = null, master = null, ambGain = null, ambienceNodes = [], enabled = true, ambienceOn = true;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.6; master.connect(ctx.destination);
    ambGain = ctx.createGain(); ambGain.gain.value = 0; ambGain.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

function tone({ freq = 440, type = 'sine', dur = 0.2, vol = 0.3, attack = 0.005, decay, slideTo, delay = 0, pan = 0 }) {
  const c = ac(); if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + (decay || dur));
  let last = g;
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); last = p; }
  o.connect(g); last.connect(master); o.start(t0); o.stop(t0 + (decay || dur) + 0.05);
}

function noise({ dur = 0.3, vol = 0.2, delay = 0, hp = 800, lp = 6000, slideLp }) {
  const c = ac(); if (!c || !enabled) return;
  const t0 = c.currentTime + delay;
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource(); src.buffer = buf;
  const h = c.createBiquadFilter(); h.type = 'highpass'; h.frequency.value = hp;
  const l = c.createBiquadFilter(); l.type = 'lowpass'; l.frequency.setValueAtTime(lp, t0); if (slideLp) l.frequency.exponentialRampToValueAtTime(slideLp, t0 + dur);
  const g = c.createGain(); g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(h); h.connect(l); l.connect(g); g.connect(master); src.start(t0); src.stop(t0 + dur + 0.02);
}

const C5 = 523.25, E5 = 659.25, G5 = 783.99, C6 = 1046.5, A5 = 880, D5 = 587.33, F5 = 698.46;

export const sfx = {
  unlock() { if (ac()) { /* warm up on first gesture */ } },
  setEnabled(on) { enabled = on; if (!on) this.stopAmbience(); else if (ambienceOn) this.startAmbience(); },
  play(name) {
    switch (name) {
      case 'pop': tone({ freq: 600, slideTo: 1200, dur: 0.12, vol: 0.25, type: 'triangle' }); break;
      case 'sparkle': [C6, E5 * 2, G5 * 2].forEach((f, i) => tone({ freq: f, dur: 0.25, vol: 0.12, delay: i * 0.06, type: 'sine' })); break;
      case 'poof': noise({ dur: 0.35, vol: 0.18, hp: 300, lp: 3000, slideLp: 400 }); break;
      case 'swish': noise({ dur: 0.3, vol: 0.15, hp: 600, lp: 8000, slideLp: 1200 }); tone({ freq: 300, slideTo: 900, dur: 0.3, vol: 0.06, type: 'sine' }); break;
      case 'success': [C5, E5, G5, C6].forEach((f, i) => tone({ freq: f, dur: 0.35, vol: 0.18, delay: i * 0.09, type: 'triangle' })); break;
      case 'confetti': [C5, E5, G5, C6, E5 * 2].forEach((f, i) => tone({ freq: f, dur: 0.4, vol: 0.16, delay: i * 0.08, type: 'triangle' })); noise({ dur: 0.5, vol: 0.08, hp: 2000, lp: 9000 }); break;
      case 'hearts': [E5, G5, C6].forEach((f, i) => tone({ freq: f, dur: 0.5, vol: 0.12, delay: i * 0.12, type: 'sine' })); break;
      case 'heal': [G5, C6, E5 * 2, G5 * 2].forEach((f, i) => tone({ freq: f, dur: 0.6, vol: 0.1, delay: i * 0.1, type: 'sine' })); break;
      case 'applause': for (let i = 0; i < 18; i++) noise({ dur: 0.05, vol: 0.12 + Math.random() * 0.08, delay: i * 0.07 + Math.random() * 0.03, hp: 1500, lp: 7000 }); break;
      case 'applause_soft': for (let i = 0; i < 8; i++) noise({ dur: 0.05, vol: 0.08, delay: i * 0.09 + Math.random() * 0.03, hp: 1500, lp: 6000 }); break;
      case 'phone': for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) tone({ freq: i % 2 ? 1200 : 1000, dur: 0.07, vol: 0.12, delay: r * 0.9 + i * 0.07, type: 'square' }); break;
      case 'music': [C5, D5, E5, G5, E5, D5, C5].forEach((f, i) => tone({ freq: f, dur: 0.22, vol: 0.12, delay: i * 0.16, type: 'triangle' })); break;
      case 'spotlight': tone({ freq: 200, slideTo: 800, dur: 0.5, vol: 0.12, type: 'sawtooth' }); break;
      case 'whoosh': noise({ dur: 0.6, vol: 0.2, hp: 200, lp: 6000, slideLp: 300 }); break;
      case 'unlock_sticker': [G5, C6, E5 * 2, G5 * 2, C6 * 2].forEach((f, i) => tone({ freq: f, dur: 0.5, vol: 0.14, delay: i * 0.08, type: 'triangle' })); break;
      case 'quest': [E5, G5].forEach((f, i) => tone({ freq: f, dur: 0.2, vol: 0.12, delay: i * 0.1, type: 'triangle' })); break;
      case 'scan': tone({ freq: 1800, dur: 0.09, vol: 0.16, type: 'square' }); tone({ freq: 2400, dur: 0.07, vol: 0.12, type: 'square', delay: 0.1 }); break;
      case 'click': tone({ freq: 900, slideTo: 700, dur: 0.05, vol: 0.08, type: 'square' }); break;
      case 'listen_on': tone({ freq: 660, dur: 0.1, vol: 0.1 }); tone({ freq: 880, dur: 0.14, vol: 0.1, delay: 0.1 }); break;
      case 'listen_off': tone({ freq: 880, dur: 0.1, vol: 0.08 }); tone({ freq: 660, dur: 0.14, vol: 0.08, delay: 0.1 }); break;
      case 'sad': [E5, D5, C5].forEach((f, i) => tone({ freq: f, dur: 0.35, vol: 0.08, delay: i * 0.18, type: 'sine' })); break;
      case 'jump': tone({ freq: 300, slideTo: 700, dur: 0.18, vol: 0.14, type: 'triangle' }); break;
      case 'bounce': tone({ freq: 250, slideTo: 420, dur: 0.1, vol: 0.1, type: 'triangle' }); break;
      case 'sleep': [A5 / 2, G5 / 2].forEach((f, i) => tone({ freq: f, dur: 0.6, vol: 0.06, delay: i * 0.4, type: 'sine' })); break;
      case 'travel': noise({ dur: 0.8, vol: 0.15, hp: 300, lp: 5000, slideLp: 500 }); [C5, E5, G5].forEach((f, i) => tone({ freq: f, dur: 0.5, vol: 0.1, delay: 0.3 + i * 0.12, type: 'triangle' })); break;
      default: break;
    }
  },
  playEvents(events) { for (const e of events || []) this.play(e); },
  // Very quiet ambient pad so the mic is not disturbed
  startAmbience() {
    const c = ac(); if (!c || !enabled || ambienceNodes.length) return;
    const notes = [130.81, 164.81, 196, 261.63];
    notes.forEach((f, i) => {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + i * 0.013;
      const lg = c.createGain(); lg.gain.value = 0.5; lfo.connect(lg);
      const g = c.createGain(); g.gain.value = 0.5; lg.connect(g.gain);
      o.connect(g); g.connect(ambGain); o.start(); lfo.start();
      ambienceNodes.push(o, lfo);
    });
    ambGain.gain.cancelScheduledValues(c.currentTime); ambGain.gain.setValueAtTime(0, c.currentTime); ambGain.gain.linearRampToValueAtTime(0.045, c.currentTime + 3);
  },
  stopAmbience() {
    const c = ctx; if (!c || !ambienceNodes.length) return;
    ambGain.gain.cancelScheduledValues(c.currentTime); ambGain.gain.setValueAtTime(ambGain.gain.value, c.currentTime); ambGain.gain.linearRampToValueAtTime(0, c.currentTime + 1);
    const nodes = ambienceNodes; ambienceNodes = [];
    setTimeout(() => nodes.forEach((n) => { try { n.stop(); } catch {} }), 1200);
  },
  setAmbience(on) { ambienceOn = on; if (on) this.startAmbience(); else this.stopAmbience(); },
  duck(on) { const c = ctx; if (!c || !ambGain) return; ambGain.gain.cancelScheduledValues(c.currentTime); ambGain.gain.setValueAtTime(ambGain.gain.value, c.currentTime); ambGain.gain.linearRampToValueAtTime(on ? 0.01 : (ambienceNodes.length ? 0.045 : 0), c.currentTime + 0.4); },
};
