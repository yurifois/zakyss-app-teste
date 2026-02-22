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

// Evento de push notification
self.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push recebido')

    let data = {
        title: 'BeautyBook',
        body: 'Você tem uma notificação!',
        icon: '/beautybook-icon.png',
        badge: '/beautybook-badge.png'
    }

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() }
        } catch (e) {
            data.body = event.data.text()
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/beautybook-icon.png',
        badge: data.badge || '/beautybook-badge.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'open', title: 'Ver agendamento' },
            { action: 'close', title: 'Fechar' }
        ]
    }

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    )
})

// Clique na notificação
self.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notificação clicada')
    event.notification.close()

    if (event.action === 'close') {
        return
    }

    // Abre a aplicação ou foca se já estiver aberta
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Se já tem uma janela aberta, foca nela
                for (const client of clientList) {
                    if ('focus' in client) {
                        return client.focus()
                    }
                }
                // Senão, abre uma nova
                if (clients.openWindow) {
                    return clients.openWindow(event.notification.data.url || '/')
                }
            })
    )
})
