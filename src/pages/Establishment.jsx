import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import * as api from '../services/api'
import { getImageUrl } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import EscolhaAgenda from '../components/EscolhaAgenda'
import { toDateString } from '../utils/schedule'
import EstablishmentLocationCard from '../components/EstablishmentLocationCard'
import { ArrowLeft, Star, MapPin, X } from 'lucide-react'
export default function Establishment() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { error } = useToast()

    const [establishment, setEstablishment] = useState(null)
    const [services, setServices] = useState([])
    const [employees, setEmployees] = useState([])
    const [selectedServices, setSelectedServices] = useState([])
    const [bookingDate, setBookingDate] = useState(null)
    const [bookingTime, setBookingTime] = useState(null)
    const [employeePreferences, setEmployeePreferences] = useState({}) // { serviceId: employeeId }
    const [loading, setLoading] = useState(true)
    const [expandedImage, setExpandedImage] = useState(null)
    const [showReviewsModal, setShowReviewsModal] = useState(false)
    const [reviews, setReviews] = useState([])
    const [loadingReviews, setLoadingReviews] = useState(false)

    useEffect(() => {
        loadData()
        // Save as redirect target for auth
        sessionStorage.setItem('redirect_after_login', `/estabelecimento/${id}`)
    }, [id])

    const loadData = async () => {
        setLoading(true)
        try {
            const [est, servs, emps] = await Promise.all([
                api.getEstablishmentById(id),
                api.getEstablishmentServices(id),
                api.getPublicEmployees(id)
            ])
            setEstablishment(est)
            setServices(servs)
            setEmployees(emps)
        } catch (err) {
            error('Erro ao carregar estabelecimento')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }


    const setEmployeeForService = (serviceId, employeeId) => {
        setEmployeePreferences(prev => ({
            ...prev,
            [serviceId]: employeeId ? parseInt(employeeId) : null
        }))
    }

    const getQualifiedEmployees = (serviceId) => {
        return employees.filter(emp => (emp.services || []).includes(serviceId))
    }

    const getSelectedServicesData = () => {
        // a etapa 3 já entrega nome, preço e duração de cada serviço
        return selectedServices
    }

    const getTotalPrice = () => {
        return getSelectedServicesData().reduce((sum, s) => sum + s.price, 0)
    }

    const getTotalDuration = () => {
        return getSelectedServicesData().reduce((sum, s) => sum + s.duration, 0)
    }

    const handleOpenReviews = async () => {
        setShowReviewsModal(true)
        setLoadingReviews(true)
        try {
            const data = await api.getEstablishmentReviews(id)
            setReviews(data || [])
        } catch (err) {
            console.error('Error loading reviews:', err)
        } finally {
            setLoadingReviews(false)
        }
    }

    const handleBooking = () => {
        // Serviço agora é escolhido DENTRO do agendamento, depois de dia e
        // horário — só ali dá pra saber o que cabe na agenda. Aqui a lista é
        // vitrine (preços): a pré-seleção segue como sugestão e é revalidada
        // contra o horário escolhido.
        sessionStorage.setItem('booking_services', JSON.stringify(selectedServices.map(sv => sv.id)))
        sessionStorage.setItem('booking_date', toDateString(bookingDate) || '')
        sessionStorage.setItem('booking_time', bookingTime || '')

        // Build assignments array
        const assignments = Object.entries(employeePreferences)
            .filter(([_, empId]) => empId !== null)
            .map(([serviceId, employeeId]) => ({
                serviceId: parseInt(serviceId),
                employeeId
            }))
        sessionStorage.setItem('booking_assignments', JSON.stringify(assignments))

        navigate(`/agendar/${id}`)
    }



    if (loading) {
        return (
            <div className="container py-8">
                <div className="skeleton" style={{ height: '300px', marginBottom: '2rem' }}></div>
                <div className="skeleton" style={{ height: '2rem', width: '50%', marginBottom: '1rem' }}></div>
                <div className="skeleton" style={{ height: '1rem', width: '70%' }}></div>
            </div>
        )
    }

    if (!establishment) {
        return (
            <div className="container py-16 text-center">
                <h2>Estabelecimento não encontrado</h2>
                <Link to="/buscar" className="btn btn-primary mt-4">Voltar para busca</Link>
            </div>
        )
    }

    return (
        <div className="py-8">
            <div className="container">
                <button onClick={() => navigate(-1)} className="btn btn-ghost btn-sm mb-4 flex items-center gap-2">
                    <ArrowLeft size={16} />
                    Voltar
                </button>
                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Main Content */}
                    <div className="lg:col-span-2">
                        {/* Header Image */}
                        <div style={{ position: 'relative', borderRadius: '1rem', overflow: 'hidden', marginBottom: '2rem' }}>
                            <img
                                src={getImageUrl(establishment.image)}
                                alt={establishment.name}
                                style={{ width: '100%', height: '300px', objectFit: 'cover' }}
                            />
                        </div>

                        {/* Info */}
                        <div className="mb-8">
                            <h1 className="text-3xl font-bold mb-2">{establishment.name}</h1>
                            <div className="flex flex-wrap items-center gap-6 text-secondary mb-6">
                                <span className="flex items-center gap-2">
                                    <Star size={20} className="text-yellow-500 fill-yellow-500" />
                                    <strong>{establishment.rating}</strong>
                                    <span className="text-muted">({establishment.reviewCount} avaliações)</span>
                                    <button
                                        onClick={handleOpenReviews}
                                        style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit', color: 'var(--primary-400)' }}
                                    >
                                        Ver avaliações
                                    </button>
                                </span>
                                <span className="flex items-center gap-2">
                                    <MapPin size={20} className="text-primary" />
                                    {establishment.address}
                                </span>
                            </div>

                            {(establishment.accessible || establishment.parking) && (
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {establishment.accessible && <span className="badge">♿ Acessível</span>}
                                    {establishment.parking && <span className="badge">🅿️ Estacionamento</span>}
                                </div>
                            )}

                            <p className="text-secondary mb-4">{establishment.description}</p>

                            <EstablishmentLocationCard establishment={establishment} />
                        </div>

                        {/* As três escolhas na ordem que a agenda exige: dia,
                            horário e só então serviço. Antes o serviço vinha
                            primeiro, então nada podia ser validado contra a
                            agenda — dava pra escolher o que não cabia. */}
                        <div className="mb-8">
                            <h2 className="text-xl font-bold mb-4">Agende seu horário</h2>
                            <EscolhaAgenda
                                establishmentId={id}
                                establishment={establishment}
                                servicosVitrine={services}
                                date={bookingDate}
                                onDateChange={setBookingDate}
                                time={bookingTime}
                                onTimeChange={setBookingTime}
                                services={selectedServices}
                                onServicesChange={setSelectedServices}
                                onServicoRemovido={(nomes, horario) =>
                                    error(`${nomes} não cabe no horário ${horario}. Escolha outro serviço ou horário.`)}
                            />
                        </div>

                        {/* Service Images Gallery */}
                        {establishment.serviceImages && establishment.serviceImages.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold mb-4">Galeria de Serviços</h2>
                                <div className="service-images-gallery">
                                    {establishment.serviceImages.map((img, index) => (
                                        <div
                                            key={index}
                                            className="service-image-item"
                                            style={{ cursor: 'pointer' }}
                                            onClick={() => setExpandedImage(img)}
                                        >
                                            <img src={getImageUrl(img)} alt={`Serviço ${index + 1}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}


                    </div>

                    {/* Booking Sidebar */}
                    <div>
                        <div className="card" style={{ padding: '1.5rem', position: 'sticky', top: '5rem' }}>
                            <h3 className="text-lg font-bold mb-4">Resumo do agendamento</h3>

                            {(bookingDate || bookingTime) && (
                                <div className="text-sm mb-4" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                                    {bookingDate && <div>📅 {new Date(`${toDateString(bookingDate)}T12:00:00`).toLocaleDateString('pt-BR')}</div>}
                                    {bookingTime && <div>🕐 {bookingTime}</div>}
                                </div>
                            )}

                            {selectedServices.length === 0 ? (
                                <p className="text-muted text-center py-8">
                                    Siga as etapas ao lado: primeiro o dia, depois o horário
                                    e só então o serviço.
                                </p>
                            ) : (
                                <>
                                    <div className="mb-4">
                                        {getSelectedServicesData().map(service => {
                                            const qualifiedEmployees = getQualifiedEmployees(service.id)
                                            return (
                                                <div key={service.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem', marginBottom: '0.75rem' }}>
                                                    <div className="flex justify-between">
                                                        <span>{service.name}</span>
                                                        <span>R$ {service.price.toFixed(2)}</span>
                                                    </div>
                                                    {/* Employee Selection */}
                                                    <div className="mt-2">
                                                        <select
                                                            className="form-select"
                                                            style={{ fontSize: '0.875rem', padding: '0.4rem 0.75rem' }}
                                                            value={employeePreferences[service.id] || ''}
                                                            onChange={(e) => setEmployeeForService(service.id, e.target.value)}
                                                        >
                                                            <option value="">👤 Qualquer funcionário</option>
                                                            {qualifiedEmployees.length > 0 ? (
                                                                qualifiedEmployees.map(emp => (
                                                                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                                ))
                                                            ) : (
                                                                <option disabled>Sem funcionários qualificados</option>
                                                            )}
                                                        </select>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>

                                    <div className="flex justify-between font-bold mb-2">
                                        <span>Total</span>
                                        <span className="text-gradient">R$ {getTotalPrice().toFixed(2)}</span>
                                    </div>
                                    <div className="text-sm text-muted mb-4">
                                        Duração estimada: {getTotalDuration()} min
                                    </div>
                                </>
                            )}

                            {/* Só libera quando as três etapas foram cumpridas */}
                            <button
                                onClick={handleBooking}
                                disabled={!bookingDate || !bookingTime || selectedServices.length === 0}
                                className="btn btn-primary btn-lg w-full"
                            >
                                {!bookingDate ? 'Escolha o dia'
                                    : !bookingTime ? 'Escolha o horário'
                                    : selectedServices.length === 0 ? 'Escolha o serviço'
                                    : 'Continuar agendamento'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Lightbox: expande a imagem clicada da galeria */}
            {expandedImage && (
                <div
                    className="modal-backdrop"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}
                    onClick={() => setExpandedImage(null)}
                >
                    <img
                        src={getImageUrl(expandedImage)}
                        alt="Imagem ampliada"
                        style={{ maxWidth: '100%', maxHeight: '90vh', borderRadius: '0.75rem' }}
                        onClick={e => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Modal de avaliações escritas */}
            {showReviewsModal && (
                <div
                    className="modal-backdrop"
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}
                    onClick={() => setShowReviewsModal(false)}
                >
                    <div
                        className="card"
                        style={{ width: '100%', maxWidth: '32rem', maxHeight: '80vh', overflow: 'auto', padding: '1.5rem' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Avaliações</h2>
                            <button
                                onClick={() => setShowReviewsModal(false)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {loadingReviews ? (
                            <p className="text-muted text-center py-8">Carregando...</p>
                        ) : reviews.length === 0 ? (
                            <p className="text-muted text-center py-8">Ainda não há avaliações escritas para este estabelecimento.</p>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {reviews.map(review => (
                                    <div key={review.id} style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                                        <div className="flex justify-between items-center mb-1">
                                            <strong>{review.name}</strong>
                                            <div className="flex">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <Star
                                                        key={star}
                                                        size={14}
                                                        className={star <= review.rating ? 'text-yellow-500 fill-yellow-500' : 'text-muted'}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-sm text-secondary">{review.comment}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
