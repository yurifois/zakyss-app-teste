import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

export default function AdminDashboard() {
    const { admin, adminLogout } = useAuth()
    const { success, error, warning } = useToast()
    const navigate = useNavigate()
    const [copied, setCopied] = useState(false)

    const [establishment, setEstablishment] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [todayAppointments, setTodayAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState(false)
    const [stats, setStats] = useState({
        today: 0,
        week: 0,
        pending: 0,
        revenue: 0,
    })

    useEffect(() => {
        if (admin) {
            loadData()
        }
    }, [admin])

    const loadData = async () => {
        setLoading(true)
        try {
            const est = await api.getEstablishmentById(admin.establishmentId)
            setEstablishment(est)

            const apts = await api.getAppointmentsByEstablishment(admin.establishmentId)

            // Enrich with services
            const enriched = await Promise.all(apts.map(async (apt) => {
                const servicesList = await api.getServicesByIds(apt.services).catch(() => [])
                return { ...apt, servicesList }
            }))

            setAppointments(enriched)

            // Filter today's appointments (incluindo cancelados para visibilidade e reativação)
            const today = new Date().toISOString().split('T')[0]
            const todayApts = enriched
                .filter(apt => apt.date === today)
                .sort((a, b) => a.time.localeCompare(b.time))
            setTodayAppointments(todayApts)

            // Calculate stats
            const weekAgo = new Date()
            weekAgo.setDate(weekAgo.getDate() - 7)
            const weekAgoStr = weekAgo.toISOString().split('T')[0]

            setStats({
                today: todayApts.length,
                week: enriched.filter(a => a.date >= weekAgoStr && a.status !== 'cancelled').length,
                pending: enriched.filter(a => a.status === 'pending').length,
                // Faturamento só conta após a conclusão do serviço, não na confirmação do agendamento
                revenue: enriched
                    .filter(a => a.status === 'completed')
                    .reduce((sum, a) => sum + a.totalPrice, 0),
            })
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleConfirm = async (appointmentId) => {
        try {
            await api.updateAppointmentStatus(appointmentId, 'confirmed')
            loadData()
            success('Agendamento confirmado!')
        } catch (err) {
            console.error('Error confirming:', err)
            error(err.message || 'Erro ao confirmar agendamento')
        }
    }

    const handleCancel = async (appointmentId) => {
        if (!window.confirm('Tem certeza que deseja cancelar este agendamento?')) return
        try {
            await api.updateAppointmentStatus(appointmentId, 'cancelled', 'establishment')
            success('Agendamento cancelado com sucesso!')
            loadData()
        } catch (err) {
            console.error('Error cancelling:', err)
            error(err.message || 'Erro ao cancelar agendamento')
        }
    }

    const handleReactivate = async (appointmentId) => {
        try {
            await api.reactivateAppointment(appointmentId)
            success('Agendamento reativado com sucesso! E-mails enviados.')
            loadData()
        } catch (err) {
            console.error('Error reactivating:', err)
            error(err.message || 'Erro ao reativar agendamento')
        }
    }

    const handleDeleteAccount = async () => {
        const confirmStr = `Tem certeza que deseja EXCLUIR TOTALMENTE sua conta e o estabelecimento "${establishment.name}"?\n\nEsta ação é PERMANENTE e apagará todos os agendamentos, funcionários e dados históricos. Você poderá criar um novo cadastro após esta ação.`

        if (!window.confirm(confirmStr)) return

        const secondConfirm = window.confirm("ÚLTIMO AVISO: Todos os seus dados serão apagados agora. Confirmar exclusão?")
        if (!secondConfirm) return

        setDeleting(true)
        try {
            await api.deleteEstablishment(admin.establishmentId)
            success('Sua conta e todos os dados foram removidos com sucesso.')
            adminLogout()
            navigate('/')
        } catch (err) {
            error(err.message || 'Erro ao excluir conta')
            console.error(err)
        } finally {
            setDeleting(false)
        }
    }

    const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-')
        return `${day}/${month}`
    }

    const getStatusBadge = (status, cancelledBy = null) => {
        if (status === 'cancelled') {
            const label = cancelledBy === 'customer'
                ? '🚫 Cancelado p/ Cliente'
                : cancelledBy === 'establishment'
                ? '🏢 Cancelado p/ Estabelecimento'
                : '✕ Cancelado'
            return <span className="badge badge-error">{label}</span>
        }
        const styles = {
            pending: { class: 'badge-warning', label: 'Pendente' },
            confirmed: { class: 'badge-success', label: 'Confirmado' },
            cancelled: { class: 'badge-error', label: 'Cancelado' },
            completed: { class: 'badge-secondary', label: 'Concluído' },
        }
        const { class: cls, label } = styles[status] || styles.pending
        return <span className={`badge ${cls}`}>{label}</span>
    }

    if (loading) return <div className="p-8">Carregando...</div>

    return (
        <div>
            <div className="mb-8 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                    <p className="text-secondary">Bem-vindo de volta! Aqui está o resumo do seu estabelecimento.</p>
                </div>
                {establishment?.image && (
                    <div 
                        style={{
                            width: '80px',
                            height: '80px',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                            flexShrink: 0,
                            border: '1px solid var(--border-color)'
                        }}
                    >
                        <img 
                            src={api.getImageUrl(establishment.image)} 
                            alt="Logo do Estabelecimento" 
                            style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover'
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="stats-grid mb-8">
                <div className="stat-card">
                    <div className="stat-icon primary">📅</div>
                    <div className="stat-value">{stats.today}</div>
                    <div className="stat-label">Agendamentos hoje</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon secondary">📊</div>
                    <div className="stat-value">{stats.week}</div>
                    <div className="stat-label">Esta semana</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon accent">⏳</div>
                    <div className="stat-value">{stats.pending}</div>
                    <div className="stat-label">Pendentes</div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon success">💰</div>
                    <div className="stat-value">R$ {stats.revenue.toFixed(0)}</div>
                    <div className="stat-label">Faturamento</div>
                </div>
            </div>

            {/* Shareable Link Card */}
            <div className="card mb-8" style={{ padding: '1.5rem', background: 'rgba(255, 0, 127, 0.08)', border: '1px solid rgba(255, 0, 127, 0.2)' }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h3 className="font-bold text-lg mb-1" style={{ color: '#FF69B4' }}>🔗 Link de Agendamento</h3>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Compartilhe com seus clientes para agendarem direto!</p>
                    </div>
                    <div className="flex items-center gap-3" style={{ flex: 1, maxWidth: '500px' }}>
                        <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/estabelecimento/${admin?.establishmentId}`}
                            className="form-input"
                            style={{
                                background: 'rgba(20, 16, 50, 0.6)',
                                fontSize: '0.875rem',
                                cursor: 'default',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-color)'
                            }}
                            onClick={(e) => e.target.select()}
                        />
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/estabelecimento/${admin?.establishmentId}`)
                                setCopied(true)
                                success('Link copiado!')
                                setTimeout(() => setCopied(false), 2000)
                            }}
                            className="btn btn-primary"
                            style={{ whiteSpace: 'nowrap' }}
                        >
                            {copied ? '✓ Copiado!' : '📋 Copiar'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
                {/* Today's Schedule */}
                <div>
                    <h2 className="text-xl font-bold mb-4">📅 Agenda de Hoje</h2>

                    {todayAppointments.length === 0 ? (
                        <div className="card text-center py-12">
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
                            <p className="text-secondary">Nenhum agendamento para hoje</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {todayAppointments.map(apt => (
                                <div key={apt.id} className="card" style={{ padding: '1rem' }}>
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <span className="text-lg font-bold text-gradient">{apt.time}</span>
                                            <span className="text-muted ml-2">({apt.totalDuration} min)</span>
                                        </div>
                                        {getStatusBadge(apt.status, apt.cancelledBy)}
                                    </div>
                                    <div className="font-medium">{apt.customerName}</div>
                                    <div className="text-sm text-secondary mb-2">{apt.customerPhone}</div>
                                    <div className="flex flex-wrap gap-1">
                                        {apt.servicesList?.map(s => (
                                            <span key={s.id} className="badge badge-primary text-xs">{s.name}</span>
                                        ))}
                                    </div>

                                    {apt.notes && (
                                        <div className="mt-3 p-2 rounded text-sm text-secondary bg-black/20 border border-purple-500/10">
                                            <span className="font-semibold text-primary/80">📝 Obs:</span> <span className="italic">{apt.notes}</span>
                                        </div>
                                    )}

                                    {apt.status === 'pending' && (
                                        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <button
                                                onClick={() => handleConfirm(apt.id)}
                                                className="btn btn-primary btn-sm flex-1"
                                            >
                                                ✓ Confirmar
                                            </button>
                                            <button
                                                onClick={() => handleCancel(apt.id)}
                                                className="btn btn-secondary btn-sm"
                                                title="Cancelar agendamento"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    )}

                                    {apt.status === 'confirmed' && (
                                        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <button
                                                onClick={() => handleCancel(apt.id)}
                                                className="btn btn-ghost btn-sm text-danger flex-1"
                                            >
                                                ✕ Cancelar
                                            </button>
                                        </div>
                                    )}

                                    {apt.status === 'cancelled' && (
                                        <div className="flex gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <button
                                                onClick={() => handleReactivate(apt.id)}
                                                className="btn btn-primary btn-sm flex-1"
                                            >
                                                🔄 Reativar Agendamento
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Pending Confirmations */}
                <div>
                    <h2 className="text-xl font-bold mb-4">⏳ Aguardando Confirmação</h2>

                    {appointments.filter(a => a.status === 'pending').length === 0 ? (
                        <div className="card text-center py-12">
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
                            <p className="text-secondary">Todos os agendamentos estão confirmados</p>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            {appointments
                                .filter(a => a.status === 'pending')
                                .slice(0, 5)
                                .map(apt => (
                                    <div key={apt.id} className="card" style={{ padding: '1rem' }}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-bold">{formatDate(apt.date)}</span>
                                                <span className="text-muted ml-2">{apt.time}</span>
                                            </div>
                                            <span className="font-semibold">R$ {apt.totalPrice?.toFixed(2)}</span>
                                        </div>
                                        <div className="font-medium">{apt.customerName}</div>
                                        {apt.notes && (
                                            <div className="mt-2 p-2 rounded text-sm text-secondary bg-black/20 border border-purple-500/10">
                                                <span className="font-semibold text-primary/80">📝 Obs:</span> <span className="italic">{apt.notes}</span>
                                            </div>
                                        )}
                                        <div className="flex gap-2 mt-3">
                                            <button
                                                onClick={() => handleConfirm(apt.id)}
                                                className="btn btn-primary btn-sm flex-1"
                                            >
                                                ✓ Confirmar
                                            </button>
                                            <button
                                                onClick={() => handleCancel(apt.id)}
                                                className="btn btn-secondary btn-sm"
                                            >
                                                ✕ Recusar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Danger Zone */}
            <div className="mt-12 pt-8 border-t" style={{ borderColor: '#fee2e2' }}>
                <div className="card" style={{ padding: '1.5rem', background: '#fff1f1', border: '1px solid #fee2e2' }}>
                    <h2 className="text-xl font-bold text-error-700 mb-2" style={{ color: '#b91c1c' }}>⚠️ Zona de Perigo</h2>
                    <p className="text-secondary mb-4">
                        Ao excluir sua conta, todos os dados do estabelecimento, agendamentos e funcionários serão removidos permanentemente do nosso banco de dados.
                    </p>
                    <button
                        onClick={handleDeleteAccount}
                        className="btn btn-error"
                        disabled={deleting}
                        style={{ background: '#ef4444', color: 'white' }}
                    >
                        {deleting ? 'Excluindo tudo...' : '🗑️ Excluir minha conta e todos os dados'}
                    </button>
                    <p className="mt-3 text-xs font-medium" style={{ color: '#dc2626' }}>
                        * Você poderá realizar um novo cadastro com o mesmo e-mail após a exclusão.
                    </p>
                </div>
            </div>
        </div>
    )
}
