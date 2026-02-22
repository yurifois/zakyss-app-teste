/**
 * Serviço de Notificações do Frontend
 * Gerencia permissões, service worker e notificações locais para lembretes de agendamento
 */

const NOTIFICATION_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutos
const NOTIFICATIONS_STORAGE_KEY = 'beautybook_notifications_sent'

/**
 * Registra o Service Worker
 */
export const registerServiceWorker = async () => {
    if (!('serviceWorker' in navigator)) {
        console.log('[NotificationService] Service Worker não suportado')
        return null
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        console.log('[NotificationService] Service Worker registrado:', registration.scope)
        return registration
    } catch (error) {
        console.error('[NotificationService] Falha ao registrar Service Worker:', error)
        return null
    }
}

/**
 * Solicita permissão para notificações
 * @returns {Promise<boolean>} Se a permissão foi concedida
 */
export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        console.log('[NotificationService] Notificações não suportadas neste navegador')
        return false
    }

    if (Notification.permission === 'granted') {
        return true
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission()
        return permission === 'granted'
    }

    return false
}

/**
 * Verifica se notificações estão habilitadas
 */
export const areNotificationsEnabled = () => {
    return 'Notification' in window && Notification.permission === 'granted'
}

/**
 * Formata data para exibição
 */
const formatDate = (dateStr) => {
    const months = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
    ]
    const [year, month, day] = dateStr.split('-')
    return `${parseInt(day)} de ${months[parseInt(month) - 1]}`
}

/**
 * Obtém notificações já enviadas do localStorage
 */
const getSentNotifications = () => {
    try {
        const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
        return stored ? JSON.parse(stored) : {}
    } catch {
        return {}
    }
}

/**
 * Marca uma notificação como enviada
 */
const markNotificationSent = (appointmentId, type) => {
    const sent = getSentNotifications()
    if (!sent[appointmentId]) {
        sent[appointmentId] = {}
    }
    sent[appointmentId][type] = Date.now()
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(sent))
}

/**
 * Verifica se uma notificação já foi enviada
 */
const wasNotificationSent = (appointmentId, type) => {
    const sent = getSentNotifications()
    return sent[appointmentId]?.[type] ? true : false
}

/**
 * Limpa notificações antigas (mais de 7 dias)
 */
const cleanOldNotifications = () => {
    const sent = getSentNotifications()
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000)

    Object.keys(sent).forEach(appointmentId => {
        const notifications = sent[appointmentId]
        const allOld = Object.values(notifications).every(time => time < weekAgo)
        if (allOld) {
            delete sent[appointmentId]
        }
    })

    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(sent))
}

/**
 * Calcula horas até o agendamento
 */
const getHoursUntilAppointment = (date, time) => {
    const appointmentDateTime = new Date(`${date}T${time}:00`)
    const now = new Date()
    return (appointmentDateTime - now) / (1000 * 60 * 60)
}

/**
 * Determina qual tipo de notificação enviar
 */
const getNotificationType = (hoursUntil) => {
    if (hoursUntil <= 4.5 && hoursUntil > 3) return '4h'
    if (hoursUntil <= 12.5 && hoursUntil > 11) return '12h'
    if (hoursUntil <= 24.5 && hoursUntil > 23) return '24h'
    return null
}

/**
 * Exibe notificação local
 */
export const showLocalNotification = (title, body, options = {}) => {
    if (!areNotificationsEnabled()) {
        console.log('[NotificationService] Notificações não habilitadas')
        return
    }

    const notification = new Notification(title, {
        body,
        icon: '/beautybook-icon.png',
        badge: '/beautybook-badge.png',
        vibrate: [200, 100, 200],
        ...options
    })

    notification.onclick = () => {
        window.focus()
        notification.close()
    }

    return notification
}

/**
 * Verifica agendamentos do usuário e envia notificações locais
 * @param {Array} appointments - Lista de agendamentos do usuário
 */
export const checkAppointmentNotifications = (appointments) => {
    if (!areNotificationsEnabled()) return

    cleanOldNotifications()

    const confirmedAppointments = appointments.filter(apt => apt.status === 'confirmed')

    for (const appointment of confirmedAppointments) {
        const hoursUntil = getHoursUntilAppointment(appointment.date, appointment.time)

        // Só verifica agendamentos futuros dentro de 25 horas
        if (hoursUntil <= 0 || hoursUntil > 25) continue

        const notificationType = getNotificationType(hoursUntil)

        if (notificationType && !wasNotificationSent(appointment.id, notificationType)) {
            const formattedDate = formatDate(appointment.date)
            const customerName = appointment.customerName?.split(' ')[0] || 'Cliente'

            const reminderText = {
                '24h': 'amanhã',
                '12h': 'em 12 horas',
                '4h': 'em 4 horas'
            }

            showLocalNotification(
                `⏰ Lembrete de Agendamento`,
                `Olá ${customerName}! Confirmado seu agendamento para o dia ${formattedDate} às ${appointment.time}.`,
                {
                    tag: `appointment-${appointment.id}-${notificationType}`,
                    requireInteraction: true
                }
            )

            markNotificationSent(appointment.id, notificationType)
            console.log(`[NotificationService] ✅ Notificação ${notificationType} enviada para agendamento ${appointment.id}`)
        }
    }
}

/**
 * Inicia verificação periódica de notificações
 * @param {Function} fetchAppointments - Função que retorna os agendamentos do usuário
 */
export const startNotificationChecker = (fetchAppointments) => {
    // Verifica imediatamente
    fetchAppointments().then(appointments => {
        if (appointments) {
            checkAppointmentNotifications(appointments)
        }
    })

    // Configura verificação periódica
    const intervalId = setInterval(async () => {
        try {
            const appointments = await fetchAppointments()
            if (appointments) {
                checkAppointmentNotifications(appointments)
            }
        } catch (error) {
            console.error('[NotificationService] Erro ao verificar agendamentos:', error)
        }
    }, NOTIFICATION_CHECK_INTERVAL)

    return intervalId
}

/**
 * Para a verificação periódica
 */
export const stopNotificationChecker = (intervalId) => {
    if (intervalId) {
        clearInterval(intervalId)
    }
}

export default {
    registerServiceWorker,
    requestNotificationPermission,
    areNotificationsEnabled,
    showLocalNotification,
    checkAppointmentNotifications,
    startNotificationChecker,
    stopNotificationChecker
}
