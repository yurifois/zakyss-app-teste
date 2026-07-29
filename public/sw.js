// Service Worker para Push Notifications do BeautyBook
const CACHE_NAME = 'beautybook-v1'

// Evento de instalação
self.addEventListener('install', (event) => {
    console.log('[ServiceWorker] Instalado')
    self.skipWaiting()
})

// Evento de ativação
self.addEventListener('activate', (event) => {
    console.log('[ServiceWorker] Ativado')
    event.waitUntil(clients.claim())
})

