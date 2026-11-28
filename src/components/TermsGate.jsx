import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import * as api from '../services/api'

// Novo aceite dos Termos/Política quando mudam de versão (os próprios termos
// prometem isso e a LGPD pede que a pessoa seja informada). Aparece uma vez
// para quem está logado com uma versão antiga; "Li e aceito" grava o aceite.
export default function TermsGate() {
    const { user, admin, logout, adminLogout } = useAuth()
    const [pendente, setPendente] = useState(false)
    const [salvando, setSalvando] = useState(false)
    const logado = !!(user || admin)

    useEffect(() => {
        if (!logado) { setPendente(false); return }
        let ativo = true
        api.getTermsStatus()
            .then(r => { if (ativo) setPendente(!r.upToDate) })
            .catch(() => {}) // sem conexão / servidor acordando: tenta no próximo acesso
        return () => { ativo = false }
    }, [user?.id, admin?.id])

    if (!pendente) return null

    const aceitar = async () => {
        setSalvando(true)
        try {
            await api.acceptTerms()
            setPendente(false)
        } catch {
            // continua aberto; a pessoa pode tentar de novo
        } finally {
            setSalvando(false)
        }
    }
    const sair = () => {
        if (admin) adminLogout()
        if (user) logout()
        setPendente(false)
    }

    return (
        <div className="modal-backdrop">
            <div className="modal" role="dialog" aria-modal="true" aria-labelledby="termos-titulo" style={{ maxWidth: '440px' }}>
                <div className="modal-body">
                    <h3 id="termos-titulo" className="text-lg font-bold mb-2">Atualizamos nossos Termos e a Política de Privacidade</h3>
                    <p className="text-secondary mb-3">
                        Explicamos melhor quais dados usamos, com quem compartilhamos e como você pode excluir sua conta.
                        Para continuar usando o Zakys, leia e aceite a nova versão.
                    </p>
                    <a href="/termos" target="_blank" rel="noopener noreferrer" className="text-primary font-semibold">
                        Ler os Termos e a Política ↗
                    </a>
                </div>
                <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
                    <button type="button" className="btn btn-outline" onClick={sair}>Sair da conta</button>
                    <button type="button" className="btn btn-primary" onClick={aceitar} disabled={salvando}>
                        {salvando ? 'Salvando...' : 'Li e aceito'}
                    </button>
                </div>
            </div>
        </div>
    )
}
