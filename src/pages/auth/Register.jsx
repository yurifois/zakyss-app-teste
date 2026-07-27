import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'

export default function Register() {
    const navigate = useNavigate()
    const { register } = useAuth()
    const { success, error } = useToast()

    const [accountType, setAccountType] = useState('client') // 'client' | 'establishment'
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
            <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.04)', filter: 'blur(100px)', pointerEvents: 'none' }} />

            <div className="container" style={{ maxWidth: '500px', position: 'relative', zIndex: 1 }}>
                <div className="text-center mb-6">
                    <h1 className="text-3xl font-bold mb-2">Criar Conta</h1>
                    <p className="text-secondary">Escolha o tipo de conta que deseja criar</p>
                </div>

                {/* Account Type Selector Tabs */}
                <div className="flex rounded-xl p-1 mb-6 gap-1" style={{ backgroundColor: 'var(--bg-tertiary, #f3f4f6)', border: '1px solid var(--border-color, #e5e7eb)' }}>
                    <button
                        type="button"
                        className="flex-1 py-3 px-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: accountType === 'client' ? 'var(--white, #ffffff)' : 'transparent',
                            color: accountType === 'client' ? 'var(--primary-600, #db2777)' : 'var(--gray-600, #4b5563)',
                            boxShadow: accountType === 'client' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none'
                        }}
                        onClick={() => setAccountType('client')}
                    >
                        <span>👤</span> Sou Cliente
                    </button>
                    <button
                        type="button"
                        className="flex-1 py-3 px-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2"
                        style={{
                            backgroundColor: accountType === 'establishment' ? 'var(--white, #ffffff)' : 'transparent',
                            color: accountType === 'establishment' ? 'var(--primary-600, #db2777)' : 'var(--gray-600, #4b5563)',
                            boxShadow: accountType === 'establishment' ? '0 2px 4px rgba(0,0,0,0.08)' : 'none'
                        }}
                        onClick={() => setAccountType('establishment')}
                    >
                        <span>🏪</span> Estabelecimento / Profissional
                    </button>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    {accountType === 'client' ? (
                        <form onSubmit={handleSubmit}>
                            <div className="mb-4 pb-3 text-center border-b border-base-200">
                                <h2 className="text-lg font-bold text-primary">Cadastro de Cliente</h2>
                                <p className="text-xs text-muted">Para agendar seus horários e serviços de beleza</p>
                            </div>

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
                                        Li e aceito os <a href="#" style={{ color: 'var(--accent-400)' }}>termos de uso</a> e{' '}
                                        <a href="#" style={{ color: 'var(--accent-400)' }}>política de privacidade</a>
                                    </span>
                                </label>
                            </div>

                            <button
                                type="submit"
                                className="btn btn-primary w-full btn-lg"
                                disabled={loading}
                            >
                                {loading ? 'Criando conta...' : 'Criar Conta de Cliente'}
                            </button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <div className="mb-4 pb-3 text-center border-b border-base-200">
                                <h2 className="text-lg font-bold text-primary">Cadastro de Estabelecimento / Profissional</h2>
                                <p className="text-xs text-muted">Ofereça seus serviços e receba agendamentos online</p>
                            </div>

                            <div className="p-4 rounded-xl border border-pink-200" style={{ backgroundColor: '#fdf2f8' }}>
                                <h3 className="font-bold text-sm mb-1 text-pink-700 flex items-center gap-2">
                                    🏢 Pessoa Jurídica (CNPJ)
                                </h3>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    Para salões de beleza, barbearias, clínicas de estética, spas ou estúdios com CNPJ e equipe de profissionais.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl border border-rose-200" style={{ backgroundColor: '#fff1f2' }}>
                                <h3 className="font-bold text-sm mb-1 text-rose-700 flex items-center gap-2">
                                    💼 Pessoa Física / Autônomo (CPF)
                                </h3>
                                <p className="text-xs text-gray-600 leading-relaxed">
                                    Para profissionais independentes, manicures, maquiadoras, esteticistas ou atendimento a domicílio com CPF.
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => navigate('/parceiro/cadastro')}
                                className="btn btn-primary w-full btn-lg mt-4 flex items-center justify-center gap-2 shadow-lg"
                            >
                                Iniciar Cadastro de Parceiro (CNPJ / CPF) →
                            </button>
                        </div>
                    )}

                    <div className="text-center mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                        <p className="text-secondary text-sm">
                            Já tem uma conta?{' '}
                            <Link to="/entrar" className="font-semibold" style={{ color: 'var(--accent-400)' }}>Entrar</Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
