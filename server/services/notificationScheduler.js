import cron from 'node-cron'
import { getRepository } from '../repositories/index.js'
import { sendAppointmentReminder } from './emailService.js'

const appointmentsRepo = getRepository('appointments.json')

/**
 * Calcula a diferença em horas entre o horário do agendamento e agora
 * @param {string} date - Data no formato YYYY-MM-DD
 * @param {string} time - Hora no formato HH:mm
 * @returns {number} Diferença em horas
 */
const getHoursUntilAppointment = (date, time) => {
    const appointmentDateTime = new Date(`${date}T${time}:00`)
    const now = new Date()
    const diffMs = appointmentDateTime - now
    return diffMs / (1000 * 60 * 60)
}

/**
 * Determina qual notificação deve ser enviada baseado no tempo restante
 * @param {number} hoursUntil - Horas até o agendamento
 * @param {object} notificationsSent - Objeto com status de envio
 * @returns {string|null} Tipo de notificação a enviar ou null
 */
const getNotificationToSend = (hoursUntil, notificationsSent = {}) => {
    // Verifica cada threshold de notificação
    // Margem de 30 minutos para cada verificação

    if (hoursUntil <= 4.5 && hoursUntil > 3.5 && !notificationsSent['4h']) {
        return '4h'
    }
    if (hoursUntil <= 24.5 && hoursUntil > 23.5 && !notificationsSent['24h']) {
        return '24h'
    }

    return null
}

/**
 * Inicializa o campo notificationsSent em agendamentos confirmados que não possuem
 */
const ensureNotificationField = async (appointment) => {
    if (appointment.status === 'confirmed' && !appointment.notificationsSent) {
        await appointmentsRepo.update(appointment.id, {
            notificationsSent: {
                '24h': false,
                '12h': false,
                '4h': false
            }
        })
        return {
            ...appointment,
            notificationsSent: { '24h': false, '12h': false, '4h': false }
        }
    }
    return appointment
}

/**
 * Processa notificações para todos os agendamentos confirmados
 */
const processNotifications = async () => {
    console.log('[NotificationScheduler] 🔍 Verificando agendamentos para notificações...')

    try {
        const appointments = await appointmentsRepo.findAll()

        // Filtrar apenas confirmados e com data futura
        const now = new Date()
        const confirmedAppointments = appointments.filter(apt => {
            if (apt.status !== 'confirmed') return false
            const aptDate = new Date(`${apt.date}T${apt.time}:00`)
            return aptDate > now
        })

        console.log(`[NotificationScheduler] 📋 ${confirmedAppointments.length} agendamentos confirmados encontrados`)

        let notificationsSent = 0

        for (const appointment of confirmedAppointments) {
            // Garantir que o campo notificationsSent existe
            const apt = await ensureNotificationField(appointment)

            const hoursUntil = getHoursUntilAppointment(apt.date, apt.time)
            const notificationType = getNotificationToSend(hoursUntil, apt.notificationsSent)

            if (notificationType) {
                console.log(`[NotificationScheduler] ⏰ Enviando notificação ${notificationType} para ${apt.customerName}`)

                // Determinar email do destinatário
                // Prioriza email do perfil do usuário (se existir userId)
                let recipientEmail = apt.customerEmail
                let recipientName = apt.customerName

                if (apt.userId) {
                    const usersRepo = getRepository('users.json')
                    const user = await usersRepo.findById(apt.userId)
                    if (user?.email) {
                        recipientEmail = user.email
                        recipientName = user.name || apt.customerName
                    }
                }

                // Enviar email
                const emailSent = await sendAppointmentReminder(
                    recipientEmail,
                    recipientName,
                    apt.date,
                    apt.time,
                    notificationType
                )

                // Marcar notificação como enviada (mesmo se não tinha email, para não tentar novamente)
                const updatedNotifications = {
                    ...apt.notificationsSent,
                    [notificationType]: true
                }

                await appointmentsRepo.update(apt.id, {
                    notificationsSent: updatedNotifications
                })

                if (emailSent) {
                    notificationsSent++
                }
            }
        }

        if (notificationsSent > 0) {
            console.log(`[NotificationScheduler] ✅ ${notificationsSent} notificações enviadas`)
        } else {
            console.log(`[NotificationScheduler] 💤 Nenhuma notificação pendente no momento`)
        }
    } catch (error) {
        console.error('[NotificationScheduler] ❌ Erro ao processar notificações:', error.message)
    }
}

/**
 * Inicia o scheduler de notificações
 * Executa a cada 30 minutos
 */
export const startNotificationScheduler = () => {
    console.log('[NotificationScheduler] 🚀 Iniciando scheduler de notificações...')

    // Executar imediatamente na inicialização
    processNotifications()

    // Agendar para rodar a cada 30 minutos
    // Formato: minuto hora dia-do-mês mês dia-da-semana
    cron.schedule('*/30 * * * *', () => {
        processNotifications()
    })

    console.log('[NotificationScheduler] ✅ Scheduler configurado para executar a cada 30 minutos')
}

/**
 * Processa notificações manualmente (para testes)
 */
export const runNotificationsNow = async () => {
    console.log('[NotificationScheduler] 🔄 Executando verificação manual...')
    await processNotifications()
}

export default {
    startNotificationScheduler,
    runNotificationsNow
}
