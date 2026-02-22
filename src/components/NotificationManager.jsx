import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import {
    registerServiceWorker,
    requestNotificationPermission,
    areNotificationsEnabled,
    startNotificationChecker,
    stopNotificationChecker
} from '../services/notificationService'
import * as api from '../services/api'

/**
 * Componente que gerencia as notificações de agendamento
 * Deve ser incluído no nível mais alto da aplicação, após AuthProvider
 */
export default function NotificationManager() {
    const { user, isAuthenticated } = useAuth()
    const [notificationsEnabled, setNotificationsEnabled] = useState(false)
    const checkerIntervalRef = useRef(null)

    // Registrar Service Worker na inicialização
    useEffect(() => {
        registerServiceWorker()
    }, [])

    // Solicitar permissão e iniciar verificação quando usuário está logado
    useEffect(() => {
        if (isAuthenticated && user) {
            const setupNotifications = async () => {
                const hasPermission = await requestNotificationPermission()
                setNotificationsEnabled(hasPermission)

                if (hasPermission) {
                    // Função para buscar agendamentos do usuário
                    const fetchUserAppointments = async () => {
                        try {
                            const result = await api.getUserAppointments(user.id)
                            return result || []
                        } catch (error) {
                            console.error('[NotificationManager] Erro ao buscar agendamentos:', error)
                            return []
                        }
                    }

                    // Iniciar verificação periódica
                    checkerIntervalRef.current = startNotificationChecker(fetchUserAppointments)
                }
            }

            setupNotifications()
        }

        // Cleanup quando usuário desloga
        return () => {
            if (checkerIntervalRef.current) {
                stopNotificationChecker(checkerIntervalRef.current)
                checkerIntervalRef.current = null
            }
        }
    }, [isAuthenticated, user])

    // Este componente não renderiza nada visível
    return null
}
