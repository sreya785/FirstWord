// Parent dashboard: honest, non-medical progress view + speaking score + privacy controls.
import { api } from './api.js';
import { t } from './i18n.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PIN_KEY = (id) => `fw_pin_${id}`;

export async function mountParent(root, childId, { navigate, toast, embedded = false }) {
  let child;
  try { child = await api.child(childId); } catch { navigate('#/select'); return; }
  let lang = child.lang || 'en';
  let activeRange = 'all'; // 'today' | 'week' | 'all'
  const L = (k) => t(lang, k);

  const nav = () => embedded ? `
    <nav class="nav embedded">
      <a class="logo" href="#/"><span class="paw">🐾</span> FirstWord AI</a>
      <div class="links"><a href="#/play/${child.id}">▶ ${esc(child.name)}</a><button class="btn sm ghost" id="closeParent">✕ ${L('back')}</button></div>
    </nav>` : `
    <nav class="nav">
      <a class="logo" href="#/"><span class="paw">🐾</span> FirstWord AI</a>
      <div class="links"><a href="#/select">${L('play')}</a><a href="#/play/${child.id}" class="hide-sm">▶ ${esc(child.name)}</a></div>
    </nav>`;

  async function load(pin) {
    try {
      const d = await api.dashboard(child.id, pin, activeRange);
      sessionStorage.setItem(PIN_KEY(child.id), pin || '');
      renderDash(d, pin);
    } catch (e) {
      if (e.status === 403) { renderPin(true); } else toast(e.message);
    }
  }

  function renderPin(wrong = false) {
    root.innerHTML = `${nav()}
      <div class="dash"><div class="card pin-box">
        <h2 style="margin-top:0">🔒 ${L('parentTitle')}</h2>
        <p class="muted">${L('enterPin')} — ${esc(child.name)}</p>
        <form id="pinForm" class="row">
          <input id="pin" type="password" inputmode="numeric" maxlength="8" autocomplete="off" style="flex:1" placeholder="••••">
          <button class="btn">${L('open')}</button>
        </form>
        ${wrong ? `<p class="error">${L('wrongPin')}</p>` : ''}
        ${child.hasPin ? '' : `<p class="muted" style="font-size:.85rem">No PIN was set for this profile. Just press ${L('open')}.</p>`}
      </div></div>`;
    const form = root.querySelector('#pinForm');
    form.addEventListener('submit', (e) => { e.preventDefault(); load(root.querySelector('#pin').value.trim()); });
    root.querySelector('#pin').focus();
  }

  /**
   * Inline SVG line chart for sentence length over time with horizontal shaded bands for Levels 1 to 4.
   */
  function lineChartWithBands(timeline) {
    const bn = lang === 'bn';
    if (!timeline.length) return `<p class="muted">${bn ? 'এখনো কোনো খেলার সেশন নেই।' : 'No play sessions yet.'}</p>`;
    const data = timeline.slice(-14);
    const W = 620, H = 220, padL = 36, padR = 48, padT = 24, padB = 34;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;
    const maxVal = Math.max(6.5, ...data.map((d) => d.avgWords || 0));

    const scaleY = (val) => padT + plotH - (Math.min(val, maxVal) / maxVal) * plotH;
    const scaleX = (idx) => padL + (data.length <= 1 ? plotW / 2 : (idx / (data.length - 1)) * plotW);

    // Level thresholds for bands: Level 1 (0..1.8), Level 2 (1.8..2.8), Level 3 (2.8..4.2), Level 4 (4.2..6.5+)
    const y0 = scaleY(0);
    const y1 = scaleY(1.8);
    const y2 = scaleY(2.8);
    const y3 = scaleY(4.2);
    const y4 = scaleY(maxVal);

    // Points and line path
    const points = data.map((d, i) => ({ x: scaleX(i), y: scaleY(d.avgWords || 0), d }));
    const pathD = points.length === 1
      ? `M ${points[0].x - 10} ${points[0].y} L ${points[0].x + 10} ${points[0].y}`
      : points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

    const nodes = points.map((p) => {
      const date = new Date(p.d.date);
      const title = `${date.toLocaleDateString()} — avg ${p.d.avgWords} words, ${p.d.utterances} turns`;
      return `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#7c3aed" stroke="#ffffff" stroke-width="2"><title>${title}</title></circle>
        <text x="${p.x.toFixed(1)}" y="${H - padB + 16}" font-size="10" text-anchor="middle" fill="#6b6480">${date.getDate()}/${date.getMonth() + 1}</text>`;
    }).join('');

    return `
      <div style="position:relative">
        <svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:auto;display:block">
          <!-- Level 1 Band -->
          <rect x="${padL}" y="${y1}" width="${plotW}" height="${y0 - y1}" fill="#fdf4ff" opacity="0.6"/>
          <text x="${W - padR + 6}" y="${(y0 + y1) / 2 + 4}" font-size="10" font-weight="700" fill="#a855f7">L1</text>
          
          <!-- Level 2 Band -->
          <rect x="${padL}" y="${y2}" width="${plotW}" height="${y1 - y2}" fill="#faf5ff" opacity="0.7"/>
          <text x="${W - padR + 6}" y="${(y1 + y2) / 2 + 4}" font-size="10" font-weight="700" fill="#7c3aed">L2</text>
          
          <!-- Level 3 Band -->
          <rect x="${padL}" y="${y3}" width="${plotW}" height="${y2 - y3}" fill="#f5f3ff" opacity="0.8"/>
          <text x="${W - padR + 6}" y="${(y2 + y3) / 2 + 4}" font-size="10" font-weight="700" fill="#6366f1">L3</text>
          
          <!-- Level 4 Band -->
          <rect x="${padL}" y="${y4}" width="${plotW}" height="${y3 - y4}" fill="#eff6ff" opacity="0.8"/>
          <text x="${W - padR + 6}" y="${(y3 + y4) / 2 + 4}" font-size="10" font-weight="700" fill="#3b82f6">L4</text>

          <!-- Horizontal guideline dividers -->
          <line x1="${padL}" y1="${y1}" x2="${W - padR}" y2="${y1}" stroke="#e9d5ff" stroke-dasharray="3,3"/>
          <line x1="${padL}" y1="${y2}" x2="${W - padR}" y2="${y2}" stroke="#ddd6fe" stroke-dasharray="3,3"/>
          <line x1="${padL}" y1="${y3}" x2="${W - padR}" y2="${y3}" stroke="#c7d2fe" stroke-dasharray="3,3"/>
          <line x1="${padL}" y1="${y0}" x2="${W - padR}" y2="${y0}" stroke="#e5e7eb" stroke-width="1.5"/>

          <!-- Line path & data dots -->
          <path d="${pathD}" fill="none" stroke="#7c3aed" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          ${nodes}
        </svg>
      </div>
      <p class="muted" style="font-size:.8rem;margin:.4rem 0 0">
        ${bn ? 'সেশনের গড় শব্দসংখ্যা (L1 থেকে L4 স্তর নির্দেশক সহ)' : 'Average sentence length over sessions with Level 1–4 guidance bands'}
      </p>`;
  }

  function renderDash(d, pin) {
    const bn = lang === 'bn';
    const petDisplayName = d.child.petName || { cat: 'Momo', bunny: 'Bubu', dino: 'Pip' }[d.child.petType] || 'Friend';
    const tot = d.totals;
    const maxSkill = Math.max(1, ...(d.skills || []).map((s) => s.count));
    const maxScene = Math.max(1, ...(d.scenes || []).map((s) => s.count));

    // Trend description
    const trendText = d.trend ? (d.trend.change > 0.3 ? (bn ? `সাম্প্রতিক সেশনে কথাগুলো একটু লম্বা হচ্ছে (${d.trend.earlier} → ${d.trend.recent} শব্দ)।` : `Utterances are getting a little longer in recent sessions (${d.trend.earlier} → ${d.trend.recent} words).`)
      : d.trend.change < -0.3 ? (bn ? `সাম্প্রতিক কথাগুলো একটু ছোট (${d.trend.earlier} → ${d.trend.recent} শব্দ)। এটি স্বাভাবিক ওঠানামা হতে পারে।` : `Recent utterances are a little shorter (${d.trend.earlier} → ${d.trend.recent} words). Normal ups and downs are expected.`)
      : (bn ? 'কথার দৈর্ঘ্য মোটামুটি একই রকম আছে।' : 'Utterance length has been fairly steady.')) : (bn ? 'ধারা দেখানোর জন্য আরও কয়েকটা সেশন দরকার।' : 'A few more sessions are needed before a trend can be shown.');

    root.innerHTML = `${nav()}
    <div class="dash">
      <!-- Header with child name, pet, time filter, and action buttons -->
      <div class="row" style="justify-content:space-between;align-items:flex-end;flex-wrap:wrap;margin-bottom:1rem;gap:1rem">
        <div>
          <p class="muted" style="margin:0">${L('parentTitle')}</p>
          <h1 style="margin:0.2rem 0">${esc(d.child.name)} ${bn ? 'ও' : '&'} ${esc(petDisplayName)} 🐾</h1>
        </div>
        <div class="row" style="gap:0.6rem">
          <div class="time-filter" id="timeFilter">
            <button data-range="today" class="${d.range === 'today' ? 'active' : ''}">${bn ? 'আজ' : 'Today'}</button>
            <button data-range="week" class="${d.range === 'week' ? 'active' : ''}">${bn ? 'এই সপ্তাহ' : 'This week'}</button>
            <button data-range="all" class="${d.range === 'all' ? 'active' : ''}">${bn ? 'সব সময়' : 'All time'}</button>
          </div>
          <div class="lang-toggle" id="langSwitch">
            <button data-lang="en" class="${lang === 'en' ? 'active' : ''}">EN</button>
            <button data-lang="bn" class="${lang === 'bn' ? 'active' : ''}">বাং</button>
          </div>
          <button class="btn secondary sm" id="printReportBtn">🖨️ ${bn ? 'পিডিএফ ডাউনলোড' : 'Download as PDF'}</button>
          <a class="btn sm" href="#/play/${child.id}">▶ ${L('play')}</a>
        </div>
      </div>

      <!-- General disclaimer banner -->
      <div class="note" style="margin-bottom:1.2rem">⚕️ ${esc(d.disclaimer)}</div>

      ${d.requiresPin ? `
        <!-- Unverified PIN Gate: prompt parent to set a PIN to unlock the score and full report -->
        <div class="pin-req-card">
          <h2>🔒 ${bn ? 'সম্পূর্ণ রিপোর্ট দেখতে প্যারেন্ট পিন সেট করুন' : 'Set a parent PIN to see the full report'}</h2>
          <p class="muted" style="line-height:1.5;margin-bottom:1.4rem">
            ${bn ? 'শিশুর স্পিকিং স্কোর, আজকের বিস্তারিত কার্যকলাপ এবং পর্যবেক্ষণ কেবল পিন দ্বারা সুরক্ষিত। রিপোর্টটি আনলক করতে একটি ৪-সংখ্যার পিন সেট করুন।' : 'Speaking scores, today’s activity, and developmental observations are strictly protected for parent privacy. Set a 4-digit PIN to unlock the full report.'}
          </p>
          <form id="createPinForm" class="row" style="justify-content:center;max-width:320px;margin:0 auto">
            <input id="newPinInput" type="password" inputmode="numeric" maxlength="8" placeholder="••••" style="flex:1;text-align:center;font-size:1.4rem;letter-spacing:0.3rem">
            <button class="btn" id="createPinBtn">${bn ? 'পিন সেট করুন' : 'Set PIN'}</button>
          </form>
        </div>
      ` : `
        <!-- Early Flag Card (rendered only when triggered) -->
        ${d.earlyFlag?.active ? `
          <div class="flag-card">
            <div class="flag-title">
              <span>⚠️</span>
              <b>${bn ? 'বিকাশ পর্যবেক্ষণ সতর্কতা' : 'Development Observation'}</b>
            </div>
            <p style="margin:0.2rem 0;font-weight:700">
              ${bn ? 'শিশুর সাম্প্রতিক ৫টি সেশনে পূর্বের ভিত্তিরেখার তুলনায় পার্থক্য দেখা গেছে:' : 'The last 5 qualifying sessions were below your child’s earlier baseline:'}
            </p>
            <div class="flag-numbers">
              • <b>${bn ? 'কথার দৈর্ঘ্য' : 'Sentence length'}:</b> ${bn ? 'ভিত্তিরেখা' : 'baseline'} ${d.earlyFlag.baseline.avgWords} ${bn ? 'শব্দ/বাক্য' : 'words/sentence'} → ${bn ? 'সাম্প্রতিক ৫ সেশনে গড়' : 'recent 5 sessions averaged'} <b>${d.earlyFlag.recent.avgWords}</b> (${d.earlyFlag.marginPercent}% ${bn ? 'এর বেশি কম' : 'margin below threshold'}).<br>
              • <b>${bn ? 'সাড়া দেওয়া (অংশগ্রহণ)' : 'Taking part'}:</b> ${bn ? 'ভিত্তিরেখা' : 'baseline'} ${d.earlyFlag.baseline.takingPart}% → ${bn ? 'সাম্প্রতিক ৫ সেশনে' : 'recent 5 sessions'} <b>${d.earlyFlag.recent.takingPart}%</b>.
            </div>
            <p class="muted" style="margin:0;font-size:.88rem;line-height:1.4">
              ${bn ? 'এটি কোনো চিকিৎসা মূল্যায়ন বা রোগনির্ণয় নয়। ক্লান্তি, নতুন পরিবেশ বা লাজুকতার কারণে কথায় তারতম্য হতে পারে। তবে আপনি চাইলে একজন স্পিচ-ল্যাঙ্গুয়েজ থেরাপিস্টের সাথে কথা বলে পরামর্শ নিতে পারেন।' : 'This is not a medical diagnosis. Every child develops at their own pace, and speech can vary with tiredness, shyness, or ambient noise. However, because the last 5 sessions have been consistently below your child’s baseline, you may wish to share these observations with a qualified speech-language professional.'}
            </p>
          </div>
        ` : ''}

        <!-- Top summary stats row -->
        <div class="stats">
          <div class="stat"><b>${tot.sessions}</b><span>${bn ? 'সেশন' : 'sessions'}</span></div>
          <div class="stat"><b>${tot.minutes}</b><span>${bn ? 'মিনিট খেলা' : 'minutes played'}</span></div>
          <div class="stat"><b>${tot.utterances}</b><span>${bn ? 'বার কথা বলেছে' : 'things said'}</span></div>
          <div class="stat"><b>${tot.avgWords}</b><span>${bn ? 'গড় শব্দ / কথা' : 'avg words / utterance'}</span></div>
          <div class="stat"><b>${tot.questions ?? 0}</b><span>${bn ? 'প্রশ্ন করেছে' : 'questions asked'}</span></div>
          <div class="stat"><b>${tot.participation == null ? '–' : tot.participation + '%'}</b><span>${bn ? 'সাড়া দিয়েছে' : 'participation'}</span></div>
        </div>

        <div class="dash-grid">
          <!-- 1. "Today" Card -->
          <div class="card">
            <h3 style="margin-top:0">📅 ${bn ? 'আজকের কার্যকলাপ' : 'Today'}</h3>
            ${d.todayCard?.hasData ? `
              <div class="today-grid">
                <div class="today-stat">
                  <b>${d.todayCard.sentencesCount}</b>
                  <span>${bn ? 'বাক্য বলা হয়েছে' : 'sentences said'}</span>
                </div>
                <div class="today-stat">
                  <b>${d.todayCard.minutesPlayed}</b>
                  <span>${bn ? 'মিনিট খেলা' : 'minutes played'}</span>
                </div>
                <div class="today-stat">
                  <b>${d.todayCard.avgWords}</b>
                  <span>${bn ? 'গড় দৈর্ঘ্য' : 'avg words/sentence'}</span>
                  ${d.todayCard.avgChangeVsYesterday != null ? `<small class="${d.todayCard.avgChangeVsYesterday >= 0 ? 'score-diff pos' : 'score-diff neg'}">${d.todayCard.avgChangeVsYesterday >= 0 ? '▲ +' + d.todayCard.avgChangeVsYesterday : '▼ ' + d.todayCard.avgChangeVsYesterday} ${bn ? 'গতকাল থেকে' : 'vs yesterday'}</small>` : ''}
                </div>
              </div>

              <!-- Longest sentence today -->
              <div class="longest-box">
                <div style="font-weight:800;color:#9d174d;margin-bottom:0.2rem">
                  🏆 ${bn ? 'আজকের সবচেয়ে লম্বা বাক্য:' : 'Longest sentence today:'} <b>${d.todayCard.longestSentence.wordCount} ${bn ? 'শব্দ' : 'words'}</b>
                </div>
                ${d.todayCard.longestSentence.text ? `<div style="font-style:italic">“${esc(d.todayCard.longestSentence.text)}”</div>` : `<div class="muted small">${bn ? '(প্রাইভেসি সেটিংসে লেখা রাখা বন্ধ থাকায় বাক্য গোপন রাখা হয়েছে)' : '(Text hidden by privacy setting — word count recorded)'}</div>`}
              </div>

              <!-- New words today -->
              <div style="margin-top:0.8rem">
                <span class="muted small" style="font-weight:800">${bn ? 'আজকের নতুন শব্দগুলো:' : 'New words today:'}</span>
                <div class="word-chips">
                  ${d.todayCard.newWords?.length ? d.todayCard.newWords.map((w) => `<span class="word-chip">${esc(w)}</span>`).join('') : `<span class="muted small">${bn ? 'আজ নতুন শব্দ নেই' : 'No new words today'}</span>`}
                </div>
              </div>

              <!-- Situations today -->
              <div style="margin-top:0.8rem">
                <span class="muted small" style="font-weight:800">${bn ? 'আজ যেসব জায়গায় খেলেছে:' : 'Situations played today:'}</span>
                <div class="situation-badges">
                  ${d.todayCard.situations?.length ? d.todayCard.situations.map((sc) => `<span class="situation-badge">${esc(sc.label)}</span>`).join('') : `<span class="muted small">–</span>`}
                </div>
              </div>
            ` : `
              <p class="muted" style="margin:1rem 0">${bn ? 'আজ এখনো কোনো সেশন খেলা হয়নি।' : 'No play sessions recorded yet today.'}</p>
            `}
          </div>

          <!-- 2. "Speaking score" Card (0 to 100) -->
          <div class="card score-card">
            <h3 style="margin-top:0">🎯 ${bn ? 'প্যারেন্ট স্পিকিং স্কোর' : 'Speaking Score'}</h3>
            ${!d.baseline?.ready ? `
              <!-- Baseline Building Phase -->
              <div class="baseline-banner">
                <b>🌱 ${esc(d.baseline?.message || 'Building your baseline')}</b>
                <p class="muted" style="margin:0.3rem 0 0;font-size:0.85rem">
                  ${bn ? 'স্কোর দেখার জন্য কমপক্ষে ৩টি কোয়ালিফাইং সেশন (প্রতিটিতে ৫+ কথা) প্রয়োজন।' : 'Scores will appear after 3 qualifying sessions (sessions with at least 5 utterances).'}
                </p>
              </div>
            ` : d.speakingScore ? `
              <!-- Big Number, status label, change vs baseline -->
              <div class="score-hero-row">
                <span class="score-hero">${d.speakingScore.number}</span>
                <span class="score-badge ${d.speakingScore.number >= 75 ? 'strong' : d.speakingScore.number >= 50 ? 'growing' : 'started'}">${esc(d.speakingScore.label)}</span>
                <span class="score-diff ${d.speakingScore.diffNumber > 0 ? 'pos' : d.speakingScore.diffNumber < 0 ? 'neg' : 'zero'}">
                  ${d.speakingScore.changeVsBaseline} ${bn ? 'ভিত্তিরেখা থেকে' : 'vs baseline'}
                </span>
              </div>
              <p class="muted" style="font-size:0.82rem;margin:0 0 0.8rem">
                ${esc(d.speakingScore.disclaimer)}
              </p>

              <!-- Four Breakdown Mini-Bars -->
              <div class="mini-bars">
                <div class="mini-bar-row">
                  <span>${bn ? 'শব্দ বৈচিত্র্য (৩০%)' : 'Word variety 30%'}</span>
                  <div class="mini-track"><div class="mini-fill" style="width:${d.speakingScore.components.wordVariety}%"></div></div>
                  <span style="text-align:right">${d.speakingScore.components.wordVariety}%</span>
                </div>
                <div class="mini-bar-row">
                  <span>${bn ? 'বাক্যের দৈর্ঘ্য (৩০%)' : 'Sentence length 30%'}</span>
                  <div class="mini-track"><div class="mini-fill" style="width:${d.speakingScore.components.sentenceLength}%"></div></div>
                  <span style="text-align:right">${d.speakingScore.components.sentenceLength}%</span>
                </div>
                <div class="mini-bar-row">
                  <span>${bn ? 'অংশগ্রহণ (২০%)' : 'Taking part 20%'}</span>
                  <div class="mini-track"><div class="mini-fill" style="width:${d.speakingScore.components.takingPart}%"></div></div>
                  <span style="text-align:right">${d.speakingScore.components.takingPart}%</span>
                </div>
                <div class="mini-bar-row">
                  <span>${bn ? 'ভাষার স্তর (২০%)' : 'Sentence level 20%'}</span>
                  <div class="mini-track"><div class="mini-fill" style="width:${d.speakingScore.components.sentenceLevel}%"></div></div>
                  <span style="text-align:right">${d.speakingScore.components.sentenceLevel}%</span>
                </div>
              </div>
            ` : `<p class="muted">–</p>`}
          </div>

          <!-- 3. Sentence length over time chart -->
          <div class="card" style="grid-column:1/-1">
            <h3 style="margin-top:0">📈 ${bn ? 'সময়ের সাথে বাক্যের দৈর্ঘ্য' : 'Sentence length over time'}</h3>
            ${lineChartWithBands(d.timeline || [])}
            <p style="font-weight:700;margin-top:0.8rem">${trendText}</p>
            <p class="muted" style="font-size:.9rem;margin-bottom:0">
              ${bn ? 'বর্তমান খেলার স্তর' : 'Current play level'}: <b>${esc(d.level.label)}</b> — ${bn ? 'বন্ধুর কথা শিশুর বর্তমান বাক্যের সাথে খাপ খাইয়ে নেয়।' : 'the pet matches its sentence complexity to the child.'}
            </p>
          </div>

          <!-- 4. Words Card -->
          <div class="card">
            <h3 style="margin-top:0">📚 ${bn ? 'শব্দভাণ্ডার' : 'Words'}</h3>
            <div class="row" style="margin-bottom:0.8rem">
              <div style="background:#faf5ff;padding:0.6rem 1rem;border-radius:14px;border:1px solid #ede9fe">
                <span class="muted small" style="display:block">${bn ? 'মোট বিভিন্ন শব্দ' : 'Total unique words'}</span>
                <b style="font-size:1.5rem;color:var(--brand)">${d.totalUniqueWords || 0}</b>
              </div>
              <div style="background:#f0fdf4;padding:0.6rem 1rem;border-radius:14px;border:1px solid #bbf7d0">
                <span class="muted small" style="display:block">${bn ? 'এই সপ্তাহে নতুন' : 'New words this week'}</span>
                <b style="font-size:1.5rem;color:#15803d">${d.newWordsThisWeek?.length || 0}</b>
              </div>
            </div>
            ${d.newWordsThisWeek?.length ? `
              <div style="margin-bottom:0.8rem">
                <small class="muted" style="font-weight:800">${bn ? 'এই সপ্তাহের নতুন শব্দ:' : 'New this week:'}</small>
                <div class="word-chips" style="margin-top:0.3rem">
                  ${d.newWordsThisWeek.map((w) => `<span class="word-chip" style="background:#dcfce7;color:#166534">${esc(w)}</span>`).join('')}
                </div>
              </div>
            ` : ''}
            <div>
              <small class="muted" style="font-weight:800">${bn ? 'সবচেয়ে বেশি ব্যবহৃত শব্দ:' : 'Most frequent words:'}</small>
              <div class="words" style="margin-top:0.4rem">
                ${(d.topWords || []).map((w) => `<span class="${d.newWordsThisWeek?.includes(w.word) ? 'new' : ''}" title="${w.count}×">${esc(w.word)}</span>`).join('')}
              </div>
            </div>
          </div>

          <!-- 5. Skills and situations -->
          <div class="card">
            <h3 style="margin-top:0">⭐ ${bn ? 'দক্ষতা ও স্থানসমূহ' : 'Skills and situations'}</h3>
            <small class="muted" style="font-weight:800;display:block;margin-bottom:0.4rem">${bn ? 'যোগাযোগ দক্ষতা:' : 'Communication skills practiced:'}</small>
            ${(d.skills || []).filter((s) => s.count > 0).length ? d.skills.filter((s) => s.count > 0).map((s) => `
              <div class="bar">
                <span>${esc(s.label)}</span>
                <div class="track"><div class="fill" style="width:${(s.count / maxSkill) * 100}%"></div></div>
                <span>${s.count}</span>
              </div>
            `).join('') : `<p class="muted">${bn ? 'খেলার পর এখানে দেখা যাবে।' : 'Will appear after play.'}</p>`}

            <small class="muted" style="font-weight:800;display:block;margin-top:1rem;margin-bottom:0.4rem">${bn ? 'যেসব জায়গায় খেলেছে:' : 'Situations explored:'}</small>
            ${(d.scenes || []).length ? d.scenes.map((s) => `
              <div class="bar">
                <span>${esc(s.label)}</span>
                <div class="track"><div class="fill" style="width:${(s.count / maxScene) * 100}%;background:linear-gradient(90deg,#f59e0b,#ec4899)"></div></div>
                <span>${s.count}</span>
              </div>
            `).join('') : `<p class="muted">–</p>`}
          </div>

          <!-- 6. Practice at home -->
          <div class="card" style="grid-column:1/-1">
            <h3 style="margin-top:0">🏡 ${bn ? 'বাড়িতে অনুশীলনের ধারণা' : 'Practice at home'}</h3>
            <ul class="sugg">${(d.suggestions || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ul>
            <div class="practice-words-section" style="margin-top:1.2rem">
              <h4 style="margin:0 0 0.6rem">🎯 ${bn ? 'গত ৭ দিনের অনুশীলনের শব্দ' : 'Practice words from the last 7 days'}</h4>
              ${(d.practiceWords && d.practiceWords.length) ? `
                <div class="practice-cards-grid">
                  ${d.practiceWords.map((pw) => `
                    <div class="practice-word-card">
                      <div class="practice-chips">
                        ${pw.words.map((w) => `<span class="practice-chip">${esc(w)}</span>`).join('')}
                        <span class="practice-count" title="${bn ? 'ব্যবহৃত হয়েছে' : 'times practiced'}">${pw.count}×</span>
                      </div>
                      ${pw.example ? `<div class="practice-example"><b>${bn ? 'উদাহরণ বাক্য:' : 'Example:'}</b> “${esc(pw.example)}”</div>` : ''}
                      ${pw.question ? `<div class="practice-question"><b>${bn ? 'জিজ্ঞেস করতে পারেন:' : 'Try asking:'}</b> “${esc(pw.question)}”</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              ` : `
                <p class="muted" style="margin:0.4rem 0 0;font-size:0.9rem">
                  ${bn ? 'গত ৭ দিনে কোনো অনুশীলনের শব্দ জমা হয়নি। খেলা চালিয়ে গেলে এখানে শব্দ যুক্ত হবে।' : 'No practice words recorded in the last 7 days. As your child plays, target words and follow-up prompts will appear here.'}
                </p>
              `}
            </div>
          </div>
        </div>
      `}

      <!-- Recent conversation turns (always visible if available) -->
      ${d.recentTurns?.length ? `
        <div class="card" style="margin-top:1.2rem">
          <h3 style="margin-top:0">💬 ${bn ? 'সাম্প্রতিক কথোপকথন' : 'Recent conversation'}</h3>
          <div class="turns">${d.recentTurns.map((tr) => `
            <div class="turn">
              <span class="c">${tr.source === 'silence' ? (bn ? '🤫 (চুপ ছিল — ঠিক আছে)' : '🤫 (quiet turn — that is okay)') : '🧒 ' + esc(tr.child || '…')}</span>
              <span class="p">${tr.pet ? '🐾 ' + esc(tr.pet) : ''}</span>
            </div>
          `).join('')}</div>
        </div>
      ` : ''}

      <!-- Sticker Book -->
      <div class="card" style="margin-top:1.2rem">
        <h3 style="margin-top:0">⭐ ${L('stickerBook')}</h3>
        <p class="muted" style="font-size:.9rem;margin-top:0">
          ${bn ? 'স্টিকার শুধু উৎসাহের জন্য — নম্বর বা মূল্যায়ন নয়। কোনো স্টিকার হারানো যায় না।' : 'Stickers celebrate milestones and curiosity — never scores. A sticker can never be lost.'}
        </p>
        <div class="sticker-grid" id="dashStickers"><p class="muted">…</p></div>
      </div>

      <!-- Teach the Pet (Intent training) -->
      <div class="card" style="margin-top:1.2rem" id="teachCard">
        <h3 style="margin-top:0">🧠 ${L('teach')}</h3>
        <p class="muted" style="font-size:.9rem;margin-top:0">
          ${bn ? 'বন্ধুর "মস্তিষ্ক" আপনার সার্ভারেই চলে: নিয়ম + একটি ছোট প্রশিক্ষিত মডেল (কোনো ক্লাউড AI নয়)। যে কথাগুলো বন্ধু ভালো বোঝেনি, সেগুলোর সঠিক মানে বেছে দিন — মডেল সঙ্গে সঙ্গে আবার শিখবে।' : 'The pet\'s brain runs locally on your machine: rules plus a compact intent model (no cloud AI). Pick the right meaning for sentences the pet was unsure about and it retrains instantly.'}
        </p>
        <div id="mlStatus" class="muted" style="font-size:.85rem">…</div>
        <div id="unclearList" style="margin-top:.8rem"></div>
        <div class="row" style="margin-top:.8rem;flex-wrap:wrap;align-items:stretch">
          <input id="teachText" placeholder="${bn ? 'একটি বাক্য লিখুন…' : 'Type a sentence…'}" style="flex:2;min-width:200px;padding:.6rem .9rem;border-radius:14px;border:2px solid #e9e4f5">
          <select id="teachIntent" style="flex:1;min-width:180px;padding:.6rem .9rem;border-radius:14px;border:2px solid #e9e4f5"></select>
          <button class="btn sm" id="teachBtn">${bn ? 'শেখাও' : 'Teach'}</button>
          <button class="btn ghost sm" id="retrainBtn">${bn ? 'আবার প্রশিক্ষণ' : 'Retrain model'}</button>
        </div>
        <pre id="teachLog" class="muted" style="font-size:.78rem;white-space:pre-wrap;margin:.6rem 0 0"></pre>
      </div>

      <!-- Privacy Controls & Management -->
      <div class="card" style="margin-top:1.2rem" id="privacyCard">
        <h3 style="margin-top:0">🔐 ${L('privacy')}</h3>
        <label class="switch"><span>${L('storeTranscripts')}</span><input type="checkbox" id="storeT" ${d.child.settings?.storeTranscripts !== false ? 'checked' : ''}></label>
        <label class="switch"><span>${L('autoListenSetting')}</span><input type="checkbox" id="autoL" ${d.child.settings?.autoListen !== false ? 'checked' : ''}></label>
        <p class="muted" style="font-size:.85rem">
          ${bn ? 'অডিও কখনো সংরক্ষণ বা ক্লাউডে পাঠানো হয় না। লেখা রাখা বন্ধ করলে সবচেয়ে লম্বা বাক্যের মূল টেক্সট মুছে শুধু শব্দসংখ্যা দেখানো হয়।' : 'Audio is never stored or uploaded. When transcripts are turned off, sentence text is redacted across reports and only word counts are kept.'}
        </p>
        <div class="row" style="margin-top:1rem;flex-wrap:wrap">
          <button class="btn secondary sm" id="exportBtn">⬇ ${L('export')}</button>
          <button class="btn ghost sm" id="setPinBtn">${child.hasPin ? (bn ? 'পিন বদলান' : 'Change PIN') : (bn ? 'পিন সেট করুন' : 'Set a PIN')}</button>
          <button class="btn pink sm" id="delDataBtn">🗑 ${L('deleteData')}</button>
          <button class="btn ghost sm" id="delChildBtn" style="color:#b91c1c">${L('deleteChild')}</button>
        </div>
      </div>

      <p class="muted" style="font-size:.85rem;margin-top:1.5rem">${L('footer')}</p>
    </div>`;

    // ---- Wiring Event Listeners ----

    // Range Switcher
    root.querySelectorAll('#timeFilter button').forEach((b) => b.addEventListener('click', () => {
      activeRange = b.dataset.range;
      load(pin);
    }));

    // Language Toggle
    root.querySelectorAll('#langSwitch button').forEach((b) => b.addEventListener('click', async () => {
      lang = b.dataset.lang;
      await api.updateChild(child.id, { lang }, pin).catch(() => {});
      child.lang = lang;
      load(pin);
    }));

    // Download as PDF / Print
    root.querySelector('#printReportBtn')?.addEventListener('click', () => {
      window.print();
    });

    // Create PIN Form (when unverified / no PIN set)
    const createForm = root.querySelector('#createPinForm');
    if (createForm) {
      createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const val = root.querySelector('#newPinInput').value.trim();
        if (!/^\d{4,8}$/.test(val)) {
          toast(bn ? '৪–৮ সংখ্যা দিন' : 'Enter a 4 to 8 digit PIN');
          return;
        }
        try {
          await api.updateChild(child.id, { pin: val });
          child.hasPin = true;
          sessionStorage.setItem(PIN_KEY(child.id), val);
          toast(bn ? '✓ পিন সেট হয়েছে' : '✓ PIN created');
          load(val);
        } catch (err) {
          toast(err.message);
        }
      });
    }

    // Sticker Book Loading
    api.stickers(child.id).then((list) => {
      const grid = root.querySelector('#dashStickers');
      if (!grid) return;
      const arr = Array.isArray(list) ? list : list.stickers || [];
      grid.innerHTML = arr.map((s) => `
        <div class="sticker ${s.unlocked ? 'on' : ''}" title="${esc(s.hint || '')}">
          <span>${s.unlocked ? s.emoji : '❔'}</span>
          <small>${esc(s.unlocked ? s.label : (bn ? 'এখনও নয়' : 'Not yet'))}</small>
          ${s.unlocked && s.at ? `<em class="muted" style="font-size:.65rem;font-style:normal">${new Date(s.at).toLocaleDateString()}</em>` : ''}
        </div>
      `).join('');
    }).catch(() => {});

    // Teach the Pet
    let labels = {};
    const fmtStatus = (st) => {
      const m = st.meta || {};
      const acc = m.testAccuracy != null ? Math.round(m.testAccuracy * 100) + '%' : '–';
      return st.ready
        ? (bn ? `মডেল প্রস্তুত · ${m.examples || 0}টি উদাহরণ (${st.customExamples || 0}টি আপনার শেখানো) · পরীক্ষায় সঠিকতা ${acc} · প্রশিক্ষণ ${st.trainedAt ? new Date(st.trainedAt).toLocaleString() : ''}`
             : `Model ready · ${m.examples || 0} examples (${st.customExamples || 0} taught by you) · held-out accuracy ${acc} · trained ${st.trainedAt ? new Date(st.trainedAt).toLocaleString() : ''}`)
        : (bn ? 'মডেল এখনো প্রশিক্ষিত নয় — "আবার প্রশিক্ষণ" চাপুন।' : 'Model not trained yet — press "Retrain model".');
    };
    const loadMl = async () => {
      try {
        const st = await api.mlStatus();
        labels = (st.labels && st.labels[lang]) || (st.labels && st.labels.en) || {};
        const mlEl = root.querySelector('#mlStatus');
        if (mlEl) mlEl.textContent = fmtStatus(st);
        const sel = root.querySelector('#teachIntent');
        if (sel) {
          sel.innerHTML = (st.intents || Object.keys(labels)).filter((i) => i !== 'chitchat').map((i) => `<option value="${i}">${esc(labels[i] || i)}</option>`).join('') + `<option value="chitchat">${esc(labels.chitchat || 'Just chatting')}</option>`;
        }
      } catch (e) {
        const mlEl = root.querySelector('#mlStatus');
        if (mlEl) mlEl.textContent = e.message;
      }
      try {
        const list = await api.unclear(child.id, pin);
        const box = root.querySelector('#unclearList');
        if (!box) return;
        if (!list.length) {
          box.innerHTML = `<p class="muted" style="font-size:.9rem">${bn ? 'এখন পর্যন্ত বন্ধু সব কথাই মোটামুটি বুঝেছে। 🎉' : 'Nothing unclear so far — the pet understood everything well enough. 🎉'}</p>`;
          return;
        }
        box.innerHTML = `
          <p style="font-weight:800;margin:.2rem 0">${bn ? 'বন্ধু যেগুলো নিশ্চিত ছিল না:' : 'Sentences the pet was not sure about:'}</p>
          <div class="turns">${list.map((u, i) => `
            <div class="turn" style="grid-template-columns:1fr auto;align-items:center">
              <div>
                <span class="c">🧒 ${esc(u.text)}</span><br>
                <span class="p" style="font-size:.8rem">${u.ml ? (bn ? 'মডেলের অনুমান' : 'model guess') + `: ${esc(labels[u.ml.intent] || u.ml.intent)} (${Math.round(u.ml.conf * 100)}%)` : (bn ? 'নিয়মে মেলেনি' : 'no rule matched')}</span>
              </div>
              <button class="btn secondary sm" data-i="${i}">${bn ? 'শেখাও' : 'Teach'}</button>
            </div>
          `).join('')}</div>`;
        box.querySelectorAll('button[data-i]').forEach((b) => b.addEventListener('click', () => {
          const u = list[Number(b.dataset.i)];
          root.querySelector('#teachText').value = u.text;
          if (u.ml?.intent) root.querySelector('#teachIntent').value = u.ml.intent;
          root.querySelector('#teachText').scrollIntoView({ behavior: 'smooth', block: 'center' });
        }));
      } catch (e) {
        const box = root.querySelector('#unclearList');
        if (box) box.innerHTML = `<p class="error">${esc(e.message)}</p>`;
      }
    };
    loadMl();

    const logEl = root.querySelector('#teachLog');
    root.querySelector('#teachBtn')?.addEventListener('click', async () => {
      const text = root.querySelector('#teachText').value.trim();
      const intent = root.querySelector('#teachIntent').value;
      if (!text) { toast(bn ? 'একটি বাক্য লিখুন' : 'Type a sentence first'); return; }
      const btn = root.querySelector('#teachBtn'); btn.disabled = true;
      if (logEl) logEl.textContent = bn ? 'শিখছে…' : 'Learning…';
      try {
        const r = await api.teach(child.id, pin, text, intent);
        if (logEl) logEl.textContent = r.log || 'ok';
        root.querySelector('#teachText').value = '';
        toast('✓ ' + (bn ? 'শিখেছে' : 'Learned'));
        await loadMl();
      } catch (e) {
        if (logEl) logEl.textContent = e.message;
      }
      btn.disabled = false;
    });

    root.querySelector('#retrainBtn')?.addEventListener('click', async () => {
      const btn = root.querySelector('#retrainBtn'); btn.disabled = true;
      if (logEl) logEl.textContent = bn ? 'প্রশিক্ষণ চলছে…' : 'Training…';
      try {
        const r = await api.retrain(child.id, pin);
        if (logEl) logEl.textContent = r.log || 'ok';
        await loadMl();
      } catch (e) {
        if (logEl) logEl.textContent = e.message;
      }
      btn.disabled = false;
    });

    // Privacy toggles
    root.querySelector('#storeT')?.addEventListener('change', async (e) => {
      await api.updateChild(child.id, { settings: { storeTranscripts: e.target.checked } }, pin);
      toast('✓');
    });
    root.querySelector('#autoL')?.addEventListener('change', async (e) => {
      await api.updateChild(child.id, { settings: { autoListen: e.target.checked } }, pin);
      toast('✓');
    });

    // Export Data
    root.querySelector('#exportBtn')?.addEventListener('click', async () => {
      const res = await fetch(`/api/children/${child.id}/export`, { headers: { 'x-parent-pin': pin || '' } });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `firstword-${child.name}.json`;
      a.click();
    });

    // Change PIN
    root.querySelector('#setPinBtn')?.addEventListener('click', async () => {
      const np = prompt(bn ? 'নতুন ৪-সংখ্যার পিন (খালি রাখলে পিন মুছে যাবে):' : 'New 4-digit PIN (leave empty to remove):');
      if (np === null) return;
      if (np && !/^\d{4,8}$/.test(np)) { toast(bn ? '৪–৮ সংখ্যা দিন' : 'Use 4–8 digits'); return; }
      await api.updateChild(child.id, { pin: np }, pin);
      child.hasPin = Boolean(np);
      sessionStorage.setItem(PIN_KEY(child.id), np);
      toast('✓');
      load(np);
    });

    // Delete Data
    root.querySelector('#delDataBtn')?.addEventListener('click', async () => {
      if (!confirm(bn ? 'সব খেলার ইতিহাস মুছে ফেলবেন? প্রোফাইল থাকবে।' : 'Delete all play history? The profile will stay.')) return;
      await api.deleteData(child.id, pin);
      toast('✓');
      load(pin);
    });

    // Delete Child Profile
    root.querySelector('#delChildBtn')?.addEventListener('click', async () => {
      if (!confirm(bn ? 'এই প্রোফাইল ও এর সব ডেটা মুছে ফেলবেন?' : 'Delete this profile and all of its data?')) return;
      await api.deleteChild(child.id, pin);
      navigate('#/select');
    });
  }

  const remembered = sessionStorage.getItem(PIN_KEY(child.id));
  if (remembered !== null) load(remembered);
  else if (!child.hasPin) load('');
  else renderPin(false);
}
