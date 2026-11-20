// SVG pet renderer v2: shaded "toy-like" look, animatable parts (ears, tail, arms, eyes, mouth), moods, outfits.
const PAL = {
  cat:   { body: '#cdbcff', light: '#efe7ff', dark: '#8b5cf6', ink: '#5b3fb0', belly: '#f7f3ff', ear: '#ffb3d1', blush: '#ff9ec4' },
  bunny: { body: '#ffd1e4', light: '#fff2f8', dark: '#f06ba6', ink: '#c2417f', belly: '#fff8fb', ear: '#ff9ec4', blush: '#ff8fb8' },
  dino:  { body: '#9ff0b3', light: '#e4ffe9', dark: '#22a95a', ink: '#157a40', belly: '#eafff0', ear: '#58d68d', blush: '#ffb3c6' },
};

const defs = (id, c) => `
  <defs>
    <radialGradient id="${id}-body" cx="38%" cy="30%" r="80%"><stop offset="0" stop-color="${c.light}"/><stop offset="0.45" stop-color="${c.body}"/><stop offset="1" stop-color="${c.dark}"/></radialGradient>
    <radialGradient id="${id}-belly" cx="50%" cy="35%" r="70%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${c.belly}"/></radialGradient>
    <radialGradient id="${id}-ear" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="${c.ear}"/></radialGradient>
    <radialGradient id="${id}-eye" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#4b4068"/><stop offset="1" stop-color="#1b1430"/></radialGradient>
    <linearGradient id="${id}-gloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
  </defs>`;

function ears(type, c, id) {
  if (type === 'cat') return `
    <g class="g-ear-l" style="transform-origin:62px 70px"><path d="M44 74 L36 18 L92 50 Z" fill="url(#${id}-body)" stroke="${c.ink}" stroke-width="3" stroke-linejoin="round"/><path d="M52 64 L47 32 L80 52 Z" fill="url(#${id}-ear)"/></g>
    <g class="g-ear-r" style="transform-origin:138px 70px"><path d="M156 74 L164 18 L108 50 Z" fill="url(#${id}-body)" stroke="${c.ink}" stroke-width="3" stroke-linejoin="round"/><path d="M148 64 L153 32 L120 52 Z" fill="url(#${id}-ear)"/></g>`;
  if (type === 'bunny') return `
    <g class="g-ear-l" style="transform-origin:70px 68px"><ellipse cx="66" cy="28" rx="17" ry="42" fill="url(#${id}-body)" stroke="${c.ink}" stroke-width="3" transform="rotate(-12 66 28)"/><ellipse cx="66" cy="31" rx="8" ry="29" fill="url(#${id}-ear)" transform="rotate(-12 66 31)"/></g>
    <g class="g-ear-r" style="transform-origin:130px 68px"><ellipse cx="134" cy="28" rx="17" ry="42" fill="url(#${id}-body)" stroke="${c.ink}" stroke-width="3" transform="rotate(12 134 28)"/><ellipse cx="134" cy="31" rx="8" ry="29" fill="url(#${id}-ear)" transform="rotate(12 134 31)"/></g>`;
  return `
    <g class="g-ear-l" style="transform-origin:100px 60px"><path d="M58 60 L67 34 L80 58 Z M84 52 L96 24 L108 52 Z M112 56 L124 32 L136 58 Z" fill="${c.ear}" stroke="${c.ink}" stroke-width="3" stroke-linejoin="round"/></g>`;
}

function tail(type, c, id) {
  if (type === 'cat') return `<g class="g-tail" style="transform-origin:160px 150px"><path d="M158 150 Q200 140 192 98 Q188 86 178 92 Q186 128 156 136 Z" fill="url(#${id}-body)" stroke="${c.ink}" stroke-width="3" stroke-linejoin="round"/></g>`;
  if (type === 'bunny') return `<g class="g-tail" style="transform-origin:166px 160px"><circle cx="166" cy="160" r="13" fill="#fff" stroke="${c.ink}" stroke-width="3"/><circle cx="161" cy="155" r="5" fill="#fff" opacity=".9"/></g>`;
  return `<g class="g-tail" style="transform-origin:158px 150px"><path d="M156 142 Q200 150 192 182 Q184 168 160 164 Z" fill="url(#${id}-body)" stroke="${c.ink}" stroke-width="3" stroke-linejoin="round"/></g>`;
}

