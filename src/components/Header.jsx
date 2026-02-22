import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
    const { user, isAuthenticated, logout } = useAuth()

    return (
        <header className="header">
            <div className="container header-content">
                <Link to="/" className="logo">
                    <img src="/logo.png" alt="Zakys" className="logo-icon" style={{ height: '2.5rem', width: 'auto' }} />
                </Link>

                <nav className="nav-links">
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        Início
                    </NavLink>
                    <NavLink to="/buscar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        Buscar
                    </NavLink>

                    {isAuthenticated ? (
                        <>
                            <NavLink to="/perfil" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                                Meu Perfil
                            </NavLink>
                            <button onClick={logout} className="btn btn-ghost btn-sm">
                                Sair
                            </button>
                        </>
                    ) : (
                        <>
                            <NavLink to="/entrar" className="nav-link">
                                Entrar
                            </NavLink>
                            <Link to="/cadastro" className="btn btn-primary btn-sm">
                                Cadastrar
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    )
}
