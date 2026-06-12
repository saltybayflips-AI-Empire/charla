/* Charla — game state, economy, streaks, quests, leagues, achievements (global ST) */
const ST = {
  KEY: "charla-state-v1",
  HEART_MAX: 5,
  HEART_REGEN_MS: 4 * 3600 * 1000,
  REFILL_COST: 350,
  FREEZE_COST: 200,
  FREEZE_MAX: 2,
  BOOST_COST: 400,
  BOOST_MS: 15 * 60 * 1000,
  LESSON_XP: 10,
  PERFECT_BONUS: 5,
  REVIEW_XP: 20,
  LEGEND_XP: 40,
  CHEST_GEMS: 25,
  LEAGUES: ["Bronze", "Silver", "Gold", "Sapphire", "Ruby", "Emerald", "Amethyst", "Pearl", "Obsidian", "Diamond"],
  LEAGUE_EMOJI: ["🥉", "🥈", "🥇", "🔷", "🔴", "🟢", "🟣", "⚪", "⚫", "💎"],
  PROMOTE_BY_TIER: [20, 15, 10, 7, 7, 7, 7, 7, 5, 0], DEMOTE_FROM: 25, LEAGUE_SIZE: 30,
  promoteN(tier) { return ST.PROMOTE_BY_TIER[tier] || 0; },

  s: null,

  defaults() {
    return {
      v: 1,
      name: "Khalil",
      avatar: "🧑",
      created: U.dayKey(),
      gems: 500,
      hearts: { n: 5, t: Date.now() },
      streak: { n: 0, best: 0, last: "", freezes: 1, frozenDays: {} },
      xp: { total: 0, byDay: {}, boostUntil: 0 },
      path: { done: {} },
      words: {},
      mistakes: [],
      league: { tier: 0, week: "", xp: 0, joined: false, history: [], best: 0, banner: null },
      quests: { day: "", items: [], monthKey: "", monthXp: 0, monthClaimed: false },
      ach: {},
      stories: {},
      stats: { lessons: 0, perfect: 0, listens: 0, storiesDone: 0, timeMs: 0 },
      settings: { sound: true, speak: true },
      flags: { installDismissed: false, welcomed: false }
    };
  },

  load() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(ST.KEY)); } catch (e) { }
    const d = ST.defaults();
    ST.s = s ? Object.assign(d, s) : d;
    // deep-merge guard for new sub-keys
    for (const k of ["hearts", "streak", "xp", "path", "league", "quests", "stats", "settings", "flags"]) {
      ST.s[k] = Object.assign(ST.defaults()[k], ST.s[k] || {});
    }
    ST.dailyTick();
  },

  save() {
    try { localStorage.setItem(ST.KEY, JSON.stringify(ST.s)); } catch (e) { }
  },

  reset() { localStorage.removeItem(ST.KEY); location.reload(); },

  /* ---------- hearts ---------- */
  hearts() {
    const h = ST.s.hearts;
    if (h.n >= ST.HEART_MAX) return h.n;
    const el = Date.now() - h.t;
    const add = Math.floor(el / ST.HEART_REGEN_MS);
    if (add > 0) {
      h.n = Math.min(ST.HEART_MAX, h.n + add);
      h.t = h.n >= ST.HEART_MAX ? Date.now() : h.t + add * ST.HEART_REGEN_MS;
      ST.save();
    }
    return h.n;
  },
  loseHeart() {
    ST.hearts();
    const h = ST.s.hearts;
    if (h.n >= ST.HEART_MAX) h.t = Date.now();
    h.n = Math.max(0, h.n - 1);
    ST.save();
    return h.n;
  },
  gainHeart(n) {
    ST.hearts();
    ST.s.hearts.n = Math.min(ST.HEART_MAX, ST.s.hearts.n + (n || 1));
    ST.save();
  },
  refillHearts() { ST.s.hearts.n = ST.HEART_MAX; ST.s.hearts.t = Date.now(); ST.save(); },
  nextHeartMs() {
    ST.hearts();
    if (ST.s.hearts.n >= ST.HEART_MAX) return 0;
    return ST.HEART_REGEN_MS - (Date.now() - ST.s.hearts.t);
  },

  /* ---------- gems ---------- */
  addGems(n) { ST.s.gems += n; ST.save(); },
  spendGems(n) {
    if (ST.s.gems < n) return false;
    ST.s.gems -= n; ST.save(); return true;
  },

  /* ---------- xp + streak ---------- */
  boostActive() { return Date.now() < ST.s.xp.boostUntil; },

  earnXP(base) {
    let amt = base;
    if (ST.boostActive()) amt *= 2;
    const day = U.dayKey();
    const x = ST.s.xp;
    x.total += amt;
    x.byDay[day] = (x.byDay[day] || 0) + amt;
    // trim byDay to last 60 days
    const keys = Object.keys(x.byDay).sort();
    while (keys.length > 60) delete x.byDay[keys.shift()];
    // league
    ST.ensureLeagueWeek();
    ST.s.league.xp += amt;
    ST.s.league.joined = true;
    // monthly
    const mk = U.monthKey();
    if (ST.s.quests.monthKey !== mk) { ST.s.quests.monthKey = mk; ST.s.quests.monthXp = 0; ST.s.quests.monthClaimed = false; }
    ST.s.quests.monthXp += amt;
    // streak
    const isFirstToday = ST.bumpStreak(day);
    ST.questBump("xp", amt);
    ST.save();
    return { amt, boosted: ST.boostActive(), firstToday: isFirstToday };
  },

  bumpStreak(day) {
    const st = ST.s.streak;
    if (st.last === day) return false;
    if (!st.last) { st.n = 1; }
    else {
      const gap = U.daysBetween(st.last, day);
      if (gap === 1) st.n += 1;
      else if (gap > 1) {
        const missed = gap - 1;
        if (st.freezes >= missed && st.n > 0) {
          st.freezes -= missed;
          for (let i = 1; i <= missed; i++) {
            const dd = U.fromKey(st.last); dd.setDate(dd.getDate() + i);
            st.frozenDays[U.dayKey(dd)] = 1;
          }
          st.n += 1;
        } else st.n = 1;
      }
    }
    st.last = day;
    st.best = Math.max(st.best, st.n);
    return true;
  },

  streakAliveToday() { return ST.s.streak.last === U.dayKey(); },

  // called on app open: if streak already broken beyond saving, zero it for honest display
  dailyTick() {
    const st = ST.s.streak;
    if (st.last && st.n > 0) {
      const gap = U.daysBetween(st.last, U.dayKey());
      if (gap > 1 && st.freezes < gap - 1) { st.n = 0; }
    }
    ST.ensureQuests();
    ST.ensureLeagueWeek();
    ST.hearts();
    ST.save();
  },

  /* ---------- quests ---------- */
  QUEST_POOL: [
    { id: "xp30", em: "⚡", text: "Earn 30 XP", goal: 30, metric: "xp", gems: 15 },
    { id: "xp50", em: "⚡", text: "Earn 50 XP", goal: 50, metric: "xp", gems: 20 },
    { id: "les2", em: "📗", text: "Complete 2 lessons", goal: 2, metric: "lessons", gems: 15 },
    { id: "les3", em: "📗", text: "Complete 3 lessons", goal: 3, metric: "lessons", gems: 20 },
    { id: "perf1", em: "💯", text: "Get 1 perfect lesson", goal: 1, metric: "perfect", gems: 20 },
    { id: "lis8", em: "🎧", text: "Do 8 listening exercises", goal: 8, metric: "listen", gems: 15 },
    { id: "combo8", em: "🔥", text: "Get 8 in a row correct", goal: 8, metric: "combo", gems: 15 },
    { id: "story1", em: "📖", text: "Read a story", goal: 1, metric: "story", gems: 20 }
  ],

  ensureQuests() {
    const day = U.dayKey();
    if (ST.s.quests.day === day && ST.s.quests.items.length) return;
    const rnd = U.rng(U.hash("q" + day));
    const pool = U.shuffle(ST.QUEST_POOL, rnd);
    // always include an XP quest first, then 2 distinct others
    const xpq = pool.find(q => q.metric === "xp");
    const rest = pool.filter(q => q !== xpq && q.metric !== "xp").slice(0, 2);
    ST.s.quests.day = day;
    ST.s.quests.items = [xpq].concat(rest).map(q => ({ id: q.id, prog: 0, done: false, claimed: false }));
    ST.save();
  },

  questDef(id) { return ST.QUEST_POOL.find(q => q.id === id); },

  questBump(metric, amt) {
    ST.ensureQuests();
    let completedNow = [];
    ST.s.quests.items.forEach(it => {
      const def = ST.questDef(it.id);
      if (!def || def.metric !== metric || it.done) return;
      if (metric === "combo") it.prog = Math.max(it.prog, amt);
      else it.prog += amt;
      if (it.prog >= def.goal) { it.prog = def.goal; it.done = true; completedNow.push(def); }
    });
    ST.save();
    return completedNow;
  },

  /* ---------- league ---------- */
  BOT_NAMES: ["Sofía", "Mateo", "Valentina", "Liam", "Camila", "Noah", "Isabella", "Ethan", "Mía", "Lucas", "Emma", "Diego", "Olivia", "Thiago", "Ava", "Santi", "Luna", "Gabriel", "Zoe", "Marco", "Ella", "Javier", "Maya", "Andrés", "Chloe", "Pablo", "Aria", "Hugo", "Nora", "Bruno", "Ruby", "Felipe", "Ivy", "Tomás", "Leah", "Dani", "Sara", "Nico", "Jade", "Alex"],
  BOT_AVATARS: ["🦊", "🐼", "🐸", "🐯", "🦁", "🐨", "🐰", "🦉", "🐢", "🦄", "🐙", "🦋", "🐝", "🐬", "🦜", "🐺", "🦝", "🐮", "🐷", "🐔", "🐵", "🐶", "🐱", "🦒", "🦓", "🐹", "🦔", "🐻", "🐳", "🦅"],

  ensureLeagueWeek() {
    const wk = U.weekKey();
    const lg = ST.s.league;
    if (lg.week === wk) return;
    if (lg.week && lg.joined) {
      // finalize last week
      const standings = ST.leagueStandings(lg.week, lg.tier, lg.xp, 7 * 24);
      const rank = standings.findIndex(r => r.me) + 1;
      let moved = "stay";
      if (rank > 0 && rank <= ST.promoteN(lg.tier) && lg.tier < ST.LEAGUES.length - 1) { lg.tier++; moved = "up"; }
      else if (rank > ST.DEMOTE_FROM && lg.tier > 0) { lg.tier--; moved = "down"; }
      lg.best = Math.max(lg.best, lg.tier);
      lg.history.push({ week: lg.week, rank, tier: lg.tier, moved });
      lg.banner = { rank, moved, league: ST.LEAGUES[lg.tier] };
    }
    lg.week = wk; lg.xp = 0; lg.joined = false;
    ST.save();
  },

  // deterministic bots; hoursElapsed lets us "finalize" past weeks
  leagueStandings(week, tier, myXp, hoursElapsed) {
    const seed = U.hash("lg" + week + "t" + tier);
    const rnd = U.rng(seed);
    const names = U.shuffle(ST.BOT_NAMES, rnd).slice(0, ST.LEAGUE_SIZE - 1);
    const avs = U.shuffle(ST.BOT_AVATARS.filter(a => a.length <= 4), rnd);
    const now = new Date();
    const hours = hoursElapsed !== undefined ? hoursElapsed
      : (U.weekDayIdx(now) * 24 + now.getHours() + 1);
    const rows = names.map((nm, i) => {
      const speed = 4 + rnd() * 26 + (tier * 2); // xp per ~day
      const lazy = rnd();
      let xp = 0;
      for (let d = 0; d < 7; d++) {
        const hoursIntoDay = Math.max(0, Math.min(24, hours - d * 24));
        if (hoursIntoDay <= 0) break;
        const dayRnd = U.rng(seed + i * 31 + d * 7);
        const active = dayRnd() > lazy * 0.45;
        if (active) xp += Math.round(speed * (0.4 + dayRnd() * 1.3) * (hoursIntoDay / 24));
      }
      return { name: nm, av: avs[i % avs.length], xp, me: false };
    });
    rows.push({ name: ST.s.name, av: ST.s.avatar, xp: myXp, me: true });
    rows.sort((a, b) => b.xp - a.xp);
    return rows;
  },

  /* ---------- words / mistakes ---------- */
  wordRec(key, ok) {
    const w = ST.s.words[key] || { s: 0, seen: 0, wrong: 0 };
    w.seen++;
    if (ok) w.s = Math.min(4, w.s + 1); else { w.s = Math.max(0, w.s - 2); w.wrong++; }
    ST.s.words[key] = w;
    ST.save();
  },
  wordsLearned() { return Object.keys(ST.s.words).length; },

  pushMistake(spec) {
    const sig = JSON.stringify([spec.t, spec.u, spec.si, spec.wi, spec.dir]);
    if (ST.s.mistakes.some(m => JSON.stringify([m.t, m.u, m.si, m.wi, m.dir]) === sig)) return;
    ST.s.mistakes.push(spec);
    if (ST.s.mistakes.length > 30) ST.s.mistakes.shift();
    ST.save();
  },
  clearMistake(spec) {
    const sig = JSON.stringify([spec.t, spec.u, spec.si, spec.wi, spec.dir]);
    ST.s.mistakes = ST.s.mistakes.filter(m => JSON.stringify([m.t, m.u, m.si, m.wi, m.dir]) !== sig);
    ST.save();
  },

  /* ---------- achievements ---------- */
  ACH: [
    { id: "fire", name: "En Fuego", em: "🔥", tiers: [3, 7, 14, 30, 60, 100], val: () => ST.s.streak.best, unit: "day streak" },
    { id: "sage", name: "Sabio", em: "🧠", tiers: [50, 250, 1000, 2500, 5000], val: () => ST.s.xp.total, unit: "XP" },
    { id: "collect", name: "Coleccionista", em: "📚", tiers: [25, 75, 150, 250], val: () => ST.wordsLearned(), unit: "words" },
    { id: "study", name: "Estudioso", em: "⭐", tiers: [10, 30, 75, 150], val: () => ST.s.stats.lessons, unit: "lessons" },
    { id: "perfect", name: "Perfeccionista", em: "💯", tiers: [3, 10, 25], val: () => ST.s.stats.perfect, unit: "perfect lessons" },
    { id: "tales", name: "Cuentista", em: "📖", tiers: [1, 3, 5], val: () => ST.s.stats.storiesDone, unit: "stories" },
    { id: "champ", name: "Campeón", em: "🏆", tiers: [2, 5, 9], val: () => ST.s.league.best, unit: "league tier" },
    { id: "rich", name: "Brillante", em: "💎", tiers: [800, 1500, 3000], val: () => ST.s.gems, unit: "gems" }
  ],

  achTier(a) { // tiers reached
    const v = a.val();
    let t = 0;
    a.tiers.forEach(x => { if (v >= x) t++; });
    return t;
  },

  checkAchievements() { // returns newly-earned [{name, em, tier}]
    const out = [];
    ST.ACH.forEach(a => {
      const t = ST.achTier(a);
      const had = ST.s.ach[a.id] || 0;
      if (t > had) { ST.s.ach[a.id] = t; out.push({ name: a.name, em: a.em, tier: t }); }
    });
    if (out.length) ST.save();
    return out;
  }
};
