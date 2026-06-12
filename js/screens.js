/* Charla — practice / leagues / quests / shop / profile / stories (global SC) */
const SC = {
  /* ---------- header stats ---------- */
  renderHeader() {
    U.$("#stat-streak").innerHTML = "🔥 <b>" + ST.s.streak.n + "</b>";
    U.$("#stat-streak").classList.toggle("cold", !ST.streakAliveToday());
    U.$("#stat-gems").innerHTML = "💎 <b>" + ST.s.gems + "</b>";
    U.$("#stat-hearts").innerHTML = "❤️ <b>" + ST.hearts() + "</b>";
  },

  bindHeader() {
    U.$("#stat-streak").onclick = () => SC.streakModal();
    U.$("#stat-gems").onclick = () => MAIN.go("shop");
    U.$("#stat-hearts").onclick = () => SC.heartsModal();
    U.$("#stat-flag").onclick = () => U.toast("🇪🇸 Spanish course — ¡vamos!");
  },

  streakModal() {
    const days = ["M", "T", "W", "T", "F", "S", "S"];
    const mon = U.fromKey(U.weekKey());
    let row = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(mon); d.setDate(d.getDate() + i);
      const k = U.dayKey(d);
      const hit = (ST.s.xp.byDay[k] || 0) > 0;
      const frozen = ST.s.streak.frozenDays[k];
      row += '<div class="wd ' + (hit ? "hit" : "") + (frozen ? " frozen" : "") + (k === U.dayKey() ? " today" : "") + '"><div class="bub">' + (hit ? "✓" : (frozen ? "🧊" : "")) + "</div>" + days[i] + "</div>";
    }
    U.modal(
      '<div class="m-em">🔥</div><h3>' + ST.s.streak.n + " day streak</h3>" +
      '<div class="week-row" style="justify-content:center">' + row + "</div>" +
      "<p>Best: <b>" + ST.s.streak.best + "</b> · Freezes: <b>🧊 " + ST.s.streak.freezes + "/" + ST.FREEZE_MAX + "</b></p>" +
      "<p>" + (ST.streakAliveToday() ? "You've extended your streak today. ¡Bien hecho!" : "Complete a lesson today to extend your streak!") + "</p>" +
      '<button class="btn btn-green" onclick="this.closest(\'.m-ov\').remove()">Got it</button>');
  },

  heartsModal() {
    const h = ST.hearts();
    const ms = ST.nextHeartMs();
    const m = U.modal(
      '<div class="m-em">❤️</div><h3>' + h + " / " + ST.HEART_MAX + " hearts</h3>" +
      "<p>" + (h >= ST.HEART_MAX ? "You're full — go learn!" : "Next heart in <b>" + U.fmtCountdown(ms) + "</b> (1 every 4h)") + "</p>" +
      '<button class="btn btn-blue" id="hm-refill">Refill — 💎 ' + ST.REFILL_COST + "</button>" +
      '<button class="btn btn-green" id="hm-practice">Practice to earn a heart</button>');
    U.$("#hm-refill").onclick = () => {
      if (h >= ST.HEART_MAX) { U.toast("Hearts already full ❤️"); return; }
      if (ST.spendGems(ST.REFILL_COST)) { ST.refillHearts(); SC.renderHeader(); m.close(); U.toast("❤️ Hearts refilled!"); }
      else U.toast("Not enough gems 💎");
    };
    U.$("#hm-practice").onclick = () => { m.close(); LS.start({ kind: "recover", specs: EX.buildPractice(), heartsFree: true, baseXp: 0 }); };
  },

  /* ---------- practice tab ---------- */
  renderPractice() {
    const el = U.$("#scr-practice");
    const nMist = ST.s.mistakes.length;
    let stories = "";
    const activeId = (EX.activeNode() || {}).id;
    EX.STORIES.forEach(st => {
      const done = ST.s.stories[st.id];
      const stUnit = EX.unit(st.unit);
      const stNode = stUnit ? EX.nodesForUnit(stUnit).find(n => n.type === "story") : null;
      const unlocked = !!done || (stNode && (ST.s.path.done[stNode.id] || stNode.id === activeId));
      stories += '<button class="story-card ' + (done ? "done-st" : "") + (unlocked ? "" : " locked-st") + '" data-story="' + st.id + '">' +
        '<span class="em">' + st.emoji + '</span><span class="tt">' + U.esc(st.title) + "</span>" +
        (done ? '<div style="color:var(--gold-d);font-size:12px;font-weight:800;margin-top:4px">COMPLETE ✓</div>' : '<div style="color:#999;font-size:12px;margin-top:4px">+' + st.xp + " XP</div>") +
        "</button>";
    });
    el.innerHTML =
      "<h2 style='margin:6px 0 14px'>Practice hub</h2>" +
      '<button class="card row" style="width:100%;text-align:left;font-family:inherit;cursor:pointer" id="pr-mist">' +
      '  <span style="font-size:34px">🩹</span><div class="grow"><h3>Mistakes review</h3><div class="sub">' + (nMist ? nMist + " mistakes to fix" : "No mistakes saved — nice!") + "</div></div></button>" +
      '<button class="card row" style="width:100%;text-align:left;font-family:inherit;cursor:pointer" id="pr-weak">' +
      '  <span style="font-size:34px">🏋️</span><div class="grow"><h3>Smart practice</h3><div class="sub">Reviews your weakest words · +10 XP</div></div></button>' +
      '<button class="card row" style="width:100%;text-align:left;font-family:inherit;cursor:pointer" id="pr-listen">' +
      '  <span style="font-size:34px">🎧</span><div class="grow"><h3>Listening practice</h3><div class="sub">Train your ear · +10 XP</div></div></button>' +
      '<button class="card row" style="width:100%;text-align:left;font-family:inherit;cursor:pointer" id="pr-words">' +
      '  <span style="font-size:34px">📚</span><div class="grow"><h3>Your words</h3><div class="sub">' + ST.wordsLearned() + " words seen so far</div></div></button>" +
      "<h2 style='margin:20px 0 12px'>Stories</h2>" +
      '<div class="story-grid">' + stories + "</div>";
    U.$("#pr-mist").onclick = () => {
      if (!nMist) { U.toast("No mistakes to review — keep learning!"); return; }
      LS.start({ kind: "mistakes", specs: EX.buildMistakes(), baseXp: 10 });
    };
    U.$("#pr-weak").onclick = () => LS.start({ kind: "practice", specs: EX.buildPractice(), baseXp: 10 });
    U.$("#pr-listen").onclick = () => {
      if (!AU.ttsOK()) { U.toast("Audio isn't available on this device"); return; }
      LS.start({ kind: "listening", specs: EX.buildListening(), baseXp: 10 });
    };
    U.$("#pr-words").onclick = SC.wordsModal;
    U.$$("[data-story]", el).forEach(b => b.onclick = () => {
      if (b.classList.contains("locked-st")) { U.toast("🔒 Reach this story's unit on the path first!"); return; }
      SC.playStory(EX.story(b.getAttribute("data-story")), null);
    });
  },

  wordsModal() {
    const rows = [];
    EX.UNITS.forEach(u => u.words.forEach((w, wi) => {
      const rec = ST.s.words[u.id + ":" + wi];
      if (rec) rows.push({ w, s: rec.s });
    }));
    rows.sort((a, b) => a.s - b.s);
    let html = "";
    rows.forEach(r => {
      let dots = "";
      for (let i = 0; i < 4; i++) dots += "<i class='" + (i < r.s ? "on" : "") + "'></i>";
      html += '<div class="w-row"><span class="w-es">' + U.esc(r.w.es) + '</span><span class="w-en">' + U.esc(r.w.en) + '</span><span class="s-dots">' + dots + "</span></div>";
    });
    U.modal("<h3>📚 Your words</h3>" +
      (rows.length ? '<div style="text-align:left;max-height:50vh;overflow-y:auto">' + html + "</div>" : "<p>Complete a lesson to start collecting words!</p>") +
      '<button class="btn btn-green" style="margin-top:14px" onclick="this.closest(\'.m-ov\').remove()">Close</button>');
  },

  /* ---------- leagues tab ---------- */
  renderLeagues() {
    const el = U.$("#scr-leagues");
    ST.ensureLeagueWeek();
    const lg = ST.s.league;
    let shields = "";
    ST.LEAGUES.forEach((nm, i) => shields += '<span class="shield ' + (i === lg.tier ? "on" : "") + '" title="' + nm + '">' + ST.LEAGUE_EMOJI[i] + "</span>");
    if (!lg.joined) {
      el.innerHTML =
        "<h2 style='margin:6px 0 4px'>" + ST.LEAGUES[lg.tier] + " League</h2>" +
        '<div class="shield-row">' + shields + "</div>" +
        '<div class="hero">' + U.parrot(110) + "<p><b>Earn XP this week to join the league!</b><br>Top " + ST.promoteN(lg.tier) + " of " + ST.LEAGUE_SIZE + " move up. Bottom 5 move down.</p>" +
        '<button class="btn btn-green" id="lg-go" style="max-width:260px;margin-top:10px">Start a lesson</button></div>';
      U.$("#lg-go").onclick = () => MAIN.go("learn");
      return;
    }
    const rows = ST.leagueStandings(lg.week, lg.tier, lg.xp);
    let list = "";
    const promoN = ST.promoteN(lg.tier);
    rows.forEach((r, i) => {
      const rank = i + 1;
      if (rank === 1 && promoN > 0) list += '<div class="zone-lab up">PROMOTION ZONE ↑</div>';
      if (rank === promoN + 1 && promoN > 0) list += '<div class="zone-lab" style="color:var(--muted)">— STAY ZONE —</div>';
      if (rank === ST.DEMOTE_FROM + 1) list += '<div class="zone-lab down">DEMOTION ZONE ↓</div>';
      list +=
        '<div class="lg-row' + (r.me ? " me" : "") + '">' +
        '<span class="lg-rank">' + (rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : rank) + "</span>" +
        '<span class="lg-av">' + r.av + "</span>" +
        '<span class="lg-name">' + U.esc(r.name) + (r.me ? " (you)" : "") + "</span>" +
        '<span class="lg-xp">' + r.xp + " XP</span></div>";
    });
    el.innerHTML =
      "<h2 style='margin:6px 0 4px'>" + ST.LEAGUES[lg.tier] + " League</h2>" +
      '<div class="shield-row">' + shields + "</div>" +
      "<p style='text-align:center;color:#777;margin:0 0 12px'>" + (promoN > 0 ? "Top " + promoN + " advance" : "Top of the mountain") + " · ends in <b>" + U.fmtCountdown(U.msToWeekEnd()) + "</b></p>" +
      list;
  },

  maybeLeagueBanner() {
    const b = ST.s.league.banner;
    if (!b) return;
    ST.s.league.banner = null; ST.save();
    const msg = b.moved === "up" ? "📈 You finished <b>#" + b.rank + "</b> — promoted to <b>" + b.league + " League</b>!" :
      b.moved === "down" ? "📉 You finished #" + b.rank + " — dropped to <b>" + b.league + " League</b>. ¡Vamos!" :
        "🛡️ You finished <b>#" + b.rank + "</b> in your league last week.";
    U.toast(msg, 4200);
  },

  /* ---------- quests tab ---------- */
  renderQuests() {
    ST.ensureQuests();
    const el = U.$("#scr-quests");
    let items = "";
    ST.s.quests.items.forEach((it, i) => {
      const def = ST.questDef(it.id);
      const pct = Math.min(100, Math.round(100 * it.prog / def.goal));
      items +=
        '<div class="card q-card">' +
        '<span class="q-em">' + def.em + "</span>" +
        '<div class="grow"><b>' + def.text + "</b>" +
        '<div class="q-bar"><div class="fill" style="width:' + pct + '%"></div></div>' +
        '<div class="sub" style="margin-top:4px">' + it.prog + " / " + def.goal + "</div></div>" +
        (it.done && !it.claimed
          ? '<button class="btn btn-gold small q-claim" data-claim="' + i + '">🎁 ' + def.gems + "</button>"
          : (it.claimed ? '<span style="font-size:24px">✅</span>' : '<span class="price">💎 ' + def.gems + "</span>")) +
        "</div>";
    });
    const mGoal = 1000, mXp = ST.s.quests.monthXp || 0;
    const mPct = Math.min(100, Math.round(100 * mXp / mGoal));
    const monthName = new Date().toLocaleString("en-US", { month: "long" });
    el.innerHTML =
      "<h2 style='margin:6px 0 4px'>Daily quests</h2>" +
      "<p style='color:#777;margin:0 0 12px'>New quests in <b>" + U.fmtCountdown(U.fromKey(U.dayKey()).getTime() + 86400000 - Date.now()) + "</b></p>" +
      items +
      "<h2 style='margin:18px 0 8px'>" + monthName + " challenge</h2>" +
      '<div class="card q-card"><span class="q-em">🏅</span>' +
      '<div class="grow"><b>Earn ' + mGoal + " XP in " + monthName + "</b>" +
      '<div class="q-bar"><div class="fill" style="width:' + mPct + '%"></div></div>' +
      '<div class="sub" style="margin-top:4px">' + mXp + " / " + mGoal + "</div></div>" +
      (mXp >= mGoal && !ST.s.quests.monthClaimed ? '<button class="btn btn-gold small q-claim" id="m-claim">🎁 100</button>' :
        (ST.s.quests.monthClaimed ? '<span style="font-size:24px">✅</span>' : '<span class="price">💎 100</span>')) +
      "</div>";
    U.$$("[data-claim]", el).forEach(b => b.onclick = () => {
      const it = ST.s.quests.items[+b.getAttribute("data-claim")];
      const def = ST.questDef(it.id);
      if (!it.done || it.claimed) return;
      it.claimed = true;
      ST.addGems(def.gems);
      AU.sfx("chest"); U.confetti(22);
      U.toast("🎁 +" + def.gems + " gems!");
      SC.renderHeader(); SC.renderQuests();
    });
    const mc = U.$("#m-claim");
    if (mc) mc.onclick = () => {
      ST.s.quests.monthClaimed = true;
      ST.addGems(100); ST.save();
      AU.sfx("chest"); U.confetti(30);
      U.toast("🏅 Monthly challenge complete — +100 gems!");
      SC.renderHeader(); SC.renderQuests();
    };
  },

  /* ---------- shop tab ---------- */
  renderShop() {
    const el = U.$("#scr-shop");
    const boostOn = ST.boostActive();
    el.innerHTML =
      "<h2 style='margin:6px 0 12px'>Shop</h2>" +
      '<div class="card" style="background:var(--blue-l);border-color:#84d8ff"><div class="row"><span style="font-size:30px">💎</span><div class="grow"><h3>' + ST.s.gems + " gems</h3><div class='sub'>Earn more from chests and quests</div></div></div></div>" +

      '<div class="card shop-item"><span class="shop-em">🧊</span>' +
      '<div class="grow"><h3>Streak Freeze</h3><div class="sub">Protects your streak for one missed day. Equipped: ' + ST.s.streak.freezes + "/" + ST.FREEZE_MAX + "</div></div>" +
      '<button class="btn btn-blue small" id="sh-freeze">💎 ' + ST.FREEZE_COST + "</button></div>" +

      '<div class="card shop-item"><span class="shop-em">❤️</span>' +
      '<div class="grow"><h3>Heart Refill</h3><div class="sub">Refill to ' + ST.HEART_MAX + " hearts (now " + ST.hearts() + ")</div></div>" +
      '<button class="btn btn-blue small" id="sh-heart">💎 ' + ST.REFILL_COST + "</button></div>" +

      '<div class="card shop-item"><span class="shop-em">⚡</span>' +
      '<div class="grow"><h3>Double XP Boost</h3><div class="sub">' + (boostOn ? "ACTIVE — " + U.fmtCountdown(ST.s.xp.boostUntil - Date.now()) + " left" : "×2 XP for 15 minutes") + "</div></div>" +
      '<button class="btn btn-blue small" id="sh-boost" ' + (boostOn ? "disabled" : "") + ">💎 " + ST.BOOST_COST + "</button></div>";

    U.$("#sh-freeze").onclick = () => {
      if (ST.s.streak.freezes >= ST.FREEZE_MAX) { U.toast("Max " + ST.FREEZE_MAX + " freezes equipped 🧊"); return; }
      if (ST.spendGems(ST.FREEZE_COST)) { ST.s.streak.freezes++; ST.save(); U.toast("🧊 Streak Freeze equipped!"); SC.renderHeader(); SC.renderShop(); }
      else U.toast("Not enough gems 💎");
    };
    U.$("#sh-heart").onclick = () => {
      if (ST.hearts() >= ST.HEART_MAX) { U.toast("Hearts already full ❤️"); return; }
      if (ST.spendGems(ST.REFILL_COST)) { ST.refillHearts(); U.toast("❤️ Refilled!"); SC.renderHeader(); SC.renderShop(); }
      else U.toast("Not enough gems 💎");
    };
    U.$("#sh-boost").onclick = () => {
      if (ST.spendGems(ST.BOOST_COST)) { ST.s.xp.boostUntil = Date.now() + ST.BOOST_MS; ST.save(); U.toast("⚡ Double XP for 15 minutes — go!"); SC.renderHeader(); SC.renderShop(); }
      else U.toast("Not enough gems 💎");
    };
  },

  /* ---------- profile tab ---------- */
  renderProfile() {
    const el = U.$("#scr-profile");
    let achs = "";
    ST.ACH.forEach(a => {
      const t = ST.achTier(a);
      const next = a.tiers[Math.min(t, a.tiers.length - 1)];
      achs += '<div class="ach ' + (t ? "" : "off") + '"><div class="em">' + a.em + '</div><div class="nm">' + a.name + '</div><div class="tier">' +
        (t >= a.tiers.length ? "MAX" : a.val() + "/" + next) + "</div></div>";
    });
    const joined = new Date(U.fromKey(ST.s.created)).toLocaleDateString("en-US", { month: "short", year: "numeric" });
    el.innerHTML =
      '<div style="text-align:center;padding:10px 0 4px">' +
      '<button id="pf-av" style="font-size:64px;background:var(--blue-l);border:2px solid #84d8ff;border-radius:50%;width:110px;height:110px;cursor:pointer">' + ST.s.avatar + "</button>" +
      '<h2 style="margin:10px 0 2px">' + U.esc(ST.s.name) + ' <button id="pf-name" style="border:0;background:none;cursor:pointer">✏️</button></h2>' +
      '<div style="color:#777">Learning Spanish 🇪🇸 · joined ' + joined + "</div></div>" +
      '<div class="stat-tiles">' +
      '<div class="stile"><span style="font-size:26px">🔥</span><div><div class="v">' + ST.s.streak.n + '</div><div class="k">Day streak</div></div></div>' +
      '<div class="stile"><span style="font-size:26px">⚡</span><div><div class="v">' + ST.s.xp.total + '</div><div class="k">Total XP</div></div></div>' +
      '<div class="stile"><span style="font-size:26px">' + ST.LEAGUE_EMOJI[ST.s.league.tier] + '</span><div><div class="v">' + ST.LEAGUES[ST.s.league.tier] + '</div><div class="k">League</div></div></div>' +
      '<div class="stile"><span style="font-size:26px">📚</span><div><div class="v">' + ST.wordsLearned() + '</div><div class="k">Words</div></div></div>' +
      "</div>" +
      "<h2 style='margin:14px 0 10px'>Achievements</h2>" +
      '<div class="ach-grid">' + achs + "</div>" +
      "<h2 style='margin:20px 0 6px'>Settings</h2>" +
      '<div class="card">' +
      '<div class="set-row"><span>🔔 Sound effects</span><button class="switch ' + (ST.s.settings.sound ? "on" : "") + '" id="set-sound"></button></div>' +
      '<div class="set-row"><span>🎤 Speaking exercises</span><button class="switch ' + (ST.s.settings.speak ? "on" : "") + '" id="set-speak"></button></div>' +
      '<div class="set-row"><span>💾 Backup progress</span><button class="btn btn-white small" id="set-backup">Copy</button></div>' +
      '<div class="set-row"><span>📥 Restore backup</span><button class="btn btn-white small" id="set-restore">Paste</button></div>' +
      '<div class="set-row"><span style="color:var(--red)">⚠️ Reset all progress</span><button class="btn btn-red small" id="set-reset">Reset</button></div>' +
      "</div>" +
      '<p style="text-align:center;color:#bbb;font-size:12px;margin-top:18px">Charla v1 — an original learning app made with Claude for Khalil 🦜<br>Not affiliated with any other language app.</p>';
    U.$("#pf-av").onclick = () => {
      const opts = ["🧑", "👨", "👩", "🧔", "👨‍🦱", "👱", "🦜", "🐱", "🐶", "🦊", "🐼", "😎"];
      const cur = opts.indexOf(ST.s.avatar);
      ST.s.avatar = opts[(cur + 1) % opts.length];
      ST.save(); SC.renderProfile();
    };
    U.$("#pf-name").onclick = () => {
      const n = prompt("Your name:", ST.s.name);
      if (n && n.trim()) { ST.s.name = n.trim().slice(0, 20); ST.save(); SC.renderProfile(); }
    };
    U.$("#set-sound").onclick = () => { ST.s.settings.sound = !ST.s.settings.sound; ST.save(); SC.renderProfile(); };
    U.$("#set-speak").onclick = () => { ST.s.settings.speak = !ST.s.settings.speak; ST.save(); SC.renderProfile(); };
    U.$("#set-backup").onclick = () => {
      const data = btoa(unescape(encodeURIComponent(JSON.stringify(ST.s))));
      const done = () => U.toast("📋 Backup copied — save it somewhere safe!");
      if (navigator.clipboard) navigator.clipboard.writeText(data).then(done, () => prompt("Copy this backup code:", data));
      else prompt("Copy this backup code:", data);
    };
    U.$("#set-restore").onclick = () => {
      const code = prompt("Paste your backup code:");
      if (!code) return;
      try {
        const s = JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
        if (!s || !s.xp) throw new Error("bad");
        localStorage.setItem(ST.KEY, JSON.stringify(s));
        location.reload();
      } catch (e) { U.toast("That code didn't work 😕"); }
    };
    U.$("#set-reset").onclick = () => {
      const m = U.modal('<div class="m-em">⚠️</div><h3>Reset everything?</h3><p>Your streak, XP and progress will be erased.</p>' +
        '<button class="btn btn-red" id="rs-yes">Yes, reset</button><button class="btn btn-ghost" id="rs-no">Cancel</button>', { sticky: true });
      U.$("#rs-yes").onclick = () => ST.reset();
      U.$("#rs-no").onclick = m.close;
    };
  },

  /* ---------- story player ---------- */
  playStory(story, nodeId) {
    const root = U.$("#lesson-root");
    let pos = 0, answered = 0, wrong = 0;
    root.innerHTML =
      '<div class="ls">' +
      '<div class="ls-head"><button class="ls-quit" id="st-quit">✕</button>' +
      '<div class="pbar"><div class="fill" id="st-fill" style="width:0%"></div></div>' +
      '<span style="font-size:22px">' + story.emoji + "</span></div>" +
      '<div class="ls-body" id="st-body"><h2 style="text-align:center">' + story.emoji + " " + U.esc(story.title) + "</h2></div>" +
      '<div class="ls-foot" id="st-foot"></div></div>';
    U.$("#st-quit").onclick = () => {
      const m = U.modal('<div class="m-em">📖</div><h3>Leave the story?</h3>' +
        '<button class="btn btn-green" id="sq-stay">Keep reading</button><button class="btn btn-ghost" id="sq-quit">Leave</button>', { sticky: true });
      U.$("#sq-stay").onclick = m.close;
      U.$("#sq-quit").onclick = () => { m.close(); root.innerHTML = ""; };
    };
    const body = U.$("#st-body"), foot = U.$("#st-foot");

    const showCont = (label) => {
      foot.className = "ls-foot";
      foot.innerHTML = '<button class="btn btn-green" id="st-cont">' + (label || "Continue") + "</button>";
      U.$("#st-cont").onclick = next;
    };

    const finish = () => {
      const res = ST.earnXP(story.xp);
      const first = !ST.s.stories[story.id];
      ST.s.stories[story.id] = 1;
      if (first) ST.s.stats.storiesDone++;
      if (nodeId) ST.s.path.done[nodeId] = 1;
      ST.questBump("story", 1);
      ST.save();
      const ach = ST.checkAchievements();
      AU.sfx("win"); U.confetti();
      body.innerHTML = '<div class="moment">' + U.parrot(120) +
        '<h1>Story complete!</h1>' +
        '<div class="chips"><div class="chip gold"><div class="ch-top">XP</div><div class="ch-val">⚡ ' + res.amt + "</div></div>" +
        '<div class="chip green"><div class="ch-top">Questions</div><div class="ch-val">🎯 ' + (answered - wrong) + "/" + answered + "</div></div></div></div>";
      foot.innerHTML = '<button class="btn btn-green" id="st-done">Continue</button>';
      U.$("#st-done").onclick = () => {
        root.innerHTML = "";
        SC.renderHeader(); PT.render(); SC.renderPractice();
        if (res.firstToday) U.toast("🔥 Streak extended!");
        (ach || []).forEach(a => U.toast(a.em + " Achievement: <b>" + a.name + "</b>!"));
        const doneQ = ST.s.quests.items.filter(it => it.done && !it.claimed).length;
        if (doneQ) U.toast("🎯 Daily quest complete — claim your chest in Quests!");
      };
    };

    const next = () => {
      U.$("#st-fill").style.width = Math.round(100 * pos / story.lines.length) + "%";
      if (pos >= story.lines.length) { finish(); return; }
      const line = story.lines[pos]; pos++;
      if (line.type === "narr") {
        body.insertAdjacentHTML("beforeend", '<div class="st-narr">' + U.esc(line.es) + '<br><span style="font-size:12px">' + U.esc(line.en) + "</span></div>");
        AU.say(line.es);
        showCont();
      } else if (line.type === "say") {
        body.insertAdjacentHTML("beforeend",
          '<div class="st-line"><span class="st-av">' + (line.avatar || "🙂") + "</span>" +
          '<div class="st-bub"><div style="font-size:11px;font-weight:800;color:#999">' + U.esc(line.speaker || "") + "</div>" +
          '<div class="es">' + U.esc(line.es) + '</div><div class="en">' + U.esc(line.en) + "</div></div></div>");
        AU.say(line.es);
        showCont();
      } else if (line.type === "q") {
        answered++;
        let html = '<div class="st-q"><div class="qq">🤔 ' + U.esc(line.prompt) + '</div><div class="choices">';
        line.choices.forEach((c, i) => html += '<button class="choice" data-q="' + i + '"><span class="ix">' + (i + 1) + "</span>" + U.esc(c) + "</button>");
        html += "</div></div>";
        body.insertAdjacentHTML("beforeend", html);
        foot.className = "ls-foot";
        foot.innerHTML = '<button class="btn btn-green" disabled>Answer the question</button>';
        const qEl = body.lastElementChild;
        let missed = false;
        U.$$(".choice", qEl).forEach(btn => btn.onclick = () => {
          const i = +btn.getAttribute("data-q");
          if (i === line.answer) {
            AU.sfx("correct");
            btn.style.borderColor = "var(--green)"; btn.style.background = "var(--green-l)";
            U.$$(".choice", qEl).forEach(x => x.onclick = null);
            showCont();
          } else {
            if (!missed) { wrong++; missed = true; }
            AU.sfx("wrong");
            btn.classList.add("bad");
            setTimeout(() => btn.classList.remove("bad"), 400);
          }
        });
      }
      body.scrollTop = body.scrollHeight;
    };
    showCont("Start story");
  }
};
