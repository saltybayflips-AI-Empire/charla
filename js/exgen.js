/* Charla — course assembly + exercise generation/checking (global EX) */
const EX = {
  COURSE: { sections: [] },
  UNITS: [],
  STORIES: [],
  storyByUnit: {},

  init() {
    if (window.COURSE_PART1 && COURSE_PART1.sections) EX.COURSE.sections.push(...COURSE_PART1.sections);
    if (window.COURSE_PART2 && COURSE_PART2.sections) EX.COURSE.sections.push(...COURSE_PART2.sections);
    EX.COURSE.sections.forEach(sec => sec.units.forEach(u => { u.secColor = sec.color; u.secTitle = sec.title; EX.UNITS.push(u); }));
    EX.STORIES = window.STORIES || [];
    EX.STORIES.forEach(st => { EX.storyByUnit[st.unit] = st; });
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
