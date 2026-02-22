import { Navigate, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminLayout() {
    const { admin, isAdmin, adminLogout, loading } = useAuth()

    // Aguardar carregamento do localStorage
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-4">⏳</div>
                    <p>Carregando...</p>
                </div>
            </div>
        )
    }

    if (!isAdmin) {
        return <Navigate to="/admin/login" replace />
    }

    return (
        <div className="admin-layout">
            <aside className="admin-sidebar">
                <div className="logo" style={{ color: 'white' }}>
                    <img
                        src="/logo.png"
                        alt="Zakys"
                        style={{
                            height: '2rem',
                            width: 'auto',
                            filter: 'brightness(0) saturate(100%) invert(45%) sepia(85%) saturate(1500%) hue-rotate(310deg) brightness(95%) contrast(95%)'
                        }}
                    />
                </div>

                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.75rem' }}>
                    <div className="text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>Logado como</div>
                    <div className="font-medium" style={{ color: 'white' }}>{admin?.name}</div>
                </div>

                <nav className="admin-nav">
                    <NavLink to="/admin" end className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                        📊 Dashboard
                    </NavLink>
                    <NavLink to="/admin/agendamentos" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                        📅 Agendamentos
                    </NavLink>
                    <NavLink to="/admin/horarios" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                        🕐 Horários
                    </NavLink>
                    <NavLink to="/admin/servicos" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                        ✂️ Serviços
                    </NavLink>
                    <NavLink to="/admin/funcionarios" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                        👥 Funcionários
                    </NavLink>
                    <NavLink to="/admin/relatorio" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                        💰 Relatório Financeiro
                    </NavLink>
                    <NavLink to="/admin/analytics" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`}>
                        📊 Analytics
                    </NavLink>
                </nav>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                        onClick={adminLogout}
                        className="btn btn-ghost w-full"
                        style={{ color: 'rgba(255,255,255,0.7)', justifyContent: 'flex-start' }}
                    >
                        🚪 Sair
                    </button>
                </div>
            </aside>

            <main className="admin-main">
                <Outlet />
            </main>
        </div>
    )
}