function eyes(mood, id) {
  const L = { x: 76, y: 104 }, R = { x: 124, y: 104 };
  const open = (p, r = 10) => `<g class="eye"><circle cx="${p.x}" cy="${p.y}" r="${r}" fill="url(#${id}-eye)"/><circle class="pupil-hl" cx="${p.x + r * 0.32}" cy="${p.y - r * 0.32}" r="${r * 0.34}" fill="#fff"/><circle cx="${p.x - r * 0.3}" cy="${p.y + r * 0.35}" r="${r * 0.16}" fill="#fff" opacity=".8"/></g>`;
  const happyClosed = (p) => `<path d="M${p.x - 11} ${p.y + 3} Q${p.x} ${p.y - 10} ${p.x + 11} ${p.y + 3}" stroke="#2b2140" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  const closed = (p) => `<path d="M${p.x - 11} ${p.y} Q${p.x} ${p.y + 7} ${p.x + 11} ${p.y}" stroke="#2b2140" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  const heart = (p) => `<path d="M${p.x} ${p.y + 10} L${p.x - 12} ${p.y - 1} A6.5 6.5 0 0 1 ${p.x} ${p.y - 7} A6.5 6.5 0 0 1 ${p.x + 12} ${p.y - 1} Z" fill="#ff4d6d"><animate attributeName="transform" type="scale" values="1;1.08;1" dur="0.8s" repeatCount="indefinite" additive="sum"/></path>`;
  const swirl = (p) => `<path d="M${p.x} ${p.y} m-9 0 a9 9 0 1 1 9 9 a5.5 5.5 0 1 1 5.5 -5.5 a2.5 2.5 0 1 1 -2.5 -2.5" stroke="#2b2140" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  const brow = (p, dir) => `<path d="M${p.x - 12} ${p.y - 18 + (dir > 0 ? 0 : 5)} L${p.x + 12} ${p.y - 18 + (dir > 0 ? 5 : 0)}" stroke="#2b2140" stroke-width="4" stroke-linecap="round"/>`;
  const tear = (p) => `<path d="M${p.x - 9} ${p.y + 13} q-3 9 0 13 q4 -4 0 -13" fill="#7cc4ff"><animate attributeName="transform" type="translate" values="0 0;0 10" dur="1.2s" repeatCount="indefinite"/></path>`;
  const sparkleEye = (p) => open(p, 11) + `<circle cx="${p.x - 4}" cy="${p.y + 4}" r="2.4" fill="#fff"/>`;
  switch (mood) {
    case 'excited': return `<g class="g-eyes">${sparkleEye(L)}${sparkleEye(R)}</g>`;
    case 'surprised': return `<g class="g-eyes">${open(L, 13)}${open(R, 13)}</g>`;
    case 'sad': return `<g class="g-eyes">${open(L, 9)}${open(R, 9)}</g>${brow(L, -1)}${brow(R, 1)}${tear(L)}`;
    case 'worried': return `<g class="g-eyes">${open(L, 9)}${open(R, 9)}</g>${brow(L, -1)}${brow(R, 1)}`;
    case 'thinking': return `<g class="g-eyes">${open(L, 10)}</g>${closed(R)}${brow(R, -1)}`;
    case 'sleepy': return closed(L) + closed(R);
    case 'proud': case 'relieved': return happyClosed(L) + happyClosed(R);
    case 'love': return heart(L) + heart(R);
    case 'sick': return swirl(L) + swirl(R);
    case 'silly': return `<g class="g-eyes">${open(L, 11)}</g>${happyClosed(R)}`;
    default: return `<g class="g-eyes">${open(L)}${open(R)}</g>`;
  }
}

function mouth(mood) {
  const cx = 100, cy = 130;
  let m;
  switch (mood) {
    case 'excited': case 'proud': m = `<path class="mouth-talk" d="M${cx - 17} ${cy} Q${cx} ${cy + 28} ${cx + 17} ${cy} Z" fill="#6d1b3b"/><path d="M${cx - 9} ${cy + 11} Q${cx} ${cy + 20} ${cx + 9} ${cy + 11} Z" fill="#ff7b9c"/>`; break;
    case 'surprised': m = `<ellipse class="mouth-talk" cx="${cx}" cy="${cy + 9}" rx="9" ry="12" fill="#6d1b3b"/>`; break;
    case 'sad': m = `<path class="mouth-talk" d="M${cx - 12} ${cy + 11} Q${cx} ${cy - 1} ${cx + 12} ${cy + 11}" stroke="#6d1b3b" stroke-width="4.5" fill="none" stroke-linecap="round"/>`; break;
    case 'worried': case 'sick': m = `<path class="mouth-talk" d="M${cx - 13} ${cy + 6} q6.5 -6 13 0 t13 0" stroke="#6d1b3b" stroke-width="4.5" fill="none" stroke-linecap="round"/>`; break;
    case 'thinking': m = `<ellipse class="mouth-talk" cx="${cx + 9}" cy="${cy + 6}" rx="5" ry="6" fill="#6d1b3b"/>`; break;
    case 'sleepy': m = `<ellipse class="mouth-talk" cx="${cx}" cy="${cy + 7}" rx="6" ry="7" fill="#6d1b3b"/>`; break;
    case 'silly': m = `<path d="M${cx - 15} ${cy} Q${cx} ${cy + 19} ${cx + 15} ${cy}" stroke="#6d1b3b" stroke-width="4.5" fill="none" stroke-linecap="round"/><path class="mouth-talk" d="M${cx - 2} ${cy + 8} q7 0 9 11 q-9 6 -11 -4 Z" fill="#ff7b9c"/>`; break;
    case 'love': m = `<path class="mouth-talk" d="M${cx - 15} ${cy} Q${cx} ${cy + 24} ${cx + 15} ${cy} Z" stroke="#6d1b3b" stroke-width="4" fill="#ff7b9c" stroke-linejoin="round"/>`; break;
    default: m = `<path class="mouth-talk" d="M${cx - 15} ${cy} Q${cx} ${cy + 19} ${cx + 15} ${cy}" stroke="#6d1b3b" stroke-width="4.5" fill="none" stroke-linecap="round"/>`;
  }
  return `<g class="g-mouth" style="transform-origin:${cx}px ${cy}px">${m}</g>`;
}

function outfit(kind, c) {
  switch (kind) {
    case 'astronaut': return `<circle cx="100" cy="106" r="74" fill="rgba(186,230,253,0.25)" stroke="#e0f2fe" stroke-width="5"/><path d="M40 106 a60 60 0 0 1 20 -44" stroke="#fff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".8"/><rect x="60" y="168" width="80" height="16" rx="8" fill="#e5e7eb"/>`;
    case 'chef': return `<path d="M62 60 Q60 18 100 22 Q140 18 138 60 L135 70 L65 70 Z" fill="#fff" stroke="#d1d5db" stroke-width="3"/><rect x="62" y="62" width="76" height="14" rx="4" fill="#fff" stroke="#d1d5db" stroke-width="3"/>`;
    case 'party': return `<path d="M100 6 L76 66 L124 66 Z" fill="#ff5d8f" stroke="#c9184a" stroke-width="3"/><path d="M86 42 L114 42 M80 56 L120 56" stroke="#ffd166" stroke-width="5"/><circle cx="100" cy="8" r="8" fill="#ffd166"/>`;
    case 'doctor': return `<rect x="54" y="46" width="92" height="18" rx="9" fill="#fff" stroke="#d1d5db" stroke-width="3"/><rect x="94" y="46" width="12" height="18" fill="#ef4444"/><rect x="91" y="51" width="18" height="8" fill="#ef4444"/>`;
    case 'crown': return `<path d="M62 62 L68 28 L86 48 L100 18 L114 48 L132 28 L138 62 Z" fill="#ffd166" stroke="#e09f3e" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="44" r="5" fill="#ef476f"/><circle cx="78" cy="50" r="3" fill="#06d6a0"/><circle cx="122" cy="50" r="3" fill="#118ab2"/>`;
    case 'bandage': return `<g transform="rotate(-20 118 78)"><rect x="96" y="70" width="46" height="16" rx="7" fill="#fcd9b6" stroke="#f59e0b" stroke-width="2"/><rect x="110" y="72" width="18" height="12" fill="#fde68a"/></g>`;
    case 'pirate': return `<path d="M48 62 Q100 26 152 62 L146 72 L54 72 Z" fill="#1f2937"/><path d="M84 50 L116 50 L116 57 L84 57 Z" fill="#fff"/><circle cx="100" cy="44" r="5" fill="#fff"/><circle cx="124" cy="104" r="13" fill="#1f2937"/><path d="M58 74 L138 94" stroke="#1f2937" stroke-width="3"/>`;
    case 'cape': return `<path d="M38 100 Q26 182 60 192 L100 172 L140 192 Q174 182 162 100 Z" fill="#ef476f" opacity=".92"/><path d="M38 100 Q100 120 162 100" stroke="#c9184a" stroke-width="3" fill="none"/>`;
    case 'police': return `<path d="M56 66 Q100 34 144 66 L144 72 L56 72 Z" fill="#1d4ed8"/><rect x="50" y="70" width="100" height="9" rx="4" fill="#1e3a8a"/><circle cx="100" cy="58" r="5" fill="#ffd166"/>`;
    case 'firefighter': return `<path d="M54 68 Q100 20 146 68 L150 78 L50 78 Z" fill="#ef4444" stroke="#991b1b" stroke-width="3"/><rect x="90" y="48" width="20" height="14" rx="3" fill="#ffd166"/>`;
    case 'glasses': return `<circle cx="76" cy="104" r="16" fill="rgba(255,255,255,.2)" stroke="#2b2140" stroke-width="3"/><circle cx="124" cy="104" r="16" fill="rgba(255,255,255,.2)" stroke="#2b2140" stroke-width="3"/><path d="M92 104 L108 104" stroke="#2b2140" stroke-width="3"/>`;
    case 'wizard': return `<path d="M100 0 L64 70 L136 70 Z" fill="#5a189a" stroke="#3c096c" stroke-width="3"/><path d="M58 70 L142 70" stroke="#3c096c" stroke-width="7"/><circle cx="92" cy="46" r="4" fill="#ffd166"/><circle cx="108" cy="30" r="3" fill="#ffd166"/>`;
    case 'wings': return `<path d="M40 110 Q0 70 30 48 Q52 80 56 102 Z M160 110 Q200 70 170 48 Q148 80 144 102 Z" fill="rgba(255,255,255,0.85)" stroke="#a5f3fc" stroke-width="3"/>`;
    default: return '';
  }
}

