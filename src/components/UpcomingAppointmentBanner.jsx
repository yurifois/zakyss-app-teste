import { useEffect, useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import * as api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export default function UpcomingAppointmentBanner() {
    const { user } = useAuth()
    const [upcomingAppointment, setUpcomingAppointment] = useState(null)
    const [establishmentName, setEstablishmentName] = useState('')

    useEffect(() => {
        if (!user || user.type !== 'customer') return

        const fetchUpcoming = async () => {
            try {
                const appointments = await api.getUserAppointments(user.id)
                const confirmed = appointments.filter(a => a.status === 'confirmed')
                
                // Obter a data de hoje no formato YYYY-MM-DD local
                const today = new Date()
                const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

                // Filtrar os de hoje e ordenar por horário (mais cedo primeiro)
                const todayAppointments = confirmed
                    .filter(a => a.date === todayStr)
                    .sort((a, b) => a.time.localeCompare(b.time))

                if (todayAppointments.length > 0) {
                    const nextAppointment = todayAppointments[0]

                    // Verificar se o usuário já dispensou este aviso (usando sessionStorage para voltar a aparecer se ele fechar e abrir o app de novo)
                    const dismissed = sessionStorage.getItem(`zakys_dismissed_upcoming_${nextAppointment.id}`)
                    
                    if (!dismissed) {
                        setUpcomingAppointment(nextAppointment)
                        
                        try {
                            const est = await api.getEstablishmentById(nextAppointment.establishmentId)
                            setEstablishmentName(est.name)
                        } catch (e) {
                            setEstablishmentName('um estabelecimento')
                        }
                    }
                }
            } catch (error) {
                console.error('Erro ao buscar agendamentos do dia:', error)
            }
        }

        fetchUpcoming()
    }, [user])

    if (!upcomingAppointment) return null

    const handleDismiss = () => {
        sessionStorage.setItem(`zakys_dismissed_upcoming_${upcomingAppointment.id}`, 'true')
        setUpcomingAppointment(null)
    }

    return (
        <div className="bg-info text-info-content px-4 py-3 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-0 z-40 border-b border-info-content/10">
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="bg-white/20 p-2 rounded-full shrink-0 animate-pulse">
                    <CalendarIcon size={20} />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-sm sm:text-base">Lembrete: Você tem um serviço hoje!</p>
                    <p className="text-xs sm:text-sm opacity-90">
                        Agendado para às <strong>{upcomingAppointment.time}</strong> em <strong>{establishmentName}</strong>.
                    </p>
                </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                <button 
                    onClick={handleDismiss}
                    className="btn btn-sm btn-ghost btn-square hover:bg-white/20 text-info-content"
                    title="Fechar aviso"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    )
}
