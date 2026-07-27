import { createContext, useContext, useEffect } from 'react'
import { useAuth } from './AuthContext'
import { useToast } from './ToastContext'
import * as api from '../services/api'
import { showLocalNotification, areNotificationsEnabled } from '../services/notificationService'

const NotificationContext = createContext({})

export function useNotification() {
    return useContext(NotificationContext)
}

export function NotificationProvider({ children }) {
    const { user } = useAuth()
    const { info } = useToast()

    useEffect(() => {
        if (!user || user.type !== 'customer') return

        const checkAppointments = async () => {
            try {
                const appointments = await api.getUserAppointments(user.id)
                const confirmedAppointments = appointments.filter(apt => apt.status === 'confirmed')
                
                const notifiedIds = JSON.parse(localStorage.getItem('zakys_notified_appointments') || '[]')
                
                let hasNewNotification = false
                
                confirmedAppointments.forEach(apt => {
                    if (!notifiedIds.includes(apt.id)) {
                        const dateStr = new Date(apt.date).toLocaleDateString('pt-BR')
                        const message = `Seu agendamento para o dia ${dateStr} às ${apt.time} foi confirmado!`
                        
                        // 1. Toast in-app
                        info(message, { duration: 8000 })
                        
                        // 2. Notificação nativa (push notification)
                        if (areNotificationsEnabled()) {
                            showLocalNotification(
                                'Agendamento Confirmado',
                                message,
                                { tag: `confirmed-${apt.id}`, requireInteraction: true }
                            )
                        }
                        notifiedIds.push(apt.id)
                        hasNewNotification = true
                    }
                })
                
                if (hasNewNotification) {
                    localStorage.setItem('zakys_notified_appointments', JSON.stringify(notifiedIds))
                }
                
            } catch (error) {
                console.error('Erro ao buscar notificações de agendamento:', error)
            }
        }

        // Checar imediatamente e depois a cada 30 segundos
        checkAppointments()
        const intervalId = setInterval(checkAppointments, 30000)

        return () => clearInterval(intervalId)
    }, [user, info])

    return (
        <NotificationContext.Provider value={{}}>
            {children}
        </NotificationContext.Provider>
    )
}
