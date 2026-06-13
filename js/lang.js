/* Charla — language registry + active-language management (global LANG)
   The exercise engine stores the foreign-language text in each item's `.es`
   field for historical reasons; treat `.es` as the generic "target language"
   slot. Per-language course data is namespaced under window.COURSES[code],
   window.STORIES_BY_LANG[code], and window.AUDIO_MAPS[code]. Progress is stored
   per language under localStorage key "charla-state-<code>". */
const LANG = {
  active: "es",

  // tts = BCP-47 used for SpeechSynthesis fallback + speech recognition.
  // voicePref = lowercase substrings to prefer when picking a device voice.
  DEFS: {
    es: { code: "es", name: "Spanish",    natName: "Español",    flag: "🇪🇸", tts: "es-MX", voicePref: ["mónica", "monica", "paulina", "sabina", "helena", "google español", "español"], hello: "¡Hola!",    welcome: "¡Bienvenido!", typeIn: "Spanish" },
    fr: { code: "fr", name: "French",     natName: "Français",   flag: "🇫🇷", tts: "fr-FR", voicePref: ["amélie", "amelie", "thomas", "audrey", "google français", "français", "french"], hello: "Bonjour !", welcome: "Bienvenue !", typeIn: "French" },
    de: { code: "de", name: "German",     natName: "Deutsch",    flag: "🇩🇪", tts: "de-DE", voicePref: ["anna", "katja", "petra", "google deutsch", "deutsch", "german"], hello: "Hallo!",    welcome: "Willkommen!",  typeIn: "German" },
    it: { code: "it", name: "Italian",    natName: "Italiano",   flag: "🇮🇹", tts: "it-IT", voicePref: ["alice", "elsa", "federica", "google italiano", "italiano", "italian"], hello: "Ciao!",     welcome: "Benvenuto!",   typeIn: "Italian" },
    pt: { code: "pt", name: "Portuguese", natName: "Português",  flag: "🇧🇷", tts: "pt-BR", voicePref: ["luciana", "fernanda", "joana", "google português", "português", "portuguese"], hello: "Olá!",      welcome: "Bem-vindo!",   typeIn: "Portuguese" }
  },

  // display order in the picker
  ORDER: ["es", "fr", "de", "it", "pt"],

  def() { return LANG.DEFS[LANG.active] || LANG.DEFS.es; },
  name() { return LANG.def().name; },
  flag() { return LANG.def().flag; },

  // a language is usable only once its course content has been loaded
  available(code) {
    return !!(window.COURSES && window.COURSES[code] && window.COURSES[code].part1);
  },
  availableCodes() { return LANG.ORDER.filter(c => LANG.available(c)); },

  load() {
    let a = null;
    try { a = localStorage.getItem("charla-lang"); } catch (e) { }
    if (a && LANG.DEFS[a]) LANG.active = a;
    // if the chosen language has no content loaded, fall back to the first available one
    if (!LANG.available(LANG.active)) {
      const f = LANG.availableCodes()[0];
      if (f) LANG.active = f;
    }
  },

  // was a language explicitly chosen yet? (drives the first-run picker)
  chosen() {
    try { return !!localStorage.getItem("charla-lang"); } catch (e) { return false; }
  },

  set(code) {
    if (!LANG.DEFS[code] || code === LANG.active) return;
    try { localStorage.setItem("charla-lang", code); } catch (e) { }
    location.reload();
  },

  stateKey() { return "charla-state-" + LANG.active; }
};
// top-level `const` does NOT attach to window — expose it so the `window.LANG` guards work
window.LANG = LANG;
