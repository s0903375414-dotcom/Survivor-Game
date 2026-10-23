const CACHE_NAME = 'survivor-game-v8';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './game.js',
  './characters_data.js',
  './equipment.js',
  './codex.js',
  './gacha.js',
  './i18n.js',
  './i18n_dict_1.js',
  './i18n_dict_2.js',
  './i18n_dict_3.js',
  './i18n_dict_4.js',
  './i18n_dict_5.js',
  './i18n_dict_6.js',
  './shared_config.js',
  './app-update.js',
  './manifest.json',
  './assets/commander_tutorial.jpg'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});
