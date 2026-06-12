/* Charla — TTS + sound effects (global AU) */
const AU = {
  ctx: null,
  voice: null,
  srOK: !!(window.SpeechRecognition || window.webkitSpeechRecognition),

  init() {
    // voices load async (esp. iOS)
    const pick = () => {
      const vs = window.speechSynthesis ? speechSynthesis.getVoices() : [];
      const es = vs.filter(v => (v.lang || "").toLowerCase().startsWith("es"));
      if (!es.length) return;
      const pref = ["mónica", "monica", "paulina", "sabina", "helena", "google español", "español"];
      AU.voice = es.find(v => pref.some(p => v.name.toLowerCase().includes(p))) || es[0];
    };
    pick();
    if (window.speechSynthesis && speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = pick;
    }
  },

  ttsOK() { return !!window.speechSynthesis; },

  say(text, slow) {
    if (!window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      if (AU.voice) { u.voice = AU.voice; u.lang = AU.voice.lang; }
      else u.lang = "es-MX";
      u.rate = slow ? 0.55 : 0.95;
      u.pitch = 1.05;
      speechSynthesis.speak(u);
    } catch (e) { /* ignore */ }
  },

  _ac() {
    if (!AU.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      AU.ctx = new AC();
    }
    if (AU.ctx.state === "suspended") AU.ctx.resume();
    return AU.ctx;
  },

  _tone(freq, t0, dur, type, vol) {
    const ctx = AU._ac(); if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, ctx.currentTime + t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, ctx.currentTime + t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t0 + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(ctx.currentTime + t0); o.stop(ctx.currentTime + t0 + dur + 0.05);
  },

  sfx(kind) {
    if (!ST.s.settings.sound) return;
    switch (kind) {
      case "correct": AU._tone(659, 0, 0.12); AU._tone(880, 0.1, 0.18); break;
      case "wrong": AU._tone(196, 0, 0.22, "sawtooth", 0.12); AU._tone(165, 0.16, 0.26, "sawtooth", 0.1); break;
      case "click": AU._tone(520, 0, 0.05, "sine", 0.08); break;
      case "tile": AU._tone(440, 0, 0.05, "sine", 0.07); break;
      case "win": [523, 659, 784, 1047].forEach((f, i) => AU._tone(f, i * 0.12, 0.22)); break;
      case "chest": [784, 988, 1175, 1568].forEach((f, i) => AU._tone(f, i * 0.08, 0.16)); break;
      case "match": AU._tone(740, 0, 0.09); break;
      case "streak": [440, 554, 659, 880].forEach((f, i) => AU._tone(f, i * 0.1, 0.2, "triangle")); break;
    }
  },

  // speech recognition (speaking exercises)
  listen(onResult, onEnd) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { onEnd && onEnd(); return null; }
    const r = new SR();
    r.lang = "es-MX"; r.interimResults = true; r.maxAlternatives = 3;
    let final = "";
    r.onresult = e => {
      let txt = "";
      for (let i = 0; i < e.results.length; i++) txt += e.results[i][0].transcript + " ";
      final = txt.trim();
      onResult && onResult(final, e.results[e.results.length - 1].isFinal);
    };
    r.onerror = () => { onEnd && onEnd(final); };
    r.onend = () => { onEnd && onEnd(final); };
    try { r.start(); } catch (e) { onEnd && onEnd(""); return null; }
    return r;
  }
};
