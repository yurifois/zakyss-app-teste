import cron from 'node-cron'
import { getRepository } from '../repositories/index.js'
import { sendAppointmentReminder, sendReturnReminder } from './emailService.js'

const appointmentsRepo = getRepository('appointments.json')

// Dias após o serviço concluído para incentivar o cliente a agendar de novo
const RETURN_REMINDER_DAYS = 30

// Só considera agendamentos concluídos a partir desta data: evita mandar um
// lote retroativo de emails pra todo o histórico assim que o recurso entra no ar.
const RETURN_REMINDER_FEATURE_START = '2026-07-08'

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
    if (hoursUntil <= 12.5 && hoursUntil > 11.5 && !notificationsSent['12h']) {
        return '12h'
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
 * Verifica quantos dias se passaram desde uma data (YYYY-MM-DD)
 */
const getDaysSince = (dateStr) => {
    const date = new Date(`${dateStr}T00:00:00`)
    const now = new Date()
    return (now - date) / (1000 * 60 * 60 * 24)
}

/**
 * Envia lembrete de retorno para clientes que concluíram um serviço há
 * RETURN_REMINDER_DAYS dias e ainda não agendaram de novo o mesmo serviço
 * no mesmo estabelecimento, incentivando a recorrência.
 */
const processReturnReminders = async () => {
    console.log('[NotificationScheduler] 🔁 Verificando lembretes de retorno...')

    try {
        const appointments = await appointmentsRepo.findAll()
        const completed = appointments.filter(apt => apt.status === 'completed')

        let remindersSent = 0

        for (const apt of completed) {
            if (apt.returnReminderSent) continue
            if (apt.date < RETURN_REMINDER_FEATURE_START) continue
            if (getDaysSince(apt.date) < RETURN_REMINDER_DAYS) continue

            // Cliente já tem um agendamento mais recente para o mesmo serviço/estabelecimento?
            const hasNewerBooking = appointments.some(other => {
                if (other.id === apt.id) return false
                if (other.establishmentId !== apt.establishmentId) return false
                if (other.status === 'cancelled') return false
                const sameCustomer = apt.userId
                    ? other.userId === apt.userId
                    : other.customerPhone === apt.customerPhone
                if (!sameCustomer) return false
                const sharesService = (other.services || []).some(s => (apt.services || []).includes(s))
                return sharesService && other.date > apt.date
            })

            if (hasNewerBooking) {
                await appointmentsRepo.update(apt.id, { returnReminderSent: true })
                continue
            }

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

            const establishmentsRepo = getRepository('establishments.json')
            const establishment = await establishmentsRepo.findById(apt.establishmentId)

            const servicesRepo = getRepository('services.json')
            const allServices = await servicesRepo.findAll()
            const serviceNames = allServices
                .filter(s => (apt.services || []).includes(s.id))
                .map(s => s.name)
                .join(', ')

            const emailSent = await sendReturnReminder(
                recipientEmail,
                recipientName,
                establishment?.name || 'o estabelecimento',
                serviceNames || 'seu serviço'
            )

            // Marca como enviado mesmo sem email, para não tentar de novo a cada ciclo
            await appointmentsRepo.update(apt.id, { returnReminderSent: true })

            if (emailSent) remindersSent++
        }

        if (remindersSent > 0) {
            console.log(`[NotificationScheduler] ✅ ${remindersSent} lembretes de retorno enviados`)
        } else {
            console.log(`[NotificationScheduler] 💤 Nenhum lembrete de retorno pendente no momento`)
        }
    } catch (error) {
        console.error('[NotificationScheduler] ❌ Erro ao processar lembretes de retorno:', error.message)
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
    processReturnReminders()

    // Agendar para rodar a cada 30 minutos
    // Formato: minuto hora dia-do-mês mês dia-da-semana
    cron.schedule('*/30 * * * *', () => {
        processNotifications()
        processReturnReminders()
    })

    console.log('[NotificationScheduler] ✅ Scheduler configurado para executar a cada 30 minutos')
}

/**
 * Processa notificações manualmente (para testes)
 */
export const runNotificationsNow = async () => {
    console.log('[NotificationScheduler] 🔄 Executando verificação manual...')
    await processNotifications()
    await processReturnReminders()
}

export default {
    startNotificationScheduler,
    runNotificationsNow
}
