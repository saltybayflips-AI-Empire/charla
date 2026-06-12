/* Charla — small utilities (global U) */
const U = {
  $: (s, root) => (root || document).querySelector(s),
  $$: (s, root) => Array.from((root || document).querySelectorAll(s)),

  esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  // seeded rng (mulberry32)
  rng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
  hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  },
  shuffle(arr, rnd) {
    const a = arr.slice(); rnd = rnd || Math.random;
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  },
  pick(arr, rnd) { return arr[Math.floor((rnd || Math.random)() * arr.length)]; },

  // dates (local)
  dayKey(d) {
    d = d || new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  },
  monthKey(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"); },
  fromKey(k) { const p = k.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); },
  daysBetween(k1, k2) { // whole days from k1 to k2
    return Math.round((U.fromKey(k2) - U.fromKey(k1)) / 86400000);
  },
  weekKey(d) { // Monday of this week
    d = d ? new Date(d) : new Date();
    const day = (d.getDay() + 6) % 7; // Mon=0
    d.setDate(d.getDate() - day);
    return U.dayKey(d);
  },
  weekDayIdx(d) { d = d || new Date(); return (d.getDay() + 6) % 7; }, // Mon=0..Sun=6
  msToWeekEnd() {
    const mon = U.fromKey(U.weekKey());
    const end = new Date(mon); end.setDate(end.getDate() + 7);
    return end - new Date();
  },
  fmtDur(ms) {
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000);
    return m + ":" + String(s).padStart(2, "0");
  },
  fmtCountdown(ms) {
    if (ms <= 0) return "now";
    const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000), m = Math.floor((ms % 3600000) / 60000);
    if (d > 0) return d + "d " + h + "h";
    if (h > 0) return h + "h " + m + "m";
    return m + "m";
  },

  // text normalization
  norm(s) { // lowercase, strip punctuation, collapse spaces (keeps accents)
    return String(s).toLowerCase()
      .replace(/[¿¡!?.,;:"“”'’()\-—]/g, " ")
      .replace(/\s+/g, " ").trim();
  },
  fold(s) { // norm + strip diacritics
    return U.norm(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
  },
  tokens(s) { return U.norm(s).split(" ").filter(Boolean); },
  rawTokens(s) { // display tokens: original casing, punctuation stripped at edges
    return String(s).split(/\s+/).map(t => t.replace(/^[¿¡"“(]+|[!?.,;:"”)]+$/g, "")).filter(Boolean);
  },
  lev(a, b) {
    if (a === b) return 0;
    const m = a.length, n = b.length;
    if (!m || !n) return Math.max(m, n);
    let prev = Array.from({ length: n + 1 }, (_, i) => i);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[n];
  },

  toast(msg, ms) {
    const root = U.$("#toast-root");
    const t = document.createElement("div");
    t.className = "toast"; t.innerHTML = msg;
    root.appendChild(t);
    setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 320); }, ms || 2600);
  },

  modal(html, opts) { // returns close fn; opts.onClose
    const root = U.$("#modal-root");
    const ov = document.createElement("div");
    ov.className = "m-ov";
    ov.innerHTML = '<div class="m-card">' + html + "</div>";
    const close = () => { ov.remove(); if (opts && opts.onClose) opts.onClose(); };
    ov.addEventListener("click", e => { if (e.target === ov && !(opts && opts.sticky)) close(); });
    root.appendChild(ov);
    return { el: ov, close };
  },

  confetti(n) {
    const colors = ["#58cc02", "#1cb0f6", "#ffc800", "#ff4b4b", "#ce82ff", "#ff9600"];
    for (let i = 0; i < (n || 44); i++) {
      const c = document.createElement("div");
      c.className = "cf";
      c.style.left = Math.random() * 100 + "vw";
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (1.3 + Math.random() * 1.4) + "s";
      c.style.animationDelay = (Math.random() * 0.5) + "s";
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3400);
    }
  },

  // tiny mascot (original parrot, inline SVG)
  parrot(size) {
    size = size || 110;
    return '<svg class="parrot" width="' + size + '" height="' + size + '" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">' +
      '<ellipse cx="60" cy="74" rx="34" ry="38" fill="#58cc02"/>' +
      '<ellipse cx="60" cy="84" rx="22" ry="26" fill="#d7ffb8"/>' +
      '<circle cx="60" cy="38" r="26" fill="#58cc02"/>' +
      '<path d="M48 14 Q60 2 66 14 Q72 8 74 18 Q66 22 58 22 Z" fill="#ff4b4b"/>' +
      '<circle cx="50" cy="36" r="10" fill="#fff"/><circle cx="70" cy="36" r="10" fill="#fff"/>' +
      '<circle cx="52" cy="38" r="4.5" fill="#3c3c3c"/><circle cx="68" cy="38" r="4.5" fill="#3c3c3c"/>' +
      '<path d="M54 50 Q60 44 66 50 Q66 60 60 61 Q54 60 54 50 Z" fill="#ff9600"/>' +
      '<path d="M30 70 Q18 78 26 94 Q36 92 40 82 Z" fill="#1cb0f6"/>' +
      '<path d="M90 70 Q102 78 94 94 Q84 92 80 82 Z" fill="#1cb0f6"/>' +
      '<path d="M52 108 L56 116 L60 108 Z" fill="#ff9600"/><path d="M62 108 L66 116 L70 108 Z" fill="#ff9600"/>' +
      "</svg>";
  }
};
