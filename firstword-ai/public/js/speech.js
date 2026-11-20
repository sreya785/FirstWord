// Speech input/output using the browser's free, built-in Web Speech API.
// Tuned for natural, warm storytelling female AI voice and continuous voice-control play.

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export const speech = {
  supported: Boolean(SR),
  ttsSupported: !!(typeof window !== 'undefined' && (window.speechSynthesis || typeof Audio !== 'undefined')),
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
  activeAudio: null,
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

    // 1. If playing in Bangla, look for genuine natural Bangla voices first
    if (isBn) {
      const wantBn = ['bn-bd', 'bn-in', 'bn', 'ben'];
      const bnVoices = this.voices.filter((v) => {
        const vLang = (v.lang || '').replace('_', '-').toLowerCase();
        const vName = (v.name || '').toLowerCase();
        return wantBn.some((p) => vLang.startsWith(p)) || /bangla|bengali|বাংলা/i.test(vName);
      });

      if (bnVoices.length) {
        const scoreBnVoice = (v) => {
          const name = (v.name || '').toLowerCase();
          let score = 0;
          if (/nabanita/i.test(name)) score += 200; // Edge Natural bn-BD female
          if (/tanishaa/i.test(name)) score += 180; // Edge Natural bn-IN female
          if (/google.*বাংলা|google.*bengali/i.test(name)) score += 160;
          if (/google/i.test(name)) score += 130;
          if (/natural|neural|online/i.test(name)) score += 40;
          if (/female/i.test(name)) score += 30;
          if (/pradeep|bashkar|male/i.test(name)) score -= 20;
          return score;
        };
        const sorted = [...bnVoices].sort((a, b) => scoreBnVoice(b) - scoreBnVoice(a));
        this.activeVoice = sorted[0];
        return this.activeVoice;
      }
      // Never force an English voice onto Bengali text.
      // Delegating with u.voice = null lets Chrome & Edge use their native cloud Bengali voice.
      this.activeVoice = null;
      return null;
    }

    // 2. High quality storytelling voice pool (Edge Natural Jenny/Aria, Google Female, Samantha, Zira)
    // Works everywhere on localhost and cloud so the pet can ALWAYS easily speak aloud!
    const wantPrefixes = isBn
      ? ['bn-bd', 'bn-in', 'bn', 'en-us', 'en-gb', 'en']
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
    if (this.activeAudio) {
      try {
        this.activeAudio.pause();
        this.activeAudio.currentTime = 0;
      } catch {}
      this.activeAudio = null;
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    this.pausedForSpeech = false;
  },

  /** Speak a list of {text, who} items sequentially with a warm, natural voice */
  speakAll(items, lang, { onStart, onEnd, onBoundary } = {}) {
    if (!this.ttsSupported || this.muted || !items.length) return Promise.resolve();
    this.abort(); // stop listening while pet speaks so it does not hear itself
    this.pausedForSpeech = true;
    this.onStateChange?.(false);
    const isBn = lang === 'bn' || (this.lang && this.lang.startsWith('bn'));
    const voice = this.pickVoice(isBn ? 'bn' : 'en');

    return new Promise((resolve) => {
      let i = 0;
      let keepAlive = null;

      const finishAll = () => {
        if (keepAlive) { clearInterval(keepAlive); keepAlive = null; }
        if (this.activeAudio) {
          try { this.activeAudio.pause(); } catch {}
          this.activeAudio = null;
        }
        this.pausedForSpeech = false;
        resolve();
      };

      const next = () => {
        if (i >= items.length) { finishAll(); return; }
        const item = items[i++];
        const cleanText = item.text.replace(/\(.*?\)/g, '').trim();
        if (!cleanText) { next(); return; }

        const hasBangla = /[\u0980-\u09FF]/.test(cleanText) || isBn;

        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          onEnd?.(item);
          setTimeout(next, 100);
        };

        // 1. Natural Google Bangla / Audio Streaming Engine
        // Bypasses browser lack of offline Bangla voice and delivers clear, authentic Bangla speech
        if (hasBangla) {
          const ttsUrl = `/api/tts?q=${encodeURIComponent(cleanText)}&tl=bn`;
          let audio = null;
          let playTimer = null;

          try {
            audio = new Audio(ttsUrl);
            this.activeAudio = audio;

            audio.onplay = () => {
              onStart?.(item);
            };

            audio.ontimeupdate = () => {
              if (audio.duration && !finished) {
                const charIndex = Math.min(cleanText.length, Math.floor((audio.currentTime / audio.duration) * cleanText.length));
                onBoundary?.(item, charIndex);
              }
            };

            audio.onended = () => {
              if (playTimer) clearTimeout(playTimer);
              finish();
            };

            audio.onerror = () => {
              if (playTimer) clearTimeout(playTimer);
              fallbackSpeechSynthesis();
            };

            playTimer = setTimeout(() => {
              if (!finished && (!audio.currentTime || audio.paused)) {
                fallbackSpeechSynthesis();
              }
            }, 6000);

            const p = audio.play();
            if (p && typeof p.catch === 'function') {
              p.catch(() => {
                if (playTimer) clearTimeout(playTimer);
                fallbackSpeechSynthesis();
              });
            }
            return;
          } catch {
            fallbackSpeechSynthesis();
            return;
          }
        } else {
          fallbackSpeechSynthesis();
        }

        // 2. Web Speech API Synthesizer (for English storytelling voices Jenny/Samantha or offline fallback)
        function fallbackSpeechSynthesis() {
          if (typeof window === 'undefined' || !window.speechSynthesis) {
            finish();
            return;
          }

          const u = new SpeechSynthesisUtterance(cleanText);
          u.lang = isBn ? 'bn-BD' : 'en-US';
          if (voice && (!isBn || (voice.lang || '').toLowerCase().startsWith('bn') || /bangla|bengali|বাংলা/i.test(voice.name || ''))) {
            u.voice = voice;
          }

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

          let started = false;
          let startGuard = null, maxGuard = null;

          const finishWebSpeech = () => {
            if (finished) return;
            finished = true;
            if (startGuard) clearTimeout(startGuard);
            if (maxGuard) clearTimeout(maxGuard);
            onEnd?.(item);
            setTimeout(next, 100);
          };

          u.onstart = () => {
            started = true;
            if (startGuard) clearTimeout(startGuard);
            onStart?.(item);
          };
          u.onboundary = (ev) => { if (!finished) onBoundary?.(item, ev.charIndex ?? 0, ev.name); };
          u.onend = finishWebSpeech;
          u.onerror = finishWebSpeech;

          startGuard = setTimeout(() => {
            if (!started) finishWebSpeech();
          }, 6000);

          const durEst = Math.max(6000, 3000 + cleanText.length * 150);
          maxGuard = setTimeout(() => {
            finishWebSpeech();
          }, durEst);

          try {
            window.speechSynthesis.speak(u);
          } catch {
            finishWebSpeech();
          }
        }
      };

      // Ensure speech synthesis is awake and unpaused
      try {
        if (window.speechSynthesis && window.speechSynthesis.paused) window.speechSynthesis.resume();
      } catch {}

      next();

      // Keep speech synthesis active on long dialogues without interrupting
      keepAlive = setInterval(() => {
        try {
          if (!window.speechSynthesis || !window.speechSynthesis.speaking) {
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
