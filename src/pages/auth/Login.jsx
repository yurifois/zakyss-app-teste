import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function Login() {
    const navigate = useNavigate()
    const { login } = useAuth()
    const { success, error } = useToast()

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        remember: false,
    })
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value,
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

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
            error(err.message)
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
                                <span className="text-sm">Lembrar-me</span>
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
                    </div>
                </div>

                <p className="text-center text-muted text-sm mt-6">
                    Teste: maria@email.com / 123456
                </p>
            </div>
        </div>
    )
}
