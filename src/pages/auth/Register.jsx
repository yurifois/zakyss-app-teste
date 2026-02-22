import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function Register() {
    const navigate = useNavigate()
    const { register } = useAuth()
    const { success, error } = useToast()

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        terms: false,
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

        if (formData.password !== formData.confirmPassword) {
            error('As senhas não coincidem')
            return
        }

        if (!formData.terms) {
            error('Você deve aceitar os termos de uso')
            return
        }

        setLoading(true)

        try {
            await register({
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                password: formData.password,
            })
            success('Conta criada com sucesso!')
            navigate('/')
        } catch (err) {
            error(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="py-16">
            <div className="container" style={{ maxWidth: '450px' }}>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Criar conta</h1>
                    <p className="text-secondary">Cadastre-se para agendar seus serviços</p>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="form-label">Nome completo</label>
                            <input
                                type="text"
                                name="name"
                                className="form-input"
                                placeholder="Seu nome"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>

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
                            <label className="form-label">Telefone</label>
                            <input
                                type="tel"
                                name="phone"
                                className="form-input"
                                placeholder="(61) 99999-9999"
                                value={formData.phone}
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
                                placeholder="Mínimo 6 caracteres"
                                value={formData.password}
                                onChange={handleChange}
                                minLength={6}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirmar senha</label>
                            <input
                                type="password"
                                name="confirmPassword"
                                className="form-input"
                                placeholder="Repita sua senha"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-checkbox">
                                <input
                                    type="checkbox"
                                    name="terms"
                                    checked={formData.terms}
                                    onChange={handleChange}
                                />
                                <span className="text-sm">
                                    Li e aceito os <a href="#" className="text-primary-500">termos de uso</a> e{' '}
                                    <a href="#" className="text-primary-500">política de privacidade</a>
                                </span>
                            </label>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary w-full btn-lg"
                            disabled={loading}
                        >
                            {loading ? 'Criando conta...' : 'Criar conta'}
                        </button>
                    </form>

                    <div className="text-center mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                        <p className="text-secondary text-sm">
                            Já tem uma conta?{' '}
                            <Link to="/entrar" className="font-semibold">Entrar</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
