/* ═══════════════════════════════════════════════════════════════
   SERVICE WORKER — Simulação de Pagamento RCONT-SCT
   Offline-first: shell local em cache + libs de CDN em runtime.
   Bump VERSION para forçar atualização em todos os clientes.
   ═══════════════════════════════════════════════════════════════ */

const VERSION    = 'v1.1.1';
const CACHE_APP  = `rcont-app-${VERSION}`;
const CACHE_CDN  = `rcont-cdn-${VERSION}`;
const ALL_CACHES = [CACHE_APP, CACHE_CDN];

/* Shell local — instalado no 1º load, disponível offline depois */
const PRECACHE = [
    './index.html',
    './index_diurno.html',
    './index_folguista.html',
    './manifest.json',
    './img/FP-3d-icon_1_192.png',
    './img/FP-3d-icon_2_512.png',
    './img/logo.png',
    './img/exportexcel.ico',
    './img/exportpdf.ico'
];

/* Bibliotecas externas — sem elas o app perde gráfico e exportação offline */
const PRECACHE_CDN = [
    'https://cdn.jsdelivr.net/npm/chart.js',
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap'
];

/* Fallback exibido quando um GET offline não encontra nada no cache */
const OFFLINE_FALLBACK = './index_diurno.html';

const CDN_HOSTS = [
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

/* ═══════════════════════════════════════════════════════════════
   INSTALL — precache tolerante a falhas
   (um asset 404 não deve impedir a ativação do SW inteiro)
   ═══════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
    event.waitUntil((async () => {
        await precache(CACHE_APP, PRECACHE, 'same-origin');
        await precache(CACHE_CDN, PRECACHE_CDN, 'no-cors');
        await self.skipWaiting();
    })());
});

async function precache(cacheName, urls, mode) {
    const cache = await caches.open(cacheName);
    await Promise.all(urls.map(async url => {
        try {
            const res = await fetch(new Request(url, { cache: 'reload', mode }));
            // resposta cross-origin chega opaca (status 0): só put() aceita isso
            if (!res || (!res.ok && res.type !== 'opaque')) {
                throw new Error('HTTP ' + (res && res.status));
            }
            await cache.put(url, res);
        } catch (err) {
            console.warn('[SW] precache falhou:', url, err);
        }
    }));
}

/* ═══════════════════════════════════════════════════════════════
   ACTIVATE — limpa caches antigos e assume o controle
   ═══════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(
            keys
                .filter(key => key.startsWith('rcont-') && !ALL_CACHES.includes(key))
                .map(key => caches.delete(key))
        );
        if (self.registration.navigationPreload) {
            await self.registration.navigationPreload.enable();
        }
        await self.clients.claim();
    })());
});

/* ═══════════════════════════════════════════════════════════════
   FETCH — roteamento por tipo de requisição
   ═══════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
    const req = event.request;

    if (req.method !== 'GET') return;

    const url = new URL(req.url);

    // Requisições de outros domínios que não são CDN conhecida: ignora
    if (url.origin !== self.location.origin && !CDN_HOSTS.includes(url.hostname)) return;

    // Navegação (troca de página / reload): rede primeiro, cache como reserva
    if (req.mode === 'navigate') {
        event.respondWith(handleNavigate(event));
        return;
    }

    // CDN (Chart.js, jsPDF, XLSX, Google Fonts): stale-while-revalidate
    if (CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(staleWhileRevalidate(req, CACHE_CDN));
        return;
    }

    // Demais recursos same-origin (CSS, JS, imagens): cache primeiro
    event.respondWith(cacheFirst(req, CACHE_APP));
});

/* ═══════════════════════════════════════════════════════════════
   ESTRATÉGIAS
   ═══════════════════════════════════════════════════════════════ */
async function handleNavigate(event) {
    const req = event.request;

    try {
        const preload = await event.preloadResponse;
        if (preload) {
            putInCache(CACHE_APP, req, preload.clone());
            return preload;
        }

        const fresh = await fetch(req);
        putInCache(CACHE_APP, req, fresh.clone());
        return fresh;
    } catch (err) {
        // Offline: página exata → landing (se for a raiz) → simulação diurna → simulação folguista
        const exact = await caches.match(req, { ignoreSearch: true });
        if (exact) return exact;

        const root = new URL(self.registration.scope).pathname.replace(/\/+$/, '');
        if (new URL(req.url).pathname.replace(/\/+$/, '') === root) {
            const landing = await caches.match('./index.html', { ignoreSearch: true });
            if (landing) return landing;
        }

        return (await caches.match(OFFLINE_FALLBACK, { ignoreSearch: true }))
            || (await caches.match('./index_folguista.html', { ignoreSearch: true }))
            || Response.error();
    }
}

async function cacheFirst(req, cacheName) {
    const cached = await caches.match(req, { ignoreSearch: true });
    if (cached) return cached;

    try {
        const fresh = await fetch(req);
        putInCache(cacheName, req, fresh.clone());
        return fresh;
    } catch (err) {
        return cached || Response.error();
    }
}

async function staleWhileRevalidate(req, cacheName) {
    const cached = await caches.match(req, { ignoreSearch: true });

    const network = fetch(req)
        .then(res => {
            if (res && (res.ok || res.type === 'opaque')) {
                return caches.open(cacheName)
                    .then(cache => cache.put(req, res.clone()))
                    .then(() => res);
            }
            return res;
        })
        .catch(() => null);

    if (cached) return cached;

    return (await network) || new Response('', { status: 504, statusText: 'Offline' });
}

function putInCache(cacheName, req, source) {
    Promise.resolve(source)
        .then(res => {
            if (!res || (!res.ok && res.type !== 'opaque')) return;
            return caches.open(cacheName).then(cache => cache.put(req, res));
        })
        .catch(() => {});
}

/* ═══════════════════════════════════════════════════════════════
   MENSAGENS — atualização imediata sob comando da página
   ═══════════════════════════════════════════════════════════════ */
self.addEventListener('message', event => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
