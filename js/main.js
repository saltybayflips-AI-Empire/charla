/* Charla — boot, tabs, install tip, service worker (global MAIN) */
const MAIN = {
  VERSION: "1.3.0",
  TABS: ["learn", "practice", "leagues", "quests", "shop", "profile"],

  go(tab) {
    MAIN.TABS.forEach(t => {
      U.$("#scr-" + t).classList.toggle("hidden", t !== tab);
      U.$('[data-tab="' + t + '"]').classList.toggle("active", t === tab);
    });
    if (tab === "learn") PT.render();
    if (tab === "practice") SC.renderPractice();
    if (tab === "leagues") SC.renderLeagues();
    if (tab === "quests") SC.renderQuests();
    if (tab === "shop") SC.renderShop();
    if (tab === "profile") SC.renderProfile();
    window.scrollTo(0, 0);
  },

  questsDot() {
    const has = ST.s.quests.items.some(it => it.done && !it.claimed);
    const tab = U.$('[data-tab="quests"]');
    let dot = U.$(".dot", tab);
    if (has && !dot) { dot = document.createElement("span"); dot.className = "dot"; tab.appendChild(dot); }
    if (!has && dot) dot.remove();
  },

  installTip() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
    let dismissed = false;
    try { dismissed = !!sessionStorage.getItem("itDismiss"); } catch (e) { }
    if (isIOS && !standalone && !dismissed) {
      U.$("#install-tip").classList.remove("hidden");
      U.$("#it-close").onclick = () => {
        U.$("#install-tip").classList.add("hidden");
        try { sessionStorage.setItem("itDismiss", "1"); } catch (e) { }
      };
    }
  },

  maybeResume() {
    const r = ST.s.resume;
    if (!r || !r.queue || r.pos >= r.queue.length || !EX.UNITS.length) return;
    const m = U.modal(
      '<div class="m-em">⏸️</div><h3>Resume your lesson?</h3>' +
      "<p>You were " + r.done + " exercise" + (r.done === 1 ? "" : "s") + " in when the app closed. Pick up where you left off!</p>" +
      '<button class="btn btn-green" id="rs-go">Resume</button>' +
      '<button class="btn btn-ghost" id="rs-no">Discard</button>', { sticky: true });
    U.$("#rs-go").onclick = () => { m.close(); LS.restore(r); };
    U.$("#rs-no").onclick = () => { ST.clearResume(); m.close(); };
  },

  // first-run language picker (only when there's a real choice and none made yet)
  maybeFirstRun() {
    if (!window.LANG) return;
    if (LANG.chosen() || LANG.availableCodes().length < 2) return;
    SC.langModal(true);
  },

  boot() {
    EX.init();        // legacy shim + LANG.load + active-language course + audio map + lexicon
    ST.load();        // per-language progress (LANG.active is set now)
    AU.init();        // device voice for the active language
    LS.initTitles();  // exercise titles reference the active language name
    SC.bindHeader();
    SC.renderHeader();
    MAIN.TABS.forEach(t => {
      U.$('[data-tab="' + t + '"]').onclick = () => { AU.sfx("click"); MAIN.go(t); MAIN.questsDot(); };
    });
    MAIN.go("learn");
    MAIN.questsDot();
    MAIN.installTip();
    MAIN.maybeFirstRun();
    SC.maybeLeagueBanner();
    MAIN.maybeResume();
    // unlock audio on first touch (iOS)
    const unlock = () => { AU._ac(); document.removeEventListener("touchstart", unlock); };
    document.addEventListener("touchstart", unlock, { once: true });
    // periodic header refresh (heart regen timers)
    setInterval(() => { SC.renderHeader(); MAIN.questsDot(); }, 30000);
    // service worker + seamless updates: when a new version takes control, reload once
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      const wasControlled = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!wasControlled || MAIN._reloaded || LS.cur) return;
        MAIN._reloaded = true;
        U.toast("✨ Charla updated to the latest version!");
        setTimeout(() => location.reload(), 900);
      });
      navigator.serviceWorker.register("sw.js").catch(() => { });
    }
  }
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", MAIN.boot);
else MAIN.boot();
