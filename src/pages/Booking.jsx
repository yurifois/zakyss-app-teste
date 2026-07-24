import { useState, useEffect, useRef } from 'react'
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
    const [showReviewModal, setShowReviewModal] = useState(false)
    const [showLoginPrompt, setShowLoginPrompt] = useState(false)

    const calendarRef = useRef(null)

    const [formData, setFormData] = useState({
        name: user?.name || '',
        phone: user?.phone || '',
        email: user?.email || '',
        notes: '',
    })

    // Sincroniza os dados do formulário quando o usuário carrega (pode vir depois da primeira renderização)
    useEffect(() => {
        if (user) {
            setFormData(prev => ({
                ...prev,
                name: prev.name || user.name || '',
                phone: prev.phone || user.phone || '',
                email: prev.email || user.email || '',
            }))
        }
    }, [user])

    // Salva o estado do agendamento incompleto no localStorage
    useEffect(() => {
        if (id && (services.length > 0 || selectedDate || selectedTime || formData.notes)) {
            const stateToSave = {
                establishmentId: id,
                services: services.map(s => s.id),
                selectedDate: selectedDate instanceof Date ? selectedDate.toISOString() : selectedDate,
                selectedTime,
                formData
            }
            localStorage.setItem('zakys_unfinished_booking', JSON.stringify(stateToSave))
        }
    }, [id, services, selectedDate, selectedTime, formData])

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

    // Em navegadores mobile a aba fica em segundo plano (troca de app, tela
    // bloqueada) enquanto o cliente preenche o formulário; ao voltar, os
    // horários podem ter sido bloqueados pelo estabelecimento nesse meio tempo.
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && selectedDate && establishment) {
                loadAvailableSlots()
            }
        }
        document.addEventListener('visibilitychange', handleVisibilityChange)
        window.addEventListener('focus', handleVisibilityChange)

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            window.removeEventListener('focus', handleVisibilityChange)
        }
    }, [selectedDate, establishment])

    const loadData = async () => {
        setLoading(true)
        try {
            // Get selected services from session or unfinished booking
            const storedServices = sessionStorage.getItem('booking_services')
            const unfinishedStr = localStorage.getItem('zakys_unfinished_booking')
            let serviceIds = []
            let unfinished = null

            if (unfinishedStr) {
                try {
                    const parsed = JSON.parse(unfinishedStr)
                    if (parsed.establishmentId === id) {
                        unfinished = parsed
                        serviceIds = parsed.services || []
                        if (parsed.selectedDate) setSelectedDate(new Date(parsed.selectedDate))
                        if (parsed.selectedTime) setSelectedTime(parsed.selectedTime)
                        if (parsed.formData) setFormData(parsed.formData)
                    }
                } catch (e) {
                    console.error('Error parsing unfinished booking', e)
                }
            } else if (storedServices) {
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
                // Monta a partir dos componentes locais em vez de toISOString() (UTC),
                // que pode virar o dia errado dependendo do fuso horário do dispositivo.
                dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
            }
            const serviceIds = services.map(s => s.id)
            const assignments = JSON.parse(sessionStorage.getItem('booking_assignments') || '[]')
            const slots = await api.getAvailableSlots(id, dateStr, serviceIds, assignments)
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

    const getClosedDates = () => {
        if (!establishment?.scheduleExceptions) return []
        const closedDates = []
        Object.entries(establishment.scheduleExceptions).forEach(([dateStr, exception]) => {
            if (exception.isClosed) {
                closedDates.push(dateStr)
            }
        })
        return closedDates
    }

    const getTotalPrice = () => services.reduce((sum, s) => sum + s.price, 0)
    const getTotalDuration = () => services.reduce((sum, s) => sum + s.duration, 0)

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleReview = (e) => {
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
            setShowLoginPrompt(true)
            return
        }

        setShowReviewModal(true)
    }

    const handleSubmit = async () => {
        setSubmitting(true)

        try {
            // Convert Date object to YYYY-MM-DD string if needed
            let dateStr = selectedDate
            if (selectedDate instanceof Date) {
                // Monta a partir dos componentes locais em vez de toISOString() (UTC),
                // que pode virar o dia errado dependendo do fuso horário do dispositivo.
                dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`
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
            localStorage.removeItem('zakys_unfinished_booking')
            success('Agendamento realizado com sucesso!')
            navigate(`/confirmacao/${appointment.id}`)
        } catch (err) {
            error(err.message || 'Erro ao criar agendamento')
            // O horário selecionado pode ter sido bloqueado/ocupado nesse meio tempo;
            // atualiza a lista para não deixar um horário inválido marcado como disponível.
            loadAvailableSlots()
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
                                <div className="card mb-6 p-4 sm:p-6">
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
                                                        const isRemoving = prev.some(s => s.id === service.id)
                                                        if (isRemoving) {
                                                            return prev.filter(s => s.id !== service.id)
                                                        }
                                                        const updated = [...prev, service]
                                                        // Scroll para o calendário após selecionar um serviço
                                                        setTimeout(() => {
                                                            calendarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                                                        }, 100)
                                                        return updated
                                                    })
                                                }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Step 1: Date */}
                            <div ref={calendarRef} className={`card mb-6 p-3 sm:p-6 ${services.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                                <h2 className="text-lg font-semibold mb-4">📅 Escolha a data</h2>
                                <Calendar
                                    selectedDate={selectedDate}
                                    onSelectDate={setSelectedDate}
                                    minDate={new Date().toISOString().split('T')[0]}
                                    disabledDays={getClosedDays()}
                                    disabledDates={getClosedDates()}
                                />
                            </div>

                            {/* Step 2: Time */}
                            {selectedDate && (
                                <div className="card mb-6 p-3 sm:p-6">
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
                                <div className="card mb-6 p-4 sm:p-6">
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
                                    type="button"
                                    className="btn btn-primary btn-lg w-full"
                                    onClick={handleReview}
                                >
                                    Revisar agendamento
                                </button>
                            )}
                        </form>
                    </div>

                    {/* Summary Sidebar */}
                    <div>
                        <div className="card p-4 sm:p-6" style={{ position: 'sticky', top: '5rem' }}>
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

            {/* Review Modal */}
            {showReviewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-base-100 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
                        <div className="p-6 text-center">
                            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                                <CalendarIcon size={32} />
                            </div>
                            <h2 className="text-2xl font-bold mb-2">Quase lá!</h2>
                            <p className="text-muted mb-6">Confirme os dados do seu agendamento abaixo.</p>

                            <div className="bg-base-200 rounded-xl p-4 text-left mb-6 space-y-3">
                                <div>
                                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Local</span>
                                    <p className="font-medium">{establishment?.name}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Data e Hora</span>
                                    <p className="font-medium capitalize">{formatDate(selectedDate)} às {selectedTime}</p>
                                </div>
                                <div>
                                    <span className="text-xs text-muted uppercase font-bold tracking-wider">Serviços ({services.length})</span>
                                    <p className="font-medium">{services.map(s => s.name).join(', ')}</p>
                                </div>
                                <div className="pt-3 mt-3 border-t border-base-300 flex justify-between items-center">
                                    <span className="text-sm font-bold">Total a pagar:</span>
                                    <span className="text-xl font-black text-primary">R$ {getTotalPrice().toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    className="btn btn-primary btn-lg w-full text-lg shadow-lg shadow-primary/20"
                                    onClick={handleSubmit}
                                    disabled={submitting}
                                >
                                    {submitting ? 'Confirmando...' : 'Confirmar Agendamento'}
                                </button>
                                <button
                                    className="btn btn-ghost"
                                    onClick={() => setShowReviewModal(false)}
                                    disabled={submitting}
                                >
                                    Voltar e editar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Login Prompt Modal */}
            {showLoginPrompt && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-base-100 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl p-6 text-center animate-in fade-in zoom-in duration-200">
                        <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <UserIcon size={32} />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Identifique-se</h2>
                        <p className="text-muted mb-6 text-sm">Para concluir o agendamento, você precisa entrar na sua conta ou criar uma nova.</p>
                        
                        <div className="flex flex-col gap-3">
                            <button 
                                className="btn btn-primary w-full"
                                onClick={() => {
                                    sessionStorage.setItem('redirect_after_login', `/agendar/${id}`)
                                    navigate('/entrar')
                                }}
                            >
                                Fazer Login
                            </button>
                            <button 
                                className="btn w-full"
                                style={{ backgroundColor: 'var(--base-200)' }}
                                onClick={() => {
                                    sessionStorage.setItem('redirect_after_login', `/agendar/${id}`)
                                    navigate('/cadastro')
                                }}
                            >
                                Criar Conta
                            </button>
                            <button 
                                className="btn btn-ghost w-full mt-2"
                                onClick={() => setShowLoginPrompt(false)}
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
