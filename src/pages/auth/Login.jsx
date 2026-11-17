import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import { isStoragePersistent, STORAGE_BLOCKED_HINT } from '../../services/safeStorage'
import { loginErrorMessage } from '../../services/authErrors'
import { getLastEmail, resendVerification, getSessionEndedNotice } from '../../services/api'

export default function Login() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const { success, error } = useToast()

    // "Manter-me conectado" já vem marcado: desmarcado, a sessão some quando o
    // celular fecha a aba — e o navegador/teclado do celular muitas vezes envia
    // o formulário assim que a senha é preenchida, antes de dar tempo de marcar.
    const lastEmail = getLastEmail('customer')
    // Sessão encerrada pelo servidor (manutenção): explica e já traz o e-mail.
    const [sessionNotice] = useState(() => getSessionEndedNotice('customer'))
    const [formData, setFormData] = useState({
        email: lastEmail,
        password: '',
        remember: true,
    })
    const passwordRef = useRef(null)
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))
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
            await login(formData.email, formData.password, formData.remember)
            success('Login realizado com sucesso!')

            const redirectUrl = sessionStorage.getItem('redirect_after_login')
            if (redirectUrl) {
                sessionStorage.removeItem('redirect_after_login')
                navigate(redirectUrl)
            } else {
                navigate('/')
            }
        } catch (err) {
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
        <div className="py-16" style={{ position: 'relative', overflow: 'hidden' }}>
            {/* Decorative glow */}
            <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(236, 72, 153, 0.05)', filter: 'blur(100px)', pointerEvents: 'none' }} />

            <div className="container" style={{ maxWidth: '450px', position: 'relative', zIndex: 1 }}>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Bem-vindo de volta!</h1>
                    <p className="text-secondary">Entre na sua conta para continuar</p>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
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
                                placeholder="seu@email.com"
                                value={formData.email}
                                onChange={handleChange}
                                autoComplete="username"
                                enterKeyHint="next"
                                onKeyDown={(e) => {
                                    // Enter no e-mail vai para a senha em vez de tentar entrar
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
                            <span 
                                onClick={() => navigate('/recuperar-senha')} 
                                className="text-sm" 
                                style={{ color: 'var(--accent-400)', cursor: 'pointer', position: 'relative', zIndex: 10 }}
                            >
                                Esqueceu a senha?
                            </span>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full btn-lg"
                            disabled={loading}
                        >
                            {loading ? 'Entrando...' : 'Entrar'}
                        </button>
                    </form>

                    <div className="text-center mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                        <p className="text-secondary text-sm">
                            Não tem uma conta?{' '}
                            <Link to="/cadastro" className="font-semibold" style={{ color: 'var(--accent-400)' }}>Cadastre-se</Link>
                        </p>
                        <p className="text-muted text-xs mt-2">
                            Já agendou aqui mas nunca criou senha? Agendar não cria conta.
                            Use o mesmo email no cadastro e seu histórico aparece junto.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
