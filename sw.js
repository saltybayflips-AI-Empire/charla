/* Charla service worker — offline-first, separate long-lived audio cache */
const VER = "charla-v3";
const AUDIO_CACHE = "charla-audio-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.webmanifest",
  "./course-data-1.js",
  "./course-data-2.js",
  "./stories-data.js",
  "./audio-map.js",
  "./data/fr/course.js",
  "./data/fr/stories.js",
  "./data/fr/audio-map.js",
  "./data/de/course.js",
  "./data/de/stories.js",
  "./data/de/audio-map.js",
  "./data/it/course.js",
  "./data/it/stories.js",
  "./data/it/audio-map.js",
  "./data/pt/course.js",
  "./data/pt/stories.js",
  "./data/pt/audio-map.js",
  "./js/util.js",
  "./js/lang.js",
  "./js/audio.js",
  "./js/state.js",
  "./js/exgen.js",
  "./js/lesson.js",
  "./js/path.js",
  "./js/screens.js",
  "./js/main.js",
  "./icons/icon-32.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VER).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VER && k !== AUDIO_CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // audio clips: cache-first into a cache that survives app version bumps
  if (url.origin === location.origin && url.pathname.includes("/audio/")) {
    e.respondWith(
      caches.open(AUDIO_CACHE).then(c =>
        c.match(e.request).then(hit => hit || fetch(e.request).then(res => {
          if (res.ok) c.put(e.request, res.clone());
          return res;
        }))
      )
    );
    return;
  }
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res.ok && url.origin === location.origin) {
          const copy = res.clone();
          caches.open(VER).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => {
        if (e.request.mode === "navigate") return caches.match("./index.html");
      });
    })
  );
});
