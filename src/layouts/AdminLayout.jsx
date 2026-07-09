import { useState, useEffect, useRef } from 'react'
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import * as api from '../services/api'
import { useToast } from '../contexts/ToastContext'

const playNotificationSound = () => {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        
        const playTone = (freq, delay) => {
            setTimeout(() => {
                if (ctx.state === 'suspended') ctx.resume();
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, ctx.currentTime);
                
                gain.gain.setValueAtTime(0, ctx.currentTime);
                gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
                
                osc.connect(gain);
                gain.connect(ctx.destination);
                
                osc.start();
                osc.stop(ctx.currentTime + 0.6);
            }, delay);
        };

        playTone(523.25, 0);   // C5
        playTone(659.25, 150); // E5
        
    } catch (e) {
        console.error('Erro ao tocar áudio', e);
    }
}

export default function AdminLayout() {
    const { admin, isAdmin, adminLogout, loading } = useAuth()
    const { info } = useToast()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const location = useLocation()
    const knownPendingIds = useRef(new Set())

    // Fechar sidebar ao navegar (mobile)
    const handleNavClick = () => setSidebarOpen(false)

    // Polling de novos agendamentos
    useEffect(() => {
        if (!admin?.establishmentId) return;

        const checkNewAppointments = async () => {
            try {
                const apts = await api.getAppointmentsByEstablishment(admin.establishmentId);
                const pendingApts = apts.filter(a => a.status === 'pending');
                const currentPendingIds = new Set(pendingApts.map(a => a.id));

                // Se já carregamos a primeira vez (size > 0 ou initialLoad feito)
                if (knownPendingIds.current.size > 0 || knownPendingIds.current.initialLoadDone) {
                    const newAppointments = pendingApts.filter(a => !knownPendingIds.current.has(a.id));
                    
                    if (newAppointments.length > 0) {
                        playNotificationSound();
                        info(`🔔 Você tem ${newAppointments.length} novo(s) agendamento(s)!`);
                    }
                }

                currentPendingIds.initialLoadDone = true;
                knownPendingIds.current = currentPendingIds;
            } catch (error) {
                console.error('Erro ao verificar novos agendamentos:', error);
            }
        };

        checkNewAppointments(); // Verifica na hora
        const interval = setInterval(checkNewAppointments, 30000); // Depois a cada 30 segundos

        return () => clearInterval(interval);
    }, [admin?.establishmentId]);

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
            {/* Hamburger button - mobile only */}
            <button
                className="admin-mobile-toggle"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label="Menu"
            >
                {sidebarOpen ? '✕' : '☰'}
            </button>

            {/* Overlay - mobile only */}
            <div
                className={`admin-sidebar-overlay ${sidebarOpen ? 'open' : ''}`}
                onClick={() => setSidebarOpen(false)}
            />

            <aside className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`}>
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
                    <NavLink to="/admin" end className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        📊 Dashboard
                    </NavLink>
                    <NavLink to="/admin/agendamentos" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        📅 Agendamentos
                    </NavLink>
                    <NavLink to="/admin/clientes" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        🗂️ Clientes
                    </NavLink>
                    <NavLink to="/admin/horarios" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        🕐 Horários
                    </NavLink>
                    <NavLink to="/admin/servicos" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        ✂️ Serviços
                    </NavLink>
                    <NavLink to="/admin/funcionarios" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        👥 Funcionários
                    </NavLink>
                    <NavLink to="/admin/relatorio" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        💰 Relatório Financeiro
                    </NavLink>
                    <NavLink to="/admin/analytics" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        📊 Analytics
                    </NavLink>
                    <NavLink to="/admin/dados" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        ⚙️ Dados Cadastrados
                    </NavLink>
                </nav>

                <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <button
                        onClick={() => { adminLogout(); setSidebarOpen(false) }}
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
