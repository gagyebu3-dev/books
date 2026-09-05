const CACHE_NAME = "my-bookshelf-v12";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];
const OPTIONAL_ASSETS = [
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // 핵심 앱 셸은 반드시 캐시(실패 시 설치 실패)
      return cache.addAll(CORE_ASSETS).then(() =>
        // 엑셀 라이브러리(CDN)는 되면 좋고 안 돼도 앱은 동작해야 하므로 실패를 무시
        Promise.all(
          OPTIONAL_ASSETS.map((url) =>
            cache.add(url).catch(() => {})
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App shell(HTML/CSS/JS/아이콘)은 캐시 우선, 그 외 요청(예: 구글 폰트)은 네트워크 우선 후 캐시 폴백
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isAppShell = url.origin === self.location.origin;

  if (isAppShell) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
  } else {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => caches.match(event.request))
    );
  }
});
