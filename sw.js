/* 신규처 등록평가 — 서비스 워커
   전략
   - 화면(HTML): 네트워크 우선 → 실패 시 캐시 (배포 즉시 최신 반영 + 오프라인 동작)
   - 정적 파일(아이콘/매니페스트): 캐시 우선 + 백그라운드 갱신
   - 외부 CDN(pptxgenjs): 캐시 우선 (한 번 받아두면 오프라인에서도 PPT 생성)
   평가 데이터는 IndexedDB에 있으므로 이 캐시와 무관하게 보존됩니다. */

const VERSION    = 'v3';
const APP_CACHE  = `cosmedb-app-${VERSION}`;
const CDN_CACHE  = `cosmedb-cdn-${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    // 일부 파일이 실패해도 설치는 계속 진행
    await Promise.all(PRECACHE.map(u => cache.add(u).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k !== APP_CACHE && k !== CDN_CACHE).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  // 1) 화면 이동 — 네트워크 우선
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(APP_CACHE);
        cache.put('./index.html', fresh.clone());
        return fresh;
      } catch (e) {
        const cache  = await caches.open(APP_CACHE);
        const cached = await cache.match('./index.html') || await cache.match('./');
        if (cached) return cached;
        return new Response(
          '<meta charset="utf-8"><p style="font-family:sans-serif;padding:24px">오프라인 상태이며 저장된 화면이 없습니다. 인터넷 연결 후 다시 열어주세요.</p>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  // 2) 외부 CDN — 캐시 우선
  if (!sameOrigin) {
    event.respondWith((async () => {
      const cache  = await caches.open(CDN_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      const fresh = await fetch(req);
      if (fresh && (fresh.ok || fresh.type === 'opaque')) cache.put(req, fresh.clone());
      return fresh;
    })().catch(() => caches.match(req)));
    return;
  }

  // 3) 같은 출처 정적 파일 — 캐시 우선 + 백그라운드 갱신
  event.respondWith((async () => {
    const cache  = await caches.open(APP_CACHE);
    const cached = await cache.match(req);
    const network = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);
    return cached || (await network) || new Response('', { status: 504 });
  })());
});
