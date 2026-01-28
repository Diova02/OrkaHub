const CACHE_NAME = 'orka-offline-v2'; // Mudei a versão para forçar atualização
const OFFLINE_URL = 'offline.html'; // Sem a barra inicial '/' para evitar erro de caminho relativo

// 1. Instalação: Força a espera e o cache
self.addEventListener('install', (event) => {
    // Força o SW a pular a fase de espera e ativar imediatamente
    self.skipWaiting();
    
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Caching offline page');
            return cache.add(new Request(OFFLINE_URL, {cache: 'reload'}));
        })
    );
});

// 2. Ativação: Reivindica o controle de todos os clientes (abas) abertas
self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
    console.log('[SW] Ativado e controlando clientes');
});

// 3. Fetch: Intercepta quedas de rede
self.addEventListener('fetch', (event) => {
    // Apenas para navegação de HTML (mudança de página ou reload)
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch((error) => {
                console.log('[SW] Falha na rede. Servindo Offline Page.');
                return caches.match(OFFLINE_URL);
            })
        );
    }
});