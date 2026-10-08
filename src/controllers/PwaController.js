/**
 * 앱 설치(PWA)용 서비스 워커. 버전이 바뀌면 캐시 이름이 바뀌어 새 파일을 받는다.
 * 화면(HTML)은 네트워크 우선, 정적 파일·분류 모델은 캐시 우선. API와 공유 링크는 캐시하지 않는다.
 */
class PwaController {
  constructor({ version }) {
    if (!version) throw new TypeError('version is required');
    this.version = version;
  }

  static PRECACHE = ['/css/style.css', '/js/app.js', '/shared/constants.js', '/shared/icons.js', '/img/icon.svg', '/manifest.webmanifest', '/models/yamnet_class_map.csv', '/config/source-mapping.json'];

  /** 서비스 워커 스크립트 본문 */
  script() {
    const cache = `neighbor-sound-${this.version}`;
    return `/* 이웃소리 서비스 워커 v${this.version} */
const CACHE = ${JSON.stringify(cache)};
const PRECACHE = ${JSON.stringify(PwaController.PRECACHE)};
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('neighbor-sound-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
const isStatic = (url) => /^\/(css|js|shared|fonts|img|models|config)\//.test(url.pathname) || url.pathname === '/manifest.webmanifest' || url.hostname === 'cdn.jsdelivr.net';
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/s/')) return;
  if (isStatic(url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then((hit) => hit || new Response('<!doctype html><meta charset="utf-8"><title>오프라인</title><body style="font-family:sans-serif;padding:24px">인터넷에 연결되어 있지 않습니다. 연결된 뒤 다시 열어 주세요.</body>', { headers: { 'Content-Type': 'text/html; charset=utf-8' } }))));
  }
});
`;
  }

  serve = (req, res, next) => {
    try {
      res.set({ 'Content-Type': 'application/javascript; charset=utf-8', 'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/' });
      res.send(this.script());
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { PwaController };
