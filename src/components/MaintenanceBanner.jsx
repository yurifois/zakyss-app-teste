import { useState } from 'react'
import { X } from 'lucide-react'

// Aviso temporário da manutenção de segurança de 17/11/2026 (troca do segredo
// dos logins, que desconectou todo mundo uma vez). Some sozinho no fim do
// prazo, sem precisar de deploy: cada aparelho compara com o próprio relógio.
// Depois de 24/11 pode apagar este arquivo e a linha que o usa em Home.jsx.
const FIM_DO_AVISO = new Date('2026-11-25T00:00:00-03:00') // até 24/11 às 23h59 (Brasília)
const CHAVE_FECHADO = 'zakys_aviso_manutencao_2026_11_fechado'

function jaFechou() {
    try {
        return localStorage.getItem(CHAVE_FECHADO) === '1'
    } catch {
        return false
    }
}

export default function MaintenanceBanner() {
    const [fechado, setFechado] = useState(jaFechou)

    if (fechado || Date.now() >= FIM_DO_AVISO.getTime()) return null

    const fechar = () => {
        try {
            localStorage.setItem(CHAVE_FECHADO, '1')
        } catch {
            // Sem armazenamento, fecha só nesta visita.
        }
        setFechado(true)
    }

    return (
        <div
            role="status"
            className="text-sm mb-6"
            style={{
                position: 'relative',
                textAlign: 'left',
                padding: '0.875rem 2.5rem 0.875rem 1rem',
                borderRadius: '0.75rem',
                border: '1px solid var(--warning-500, #f59e0b)',
                background: 'rgba(245, 158, 11, 0.12)',
                color: 'white',
            }}
        >
            <strong>🔧 Manutenção de segurança até 24/11.</strong>{' '}
            Estamos atualizando o Zakys para deixar sua conta mais protegida. Na primeira vez que você entrar,
            pode ser preciso <strong>fazer login de novo</strong> — seus dados e agendamentos continuam aqui.
            <button
                type="button"
                onClick={fechar}
                aria-label="Fechar aviso de manutenção"
                style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    background: 'transparent',
                    border: 'none',
                    color: 'inherit',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    lineHeight: 0,
                }}
            >
                <X size={18} />
            </button>
        </div>
    )
}
