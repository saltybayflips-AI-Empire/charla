/* Charla — learn tab: the lesson path (global PT) */
const PT = {
  ICONS: { lesson: "⭐", chest: "🎁", story: "📖", trophy: "🏆" },
  OFFSETS: [0, -68, -100, -68, 0, 68, 100, 68],

  render() {
    const el = U.$("#scr-learn");
    if (!EX.UNITS.length) {
      el.innerHTML = '<div class="hero">' + U.parrot(120) + "<h1>¡Uy!</h1><p>Course content failed to load. Try reloading the app.</p></div>";
      return;
    }
    let html = "";
    if (!ST.s.flags.welcomed) {
      const L = window.LANG ? LANG : { def: () => ({ welcome: "¡Bienvenido!" }), name: () => "Spanish" };
      html += '<div class="hero">' + U.parrot(110) +
        "<h1>" + U.esc(L.def().welcome) + "</h1><p>I'm <b>Loro</b>. Let's learn " + U.esc(L.name()) + " —<br>a few minutes a day. Tap the first lesson!</p></div>";
    }
    const allNodes = EX.allNodes();
    const activeId = (EX.activeNode() || {}).id;
    let globalIdx = 0;
    EX.UNITS.forEach((u, ui) => {
      const prog = EX.unitProgress(u);
      html +=
        '<div class="unit-banner" style="background:' + u.secColor + '">' +
        '  <div><div class="ub-kicker">' + U.esc(u.secTitle) + " · Unit " + (ui + 1) + " · " + prog.done + "/" + prog.total + "</div>" +
        "  <h2>" + U.esc(u.title) + "</h2></div>" +
        '  <button class="ub-book" data-tip="' + u.id + '">📔</button>' +
        "</div>" +
        '<div class="path">';
      EX.nodesForUnit(u).forEach((n, ni) => {
        const st = ST.s.path.done[n.id];
        const isActive = n.id === activeId;
        const locked = !st && !isActive;
        let cls = "node", style = "", icon = PT.ICONS[n.type];
        if (st === 2) { cls += " legend"; }
        else if (st) { cls += " done"; icon = n.type === "chest" ? "🎁" : (n.type === "story" ? "📖" : (n.type === "trophy" ? "🏆" : "⭐")); }
        else if (isActive) { cls += " active"; style = "background:" + u.secColor + ";"; }
        else { cls += " locked"; icon = n.type === "chest" ? "🎁" : "🔒"; }
        const off = PT.OFFSETS[(globalIdx) % PT.OFFSETS.length];
        html +=
          '<div class="node-wrap">' +
          (isActive ? '<div style="position:relative;transform:translateX(' + off + 'px)"><div class="start-bub">START</div>' : '<div style="transform:translateX(' + off + 'px)">') +
          '<button class="' + cls + '" style="' + style + '" data-node="' + n.id + '">' + icon + "</button>" +
          "</div></div>";
        globalIdx++;
      });
      html += "</div>";
    });
    html += '<div class="hero">' + U.parrot(90) + "<p><b>¡Increíble!</b> More units coming soon.<br>Keep your streak alive with Practice!</p></div>";
    el.innerHTML = html;
    U.$$("[data-tip]", el).forEach(b => b.onclick = () => PT.tipModal(b.getAttribute("data-tip")));
    U.$$("[data-node]", el).forEach(b => b.onclick = () => PT.nodeTap(b.getAttribute("data-node")));
  },

  nodeFromId(id) {
    const unitId = id.split(":")[0];
    const u = EX.unit(unitId);
    return EX.nodesForUnit(u).find(n => n.id === id);
  },

  nodeTap(id) {
    const n = PT.nodeFromId(id);
    const u = EX.unit(n.unitId);
    const st = ST.s.path.done[id];
    const activeId = (EX.activeNode() || {}).id;
    const isActive = id === activeId;
    if (!st && !isActive) {
      U.toast("🔒 Complete the lessons above to unlock this!");
      return;
    }
    if (n.type === "chest") {
      if (st) { U.toast("This chest is already open 🎁"); return; }
      ST.s.path.done[id] = 1;
      ST.addGems(ST.CHEST_GEMS);
      AU.sfx("chest");
      U.confetti(26);
      U.modal('<div class="m-em">🎁</div><h3>Chest opened!</h3><p>You found <b style="color:var(--blue)">💎 ' + ST.CHEST_GEMS + ' gems</b></p><button class="btn btn-blue" onclick="this.closest(\'.m-ov\').remove()">Collect</button>');
      ST.s.flags.welcomed = true; ST.save();
      SC.renderHeader(); PT.render();
      return;
    }
    if (n.type === "story") {
      const story = EX.story(n.storyId);
      PT.startCard(u, "📖 " + story.title, "A short story · +" + story.xp + " XP", st ? "Read again" : "Read", () => SC.playStory(story, id), st ? "done" : "fresh");
      return;
    }
    if (n.type === "trophy") {
      PT.startCard(u, "🏆 Unit review", "Prove you've mastered “" + u.title + "” · +" + ST.REVIEW_XP + " XP", st ? "Review again" : "Start review", () => {
        LS.start({ kind: "review", specs: EX.buildReview(u), nodeId: id, baseXp: ST.REVIEW_XP });
      }, st ? "done" : "fresh");
      return;
    }
    // lesson node
    const lessonNo = n.li + 1;
    if (st) {
      PT.startCard(u, "⭐ " + u.title + " — Lesson " + lessonNo,
        st === 2 ? "Legendary complete! Replay for practice (+" + ST.LESSON_XP + " XP)" : "Complete! Go Legendary: typing only, 3 slips allowed (+" + ST.LEGEND_XP + " XP)",
        st === 2 ? "Practice again" : "⚡ Go Legendary",
        () => {
          if (st === 2) LS.start({ kind: "lesson", specs: EX.buildLesson(u, n.li), nodeId: id, baseXp: ST.LESSON_XP });
          else LS.start({ kind: "legendary", specs: EX.buildLegendary(u, n.li), nodeId: id, baseXp: ST.LEGEND_XP, lives: 3 });
        }, "done");
    } else {
      PT.startCard(u, u.title + " — Lesson " + lessonNo, "+" + ST.LESSON_XP + " XP", "Start", () => {
        ST.s.flags.welcomed = true; ST.save();
        LS.start({ kind: "lesson", specs: EX.buildLesson(u, n.li), nodeId: id, baseXp: ST.LESSON_XP });
      }, "fresh");
    }
  },

  startCard(u, title, sub, btnText, onGo, mode) {
    const m = U.modal(
      '<h3 style="color:' + u.secColor + '">' + U.esc(title) + "</h3>" +
      "<p>" + U.esc(sub) + "</p>" +
      '<button class="btn ' + (mode === "done" ? "btn-purple" : "btn-green") + '" id="sc-go">' + U.esc(btnText) + "</button>");
    U.$("#sc-go").onclick = () => { m.close(); onGo(); };
  },

  tipModal(unitId) {
    const u = EX.unit(unitId);
    let words = "";
    u.words.forEach(w => {
      words += '<div class="w-row"><button class="spk" style="font-size:15px;padding:6px 9px" data-say="' + U.esc(w.es) + '">🔊</button>' +
        '<span class="w-es">' + U.esc(w.es) + '</span><span class="w-en">' + U.esc(w.en) + "</span>" +
        (w.emoji ? '<span style="margin-left:auto">' + w.emoji + "</span>" : "") + "</div>";
    });
    const m = U.modal(
      '<h3>📔 ' + U.esc(u.title) + "</h3>" +
      '<p style="text-align:left">' + U.esc(u.tip || "") + "</p>" +
      '<div style="text-align:left;margin-top:8px">' + words + "</div>" +
      '<button class="btn btn-green" id="tip-x" style="margin-top:14px">Got it</button>');
    U.$$("[data-say]", m.el).forEach(b => b.onclick = () => AU.say(b.getAttribute("data-say")));
    U.$("#tip-x").onclick = m.close;
  }
};