let uid = 0;
export function petSVG({ type = 'cat', mood = 'happy', outfit: kind = null, state = 'normal' } = {}) {
  const c = PAL[type] || PAL.cat;
  const id = `p${(uid++ % 1000)}`;
  const effectiveMood = state === 'sleeping' ? 'sleepy' : mood;
  const behind = kind === 'cape' || kind === 'wings' ? outfit(kind, c) : '';
  const front = kind && kind !== 'cape' && kind !== 'wings' ? outfit(kind, c) : '';
  const sickTint = state === 'sick' ? `<ellipse cx="100" cy="120" rx="72" ry="66" fill="#86efac" opacity=".35"/>` : '';
  const whiskers = type === 'cat' ? `<g stroke="${c.ink}" stroke-width="2" stroke-linecap="round" opacity=".7"><path d="M40 118 L62 122 M40 130 L62 128 M160 118 L138 122 M160 130 L138 128"/></g>` : '';
  return `
  <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${type} pet feeling ${effectiveMood}">
    ${defs(id, c)}
    <g class="pet-body">
      ${behind}
      ${tail(type, c, id)}
      ${ears(type, c, id)}
      <g class="g-arm-l" style="transform-origin:46px 128px"><ellipse cx="40" cy="138" rx="12" ry="18" fill="url(#${id}-body)" stroke="${c.ink}" stroke-width="3" transform="rotate(20 40 138)"/></g>
      <g class="g-arm-r" style="transform-origin:154px 128px"><ellipse cx="160" cy="138" rx="12" ry="18" fill="url(#${id}-body)" stroke="${c.ink}" stroke-width="3" transform="rotate(-20 160 138)"/></g>
      <ellipse cx="100" cy="120" rx="72" ry="66" fill="url(#${id}-body)" stroke="${c.ink}" stroke-width="3"/>
      ${sickTint}
      <ellipse cx="100" cy="150" rx="40" ry="28" fill="url(#${id}-belly)" opacity=".95"/>
      <ellipse cx="74" cy="76" rx="26" ry="14" fill="url(#${id}-gloss)" transform="rotate(-20 74 76)"/>
      <ellipse cx="60" cy="124" rx="10" ry="6" fill="${c.blush}" opacity=".75" filter="url(#${id}-soft)"/>
      <ellipse cx="140" cy="124" rx="10" ry="6" fill="${c.blush}" opacity=".75" filter="url(#${id}-soft)"/>
      ${whiskers}
      ${eyes(effectiveMood, id)}
      ${mouth(effectiveMood)}
      <ellipse cx="66" cy="182" rx="17" ry="8" fill="${c.dark}" stroke="${c.ink}" stroke-width="2"/>
      <ellipse cx="134" cy="182" rx="17" ry="8" fill="${c.dark}" stroke="${c.ink}" stroke-width="2"/>
      ${front}
      ${state === 'sick' ? '<path d="M152 78 q5 9 0 14 q-5 -5 0 -14" fill="#7cc4ff"><animate attributeName="transform" type="translate" values="0 0;0 8;0 0" dur="1.4s" repeatCount="indefinite"/></path>' : ''}
    </g>
  </svg>`;
}

export const PET_META = {
  cat: { name: 'Momo', bn: 'মোমো', emoji: '🐱', blurb: 'curious and cuddly', bnBlurb: 'কৌতূহলী আর আদুরে', color: '#8b5cf6' },
  bunny: { name: 'Bubu', bn: 'বুবু', emoji: '🐰', blurb: 'gentle and hoppy', bnBlurb: 'নরম আর লাফালাফি', color: '#f06ba6' },
  dino: { name: 'Pip', bn: 'পিপ', emoji: '🦖', blurb: 'brave and silly', bnBlurb: 'সাহসী আর দুষ্টু', color: '#22a95a' },
};
