import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Search as SearchIcon } from 'lucide-react'

export default function Header() {
    const { user, isAuthenticated, logout } = useAuth()
    const [searchQuery, setSearchQuery] = useState('')
    const navigate = useNavigate()

    return (
        <header className="header">
            <div className="container header-content">
                <Link to="/" className="logo">
                    <img src="/logo.png" alt="Zakys" className="logo-icon" style={{ height: '2.5rem', width: 'auto' }} />
                </Link>

                <div className="header-search md:flex hidden" style={{ flex: 1, maxWidth: '400px', margin: '0 2rem' }}>
                    <form onSubmit={(e) => {
                        e.preventDefault()
                        if (searchQuery.trim()) navigate(`/buscar?q=${encodeURIComponent(searchQuery)}`)
                    }} style={{ width: '100%', position: 'relative' }}>
                        <input
                            type="text"
                            placeholder="Buscar salão ou serviço..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="form-input"
                            style={{ paddingLeft: '2.5rem', borderRadius: '999px', height: '2.5rem' }}
                        />
                        <SearchIcon size={18} className="text-muted" style={{ position: 'absolute', left: '0.8rem', top: '50%', transform: 'translateY(-50%)' }} />
                    </form>
                </div>

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
