import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { isStoragePersistent, STORAGE_BLOCKED_HINT } from '../../services/safeStorage'
import { loginErrorMessage } from '../../services/authErrors'
import { getLastEmail, resendVerification, getSessionEndedNotice } from '../../services/api'

export default function AdminLogin() {
    const navigate = useNavigate()
    const { adminLogin, adminLogout } = useAuth()
    const { success, error } = useToast()

    useEffect(() => {
        adminLogout()
    }, [])

    const lastEmail = getLastEmail('admin')
    // Sessão encerrada pelo servidor (manutenção): explica e já traz o e-mail.
    const [sessionNotice] = useState(() => getSessionEndedNotice('admin'))
    const [formData, setFormData] = useState({
        email: lastEmail,
        password: '',
        remember: true,
    })
    const passwordRef = useRef(null)
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    // Conta nova que ainda não confirmou o e-mail: em vez de só um erro,
    // mostra o aviso com o botão de reenviar o link.
    const [pendingEmail, setPendingEmail] = useState('')
    const [resending, setResending] = useState(false)
    const handleResend = async () => {
        setResending(true)
        try {
            await resendVerification(pendingEmail)
            success('Se houver uma conta aguardando confirmação, enviamos um novo link.')
        } catch (err) {
            error(err.message || 'Não foi possível reenviar agora.')
        } finally {
            setResending(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setPendingEmail('')

        try {
            await adminLogin(formData.email, formData.password, formData.remember)
            success('Login realizado com sucesso!')
            navigate('/admin')
        } catch (err) {
            // Antes esta tela anunciava "credenciais inválidas" para QUALQUER
            // falha: servidor fora do ar, rede caindo, armazenamento bloqueado.
            // Isso escondia o problema real e mandava o dono trocar uma senha
            // que estava certa. Agora cada causa aparece com o próprio nome.
            if (err.code === 'EMAIL_NOT_VERIFIED') {
                setPendingEmail(formData.email.trim())
            } else {
                error(loginErrorMessage(err))
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-hero)' }}>
            <div style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                <div className="text-center mb-8">
                    <Link to="/" className="logo" style={{ justifyContent: 'center', marginBottom: '1.5rem', color: 'white' }}>
                        <img src="/logo.png" alt="Zakys" style={{ height: '3rem', width: 'auto' }} />
                    </Link>
                    <h1 className="text-2xl font-bold mb-2" style={{ color: 'white' }}>Portal do Parceiro</h1>
                    <p style={{ color: 'rgba(255,255,255,0.6)' }}>Acesse sua área administrativa</p>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    {/* Avisa ANTES da tentativa, pra pessoa não achar que
                        errou a senha quando o problema é o navegador. */}
                    {!isStoragePersistent() && (
                        <div
                            className="mb-4 text-sm"
                            style={{
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--warning-500, #f59e0b)',
                                background: 'rgba(245, 158, 11, 0.08)'
                            }}
                        >
                            ⚠️ {STORAGE_BLOCKED_HINT}
                        </div>
                    )}

                    {sessionNotice && (
                        <div
                            className="mb-4 text-sm"
                            role="status"
                            style={{
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--warning-500, #f59e0b)',
                                background: 'rgba(245, 158, 11, 0.08)'
                            }}
                        >
                            🔒 Fizemos uma <strong>manutenção de segurança</strong> e, por isso, sua conta foi desconectada.
                            Seus dados e agendamentos continuam aqui — é só entrar de novo com seu e-mail e senha.
                            Se não lembrar a senha, toque em <strong>Esqueceu a senha?</strong>
                        </div>
                    )}

                    {pendingEmail && (
                        <div
                            className="mb-4 text-sm"
                            role="status"
                            style={{
                                padding: '0.75rem',
                                borderRadius: '0.5rem',
                                border: '1px solid var(--accent-400)',
                                background: 'rgba(236, 72, 153, 0.08)'
                            }}
                        >
                            <p className="mb-2">
                                📬 Falta confirmar o e-mail <strong>{pendingEmail}</strong>. Abra a mensagem que enviamos e toque em <strong>Confirmar meu e-mail</strong>.
                            </p>
                            <button type="button" className="btn btn-outline btn-sm" onClick={handleResend} disabled={resending}>
                                {resending ? 'Reenviando…' : 'Reenviar o link'}
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">E-mail</label>
                            <input
                                type="email"
                                name="email"
                                className="form-input"
                                placeholder="admin@estabelecimento.com"
                                value={formData.email}
                                onChange={handleChange}
                                autoComplete="username"
                                enterKeyHint="next"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        passwordRef.current?.focus()
                                    }
                                }}
                                autoFocus={!lastEmail}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Senha</label>
                            <input
                                type="password"
                                name="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={handleChange}
                                ref={passwordRef}
                                autoComplete="current-password"
                                enterKeyHint="go"
                                autoFocus={!!lastEmail}
                                required
                            />
                        </div>

                        <div className="flex justify-between items-center mb-6">
                            <label className="form-checkbox">
                                <input
                                    type="checkbox"
                                    name="remember"
                                    checked={formData.remember}
                                    onChange={handleChange}
                                />
                                <span className="text-sm">Manter-me conectado</span>
                            </label>
                            <Link to="/recuperar-senha" className="text-sm" style={{ color: 'var(--accent-400)' }}>
                                Esqueceu a senha?
                            </Link>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full btn-lg"
                            disabled={loading}
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>

                    <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                        <p className="text-center text-secondary text-sm mb-4">Não tem uma conta? Cadastre-se:</p>

                        <div className="flex justify-center">
                            <Link
                                to="/parceiro/cadastro"
                                className="p-3 text-center hover-lift w-full"
                                style={{
                                    background: 'rgba(236, 72, 153, 0.08)',
                                    textDecoration: 'none',
                                    border: '1px solid rgba(236, 72, 153, 0.2)',
                                    borderRadius: 'var(--radius-lg)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🏪</div>
                                <div className="font-semibold text-sm" style={{ color: 'var(--accent-300)' }}>Criar conta de Estabelecimento</div>
                            </Link>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    )
}
