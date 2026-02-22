import { Link } from 'react-router-dom'

export default function Footer() {
    return (
        <footer className="footer">
            <div className="container">
                <div className="footer-grid">
                    <div>
                        <div className="logo" style={{ marginBottom: '1rem' }}>
                            <img src="/logo.png" alt="Zakys" style={{ height: '2.5rem', width: 'auto' }} />
                        </div>
                        <p style={{ color: 'var(--gray-400)', fontSize: 'var(--font-size-sm)' }}>
                            A plataforma mais completa para agendamentos de beleza e estética em Brasília.
                        </p>
                    </div>

                    <div>
                        <h4 className="footer-title">Navegação</h4>
                        <ul className="footer-links">
                            <li><Link to="/">Início</Link></li>
                            <li><Link to="/buscar">Buscar Serviços</Link></li>
                            <li><Link to="/entrar">Entrar</Link></li>
                            <li><Link to="/cadastro">Cadastrar</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="footer-title">Para Profissionais</h4>
                        <ul className="footer-links">
                            <li><Link to="/parceiro/cadastro">Cadastrar Estabelecimento</Link></li>
                            <li><Link to="/admin/login">Área do Parceiro</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="footer-title">Contato</h4>
                        <ul className="footer-links">
                            <li><a href="mailto:contato@zakys.com.br">contato@zakys.com.br</a></li>
                            <li><a href="tel:+5561999999999">(61) 99999-9999</a></li>
                        </ul>
                    </div>
                </div>

                <div className="footer-bottom">
                    <p>© {new Date().getFullYear()} Zakys. Todos os direitos reservados.</p>
                </div>
            </div>
        </footer>
    )
}
