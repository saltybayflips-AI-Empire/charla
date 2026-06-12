/* Charla — boot, tabs, install tip, service worker (global MAIN) */
const MAIN = {
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
    if (isIOS && !standalone && !ST.s.flags.installDismissed) {
      U.$("#install-tip").classList.remove("hidden");
      U.$("#it-close").onclick = () => {
        U.$("#install-tip").classList.add("hidden");
        ST.s.flags.installDismissed = true; ST.save();
      };
    }
  },

  boot() {
    ST.load();
    AU.init();
    EX.init();
    SC.bindHeader();
    SC.renderHeader();
    MAIN.TABS.forEach(t => {
      U.$('[data-tab="' + t + '"]').onclick = () => { AU.sfx("click"); MAIN.go(t); MAIN.questsDot(); };
    });
    MAIN.go("learn");
    MAIN.questsDot();
    MAIN.installTip();
    SC.maybeLeagueBanner();
    // unlock audio on first touch (iOS)
    const unlock = () => { AU._ac(); document.removeEventListener("touchstart", unlock); };
    document.addEventListener("touchstart", unlock, { once: true });
    // periodic header refresh (heart regen timers)
    setInterval(() => { SC.renderHeader(); MAIN.questsDot(); }, 30000);
    // service worker
    if ("serviceWorker" in navigator && location.protocol !== "file:") {
      navigator.serviceWorker.register("sw.js").catch(() => { });
    }
  }
};

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", MAIN.boot);
else MAIN.boot();
