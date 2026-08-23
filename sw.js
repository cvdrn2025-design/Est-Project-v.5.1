/* ============================================================
   SERVICE WORKER SiCerMat - Versi 2.3
   - Cache Aset Statis (HTML, CSS, JS, Gambar)
   - Strategi: Cache First untuk aset, Network First untuk navigasi
   - Mendukung PWA (Offline Mode)
   ============================================================ */

const CACHE_NAME = 'sicermat-cache-v2.3'; // <-- PERBARUI KE v2.3
const OFFLINE_URL = 'offline.html';

// Daftar aset yang wajib di-cache saat pertama kali dibuka
const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/admin.html',
    '/qris-payment.html',
    '/qris-addon.html',
    '/qris-newcat.html',
    '/offline.html',
    '/manifest.json',
    '/icon.png',
    '/icon-192.png',
    '/icon-512.png',
    '/master-data.js',
    '/addon-notification.js',
    '/sw.js',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
    'https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/8.10.0/firebase-database.js'
];

// Instal Service Worker & Cache Aset
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Precaching assets...');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
    );
});

// Aktifkan Service Worker & Hapus Cache Lama
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Menghapus cache lama:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Strategi Fetch: Cache First untuk aset statis, Network First untuk navigasi
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Hanya tangani request HTTP/HTTPS (bukan chrome-extension, dll)
    if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
        return;
    }

    // Strategi untuk navigasi halaman (HTML)
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Simpan salinan halaman ke cache
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, copy);
                    });
                    return response;
                })
                .catch(() => {
                    // Fallback ke cache, lalu ke offline.html jika tidak ada
                    return caches.match(request).then((cachedResponse) => {
                        if (cachedResponse) {
                            return cachedResponse;
                        }
                        return caches.match(OFFLINE_URL);
                    });
                })
        );
        return;
    }

    // Strategi untuk aset statis (JS, CSS, Gambar) - Cache First
    if (request.destination === 'script' || 
        request.destination === 'style' || 
        request.destination === 'image' || 
        request.destination === 'font') {
        
        event.respondWith(
            caches.match(request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(request).then((response) => {
                    // Simpan aset baru ke cache
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, copy);
                    });
                    return response;
                }).catch(() => {
                    return caches.match(OFFLINE_URL);
                });
            })
        );
        return;
    }

    // Strategi default untuk request lainnya (misal: API Firebase) - Network Only
    event.respondWith(
        fetch(request).catch(() => {
            return caches.match(OFFLINE_URL);
        })
    );
});

// Pesan dari halaman utama untuk update cache
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
