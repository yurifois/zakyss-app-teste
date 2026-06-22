import { useState } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

export default function ForgotPassword() {
    const { success, error } = useToast()
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await forgotPassword(email)
            success(res?.message || 'Se o e-mail existir, um link de recuperação foi enviado.')
            setSubmitted(true)
        } catch (err) {
            error(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="py-16" style={{ position: 'relative', overflow: 'hidden', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(236, 72, 153, 0.05)', filter: 'blur(100px)', pointerEvents: 'none' }} />

            <div className="container" style={{ maxWidth: '450px', position: 'relative', zIndex: 1, margin: '0 auto' }}>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Recuperar Senha</h1>
                    <p className="text-secondary">Enviaremos um link para redefinir sua senha</p>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    {submitted ? (
                        <div className="text-center">
                            <div style={{ width: '64px', height: '64px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem' }}>
                                <i className="fi fi-rr-envelope"></i>
                            </div>
                            <h2 className="text-xl font-bold mb-4">Verifique seu e-mail</h2>
                            <p className="text-secondary mb-6">
                                Enviamos as instruções de recuperação para <strong>{email}</strong>
                            </p>
                            <Link to="/entrar" className="btn btn-primary w-full">Voltar para o Login</Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">E-mail</label>
                                <input
                                    type="email"
                                    className="form-input"
                                    placeholder="seu@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary w-full btn-lg mt-4"
                                disabled={loading}
                            >
                                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                            </button>
                            
                            <div className="text-center mt-6">
                                <Link to="/entrar" className="text-sm font-semibold" style={{ color: 'var(--accent-400)' }}>
                                    <i className="fi fi-rr-arrow-small-left mr-2" style={{ verticalAlign: 'middle' }}></i>
                                    Voltar para o Login
                                </Link>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
