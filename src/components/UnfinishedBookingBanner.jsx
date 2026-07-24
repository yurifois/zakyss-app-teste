import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarIcon, ChevronRight, X } from 'lucide-react'
import * as api from '../services/api'

export default function UnfinishedBookingBanner() {
    const [unfinished, setUnfinished] = useState(null)
    const [establishmentName, setEstablishmentName] = useState('')
    const location = useLocation()
    const navigate = useNavigate()

    useEffect(() => {
        const checkUnfinished = async () => {
            const unfinishedStr = localStorage.getItem('zakys_unfinished_booking')
            if (unfinishedStr) {
                try {
                    const parsed = JSON.parse(unfinishedStr)
                    
                    // Não mostra se já estiver na tela de agendamento do mesmo estabelecimento
                    if (location.pathname === `/agendar/${parsed.establishmentId}`) {
                        setUnfinished(null)
                        return
                    }

                    setUnfinished(parsed)
                    
                    // Buscar nome do estabelecimento para mostrar na barra
                    try {
                        const est = await api.getEstablishmentById(parsed.establishmentId)
                        setEstablishmentName(est.name)
                    } catch (e) {
                        setEstablishmentName('um estabelecimento')
                    }
                } catch (e) {
                    console.error('Error parsing unfinished booking', e)
                }
            } else {
                setUnfinished(null)
            }
        }

        checkUnfinished()
    }, [location.pathname])

    if (!unfinished) return null

    const handleContinue = () => {
        navigate(`/agendar/${unfinished.establishmentId}`)
    }

    const handleDismiss = () => {
        localStorage.removeItem('zakys_unfinished_booking')
        setUnfinished(null)
    }

    return (
        <div className="bg-primary text-primary-content px-4 py-3 shadow-md flex flex-col sm:flex-row items-center justify-between gap-3 sticky top-0 z-50">
            <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="bg-white/20 p-2 rounded-full shrink-0">
                    <CalendarIcon size={20} />
                </div>
                <div className="flex-1">
                    <p className="font-bold text-sm sm:text-base">Você tem um agendamento não finalizado!</p>
                    <p className="text-xs sm:text-sm opacity-90">Termine seu agendamento em <strong>{establishmentName}</strong>.</p>
                </div>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button 
                    onClick={handleContinue}
                    className="btn btn-sm bg-white text-primary hover:bg-base-200 border-none flex-1 sm:flex-none shadow-sm"
                >
                    Continuar <ChevronRight size={16} />
                </button>
                <button 
                    onClick={handleDismiss}
                    className="btn btn-sm btn-ghost btn-square text-white hover:bg-white/20"
                    title="Descartar"
                >
                    <X size={18} />
                </button>
            </div>
        </div>
    )
}
