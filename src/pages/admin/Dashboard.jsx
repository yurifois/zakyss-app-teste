import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import ImageUploader from '../../components/ImageUploader'

export default function AdminDashboard() {
    const { admin } = useAuth()
    const { success } = useToast()
    const [copied, setCopied] = useState(false)

    const [establishment, setEstablishment] = useState(null)
    const [appointments, setAppointments] = useState([])
    const [todayAppointments, setTodayAppointments] = useState([])
    const [loading, setLoading] = useState(true)
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
                const servicesList = await api.getServicesByIds(apt.services)
                return { ...apt, servicesList }
            }))

            setAppointments(enriched)

            // Filter today's appointments
            const today = new Date().toISOString().split('T')[0]
            const todayApts = enriched
                .filter(apt => apt.date === today && apt.status !== 'cancelled')
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
                revenue: enriched
                    .filter(a => a.status === 'confirmed' || a.status === 'completed')
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
        } catch (error) {
            console.error('Error confirming:', error)
        }
    }

    const handleCancel = async (appointmentId) => {
        try {
            await api.updateAppointmentStatus(appointmentId, 'cancelled')
            loadData()
            success('Agendamento cancelado')
        } catch (error) {
            console.error('Error cancelling:', error)
        }
    }

    const handleLogoUpload = async (file) => {
        try {
            const result = await api.uploadEstablishmentLogo(admin.establishmentId, file)
            setEstablishment(prev => ({ ...prev, image: result.image }))
            success('Logo atualizada com sucesso!')
        } catch (error) {
            console.error('Error uploading logo:', error)
            throw error
        }
    }

    const handleServiceImageUpload = async (file) => {
        try {
            const result = await api.uploadServiceImage(admin.establishmentId, file)
            setEstablishment(prev => ({ ...prev, serviceImages: result.serviceImages }))
            success('Imagem adicionada com sucesso!')
        } catch (error) {
            console.error('Error uploading service image:', error)
            throw error
        }
    }

    const handleDeleteServiceImage = async (index) => {
        try {
            await api.deleteServiceImage(admin.establishmentId, index)
            setEstablishment(prev => ({
                ...prev,
                serviceImages: prev.serviceImages.filter((_, i) => i !== index)
            }))
            success('Imagem removida')
        } catch (error) {
            console.error('Error deleting image:', error)
        }
    }

    const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-')
        return `${day}/${month}`
    }

    const getStatusBadge = (status) => {
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
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
                <p className="text-secondary">Bem-vindo de volta! Aqui está o resumo do seu estabelecimento.</p>
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
            <div className="card mb-8" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, var(--primary-50), var(--primary-100))' }}>
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h3 className="font-bold text-lg mb-1">🔗 Link de Agendamento</h3>
                        <p className="text-sm text-secondary">Compartilhe com seus clientes para agendarem direto!</p>
                    </div>
                    <div className="flex items-center gap-3" style={{ flex: 1, maxWidth: '500px' }}>
                        <input
                            type="text"
                            readOnly
                            value={`${window.location.origin}/estabelecimento/${admin?.establishmentId}`}
                            className="form-input"
                            style={{
                                background: 'white',
                                fontSize: '0.875rem',
                                cursor: 'default'
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
                                        {getStatusBadge(apt.status)}
                                    </div>
                                    <div className="font-medium">{apt.customerName}</div>
                                    <div className="text-sm text-secondary mb-2">{apt.customerPhone}</div>
                                    <div className="flex flex-wrap gap-1">
                                        {apt.servicesList?.map(s => (
                                            <span key={s.id} className="badge badge-primary text-xs">{s.name}</span>
                                        ))}
                                    </div>

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
                                            >
                                                ✕
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

            {/* Images Section */}
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4">🖼️ Imagens do Estabelecimento</h2>

                <div className="grid md:grid-cols-2 gap-6">
                    {/* Logo Upload */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 className="font-bold mb-4">Logo / Imagem Principal</h3>
                        <p className="text-sm text-secondary mb-4">
                            Esta imagem será exibida no card do seu estabelecimento.
                        </p>
                        <ImageUploader
                            label=""
                            currentImage={api.getImageUrl(establishment?.image)}
                            onUpload={handleLogoUpload}
                        />
                    </div>

                    {/* Service Images */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h3 className="font-bold mb-4">Galeria de Serviços</h3>
                        <p className="text-sm text-secondary mb-4">
                            Adicione fotos do seu trabalho para atrair mais clientes.
                        </p>

                        <ImageUploader
                            label="Adicionar nova imagem"
                            onUpload={handleServiceImageUpload}
                        />

                        {establishment?.serviceImages && establishment.serviceImages.length > 0 && (
                            <div className="service-images-gallery">
                                {establishment.serviceImages.map((img, index) => (
                                    <div key={index} className="service-image-item">
                                        <img src={api.getImageUrl(img)} alt={`Serviço ${index + 1}`} />
                                        <button
                                            className="service-image-remove"
                                            onClick={() => handleDeleteServiceImage(index)}
                                            title="Remover imagem"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
