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
    const { info, success, error: showError } = useToast()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [establishmentName, setEstablishmentName] = useState(null)
    const [editingName, setEditingName] = useState(false)
    const [nameInput, setNameInput] = useState('')
    const [savingName, setSavingName] = useState(false)
    const location = useLocation()
    const knownPendingIds = useRef(new Set())

    // Fechar sidebar ao navegar (mobile)
    const handleNavClick = () => setSidebarOpen(false)

    // Nome real do estabelecimento (não o nome do admin, que fica travado no
    // que foi digitado no cadastro). Rebusca a cada navegação pra refletir
    // edições feitas por aqui mesmo sem precisar recarregar a página.
    useEffect(() => {
        if (!admin?.establishmentId) return
        api.getEstablishmentById(admin.establishmentId)
            .then(est => setEstablishmentName(est?.name || null))
            .catch(() => {})
    }, [admin?.establishmentId, location.pathname])

    const startEditingName = () => {
        setNameInput(establishmentName || '')
        setEditingName(true)
    }

    const saveEstablishmentName = async () => {
        const trimmed = nameInput.trim()
        if (!trimmed) {
            showError('O nome não pode ficar vazio')
            return
        }
        setSavingName(true)
        try {
            await api.updateEstablishment(admin.establishmentId, { name: trimmed })
            setEstablishmentName(trimmed)
            setEditingName(false)
            success('Nome atualizado! Já vale pra busca, agendamento e favoritos.')
        } catch (err) {
            showError(err.message || 'Erro ao salvar o nome')
        } finally {
            setSavingName(false)
        }
    }

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
                    <div className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.7)' }}>Estabelecimento</div>
                    {editingName ? (
                        <div className="flex items-center gap-1">
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && saveEstablishmentName()}
                                autoFocus
                                disabled={savingName}
                                style={{ width: '100%', padding: '0.25rem 0.5rem', borderRadius: '0.375rem', border: 'none', fontSize: '0.9rem' }}
                            />
                            <button
                                onClick={saveEstablishmentName}
                                disabled={savingName}
                                title="Salvar"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white' }}
                            >
                                ✅
                            </button>
                            <button
                                onClick={() => setEditingName(false)}
                                disabled={savingName}
                                title="Cancelar"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
                            >
                                ✕
                            </button>
                        </div>
                    ) : (
                        <div className="font-medium flex items-center gap-2" style={{ color: 'white' }}>
                            {establishmentName || '...'}
                            <button
                                onClick={startEditingName}
                                title="Editar nome do estabelecimento"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
                            >
                                ✏️
                            </button>
                        </div>
                    )}
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
                    <NavLink to="/admin/imagens" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        🖼️ Imagens
                    </NavLink>
                    <NavLink to="/admin/links" className={({ isActive }) => `admin-nav-item ${isActive ? 'active' : ''}`} onClick={handleNavClick}>
                        🔗 Links
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
