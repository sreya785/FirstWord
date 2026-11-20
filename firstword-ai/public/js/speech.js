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
   * For Bangla: Prioritizes Microsoft Nabanita (Edge Natural bn-BD), Tanishaa (bn-IN),
   * Google বাংলা, or browser cloud Bangla TTS. NEVER falls back to English for Bengali text.
   * For English: Prioritizes Edge Natural Jenny/Aria, Google US/UK, Samantha/Ava, Zira.
   */
  pickVoice(lang) {
    if (!this.voices.length) this.loadVoices();
    const isBn = lang === 'bn' || (this.lang && this.lang.startsWith('bn'));

    if (isBn) {
      const wantPrefixes = ['bn-bd', 'bn-in', 'bn', 'ben'];
      const bnVoices = this.voices.filter((v) => {
        const vLang = (v.lang || '').replace('_', '-').toLowerCase();
        const vName = (v.name || '').toLowerCase();
        return wantPrefixes.some((p) => vLang.startsWith(p)) || /bangla|bengali|বাংলা/i.test(vName);
      });

      // If browser doesn't have an offline/dedicated Bangla voice object,
      // return null so it delegates to browser's native cloud Bangla TTS (Google বাংলা or Edge Online).
      // NEVER fall back to an English voice for Bangla text!
      if (!bnVoices.length) {
        this.activeVoice = null;
        return null;
      }

      const scoreBnVoice = (v) => {
        const name = (v.name || '').toLowerCase();
        let score = 0;
        // Microsoft Edge Natural female Bangla voices (warm, fluent, expressive)
        if (/nabanita/i.test(name)) score += 200; // bn-BD Natural female
        if (/tanishaa/i.test(name)) score += 180; // bn-IN Natural female
        // Google cloud / high quality Bangla voices
        if (/google.*বাংলা|google.*bengali/i.test(name)) score += 160;
        if (/google/i.test(name)) score += 130;
        if (/natural|neural|online/i.test(name)) score += 40;
        if (/female/i.test(name)) score += 30;
        if (/pradeep|bashkar|male/i.test(name)) score -= 20;
        return score;
      };

      const sorted = [...bnVoices].sort((a, b) => scoreBnVoice(b) - scoreBnVoice(a));
      this.activeVoice = sorted[0] || null;
      return this.activeVoice;
    }

    // English voices
    const wantPrefixes = ['en-us', 'en-gb', 'en-ca', 'en-au', 'en-in', 'en'];
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
    const isBn = lang === 'bn' || (this.lang && this.lang.startsWith('bn'));
    const voice = this.pickVoice(isBn ? 'bn' : 'en');

    return new Promise((resolve) => {
      let i = 0;
      let keepAlive = null;

      const finishAll = () => {
        if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
        resolve();
      };

      const next = () => {
        if (i >= items.length) { finishAll(); return; }
        const item = items[i++];
        const cleanText = item.text.replace(/\(.*?\)/g, '').trim();
        if (!cleanText) { next(); return; }

        const u = new SpeechSynthesisUtterance(cleanText);
        u.lang = isBn ? 'bn-BD' : 'en-US';

        // STRICT VOICE ASSIGNMENT:
        // Only assign u.voice if it genuinely matches the target language!
        if (isBn) {
          if (voice && ((voice.lang || '').toLowerCase().startsWith('bn') || /bangla|bengali|বাংলা/i.test(voice.name || ''))) {
            u.voice = voice;
          }
          // If no dedicated Bangla voice object, leave u.voice unset (null)
          // Browser will automatically use Google বাংলা or Edge Online Bangla!
        } else if (voice) {
          u.voice = voice;
        }

        // Natural, warm storytelling cadence calibration
        let pitch = 1.0;
        let rate = 1.0;

        if (isBn) {
          rate = 1.0; // Fluent natural Bangla tempo (0.90 was sluggish & distorted)
          if (item.who === 'pet') {
            pitch = 1.12; // Cheerful, loving Momo pet companion
          } else if (item.who === 'doctor' || /doctor|ডাক্তার/i.test(item.name || item.key || '')) {
            pitch = 1.0;  // Warm, reassuring female doctor
            rate = 0.96;
          } else {
            pitch = 1.02;
            rate = 1.0;
          }
        } else {
          rate = 0.95;
          if (item.who === 'pet') {
            pitch = 1.08;
          } else if (item.who === 'doctor' || /doctor|ডাক্তার/i.test(item.name || item.key || '')) {
            pitch = 0.98;
            rate = 0.90;
          } else {
            pitch = 1.00;
            rate = 0.94;
          }
        }

        u.pitch = pitch;
        u.rate = rate;
        u.volume = 1;

        let started = false, finished = false;
        let startGuard = null, maxGuard = null;

        const finish = () => {
          if (finished) return;
          finished = true;
          if (startGuard) clearTimeout(startGuard);
          if (maxGuard) clearTimeout(maxGuard);
          onEnd?.(item);
          next();
        };

        u.onstart = () => {
          started = true;
          if (startGuard) clearTimeout(startGuard);
          onStart?.(item);
        };
        u.onboundary = (ev) => { if (!finished) onBoundary?.(item, ev.charIndex ?? 0, ev.name); };
        u.onend = finish;
        u.onerror = (e) => {
          // If interrupted or canceled, finish gracefully without crashing chain
          finish();
        };

        // Generous safeguard in case browser TTS hangs without firing onstart/onerror (8s)
        startGuard = setTimeout(() => {
          if (!started) {
            finish();
          }
        }, 8000);

        // Generous maximum utterance duration safeguard (does not prematurely cancel)
        const durEst = Math.max(8000, 4000 + cleanText.length * 180);
        maxGuard = setTimeout(() => {
          finish();
        }, durEst);

        try {
          window.speechSynthesis.speak(u);
        } catch {
          finish();
        }
      };

      // Ensure speech synthesis is awake and unpaused
      try {
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch {}

      next();

      // Keep speech synthesis active on long dialogues without interrupting
      keepAlive = setInterval(() => {
        try {
          if (!window.speechSynthesis.speaking) {
            clearInterval(keepAlive);
            keepAlive = null;
            return;
          }
          window.speechSynthesis.pause();
          window.speechSynthesis.resume();
        } catch {
          clearInterval(keepAlive);
          keepAlive = null;
        }
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
