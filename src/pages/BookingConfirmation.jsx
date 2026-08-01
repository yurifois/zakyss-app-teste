import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import * as api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function BookingConfirmation() {
    const { id } = useParams()
    const { user, isAuthenticated } = useAuth()
    const { success, error: showError } = useToast()
    const [appointment, setAppointment] = useState(null)
    const [establishment, setEstablishment] = useState(null)
    const [loading, setLoading] = useState(true)
    const [cancelling, setCancelling] = useState(false)
    const [guestPhone, setGuestPhone] = useState('')
    const [showGuestForm, setShowGuestForm] = useState(false)
    const [showCancelModal, setShowCancelModal] = useState(false)
    const [showReactivateModal, setShowReactivateModal] = useState(false)

    useEffect(() => {
        loadData()
    }, [id])

    const loadData = async () => {
        try {
            const apt = await api.getAppointmentById(id)
            setAppointment(apt)

            const est = await api.getEstablishmentById(apt.establishmentId)
            setEstablishment(est)
        } catch (error) {
            console.error('Error loading confirmation:', error)
        } finally {
            setLoading(false)
        }
    }

    const isOwner = isAuthenticated && appointment && user?.id === appointment.userId

    const handleCancel = () => {
        if (!isOwner && !guestPhone.trim()) {
            setShowGuestForm(true)
            return
        }
        setShowCancelModal(true)
    }

    const confirmCancel = async () => {
        setCancelling(true)
        try {
            if (isOwner) {
                await api.updateAppointmentStatus(appointment.id, 'cancelled', 'customer')
            } else {
                await api.cancelGuestAppointment(appointment.id, guestPhone)
            }
            setAppointment(prev => ({ ...prev, status: 'cancelled', cancelledBy: 'customer' }))
            success('Agendamento cancelado com sucesso.')
        } catch (err) {
            showError(err.message || 'Erro ao cancelar agendamento')
        } finally {
            setCancelling(false)
            setShowCancelModal(false)
        }
    }

    const confirmReactivate = async () => {
        setCancelling(true)
        try {
            await api.reactivateAppointment(appointment.id)
            setAppointment(prev => ({ ...prev, status: 'confirmed', cancelledBy: null, cancelledAt: null }))
            success('Agendamento reativado com sucesso! Notificações enviadas.')
        } catch (err) {
            showError(err.message || 'Erro ao reativar agendamento')
        } finally {
            setCancelling(false)
            setShowReactivateModal(false)
        }
    }

    const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-')
        const date = new Date(year, month - 1, day)
        return date.toLocaleDateString('pt-BR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        })
    }

    if (loading) {
        return (
            <div className="container py-16 text-center">
                <div className="skeleton" style={{ height: '300px', maxWidth: '500px', margin: '0 auto' }}></div>
            </div>
        )
    }

    if (!appointment) {
        return (
            <div className="container py-16 text-center">
                <h2>Agendamento não encontrado</h2>
                <Link to="/" className="btn btn-primary mt-4">Voltar ao início</Link>
            </div>
        )
    }

    return (
        <div className="py-16">
            <div className="container" style={{ maxWidth: '600px' }}>
                <div className="text-center mb-8">
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        background: 'rgba(34, 197, 94, 0.15)',
                        border: '2px solid rgba(34, 197, 94, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        fontSize: '2.5rem',
                        color: '#4ade80'
                    }}>
                        ✓
                    </div>
                    <h1 className="text-3xl font-bold mb-2">Agendamento Confirmado!</h1>
                    <p className="text-secondary">
                        Seu agendamento foi realizado com sucesso. Aguarde a confirmação do estabelecimento.
                    </p>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    <div className="mb-6 pb-6" style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <h2 className="text-lg font-bold mb-1">{establishment?.name}</h2>
                        <p className="text-sm text-secondary">{establishment?.address}</p>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6 mb-6">
                        <div>
                            <span className="text-sm text-muted">📅 Data</span>
                            <p className="font-medium">{formatDate(appointment.date)}</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted">🕐 Horário</span>
                            <p className="font-medium">{appointment.time}</p>
                        </div>
                    </div>

                    <div className="mb-6">
                        <span className="text-sm text-muted">Serviços</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {appointment.servicesList?.map(s => (
                                <span key={s.id} className="badge badge-primary">{s.name}</span>
                            ))}
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-6 mb-6">
                        <div>
                            <span className="text-sm text-muted">⏱ Duração</span>
                            <p className="font-medium">{appointment.totalDuration} minutos</p>
                        </div>
                        <div>
                            <span className="text-sm text-muted">💰 Valor total</span>
                            <p className="font-bold text-gradient">R$ {appointment.totalPrice?.toFixed(2)}</p>
                        </div>
                    </div>

                    <div className="p-4 mb-4" style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 'var(--radius-lg)' }}>
                        <p className="text-sm" style={{ color: '#fcd34d' }}>
                            <strong>⚠️ Status:</strong> Aguardando confirmação do estabelecimento
                        </p>
                    </div>

                    <div className="p-4" style={{ backgroundColor: '#fdf2f8', border: '1px solid rgba(236, 72, 153, 0.3)', borderRadius: 'var(--radius-lg)' }}>
                        <p className="text-sm font-medium mb-1" style={{ color: '#db2777' }}>
                            ℹ️ Comunicado ao Cliente:
                        </p>
                        <p className="text-xs leading-relaxed" style={{ color: '#5c5752' }}>
                            Alguns serviços podem sofrer alteração de valor e necessitam de diagnóstico prévio presencial no momento do atendimento.
                        </p>
                    </div>

                    {(appointment.status === 'pending' || appointment.status === 'confirmed') && (
                        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                            {showGuestForm && !isOwner && (
                                <div className="mb-3">
                                    <label className="text-sm text-muted">Confirme o telefone usado no agendamento</label>
                                    <input
                                        type="tel"
                                        className="input w-full mt-1"
                                        placeholder="(00) 00000-0000"
                                        value={guestPhone}
                                        onChange={(e) => setGuestPhone(e.target.value)}
                                    />
                                </div>
                            )}
                            <button
                                onClick={handleCancel}
                                disabled={cancelling}
                                className="btn btn-sm"
                                style={{ backgroundColor: 'var(--error-500)', color: 'white' }}
                            >
                                ✕ Cancelar agendamento
                            </button>
                        </div>
                    )}

                    {appointment.status === 'cancelled' && (
                        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                            <p className="text-sm text-secondary mb-4">
                                {appointment.cancelledBy === 'customer'
                                    ? '🚫 Este agendamento foi cancelado pelo cliente.'
                                    : appointment.cancelledBy === 'establishment'
                                    ? '🏢 Este agendamento foi cancelado pelo estabelecimento.'
                                    : '✕ Este agendamento foi cancelado.'}
                            </p>
                            <button
                                onClick={() => setShowReactivateModal(true)}
                                disabled={cancelling}
                                className="btn btn-primary w-full"
                            >
                                🔄 Reativar este Agendamento
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex gap-4 mt-8">
                    <Link to="/" className="btn btn-secondary flex-1">
                        Voltar ao início
                    </Link>
                    <Link to="/perfil" className="btn btn-primary flex-1">
                        Ver meus agendamentos
                    </Link>
                </div>
            </div>

            {/* Modal de Confirmação de Cancelamento */}
            {showCancelModal && (
                <div
                    className="modal-backdrop"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}
                >
                    <div className="bg-base-100 rounded-2xl w-full max-w-md p-6 text-center shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
                            <span style={{ fontSize: '2rem' }}>⚠️</span>
                        </div>
                        <h2 className="text-xl font-bold mb-2">Confirmar Cancelamento?</h2>
                        <p className="text-muted text-sm mb-6">
                            Tem certeza que deseja cancelar seu agendamento em <strong>{establishment?.name}</strong> para <strong>{formatDate(appointment.date)} às {appointment.time}</strong>?
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                className="btn w-full"
                                onClick={confirmCancel}
                                disabled={cancelling}
                                style={{ backgroundColor: 'var(--error-500)', color: 'white' }}
                            >
                                {cancelling ? 'Cancelando...' : 'Sim, Cancelar Agendamento'}
                            </button>
                            <button
                                className="btn btn-ghost w-full"
                                onClick={() => setShowCancelModal(false)}
                                disabled={cancelling}
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Reativação */}
            {showReactivateModal && (
                <div
                    className="modal-backdrop"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}
                >
                    <div className="bg-base-100 rounded-2xl w-full max-w-md p-6 text-center shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(236, 72, 153, 0.1)' }}>
                            <span style={{ fontSize: '2rem' }}>🔄</span>
                        </div>
                        <h2 className="text-xl font-bold mb-2">Reativar Agendamento?</h2>
                        <p className="text-muted text-sm mb-6">
                            Deseja restaurar seu agendamento em <strong>{establishment?.name}</strong> para <strong>{formatDate(appointment.date)} às {appointment.time}</strong>? Notificaremos o estabelecimento por e-mail.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                className="btn btn-primary w-full"
                                onClick={confirmReactivate}
                                disabled={cancelling}
                            >
                                {cancelling ? 'Reativando...' : 'Sim, Reativar Agendamento'}
                            </button>
                            <button
                                className="btn btn-ghost w-full"
                                onClick={() => setShowReactivateModal(false)}
                                disabled={cancelling}
                            >
                                Voltar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
