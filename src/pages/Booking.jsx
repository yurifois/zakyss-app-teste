import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import * as api from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Calendar from '../components/Calendar'
import TimeSlots from '../components/TimeSlots'
import ServiceCard from '../components/ServiceCard'
import { ArrowLeft, Clock, Calendar as CalendarIcon, User as UserIcon } from 'lucide-react'

export default function Booking() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { success, error } = useToast()

    const [establishment, setEstablishment] = useState(null)
    const [services, setServices] = useState([])
    const [selectedDate, setSelectedDate] = useState(null)
    const [selectedTime, setSelectedTime] = useState(null)
    const [availableSlots, setAvailableSlots] = useState([])
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [allEstablishmentServices, setAllEstablishmentServices] = useState([])

    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        email: user?.email || '',
        notes: '',
    })

    useEffect(() => {
        // We no longer require login immediately to view the page.
        // Guests can see services and select dates.
        loadData()

        // Save current URL as redirect target in case they decide to login/register later
        if (!user) {
            sessionStorage.setItem('redirect_after_login', `/agendar/${id}`)
        }
    }, [id, user])

    useEffect(() => {
        if (selectedDate && establishment) {
            loadAvailableSlots()
        }
    }, [selectedDate])

    const loadData = async () => {
        setLoading(true)
        try {
            // Get selected services from session
            const storedServices = sessionStorage.getItem('booking_services')
            let serviceIds = []

            if (storedServices) {
                serviceIds = JSON.parse(storedServices)
            }

            const [est, allEstServices] = await Promise.all([
                api.getEstablishmentById(id),
                api.getEstablishmentServices(id)
            ])

            setEstablishment(est)

            if (serviceIds.length > 0) {
                const selected = allEstServices.filter(s => serviceIds.includes(s.id))
                setServices(selected)
            } else {
                // If no services pre-selected, let user select from all
                setAllEstablishmentServices(allEstServices)
            }
        } catch (err) {
            error('Erro ao carregar dados')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const loadAvailableSlots = async () => {
        try {
            // Convert Date object to YYYY-MM-DD string if needed
            let dateStr = selectedDate
            if (selectedDate instanceof Date) {
                dateStr = selectedDate.toISOString().split('T')[0]
            }
            const slots = await api.getAvailableSlots(id, dateStr)
            setAvailableSlots(slots)
            setSelectedTime(null)
        } catch (err) {
            console.error('Error loading slots:', err)
            setAvailableSlots([])
        }
    }

    // Retorna os dias da semana em que o estabelecimento está fechado
    // 0 = Domingo, 1 = Segunda, ..., 6 = Sábado
    const getClosedDays = () => {
        if (!establishment?.workingHours) return []

        const dayMapping = {
            sunday: 0,
            monday: 1,
            tuesday: 2,
            wednesday: 3,
            thursday: 4,
            friday: 5,
            saturday: 6
        }

        const closedDays = []
        Object.entries(establishment.workingHours).forEach(([day, hours]) => {
            if (hours === null) {
                closedDays.push(dayMapping[day])
            }
        })

        return closedDays
    }

    const getTotalPrice = () => services.reduce((sum, s) => sum + s.price, 0)
    const getTotalDuration = () => services.reduce((sum, s) => sum + s.duration, 0)

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        if (!selectedDate || !selectedTime) {
            error('Selecione data e horário')
            return
        }

        if (!formData.name || !formData.phone) {
            error('Preencha nome e telefone')
            return
        }

        if (!user) {
            error('Você precisa estar logado para agendar')
            sessionStorage.setItem('redirect_after_login', `/agendar/${id}`)
            navigate('/entrar')
            return
        }

        setSubmitting(true)

        try {
            // Convert Date object to YYYY-MM-DD string if needed
            let dateStr = selectedDate
            if (selectedDate instanceof Date) {
                dateStr = selectedDate.toISOString().split('T')[0]
            }

            // Get assignments from session
            const assignments = JSON.parse(sessionStorage.getItem('booking_assignments') || '[]')

            const appointment = await api.createAppointment({
                establishmentId: parseInt(id),
                userId: user?.id || null,
                services: services.map(s => s.id),
                date: dateStr,
                time: selectedTime,
                customerName: formData.name,
                customerPhone: formData.phone,
                customerEmail: formData.email,
                notes: formData.notes,
                assignments: assignments
            })

            sessionStorage.removeItem('booking_services')
            sessionStorage.removeItem('booking_assignments')
            success('Agendamento realizado com sucesso!')
            navigate(`/confirmacao/${appointment.id}`)
        } catch (err) {
            error(err.message || 'Erro ao criar agendamento')
        } finally {
            setSubmitting(false)
        }
    }

    const formatDate = (dateInput) => {
        if (!dateInput) return ''
        let date
        if (dateInput instanceof Date) {
            date = dateInput
        } else {
            const [year, month, day] = dateInput.split('-')
            date = new Date(year, month - 1, day)
        }
        return date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
    }

    if (loading) {
        return (
            <div className="container py-8">
                <div className="skeleton" style={{ height: '400px' }}></div>
            </div>
        )
    }

    return (
        <div className="py-8">
            <div className="container">
                <div className="mb-8">
                    <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm mb-4 flex items-center gap-2">
                        <ArrowLeft size={16} />
                        Voltar
                    </button>
                    <h1 className="text-3xl font-bold mb-2">Agendar horário</h1>
                    <p className="text-secondary">{establishment?.name}</p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Form */}
                    <div className="lg:col-span-2">
                        <form onSubmit={handleSubmit}>
                            {/* Step 0: Service Selection (if none selected) */}
                            {services.length === 0 && (
                                <div className="card mb-6" style={{ padding: '1.5rem' }}>
                                    <h2 className="text-lg font-semibold mb-4 text-primary font-bold">✨ Escolha os serviços</h2>
                                    <p className="text-sm text-muted mb-4">Selecione pelo menos um serviço para ver os horários disponíveis</p>
                                    <div className="flex flex-col gap-2">
                                        {allEstablishmentServices.map(service => (
                                            <ServiceCard
                                                key={service.id}
                                                service={service}
                                                selected={services.some(s => s.id === service.id)}
                                                onToggle={() => {
                                                    setServices(prev => {
                                                        if (prev.some(s => s.id === service.id)) {
                                                            return prev.filter(s => s.id !== service.id)
                                                        }
                                                        return [...prev, service]
                                                    })
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Step 1: Date */}
                            <div className={`card mb-6 ${services.length === 0 ? 'opacity-50 pointer-events-none' : ''}`} style={{ padding: '1.5rem' }}>
                                <h2 className="text-lg font-semibold mb-4">📅 Escolha a data</h2>
                                <Calendar
                                    selectedDate={selectedDate}
                                    onSelectDate={setSelectedDate}
                                    minDate={new Date().toISOString().split('T')[0]}
                                    disabledDays={getClosedDays()}
                                />
                            </div>

                            {/* Step 2: Time */}
                            {selectedDate && (
                                <div className="card mb-6" style={{ padding: '1.5rem' }}>
                                    <h2 className="text-lg font-semibold mb-4">🕐 Escolha o horário</h2>
                                    <p className="text-sm text-muted mb-4">{formatDate(selectedDate)}</p>
                                    {availableSlots.length === 0 ? (
                                        <p className="text-muted text-center py-4">Nenhum horário disponível nesta data</p>
                                    ) : (
                                        <TimeSlots
                                            slots={availableSlots}
                                            selectedTime={selectedTime}
                                            onSelectTime={setSelectedTime}
                                            bookedTimes={[]}
                                        />
                                    )}
                                </div>
                            )}

                            {/* Step 3: Customer Info */}
                            {selectedTime && (
                                <div className="card mb-6" style={{ padding: '1.5rem' }}>
                                    <h2 className="text-lg font-semibold mb-4">👤 Seus dados</h2>

                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="form-group">
                                            <label className="form-label">Nome completo *</label>
                                            <input
                                                type="text"
                                                name="name"
                                                className="form-input"
                                                value={formData.name}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Telefone *</label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                className="form-input"
                                                placeholder="(61) 99999-9999"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">E-mail</label>
                                        <input
                                            type="email"
                                            name="email"
                                            className="form-input"
                                            value={formData.email}
                                            onChange={handleChange}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Observações</label>
                                        <textarea
                                            name="notes"
                                            className="form-textarea"
                                            rows={3}
                                            placeholder="Alguma informação adicional..."
                                            value={formData.notes}
                                            onChange={handleChange}
                                        ></textarea>
                                    </div>
                                </div>
                            )}

                            {/* Submit */}
                            {selectedTime && (
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-lg w-full"
                                    disabled={submitting}
                                >
                                    {submitting ? 'Agendando...' : 'Confirmar agendamento'}
                                </button>
                            )}
                        </form>
                    </div>

                    {/* Summary Sidebar */}
                    <div>
                        <div className="card" style={{ padding: '1.5rem', position: 'sticky', top: '5rem' }}>
                            <h3 className="text-lg font-bold mb-4">Resumo</h3>

                            <div className="mb-4 pb-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <p className="font-medium">{establishment?.name}</p>
                                <p className="text-sm text-muted">{establishment?.address}</p>
                            </div>

                            <div className="mb-4">
                                <h4 className="text-sm font-medium mb-2">Serviços selecionados</h4>
                                {services.length === 0 ? (
                                    <p className="text-xs text-muted">Nenhum serviço selecionado</p>
                                ) : (
                                    services.map(service => (
                                        <div key={service.id} className="flex justify-between text-sm py-1">
                                            <span className="text-muted">{service.name}</span>
                                            <span>R$ {service.price.toFixed(2)}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            {selectedDate && (
                                <div className="mb-4 text-sm">
                                    <span className="text-muted">📅 </span>
                                    {formatDate(selectedDate)}
                                    {selectedTime && <strong> às {selectedTime}</strong>}
                                </div>
                            )}

                            <div className="pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                                <div className="flex justify-between font-bold mb-1">
                                    <span>Total</span>
                                    <span className="text-gradient">R$ {getTotalPrice().toFixed(2)}</span>
                                </div>
                                <div className="text-sm text-muted">
                                    Duração: {getTotalDuration()} min
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
