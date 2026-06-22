import { useState, useEffect } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

export default function ResetPassword() {
    const [searchParams] = useSearchParams()
    const token = searchParams.get('token')
    const navigate = useNavigate()
    const { success, error } = useToast()

    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (!token) {
            error('Token de recuperação inválido ou ausente.')
            navigate('/entrar')
        }
    }, [token, navigate, error])

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (formData.password !== formData.confirmPassword) {
            return error('As senhas não coincidem.')
        }

        if (formData.password.length < 6) {
            return error('A senha deve ter pelo menos 6 caracteres.')
        }

        setLoading(true)

        try {
            const res = await resetPassword(token, formData.password)
            success(res?.message || 'Senha redefinida com sucesso!')
            navigate('/entrar')
        } catch (err) {
            error(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!token) return null

    return (
        <div className="py-16" style={{ position: 'relative', overflow: 'hidden', minHeight: '80vh', display: 'flex', alignItems: 'center' }}>
            <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(236, 72, 153, 0.05)', filter: 'blur(100px)', pointerEvents: 'none' }} />

            <div className="container" style={{ maxWidth: '450px', position: 'relative', zIndex: 1, margin: '0 auto' }}>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Redefinir Senha</h1>
                    <p className="text-secondary">Crie uma nova senha para sua conta</p>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Nova Senha</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                                required
                            />
                        </div>

                        <div className="form-group mt-4">
                            <label className="form-label">Confirmar Nova Senha</label>
                            <input
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full btn-lg mt-6"
                            disabled={loading}
                        >
                            {loading ? 'Salvando...' : 'Salvar Nova Senha'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
