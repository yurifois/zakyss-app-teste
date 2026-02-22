import { Link } from 'react-router-dom'

export default function PartnerTypeSelect() {
    return (
        <div className="py-16">
            <div className="container" style={{ maxWidth: '800px' }}>
                <div className="text-center mb-12">
                    <h1 className="text-3xl font-bold mb-3">Como você quer se cadastrar?</h1>
                    <p className="text-secondary">
                        Escolha a opção que melhor descreve sua atuação
                    </p>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                    {/* Establishment Option */}
                    <Link
                        to="/parceiro/cadastro"
                        className="card p-6 text-center hover-lift"
                        style={{
                            textDecoration: 'none',
                            color: 'inherit',
                            border: '2px solid transparent',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary-500)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    >
                        <div style={{
                            fontSize: '4rem',
                            marginBottom: '1rem',
                            filter: 'grayscale(0)'
                        }}>
                            🏪
                        </div>
                        <h2 className="text-xl font-bold mb-2">Estabelecimento</h2>
                        <p className="text-sm text-muted mb-4">
                            Salão, barbearia, clínica ou spa com CNPJ e local fixo
                        </p>
                        <ul className="text-left text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                            <li className="flex items-center gap-2">
                                <span style={{ color: 'var(--primary-500)' }}>✓</span>
                                Cadastro com CNPJ
                            </li>
                            <li className="flex items-center gap-2">
                                <span style={{ color: 'var(--primary-500)' }}>✓</span>
                                Gestão de funcionários
                            </li>
                            <li className="flex items-center gap-2">
                                <span style={{ color: 'var(--primary-500)' }}>✓</span>
                                Múltiplos serviços e profissionais
                            </li>
                            <li className="flex items-center gap-2">
                                <span style={{ color: 'var(--primary-500)' }}>✓</span>
                                Dashboard completa com relatórios
                            </li>
                        </ul>
                        <div className="mt-6">
                            <span className="btn btn-primary btn-sm">Cadastrar Estabelecimento →</span>
                        </div>
                    </Link>

                    {/* Professional Option */}
                    <Link
                        to="/profissional/cadastro"
                        className="card p-6 text-center hover-lift"
                        style={{
                            textDecoration: 'none',
                            color: 'inherit',
                            border: '2px solid transparent',
                            transition: 'all 0.3s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--accent-500)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'transparent'}
                    >
                        <div style={{
                            fontSize: '4rem',
                            marginBottom: '1rem',
                            filter: 'grayscale(0)'
                        }}>
                            💼
                        </div>
                        <h2 className="text-xl font-bold mb-2">Profissional Autônomo</h2>
                        <p className="text-sm text-muted mb-4">
                            Trabalha por conta própria, com ou sem local fixo
                        </p>
                        <ul className="text-left text-sm space-y-2" style={{ color: 'var(--text-secondary)' }}>
                            <li className="flex items-center gap-2">
                                <span style={{ color: 'var(--accent-500)' }}>✓</span>
                                Cadastro com CPF e RG
                            </li>
                            <li className="flex items-center gap-2">
                                <span style={{ color: 'var(--accent-500)' }}>✓</span>
                                Atendimento em domicílio
                            </li>
                            <li className="flex items-center gap-2">
                                <span style={{ color: 'var(--accent-500)' }}>✓</span>
                                Define seu raio de atendimento
                            </li>
                            <li className="flex items-center gap-2">
                                <span style={{ color: 'var(--accent-500)' }}>✓</span>
                                Agenda simplificada
                            </li>
                        </ul>
                        <div className="mt-6">
                            <span className="btn btn-secondary btn-sm" style={{ background: 'var(--accent-50)', color: 'var(--accent-700)', border: '1px solid var(--accent-200)' }}>
                                Cadastrar como Profissional →
                            </span>
                        </div>
                    </Link>
                </div>

                <p className="text-center mt-8 text-sm text-muted">
                    Já tem cadastro? <Link to="/admin/login" className="text-primary">Faça login aqui</Link>
                </p>
            </div>
        </div>
    )
}
