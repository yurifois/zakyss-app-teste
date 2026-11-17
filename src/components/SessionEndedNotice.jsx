import { useEffect, useRef } from 'react'
import { useToast } from '../contexts/ToastContext'
import { SESSION_ENDED_EVENT } from '../services/api'

// Aviso na hora em que o servidor encerra a sessão guardada (ex.: depois de
// uma manutenção de segurança). O recado completo, com o e-mail preenchido,
// fica na tela de entrar.
export default function SessionEndedNotice() {
    const { addToast } = useToast()
    // Quem tinha login de cliente E de parceiro no mesmo aparelho perde os dois
    // de uma vez: um aviso basta.
    const ultimoAviso = useRef(0)

    useEffect(() => {
        const onEnded = () => {
            if (Date.now() - ultimoAviso.current < 5000) return
            ultimoAviso.current = Date.now()
            addToast(
                'Fizemos uma manutenção de segurança e sua conta foi desconectada. É só entrar de novo.',
                'warning',
                9000
            )
        }
        window.addEventListener(SESSION_ENDED_EVENT, onEnded)
        return () => window.removeEventListener(SESSION_ENDED_EVENT, onEnded)
    }, [addToast])

    return null
}
