import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Menu, X } from 'lucide-react'

export default function Header() {
    const { user, isAuthenticated, logout } = useAuth()
    const [scrolled, setScrolled] = useState(false)
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
    const navigate = useNavigate()

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 50)
        }

        window.addEventListener('scroll', handleScroll, { passive: true })
        return () => window.removeEventListener('scroll', handleScroll)
    }, [])

    const toggleMobileMenu = () => {
        setMobileMenuOpen(!mobileMenuOpen)
    }

    const closeMobileMenu = () => {
        setMobileMenuOpen(false)
    }

    return (
        <header className={`header ${scrolled ? 'header--scrolled' : ''}`}>
            <div className="container header-content">
                <Link to="/" className="logo" onClick={closeMobileMenu}>
                    <div className="logo-container">
                        <img src="/logo.png" alt="Zakys" className="logo-icon" />
                    </div>
                </Link>

                {/* Mobile Menu Toggle */}
                <button 
                    className="mobile-menu-btn md:hidden"
                    onClick={toggleMobileMenu}
                    style={{ background: 'transparent', border: 'none', color: scrolled ? '#1a1a2e' : 'white', cursor: 'pointer' }}
                >
                    {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>

                {/* Desktop and Mobile Nav */}
                <nav className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
                    <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                        Início
                    </NavLink>
                    <NavLink to="/buscar" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                        Buscar
                    </NavLink>

                    {isAuthenticated ? (
                        <>
                            <NavLink to="/perfil" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMobileMenu}>
                                Meu Perfil
                            </NavLink>
                            <button onClick={() => { logout(); closeMobileMenu(); }} className="btn btn-ghost btn-sm">
                                Sair
                            </button>
                        </>
                    ) : (
                        <>
                            <NavLink to="/entrar" className="nav-link" onClick={closeMobileMenu}>
                                Entrar
                            </NavLink>
                            <Link to="/cadastro" className="btn btn-primary btn-sm" onClick={closeMobileMenu}>
                                Cadastrar
                            </Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    )
}
