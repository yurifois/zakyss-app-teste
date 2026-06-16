import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'

export default function Header() {
    const { user, isAuthenticated, logout } = useAuth()
    const [scrolled, setScrolled] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    return (
        <header className={`header ${scrolled ? 'header--scrolled' : ''}`}>
            <div className="container header-content">
                <Link to="/" className="logo">
                    <div className="logo-container">
                        <img src="/logo.png" alt="Zakys" className="logo-icon" />
                    </div>
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
