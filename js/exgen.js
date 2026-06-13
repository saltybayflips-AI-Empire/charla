/* Charla — course assembly + exercise generation/checking (global EX) */
const EX = {
  COURSE: { sections: [] },
  UNITS: [],
  STORIES: [],
  storyByUnit: {},

  // Spanish connector words for the hint breakdown (high-frequency, unambiguous)
  FUNC_ES: {
    "el": "the", "la": "the", "los": "the", "las": "the", "un": "a", "una": "a", "unos": "some", "unas": "some",
    "yo": "I", "ella": "she", "nosotros": "we", "ellos": "they", "usted": "you",
    "soy": "am", "eres": "are", "es": "is", "somos": "are", "son": "are",
    "estoy": "am", "estas": "are", "esta": "is", "estan": "are", "hay": "there is",
    "y": "and", "o": "or", "pero": "but", "porque": "because", "que": "that",
    "de": "of", "en": "in", "con": "with", "por": "for", "para": "for", "sin": "without",
    "no": "not", "si": "yes", "tambien": "also", "muy": "very", "mas": "more",
    "aqui": "here", "alli": "there", "hoy": "today", "ahora": "now"
  },

  init() {
    window.COURSES = window.COURSES || {};
    window.AUDIO_MAPS = window.AUDIO_MAPS || {};
    window.STORIES_BY_LANG = window.STORIES_BY_LANG || {};
    // legacy shim: the original Spanish files set flat globals — map them into the es bucket
    if (!window.COURSES.es && window.COURSE_PART1) {
      window.COURSES.es = { part1: window.COURSE_PART1, part2: window.COURSE_PART2, func: EX.FUNC_ES };
      window.STORIES_BY_LANG.es = window.STORIES || [];
      window.AUDIO_MAPS.es = window.AUDIO_MAP || {};
    }
    if (window.LANG) LANG.load();
    const code = window.LANG ? LANG.active : "es";

    EX.COURSE = { sections: [] };
    EX.UNITS = [];
    EX.storyByUnit = {};
    const course = window.COURSES[code] || {};
    if (course.part1 && course.part1.sections) EX.COURSE.sections.push(...course.part1.sections);
    if (course.part2 && course.part2.sections) EX.COURSE.sections.push(...course.part2.sections);
    EX.COURSE.sections.forEach(sec => sec.units.forEach(u => { u.secColor = sec.color; u.secTitle = sec.title; EX.UNITS.push(u); }));
    EX.STORIES = window.STORIES_BY_LANG[code] || [];
    EX.STORIES.forEach(st => { EX.storyByUnit[st.unit] = st; });
    // point the audio player at the active language's clip map
    window.AUDIO_MAP = window.AUDIO_MAPS[code] || {};
    EX.buildLexicon();
  },

  /* ---------- vocabulary lexicon (powers hints / glosses) ---------- */
  // phrases: known target-language word-entries, longest first, for chunked glossing.
  // FUNC: per-language map of common connector words (articles, pronouns, copula…).
  buildLexicon() {
    const seen = new Set();
    EX.PHRASES = [];
    EX.UNITS.forEach(u => u.words.forEach(w => {
      const f = U.fold(w.es);
      if (!f || seen.has(f)) return;
      seen.add(f);
      EX.PHRASES.push({ fold: f, raw: w.es, en: w.en, n: f.split(" ").length });
    }));
    EX.PHRASES.sort((a, b) => b.n - a.n); // greedy longest-match first
    // function-word gloss map (folded keys)
    EX.FUNC = {};
    const code = window.LANG ? LANG.active : "es";
    const src = (window.COURSES[code] && window.COURSES[code].func) || {};
    Object.keys(src).forEach(k => { EX.FUNC[U.fold(k)] = src[k]; });
  },

  // break a target sentence into known [chunk, meaning] pairs (best effort)
  gloss(text) {
    const toks = U.rawTokens(text);
    const folds = toks.map(t => U.fold(t));
    const out = [];
    let i = 0;
    while (i < toks.length) {
      let hit = null;
      for (const p of EX.PHRASES) {
        if (p.n > toks.length - i) continue;
        if (folds.slice(i, i + p.n).join(" ") === p.fold) { hit = p; break; }
      }
      if (hit) { out.push([toks.slice(i, i + hit.n).join(" "), hit.en]); i += hit.n; }
      else { out.push([toks[i], EX.FUNC[folds[i]] || null]); i++; }
    }
    return out;
  },

  // grammar "why" for a sentence: prefer the sentence's own tip, else the unit tip
  whyFor(u, sent) {
    if (sent && sent.tip) return sent.tip;
    return u && u.tip ? u.tip : "";
  },

  /* ---------- answer diff (what went wrong) ---------- */
  // token-level LCS so we can mark which words matched / were missed / were extra
  lcsMatch(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = m - 1; i >= 0; i--)
      for (let j = n - 1; j >= 0; j--)
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const ai = new Set(), bi = new Set();
    let i = 0, j = 0;
    while (i < m && j < n) {
      if (a[i] === b[j]) { ai.add(i); bi.add(j); i++; j++; }
      else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
      else j++;
    }
    return { ai, bi }; // matched index sets in a and b
  },

  // returns {youHtml, solHtml}: user's words with wrong ones struck; solution with missed words bolded
  answerDiffHtml(userText, correctText) {
    const uT = U.rawTokens(userText), cT = U.rawTokens(correctText);
    if (!uT.length) return { youHtml: "", solHtml: U.esc(correctText) };
    const { ai, bi } = EX.lcsMatch(uT.map(U.fold), cT.map(U.fold));
    const youHtml = uT.map((t, k) => ai.has(k) ? U.esc(t) : '<span class="d-bad">' + U.esc(t) + "</span>").join(" ");
    const solHtml = cT.map((t, k) => bi.has(k) ? U.esc(t) : '<b class="d-add">' + U.esc(t) + "</b>").join(" ");
    return { youHtml, solHtml };
  },

  unit(id) { return EX.UNITS.find(u => u.id === id); },
  story(id) { return EX.STORIES.find(s => s.id === id); },

  /* ---------- path nodes ---------- */
  nodesForUnit(u) {
    const nodes = [
      { type: "lesson", li: 0 }, { type: "lesson", li: 1 },
      { type: "chest" },
      { type: "lesson", li: 2 }, { type: "lesson", li: 3 }
    ];
    if (EX.storyByUnit[u.id]) nodes.push({ type: "story", storyId: EX.storyByUnit[u.id].id });
    nodes.push({ type: "trophy" });
    return nodes.map((n, i) => Object.assign(n, { id: u.id + ":" + i, unitId: u.id }));
  },

  allNodes() {
    const out = [];
    EX.UNITS.forEach(u => out.push(...EX.nodesForUnit(u)));
    return out;
  },

  activeNode() {
    const nodes = EX.allNodes();
    return nodes.find(n => !ST.s.path.done[n.id]) || null;
  },

  unitProgress(u) {
    const nodes = EX.nodesForUnit(u);
    const done = nodes.filter(n => ST.s.path.done[n.id]).length;
    return { done, total: nodes.length };
  },

  /* ---------- distractor pools ---------- */
  wordPool(lang, excludeFold) {
    const out = [];
    EX.UNITS.forEach(u => u.words.forEach(w => {
      const t = lang === "es" ? w.es : w.en;
      U.rawTokens(t).forEach(tok => {
        if (tok.length > 1 && !excludeFold.has(U.fold(tok))) out.push(tok);
      });
    }));
    return out;
  },

  bank(sentence, lang, nDistract) {
    const target = U.rawTokens(sentence);
    const used = new Set(target.map(t => U.fold(t)));
    const pool = [];
    // distractors: tokens from other sentences in the course (same language)
    EX.UNITS.forEach(u => u.sentences.forEach(s => {
      U.rawTokens(lang === "es" ? s.es : s.en).forEach(tok => {
        const f = U.fold(tok);
        if (tok.length > 1 && !used.has(f) && !pool.some(p => U.fold(p) === f)) pool.push(tok);
      });
    }));
    const distract = U.shuffle(pool).slice(0, nDistract || Math.min(4, 3 + Math.floor(Math.random() * 2)));
    return U.shuffle(target.concat(distract));
  },

  /* ---------- lesson builders ---------- */
  buildLesson(u, li) {
    const specs = [];
    const wCount = u.words.length;
    const newIdx = [li * 3 % wCount, (li * 3 + 1) % wCount, (li * 3 + 2) % wCount];
    // intro the new words
    newIdx.forEach((wi, k) => {
      const w = u.words[wi];
      if (w.emoji && k % 2 === 0) specs.push({ t: "img", u: u.id, wi });
      else specs.push({ t: "mc", u: u.id, wi, dir: k % 2 ? "ef" : "fe" });
    });
    // one pairs round
    const pairIdx = U.shuffle(Array.from({ length: wCount }, (_, i) => i)).slice(0, 5);
    specs.push({ t: "pairs", u: u.id, ws: pairIdx });
    // sentence drills
    const sIdx = U.shuffle(Array.from({ length: u.sentences.length }, (_, i) => i), U.rng(U.hash(u.id + li))).slice(0, 6);
    const types = ["tr-fe", "tr-ef", "lt", "fb", "th", "tr-fe"];
    sIdx.forEach((si, k) => {
      const ty = types[k % types.length];
      if (ty === "tr-fe") specs.push({ t: "tr", u: u.id, si, dir: "fe" });
      else if (ty === "tr-ef") specs.push({ t: "tr", u: u.id, si, dir: "ef" });
      else if (ty === "lt") specs.push(AU.ttsOK() ? { t: "lt", u: u.id, si } : { t: "tr", u: u.id, si, dir: "fe" });
      else if (ty === "th") {
        if (k === 4 && AU.speakAllowed()) specs.push({ t: "sp", u: u.id, si });
        else specs.push(AU.ttsOK() ? { t: "th", u: u.id, si } : { t: "tr", u: u.id, si, dir: "ef" });
      }
      else specs.push({ t: "fb", u: u.id, si });
    });
    return specs;
  },

  buildReview(u) {
    const specs = [];
    const wIdx = U.shuffle(Array.from({ length: u.words.length }, (_, i) => i));
    wIdx.slice(0, 3).forEach((wi, k) => {
      const w = u.words[wi];
      if (w.emoji && k === 0) specs.push({ t: "img", u: u.id, wi });
      else specs.push({ t: "mc", u: u.id, wi, dir: k % 2 ? "ef" : "fe" });
    });
    specs.push({ t: "pairs", u: u.id, ws: wIdx.slice(3, 8) });
    const sIdx = U.shuffle(Array.from({ length: u.sentences.length }, (_, i) => i)).slice(0, 8);
    const types = ["tr-fe", "lt", "tr-ef", "fb", "th", "tr-fe", "lt", "tr-ef"];
    sIdx.forEach((si, k) => {
      const ty = types[k % types.length];
      if (ty === "lt" || ty === "th") specs.push(AU.ttsOK() ? { t: ty, u: u.id, si } : { t: "tr", u: u.id, si, dir: "fe" });
      else if (ty === "fb") specs.push({ t: "fb", u: u.id, si });
      else specs.push({ t: "tr", u: u.id, si, dir: ty === "tr-fe" ? "fe" : "ef" });
    });
    return specs;
  },

  buildLegendary(u, li) {
    // like the lesson but typed translations, no pairs
    return EX.buildLesson(u, li)
      .filter(s => s.t !== "pairs" && s.t !== "img" && s.t !== "mc")
      .map(s => s.t === "tr" ? Object.assign({}, s, { typed: true }) : s)
      .slice(0, 8);
  },

  learnedUnits() {
    // units where at least one node is done (plus always the first)
    const us = EX.UNITS.filter(u => EX.nodesForUnit(u).some(n => ST.s.path.done[n.id]));
    return us.length ? us : EX.UNITS.slice(0, 1);
  },

  buildPractice() {
    const us = EX.learnedUnits();
    // weakest words first
    const scored = [];
    us.forEach(u => u.words.forEach((w, wi) => {
      const rec = ST.s.words[u.id + ":" + wi];
      scored.push({ u, wi, s: rec ? rec.s : 2.5 });
    }));
    scored.sort((a, b) => a.s - b.s);
    const specs = [];
    scored.slice(0, 4).forEach((x, k) => {
      const w = x.u.words[x.wi];
      if (w.emoji && k % 2 === 0) specs.push({ t: "img", u: x.u.id, wi: x.wi });
      else specs.push({ t: "mc", u: x.u.id, wi: x.wi, dir: k % 2 ? "ef" : "fe" });
    });
    const u = U.pick(us);
    specs.push({ t: "pairs", u: u.id, ws: U.shuffle(Array.from({ length: u.words.length }, (_, i) => i)).slice(0, 5) });
    for (let k = 0; k < 4; k++) {
      const uu = U.pick(us);
      const si = Math.floor(Math.random() * uu.sentences.length);
      const ty = ["tr", "lt", "tr", "fb"][k];
      if (ty === "lt" && AU.ttsOK()) specs.push({ t: "lt", u: uu.id, si });
      else if (ty === "fb") specs.push({ t: "fb", u: uu.id, si });
      else specs.push({ t: "tr", u: uu.id, si, dir: k % 2 ? "ef" : "fe" });
    }
    return specs;
  },

  buildListening() {
    const us = EX.learnedUnits();
    const specs = [];
    for (let k = 0; k < 8; k++) {
      const u = U.pick(us);
      const si = Math.floor(Math.random() * u.sentences.length);
      specs.push({ t: k % 3 === 2 ? "th" : "lt", u: u.id, si });
    }
    return specs;
  },

  buildMistakes() {
    return U.shuffle(ST.s.mistakes).slice(0, 10).map(m => Object.assign({}, m, { fromMistakes: true }));
  },

  /* ---------- per-spec data ---------- */
  resolve(spec) {
    const u = EX.unit(spec.u);
    const out = { u, spec };
    if (spec.si !== undefined) out.sent = u.sentences[spec.si];
    if (spec.wi !== undefined) out.word = u.words[spec.wi];
    if (spec.ws) out.words = spec.ws.map(i => u.words[i]);
    return out;
  },

  // multiple-choice options for a word (returns {opts, correct})
  mcOptions(u, wi, dir) {
    const w = u.words[wi];
    const correct = dir === "fe" ? w.en : w.es;
    const seen = new Set([U.fold(correct)]);
    const pool = [];
    EX.UNITS.forEach(uu => uu.words.forEach((ww, i) => {
      if (uu.id === u.id && i === wi) return;
      const t = dir === "fe" ? ww.en : ww.es;
      const f = U.fold(t);
      if (!seen.has(f)) { seen.add(f); pool.push(t); }
    }));
    const opts = U.shuffle(U.shuffle(pool).slice(0, 3).concat([correct]));
    return { opts, correct };
  },

  imgOptions(u, wi) {
    const w = u.words[wi];
    const pool = [];
    EX.UNITS.forEach(uu => uu.words.forEach((ww, i) => {
      if (ww.emoji && !(uu.id === u.id && i === wi) && ww.emoji !== w.emoji) pool.push(ww);
    }));
    const opts = U.shuffle(U.shuffle(pool).slice(0, 3).concat([w]));
    return { opts, correct: w };
  },

  fbData(u, si) {
    const sent = u.sentences[si];
    const toks = U.rawTokens(sent.es);
    const rnd = U.rng(U.hash("fb" + u.id + si));
    const cands = toks.map((t, i) => ({ t, i })).filter(x => x.t.length >= 3);
    const pickFrom = cands.length ? cands : toks.map((t, i) => ({ t, i }));
    const blank = pickFrom[Math.floor(rnd() * pickFrom.length)];
    const used = new Set([U.fold(blank.t)]);
    const pool = EX.wordPool("es", used).filter(t => Math.abs(t.length - blank.t.length) <= 3);
    const opts = U.shuffle(U.shuffle(pool).slice(0, 2).concat([blank.t]));
    return { toks, blankIdx: blank.i, answer: blank.t, opts, sent };
  },

  /* ---------- answer checking ---------- */
  checkTokens(selected, target, alts) {
    const sel = U.fold(selected.join(" "));
    const cands = [target].concat(alts || []);
    return cands.some(c => U.fold(c) === sel);
  },

  checkTyped(input, target, alts) {
    const inF = U.fold(input), inN = U.norm(input);
    if (!inF) return { ok: false };
    const cands = [target].concat(alts || []);
    for (const c of cands) {
      const cF = U.fold(c), cN = U.norm(c);
      if (inN === cN) return { ok: true };
      if (inF === cF) return { ok: true, accents: true };
      if (cF.length > 4 && U.lev(inF, cF) === 1) return { ok: true, typo: true };
    }
    return { ok: false };
  },

  checkSpeech(transcript, target) {
    const tT = U.fold(target).split(" ").filter(Boolean);
    const tH = new Set(U.fold(transcript).split(" ").filter(Boolean));
    if (!tT.length) return false;
    const hit = tT.filter(t => tH.has(t)).length;
    return hit / tT.length >= 0.55;
  }
};
