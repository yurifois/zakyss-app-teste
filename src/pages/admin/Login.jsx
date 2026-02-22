import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'


export default function AdminLogin() {
    const navigate = useNavigate()
    const { adminLogin, adminLogout } = useAuth()
    const { success, error } = useToast()

    // Limpar sessão anterior ao acessar página de login
    useEffect(() => {
        adminLogout()
    }, [])

    const [formData, setFormData] = useState({
        email: '',
        password: '',
    })
    const [loading, setLoading] = useState(false)

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)

        try {
            await adminLogin(formData.email, formData.password)
            success('Login realizado com sucesso!')
            navigate('/admin')
        } catch (err) {
            error('Credenciais inválidas ou usuário não encontrado')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--gradient-dark)' }}>
            <div style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                <div className="text-center mb-8">
                    <Link to="/" className="logo" style={{ justifyContent: 'center', marginBottom: '1.5rem', color: 'white' }}>
                        <img
                            src="/logo.png"
                            alt="Zakys"
                            style={{
                                height: '3rem',
                                width: 'auto',
                                filter: 'brightness(0) saturate(100%) invert(45%) sepia(85%) saturate(1500%) hue-rotate(310deg) brightness(95%) contrast(95%)'
                            }}
                        />
                    </Link>
                    <h1 className="text-2xl font-bold mb-2" style={{ color: 'white' }}>Portal do Parceiro</h1>
                    <p style={{ color: 'rgba(255,255,255,0.7)' }}>Acesse sua área administrativa</p>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
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
                                className="p-3 rounded-lg text-center hover-lift w-full"
                                style={{
                                    background: 'var(--primary-50)',
                                    textDecoration: 'none',
                                    border: '1px solid var(--primary-200)',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🏪</div>
                                <div className="font-semibold text-sm" style={{ color: 'var(--primary-700)' }}>Criar conta de Estabelecimento</div>
                            </Link>
                        </div>
                    </div>
                </div>

                <p className="text-center text-sm mt-6" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    Teste: admin@studiobeleza.com / 123456
                </p>
            </div>
        </div>
    )
}

