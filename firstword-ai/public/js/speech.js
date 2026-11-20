// Speech input/output using the browser's free, built-in Web Speech API.
// Tuned for natural, warm storytelling female AI voice and continuous voice-control play.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export const speech = {
  supported: Boolean(SR),
  ttsSupported: !!(typeof window !== 'undefined' && window.speechSynthesis && typeof window.speechSynthesis.getVoices === 'function'),
  lang: 'en-US',
  recognition: null,
  listening: false,
  pausedForSpeech: false,
  onInterim: null,
  onFinal: null,
  onStateChange: null,
  onError: null,
  voices: [],
  activeVoice: null,
  muted: false,

  setLang(l) {
    this.lang = l === 'bn' ? 'bn-BD' : 'en-US';
    this.activeVoice = this.pickVoice(l);
  },

  start() {
    if (!SR) return false;
    if (this.listening) return true;
    if (this.pausedForSpeech) return false;

    // Clean up any stale instance
    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
      this.recognition = null;
    }

    const rec = new SR();
    rec.lang = this.lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';
    let gotResult = false;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      gotResult = true;
      if (interim && this.onInterim) this.onInterim(interim);
    };

    rec.onerror = (e) => {
      this.listening = false;
      this.onStateChange?.(false);
      const harmless = e.error === 'no-speech' || e.error === 'aborted';
      if (!harmless) {
        this.onError?.(e.error);
      } else if (e.error === 'no-speech') {
        this.onFinal?.('', { noSpeech: true });
      }
    };

    rec.onend = () => {
      const wasListening = this.listening;
      this.listening = false;
      this.onStateChange?.(false);
      if (wasListening || gotResult) {
        const text = finalText.trim();
        if (text) this.onFinal?.(text, {});
        else if (!gotResult) this.onFinal?.('', { noSpeech: true });
      }
    };

    try {
      rec.start();
      this.recognition = rec;
      this.listening = true;
      this.onStateChange?.(true);
      return true;
    } catch (err) {
      this.listening = false;
      this.onError?.(err.message);
      return false;
    }
  },

  stop() {
    if (this.recognition && this.listening) {
      try { this.recognition.stop(); } catch {}
    }
    this.listening = false;
  },

  abort() {
    if (this.recognition) {
      try { this.recognition.abort(); } catch {}
    }
    this.listening = false;
    this.onStateChange?.(false);
  },

  loadVoices() {
    if (!this.ttsSupported) return;
    try {
      this.voices = window.speechSynthesis.getVoices() || [];
      if (this.voices.length) {
        this.activeVoice = this.pickVoice(this.lang.startsWith('bn') ? 'bn' : 'en');
      }
    } catch {
      this.voices = [];
    }
  },

  /**
   * Find the highest quality, warm natural storytelling female AI voice.
   * Prioritizes Edge Natural Neural voices (Jenny/Aria), Google US/UK Female,
   * Apple Samantha/Ava, and Windows Zira.
   */
  pickVoice(lang) {
    if (!this.voices.length) this.loadVoices();
    const isBn = lang === 'bn' || (this.lang && this.lang.startsWith('bn'));
    const wantPrefixes = isBn
      ? ['bn-bd', 'bn-in', 'bn']
      : ['en-us', 'en-gb', 'en-ca', 'en-au', 'en-in', 'en'];

    const langVoices = this.voices.filter((v) => {
      const vLang = (v.lang || '').replace('_', '-').toLowerCase();
      return wantPrefixes.some((p) => vLang.startsWith(p));
    });

    const pool = langVoices.length ? langVoices : this.voices;
    if (!pool.length) return null;

    const scoreVoice = (v) => {
      const name = (v.name || '').toLowerCase();
      let score = 0;

      // Microsoft Edge Natural female voices (acclaimed warm storytelling audio)
      if (/jenny/i.test(name)) score += 120;
      if (/aria/i.test(name)) score += 110;
      if (/sara/i.test(name)) score += 105;
      if (/michelle/i.test(name)) score += 100;
      if (/libby|sonia/i.test(name)) score += 95;

      // Google female voices (warm, high quality)
      if (/google.*uk.*female/i.test(name)) score += 95;
      if (/google.*us.*english/i.test(name)) score += 90;
      if (/neural2.*f|wavenet.*f/i.test(name)) score += 88;

      // Apple Natural/Enhanced warm female voices
      if (/samantha/i.test(name)) score += 85;
      if (/ava|serena|karen|victoria|moira|allison/i.test(name)) score += 80;

      // Windows offline clean female voice
      if (/zira/i.test(name)) score += 70;

      // Natural, neural, female descriptors
      if (/natural/i.test(name)) score += 30;
      if (/neural/i.test(name)) score += 25;
      if (/online/i.test(name)) score += 15;
      if (/female/i.test(name)) score += 25;

      // Demote male or robotic voices
      if (/david|mark|george|guy|richard|james|male|robot|steffi/i.test(name) && !/female/i.test(name)) {
        score -= 90;
      }

      return score;
    };

    const sorted = [...pool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    this.activeVoice = sorted[0] || null;
    return this.activeVoice;
  },

  cancel() {
    if (this.ttsSupported) window.speechSynthesis.cancel();
  },

  /** Speak a list of {text, who} items sequentially with a warm, natural storytelling female voice */
  speakAll(items, lang, { onStart, onEnd, onBoundary } = {}) {
    if (!this.ttsSupported || this.muted || !items.length) return Promise.resolve();
    this.abort(); // stop listening while pet speaks so it does not hear itself
    this.cancel();
    const voice = this.pickVoice(lang);

    return new Promise((resolve) => {
      let i = 0;
      const next = () => {
        if (i >= items.length) { resolve(); return; }
        const item = items[i++];
        const cleanText = item.text.replace(/\(.*?\)/g, '').trim();
        if (!cleanText) { next(); return; }

        const u = new SpeechSynthesisUtterance(cleanText);
        u.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
        if (voice) u.voice = voice;

        // Warm, natural storytelling female voice calibration:
        // Grounded natural pitch ~1.00 (not cartoonish/high-pitched 1.35)
        // Gentle relaxed pacing ~0.90 for an engaging storybook companion feel
        let pitch = 1.0;
        let rate = 0.90;

        if (item.who === 'pet') {
          pitch = 1.02; // Warm, friendly female storytelling companion
          rate = 0.90;  // Relaxed, soothing cadence
        } else if (item.who === 'doctor' || /doctor|ডাক্তার/i.test(item.name || item.key || '')) {
          pitch = 0.98; // Caring, calm female doctor
          rate = 0.88;
        } else {
          pitch = 1.00;
          rate = 0.92;
        }

        u.pitch = pitch;
        u.rate = rate;
        u.volume = 1;

        let started = false, finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          clearTimeout(startGuard);
          clearTimeout(maxGuard);
          onEnd?.(item);
          next();
        };

        u.onstart = () => { started = true; onStart?.(item); };
        u.onboundary = (ev) => { if (!finished) onBoundary?.(item, ev.charIndex ?? 0, ev.name); };
        u.onend = finish;
        u.onerror = finish;

        // Protective timers for browser edge cases
        const startGuard = setTimeout(() => {
          if (!started) {
            try { window.speechSynthesis.cancel(); } catch {}
            finish();
          }
        }, 4000);

        const maxGuard = setTimeout(() => {
          try { window.speechSynthesis.cancel(); } catch {}
          finish();
        }, 4000 + cleanText.length * 130);

        window.speechSynthesis.speak(u);
      };

      next();

      // Keep speech synthesis active on long dialogues
      const keepAlive = setInterval(() => {
        if (!window.speechSynthesis.speaking) { clearInterval(keepAlive); return; }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 10000);
    });
  },

  /** Preview the natural warm female storytelling voice */
  testWarmVoice(lang = 'en') {
    const text = lang === 'bn'
      ? 'হ্যালো! আমি তোমার গল্প বলা বন্ধু। চলো আমরা আজ রেস্টুরেন্ট, দোকান বা নতুন কোনো জগতে যাই!'
      : 'Hello! I am your warm storytelling friend. Tell me where you would like to explore today, or ask me to create something magical!';
    return this.speakAll([{ who: 'pet', text }], lang);
  },
};

if (speech.ttsSupported) {
  speech.loadVoices();
  window.speechSynthesis.onvoiceschanged = () => speech.loadVoices();
}
