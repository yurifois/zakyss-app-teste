import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import * as api from '../services/api'

export default function BookingConfirmation() {
    const { id } = useParams()
    const [appointment, setAppointment] = useState(null)
    const [establishment, setEstablishment] = useState(null)
    const [loading, setLoading] = useState(true)

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
                        background: 'var(--success-100)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        fontSize: '2.5rem'
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

                    <div className="p-4 rounded-lg" style={{ background: 'var(--warning-100)' }}>
                        <p className="text-sm" style={{ color: 'var(--warning-700)' }}>
                            <strong>⚠️ Status:</strong> Aguardando confirmação do estabelecimento
                        </p>
                    </div>
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
        </div>
    )
}
