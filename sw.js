// Service Worker — 오프라인 캐싱
// 앱 셸(index.html)을 캐시해 비행기·터널 등 네트워크 없는 곳에서도 열리게 한다.
// 지도 타일은 캐시하지 않는다(용량이 크고 수시로 바뀜).

const CACHE = 'sg-guide-v7-simple-ai';
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 다른 출처(지도 타일, 구글맵 등)는 그대로 통과
  if (url.origin !== location.origin) return;

  // API는 항상 네트워크 — 실패해도 앱이 내장 시나리오로 폴백함
  if (url.pathname.startsWith('/api/')) return;

  // 앱 셸: 네트워크 우선, 실패 시 캐시 (최신 버전 우선 + 오프라인 보장)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('/index.html')))
  );
});
