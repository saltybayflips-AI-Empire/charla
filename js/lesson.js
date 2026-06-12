/* Charla — lesson session controller (global LS) */
const LS = {
  cur: null,
  suspended: null,

  PRAISE: ["Nice!", "Excellent!", "¡Muy bien!", "Great job!", "¡Perfecto!", "You got it!", "Awesome!"],
  TITLES: {
    tr_fe: "Translate this sentence",
    tr_ef: "Translate into Spanish",
    lt: "Tap what you hear",
    th: "Type what you hear",
    fb: "Fill in the blank",
    mc_fe: "What does this mean?",
    mc_ef: "How do you say this in Spanish?",
    img: "Select the correct image",
    pairs: "Match the pairs",
    sp: "Say this sentence"
  },

  start(opts) {
    // opts: {kind, specs, nodeId, unitId, baseXp, heartsFree, lives, label}
    if (!opts.heartsFree && ST.hearts() <= 0) { SC.heartsModal(); return; }
    LS.cur = {
      o: opts,
      queue: opts.specs.slice(),
      pos: 0,
      done: 0,
      wrong: 0,
      combo: 0,
      comboMax: 0,
      requeues: 0,
      lives: opts.lives || 0,
      t0: Date.now(),
      checked: false,
      evalFn: null
    };
    LS.shell();
    LS.renderEx();
  },

  shell() {
    const root = U.$("#lesson-root");
    root.innerHTML =
      '<div class="ls">' +
      '  <div class="ls-head">' +
      '    <button class="ls-quit" id="ls-quit">✕</button>' +
      '    <div class="pbar"><div class="fill" id="ls-fill" style="width:0%"></div></div>' +
      '    <div class="ls-hearts" id="ls-hearts"></div>' +
      '  </div>' +
      '  <div class="ls-body" id="ls-body"></div>' +
      '  <div class="ls-foot" id="ls-foot"></div>' +
      "</div>";
    U.$("#ls-quit").onclick = LS.confirmQuit;
    LS.updateHead();
  },

  updateHead() {
    const c = LS.cur; if (!c) return;
    const pct = c.done / Math.max(1, c.done + (c.queue.length - c.pos));
    U.$("#ls-fill").style.width = Math.round(pct * 100) + "%";
    const h = U.$("#ls-hearts");
    if (c.o.kind === "legendary") h.innerHTML = '<span style="color:var(--purple)">⚡ ' + c.lives + "</span>";
    else if (c.o.heartsFree) h.innerHTML = '<span style="color:var(--blue)">∞</span>';
    else h.textContent = "❤️ " + ST.hearts();
  },

  /* ---------- footer states ---------- */
  footCheck(enabled, extraHtml) {
    const f = U.$("#ls-foot");
    f.className = "ls-foot";
    f.innerHTML = (extraHtml || "") + '<button class="btn btn-green" id="ls-check" ' + (enabled ? "" : "disabled") + ">Check</button>";
    const b = U.$("#ls-check");
    b.onclick = () => LS.onCheck();
  },
  ready(on) {
    const b = U.$("#ls-check");
    if (b) b.disabled = !on;
  },
  footFeedback(ok, solutionHtml, noteHtml) {
    const c = LS.cur;
    const f = U.$("#ls-foot");
    f.className = "ls-foot " + (ok ? "ok" : "bad");
    let head = ok
      ? '<div class="fb-head">✔︎ ' + U.pick(LS.PRAISE) + (c.combo >= 5 ? ' <span class="combo">' + c.combo + " in a row!</span>" : "") + "</div>"
      : '<div class="fb-head">✖︎ Incorrect</div>';
    f.innerHTML = head +
      (noteHtml ? '<div class="fb-note">' + noteHtml + "</div>" : "") +
      (!ok && solutionHtml ? '<div class="fb-sol"><b>Correct solution:</b> ' + solutionHtml + "</div>" : "") +
      '<button class="btn ' + (ok ? "btn-green" : "btn-red") + '" id="ls-cont">Continue</button>';
    U.$("#ls-cont").onclick = () => LS.onContinue(ok);
  },

  /* ---------- check / continue ---------- */
  onCheck() {
    const c = LS.cur;
    if (!c || c.checked || !c.evalFn) return;
    const res = c.evalFn();
    if (!res) return;
    c.checked = true;
    LS.applyResult(res);
  },

  applyResult(res) {
    const c = LS.cur;
    const spec = c.queue[c.pos];
    if (res.ok) {
      c.combo++; c.comboMax = Math.max(c.comboMax, c.combo);
      AU.sfx("correct");
      if (spec.wi !== undefined) ST.wordRec(spec.u + ":" + spec.wi, true);
      if (spec.fromMistakes) ST.clearMistake(spec);
      if (spec.t === "lt" || spec.t === "th") ST.questBump("listen", 1);
      let note = res.accents ? "Watch the accents — otherwise perfect!" : (res.typo ? "You have a small typo — accepted." : (res.note || ""));
      LS.footFeedback(true, null, note);
    } else {
      c.combo = 0; c.wrong++;
      AU.sfx("wrong");
      if (spec.wi !== undefined) ST.wordRec(spec.u + ":" + spec.wi, false);
      if (!spec.fromMistakes) ST.pushMistake(spec);
      // requeue (cap)
      if (c.requeues < 6) { c.queue.push(Object.assign({}, spec)); c.requeues++; }
      if (c.o.kind === "legendary") {
        c.lives--;
        LS.updateHead();
        if (c.lives <= 0) { LS.legendFail(); return; }
      } else if (!c.o.heartsFree && spec.t !== "pairs") {
        ST.loseHeart();
        LS.updateHead();
        SC.renderHeader();
        if (ST.hearts() <= 0) { LS.footFeedback(false, res.solution || "", ""); LS.outOfHearts(); return; }
      }
      LS.footFeedback(false, res.solution || "");
    }
  },

  onContinue(wasOk) {
    const c = LS.cur;
    c.done++;
    c.pos++;
    c.checked = false;
    c.evalFn = null;
    LS.updateHead();
    if (c.pos >= c.queue.length) LS.finish();
    else LS.renderEx();
  },

  confirmQuit() {
    const m = U.modal(
      '<div class="m-em">😢</div><h3>Wait, don\'t go!</h3>' +
      "<p>You'll lose your progress in this session.</p>" +
      '<button class="btn btn-green" id="mq-stay">Keep learning</button>' +
      '<button class="btn btn-ghost" id="mq-quit">End session</button>', { sticky: true });
    U.$("#mq-stay").onclick = m.close;
    U.$("#mq-quit").onclick = () => { m.close(); LS.close(); };
  },

  close() {
    LS.cur = null;
    U.$("#lesson-root").innerHTML = "";
    SC.renderHeader();
    PT.render();
  },

  /* ---------- hearts depleted ---------- */
  outOfHearts() {
    const m = U.modal(
      '<div class="m-em">💔</div><h3>You ran out of hearts!</h3>' +
      "<p>Get more hearts to keep learning.</p>" +
      '<button class="btn btn-blue" id="oh-refill">Refill — 💎 ' + ST.REFILL_COST + "</button>" +
      '<button class="btn btn-green" id="oh-practice">Practice to earn a heart</button>' +
      '<button class="btn btn-ghost" id="oh-quit">End session</button>', { sticky: true });
    U.$("#oh-refill").onclick = () => {
      if (ST.spendGems(ST.REFILL_COST)) {
        ST.refillHearts(); m.close(); LS.updateHead(); SC.renderHeader();
        U.toast("❤️ Hearts refilled!");
      } else U.toast("Not enough gems 💎");
    };
    U.$("#oh-practice").onclick = () => {
      m.close();
      LS.suspended = LS.cur;
      LS.start({ kind: "recover", specs: EX.buildPractice(), heartsFree: true, baseXp: 0, label: "Heart practice" });
    };
    U.$("#oh-quit").onclick = () => { m.close(); LS.close(); };
  },

  legendFail() {
    const body = U.$("#ls-body"), f = U.$("#ls-foot");
    body.innerHTML =
      '<div class="moment"><div class="big-em">💜</div><h1>So close!</h1>' +
      "<p>Legendary allows only a few mistakes. Try again!</p></div>";
    f.className = "ls-foot";
    f.innerHTML = '<button class="btn btn-purple" id="lf-x">Back to path</button>';
    U.$("#lf-x").onclick = LS.close;
  },

  /* ---------- finish flow ---------- */
  finish() {
    const c = LS.cur;
    if (c.o.kind === "recover") {
      ST.gainHeart(1);
      if (LS.suspended) {
        const s = LS.suspended; LS.suspended = null;
        U.toast("❤️ +1 heart — back to your lesson!");
        LS.cur = s; LS.shell(); LS.renderEx();
        return;
      }
      LS.close();
      return;
    }
    const perfect = c.wrong === 0;
    let xp = c.o.baseXp;
    if (perfect && (c.o.kind === "lesson" || c.o.kind === "review")) xp += ST.PERFECT_BONUS;
    const res = ST.earnXP(xp);
    // node completion
    if (c.o.nodeId) ST.s.path.done[c.o.nodeId] = (c.o.kind === "legendary") ? 2 : (ST.s.path.done[c.o.nodeId] || 1);
    ST.s.stats.lessons++;
    if (perfect) { ST.s.stats.perfect++; ST.questBump("perfect", 1); }
    ST.s.stats.timeMs += Date.now() - c.t0;
    ST.questBump("lessons", 1);
    ST.questBump("combo", c.comboMax);
    ST.addGems(2);
    ST.save();
    const newAch = ST.checkAchievements();
    const acc = c.done ? Math.round(100 * (c.done - c.wrong - c.requeues) / Math.max(1, c.done - c.requeues)) : 100;
    // results screen
    const body = U.$("#ls-body"), f = U.$("#ls-foot");
    AU.sfx("win");
    U.confetti();
    body.innerHTML =
      '<div class="moment">' + U.parrot(120) +
      '<h1 class="' + (perfect ? "green" : "") + '">' + (perfect ? "Perfect lesson!" : "Lesson complete!") + "</h1>" +
      '<div class="chips">' +
      '  <div class="chip gold"><div class="ch-top">Total XP</div><div class="ch-val">⚡ ' + res.amt + (res.boosted ? " ×2" : "") + "</div></div>" +
      '  <div class="chip green"><div class="ch-top">Accuracy</div><div class="ch-val">🎯 ' + Math.max(0, Math.min(100, acc)) + "%</div></div>" +
      '  <div class="chip blue"><div class="ch-top">Time</div><div class="ch-val">⏱ ' + U.fmtDur(Date.now() - c.t0) + "</div></div>" +
      "</div></div>";
    f.className = "ls-foot";
    f.innerHTML = '<button class="btn btn-green" id="ls-res-cont">Continue</button>';
    U.$("#ls-res-cont").onclick = () => {
      if (res.firstToday) LS.streakScreen(newAch);
      else LS.afterResults(newAch);
    };
  },

  streakScreen(newAch) {
    const body = U.$("#ls-body"), f = U.$("#ls-foot");
    AU.sfx("streak");
    const days = ["M", "T", "W", "T", "F", "S", "S"];
    const mon = U.fromKey(U.weekKey());
    let row = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(d.getDate() + i);
      const k = U.dayKey(d);
      const hit = (ST.s.xp.byDay[k] || 0) > 0;
      const frozen = ST.s.streak.frozenDays[k];
      const today = k === U.dayKey();
      row += '<div class="wd ' + (hit ? "hit" : "") + (frozen ? " frozen" : "") + (today ? " today" : "") + '">' +
        '<div class="bub">' + (hit ? "✓" : (frozen ? "🧊" : "")) + "</div>" + days[i] + "</div>";
    }
    body.innerHTML =
      '<div class="moment"><div class="flame-big">🔥</div>' +
      '<div class="streak-n">' + ST.s.streak.n + "</div>" +
      '<h1 style="color:var(--orange)">day streak!</h1>' +
      '<div class="week-row">' + row + "</div>" +
      '<p style="color:#777">' + (ST.s.streak.freezes ? "🧊 " + ST.s.streak.freezes + " streak freeze" + (ST.s.streak.freezes > 1 ? "s" : "") + " equipped" : "Tip: grab a Streak Freeze in the shop!") + "</p></div>";
    f.className = "ls-foot";
    f.innerHTML = '<button class="btn btn-green" id="ls-stk-cont">Continue</button>';
    U.$("#ls-stk-cont").onclick = () => LS.afterResults(newAch);
  },

  afterResults(newAch) {
    LS.close();
    const doneQ = ST.s.quests.items.filter(it => it.done && !it.claimed).length;
    if (doneQ) U.toast("🎯 Daily quest complete — claim your chest in Quests!");
    (newAch || []).forEach(a => U.toast(a.em + " Achievement: <b>" + a.name + "</b> tier " + a.tier + "!"));
    SC.maybeLeagueBanner();
  },

  /* ---------- exercise renderers ---------- */
  renderEx() {
    const c = LS.cur;
    const spec = c.queue[c.pos];
    const r = EX.resolve(spec);
    const body = U.$("#ls-body");
    body.scrollTop = 0;
    c.evalFn = null;
    c.checked = false;
    switch (spec.t) {
      case "tr": spec.typed ? LS.exTranslateTyped(body, r) : LS.exTranslateTap(body, r); break;
      case "lt": LS.exListenTap(body, r); break;
      case "th": LS.exTypeHeard(body, r); break;
      case "fb": LS.exFillBlank(body, r); break;
      case "mc": LS.exMultiChoice(body, r); break;
      case "img": LS.exImage(body, r); break;
      case "pairs": LS.exPairs(body, r); break;
      case "sp": LS.exSpeak(body, r); break;
      default: LS.onContinue(true); return;
    }
    LS.updateHead();
  },

  speakerRow(text, showText) {
    return '<div class="ex-prompt-row">' +
      '<button class="spk" data-say="' + U.esc(text) + '">🔊</button>' +
      '<button class="spk turtle" data-say-slow="' + U.esc(text) + '">🐢</button>' +
      (showText ? '<span class="ex-sentence"><b>' + U.esc(text) + "</b></span>" : "") +
      "</div>";
  },
  bindSpeakers(root, autoText) {
    U.$$("[data-say]", root).forEach(b => b.onclick = () => AU.say(b.getAttribute("data-say")));
    U.$$("[data-say-slow]", root).forEach(b => b.onclick = () => AU.say(b.getAttribute("data-say-slow"), true));
    if (autoText && AU.ttsOK()) setTimeout(() => AU.say(autoText), 250);
  },

  // --- translate with word bank ---
  exTranslateTap(body, r) {
    const c = LS.cur, spec = r.spec, sent = r.sent;
    const src = spec.dir === "fe" ? sent.es : sent.en;
    const tgt = spec.dir === "fe" ? sent.en : sent.es;
    const alts = spec.dir === "fe" ? (sent.altEn || []) : (sent.altEs || []);
    const lang = spec.dir === "fe" ? "en" : "es";
    body.innerHTML =
      '<div class="ex-title">' + LS.TITLES["tr_" + spec.dir] + "</div>" +
      (spec.dir === "fe" ? LS.speakerRow(src, true) : '<div class="ex-prompt-row"><span class="ex-sentence"><b>' + U.esc(src) + "</b></span></div>") +
      '<div class="answer-zone" id="az"></div>' +
      '<div class="bank" id="bank"></div>' +
      '<button class="btn btn-ghost small kb-toggle" id="kb-tog">Use keyboard</button>';
    const az = U.$("#az"), bank = U.$("#bank");
    const azTokens = () => U.$$(".tile", az).map(b => b.textContent);
    EX.bank(tgt, lang).forEach(tok => {
      const b = document.createElement("button");
      b.className = "tile"; b.textContent = tok;
      b.onclick = () => {
        AU.sfx("tile");
        if (b.dataset.in === "1") return;
        b.classList.add("ghost"); b.dataset.in = "1";
        const a = document.createElement("button");
        a.className = "tile"; a.textContent = tok;
        a.onclick = () => { AU.sfx("tile"); a.remove(); b.classList.remove("ghost"); b.dataset.in = ""; LS.ready(azTokens().length > 0); };
        az.appendChild(a);
        LS.ready(true);
        if (lang === "es") AU.say(tok);
      };
      bank.appendChild(b);
    });
    U.$("#kb-tog").onclick = () => { r.spec.typed = true; LS.renderEx(); };
    LS.footCheck(false);
    c.evalFn = () => {
      const ok = EX.checkTokens(azTokens(), tgt, alts);
      return { ok, solution: U.esc(tgt) };
    };
    if (spec.dir === "fe") LS.bindSpeakers(body, src);
  },

  exTranslateTyped(body, r) {
    const c = LS.cur, spec = r.spec, sent = r.sent;
    const src = spec.dir === "fe" ? sent.es : sent.en;
    const tgt = spec.dir === "fe" ? sent.en : sent.es;
    const alts = spec.dir === "fe" ? (sent.altEn || []) : (sent.altEs || []);
    body.innerHTML =
      '<div class="ex-title">' + LS.TITLES["tr_" + spec.dir] + "</div>" +
      (spec.dir === "fe" ? LS.speakerRow(src, true) : '<div class="ex-prompt-row"><span class="ex-sentence"><b>' + U.esc(src) + "</b></span></div>") +
      '<textarea class="typed" id="ty" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type in ' + (spec.dir === "fe" ? "English" : "Spanish") + '"></textarea>';
    const ty = U.$("#ty");
    ty.oninput = () => LS.ready(ty.value.trim().length > 0);
    LS.footCheck(false);
    c.evalFn = () => {
      const res = EX.checkTyped(ty.value, tgt, alts);
      return { ok: res.ok, accents: res.accents, typo: res.typo, solution: U.esc(tgt) };
    };
    if (spec.dir === "fe") LS.bindSpeakers(body, src);
    setTimeout(() => ty.focus(), 200);
  },

  // --- listening ---
  exListenTap(body, r) {
    const c = LS.cur, sent = r.sent;
    body.innerHTML =
      '<div class="ex-title">' + LS.TITLES.lt + "</div>" +
      '<div class="ex-prompt-row" style="justify-content:center">' +
      '<button class="spk big" data-say="' + U.esc(sent.es) + '">🔊</button>' +
      '<button class="spk turtle" data-say-slow="' + U.esc(sent.es) + '">🐢</button></div>' +
      '<div class="answer-zone" id="az"></div><div class="bank" id="bank"></div>';
    const az = U.$("#az"), bank = U.$("#bank");
    const azTokens = () => U.$$(".tile", az).map(b => b.textContent);
    EX.bank(sent.es, "es").forEach(tok => {
      const b = document.createElement("button");
      b.className = "tile"; b.textContent = tok;
      b.onclick = () => {
        AU.sfx("tile");
        if (b.dataset.in === "1") return;
        b.classList.add("ghost"); b.dataset.in = "1";
        const a = document.createElement("button");
        a.className = "tile"; a.textContent = tok;
        a.onclick = () => { a.remove(); b.classList.remove("ghost"); b.dataset.in = ""; LS.ready(azTokens().length > 0); };
        az.appendChild(a);
        LS.ready(true);
      };
      bank.appendChild(b);
    });
    LS.footCheck(false);
    c.evalFn = () => ({ ok: EX.checkTokens(azTokens(), sent.es, sent.altEs || []), solution: U.esc(sent.es) });
    LS.bindSpeakers(body, sent.es);
  },

  exTypeHeard(body, r) {
    const c = LS.cur, sent = r.sent;
    body.innerHTML =
      '<div class="ex-title">' + LS.TITLES.th + "</div>" +
      '<div class="ex-prompt-row" style="justify-content:center">' +
      '<button class="spk big" data-say="' + U.esc(sent.es) + '">🔊</button>' +
      '<button class="spk turtle" data-say-slow="' + U.esc(sent.es) + '">🐢</button></div>' +
      '<textarea class="typed" id="ty" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="Type in Spanish"></textarea>';
    const ty = U.$("#ty");
    ty.oninput = () => LS.ready(ty.value.trim().length > 0);
    LS.footCheck(false);
    c.evalFn = () => {
      const res = EX.checkTyped(ty.value, sent.es, sent.altEs || []);
      return { ok: res.ok, accents: res.accents, typo: res.typo, solution: U.esc(sent.es) };
    };
    LS.bindSpeakers(body, sent.es);
  },

  // --- fill in the blank ---
  exFillBlank(body, r) {
    const c = LS.cur, spec = r.spec;
    const d = EX.fbData(r.u, spec.si);
    const shown = d.toks.map((t, i) => i === d.blankIdx ? "<b>____</b>" : U.esc(t)).join(" ");
    body.innerHTML =
      '<div class="ex-title">' + LS.TITLES.fb + "</div>" +
      '<div class="ex-prompt-row"><span class="ex-sentence">' + shown + "</span></div>" +
      '<p style="color:#777;font-size:14px;margin:0 0 14px">“' + U.esc(d.sent.en) + "”</p>" +
      '<div class="choices" id="ch"></div>';
    let sel = null;
    const ch = U.$("#ch");
    d.opts.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = '<span class="ix">' + (i + 1) + "</span>" + U.esc(opt);
      b.onclick = () => { AU.sfx("click"); U.$$(".choice", ch).forEach(x => x.classList.remove("sel")); b.classList.add("sel"); sel = opt; LS.ready(true); };
      ch.appendChild(b);
    });
    LS.footCheck(false);
    c.evalFn = () => ({ ok: sel !== null && U.fold(sel) === U.fold(d.answer), solution: U.esc(d.sent.es) });
  },

  // --- word multiple choice ---
  exMultiChoice(body, r) {
    const c = LS.cur, spec = r.spec, w = r.word;
    const prompt = spec.dir === "fe" ? w.es : w.en;
    const d = EX.mcOptions(r.u, spec.wi, spec.dir);
    body.innerHTML =
      '<div class="ex-title">' + LS.TITLES["mc_" + spec.dir] + "</div>" +
      '<div class="ex-prompt-row">' +
      (spec.dir === "fe" ? '<button class="spk" data-say="' + U.esc(w.es) + '">🔊</button>' : "") +
      '<span class="ex-sentence"><b>' + U.esc(prompt) + "</b></span></div>" +
      '<div class="choices" id="ch"></div>';
    let sel = null;
    const ch = U.$("#ch");
    d.opts.forEach((opt, i) => {
      const b = document.createElement("button");
      b.className = "choice";
      b.innerHTML = '<span class="ix">' + (i + 1) + "</span>" + U.esc(opt);
      b.onclick = () => {
        AU.sfx("click");
        U.$$(".choice", ch).forEach(x => x.classList.remove("sel"));
        b.classList.add("sel"); sel = opt; LS.ready(true);
        if (spec.dir === "ef") AU.say(opt);
      };
      ch.appendChild(b);
    });
    LS.footCheck(false);
    c.evalFn = () => ({ ok: sel !== null && U.fold(sel) === U.fold(d.correct), solution: U.esc(d.correct) });
    if (spec.dir === "fe") LS.bindSpeakers(body, w.es);
  },

  // --- select the image ---
  exImage(body, r) {
    const c = LS.cur, w = r.word;
    const d = EX.imgOptions(r.u, r.spec.wi);
    body.innerHTML =
      '<div class="ex-title">' + LS.TITLES.img + "</div>" +
      '<div class="ex-prompt-row"><span class="ex-sentence">Which one is <b>“' + U.esc(w.en) + '”</b>?</span></div>' +
      '<div class="img-grid" id="ig"></div>';
    let sel = null;
    const ig = U.$("#ig");
    d.opts.forEach(opt => {
      const b = document.createElement("button");
      b.className = "img-card";
      b.innerHTML = '<span class="em">' + opt.emoji + '</span><span class="cap">' + U.esc(opt.es) + "</span>";
      b.onclick = () => {
        AU.sfx("click");
        U.$$(".img-card", ig).forEach(x => x.classList.remove("sel"));
        b.classList.add("sel"); sel = opt; LS.ready(true);
        AU.say(opt.es);
      };
      ig.appendChild(b);
    });
    LS.footCheck(false);
    c.evalFn = () => ({ ok: sel !== null && sel.es === d.correct.es, solution: U.esc(d.correct.es) });
  },

  // --- match pairs (no check button; mistakes don't cost hearts) ---
  exPairs(body, r) {
    const c = LS.cur;
    const words = r.words.filter(Boolean);
    body.innerHTML =
      '<div class="ex-title">' + LS.TITLES.pairs + "</div>" +
      '<div class="pairs-grid" id="pg"></div>';
    const pg = U.$("#pg");
    const left = U.shuffle(words.map(w => ({ k: w.es, v: w.es, side: "L" })));
    const right = U.shuffle(words.map(w => ({ k: w.es, v: w.en, side: "R" })));
    const rows = Math.max(left.length, right.length);
    const cells = [];
    for (let i = 0; i < rows; i++) { if (left[i]) cells.push(left[i]); if (right[i]) cells.push(right[i]); }
    let selBtn = null, matched = 0;
    cells.forEach(cell => {
      const b = document.createElement("button");
      b.className = "pair-btn"; b.textContent = cell.v;
      b.dataset.k = cell.k; b.dataset.side = cell.side;
      b.onclick = () => {
        if (b.classList.contains("ok")) return;
        if (cell.side === "L") AU.say(cell.v);
        if (!selBtn) { selBtn = b; b.classList.add("sel"); AU.sfx("tile"); return; }
        if (selBtn === b) { b.classList.remove("sel"); selBtn = null; return; }
        if (selBtn.dataset.side === b.dataset.side) { selBtn.classList.remove("sel"); selBtn = b; b.classList.add("sel"); return; }
        if (selBtn.dataset.k === b.dataset.k) {
          selBtn.classList.remove("sel");
          selBtn.classList.add("ok"); b.classList.add("ok");
          AU.sfx("match");
          matched++;
          selBtn = null;
          if (matched >= words.length) setTimeout(() => { c.combo++; c.comboMax = Math.max(c.comboMax, c.combo); AU.sfx("correct"); LS.onContinue(true); }, 450);
        } else {
          const a = selBtn;
          a.classList.remove("sel"); a.classList.add("bad"); b.classList.add("bad");
          AU.sfx("wrong");
          setTimeout(() => { a.classList.remove("bad"); b.classList.remove("bad"); }, 380);
          selBtn = null;
        }
      };
      pg.appendChild(b);
    });
    const f = U.$("#ls-foot");
    f.className = "ls-foot";
    f.innerHTML = '<button class="btn btn-green" disabled>Match all the pairs</button>';
  },

  // --- speaking ---
  exSpeak(body, r) {
    const c = LS.cur, sent = r.sent;
    let rec = null, fails = 0, finished = false;
    body.innerHTML =
      '<div class="ex-title">' + LS.TITLES.sp + "</div>" +
      LS.speakerRow(sent.es, true) +
      '<p style="color:#777;font-size:14px">“' + U.esc(sent.en) + "”</p>" +
      '<div class="mic-wrap"><button class="mic-btn" id="mic">🎤</button>' +
      '<div class="mic-heard" id="heard"></div></div>';
    const mic = U.$("#mic"), heard = U.$("#heard");
    const stopRec = () => { if (rec) { try { rec.stop(); } catch (e) { } rec = null; } mic.classList.remove("rec"); };
    mic.onclick = () => {
      if (finished) return;
      if (rec) { stopRec(); return; }
      mic.classList.add("rec");
      heard.textContent = "Listening…";
      rec = AU.listen(
        (txt) => { heard.textContent = "“" + txt + "”"; },
        (finalTxt) => {
          mic.classList.remove("rec"); rec = null;
          if (finished) return;
          if (finalTxt && EX.checkSpeech(finalTxt, sent.es)) {
            finished = true; c.checked = true;
            c.combo++; c.comboMax = Math.max(c.comboMax, c.combo);
            AU.sfx("correct");
            LS.footFeedback(true, null, "");
          } else {
            fails++;
            if (fails >= 2) {
              finished = true; c.checked = true;
              c.combo = 0; c.wrong++;
              AU.sfx("wrong");
              LS.footFeedback(false, U.esc(sent.es));
            } else heard.textContent = "Hmm, try again — speak clearly 🎤";
          }
        });
    };
    const f = U.$("#ls-foot");
    f.className = "ls-foot";
    f.innerHTML =
      '<button class="btn btn-ghost" id="sp-skip" style="margin-bottom:10px">Can\'t speak now</button>' +
      '<button class="btn btn-green" disabled>Use the mic above</button>';
    U.$("#sp-skip").onclick = () => {
      if (finished) return;
      finished = true; stopRec();
      c.checked = true;
      LS.footFeedback(true, null, "We'll skip speaking for now.");
    };
    LS.bindSpeakers(body, sent.es);
  }
};
