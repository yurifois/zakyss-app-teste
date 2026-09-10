import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import * as api from '../services/api'
import { getImageUrl } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import EscolhaAgenda from '../components/EscolhaAgenda'
import { toDateString } from '../utils/schedule'
import EstablishmentLocationCard from '../components/EstablishmentLocationCard'
import { ArrowLeft, Star, MapPin, X } from 'lucide-react'
const Passo = ({ numero, rotulo, valor }) => (
    <span
        className="badge"
        style={{ opacity: valor ? 1 : 0.5, border: `1px solid ${valor ? 'var(--primary-500)' : 'var(--border-color)'}` }}
    >
        {valor ? '✓' : numero} {rotulo}{valor ? `: ${valor}` : ''}
    </span>
)

export default function Establishment() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { error } = useToast()

    const [establishment, setEstablishment] = useState(null)
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
            // A lista de serviços vem junto com a agenda do dia, já filtrada
            // pelo que cabe no horário — não precisa ser buscada aqui.
            const [est, emps] = await Promise.all([
                api.getEstablishmentById(id),
                api.getPublicEmployees(id)
            ])
            setEstablishment(est)
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
                {/* Identidade enxuta de propósito: o primeiro passo do
                    agendamento precisa aparecer sem o cliente rolar a tela. */}
                <div className="card mb-6" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <img
                        src={getImageUrl(establishment.image)}
                        alt={establishment.name}
                        style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '0.75rem', flexShrink: 0 }}
                    />
                    <div style={{ flex: '1 1 16rem', minWidth: 0 }}>
                        <h1 className="text-2xl font-bold mb-1" style={{ wordBreak: 'break-word' }}>{establishment.name}</h1>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
                            <span className="flex items-center gap-1">
                                <Star size={16} className="text-yellow-500 fill-yellow-500" />
                                <strong>{establishment.rating}</strong>
                                <span className="text-muted">({establishment.reviewCount})</span>
                                <button
                                    onClick={handleOpenReviews}
                                    style={{ background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', padding: 0, font: 'inherit', color: 'var(--primary-400)' }}
                                >
                                    Ver avaliações
                                </button>
                            </span>
                            <span className="flex items-center gap-1" style={{ minWidth: 0 }}>
                                <MapPin size={16} className="text-primary" />
                                {establishment.address}
                            </span>
                        </div>
                        {(establishment.accessible || establishment.parking) && (
                            <div className="flex flex-wrap gap-2 mt-2">
                                {establishment.accessible && <span className="badge">♿ Acessível</span>}
                                {establishment.parking && <span className="badge">🅿️ Estacionamento</span>}
                            </div>
                        )}
                    </div>
                </div>

                {/* O agendamento é o conteúdo principal da página. As três
                    etapas destravam em ordem porque só depois do dia e do
                    horário dá pra saber quais serviços cabem na agenda. */}
                <h2 className="text-xl font-bold mb-3">Agende seu horário</h2>
                <div className="flex flex-wrap gap-2 mb-4">
                    <Passo numero="1" rotulo="Dia" valor={bookingDate ? new Date(`${toDateString(bookingDate)}T12:00:00`).toLocaleDateString('pt-BR') : null} />
                    <Passo numero="2" rotulo="Serviço" valor={selectedServices.length > 0 ? `${selectedServices.length} escolhido(s)` : null} />
                    <Passo numero="3" rotulo="Horário" valor={bookingTime} />
                </div>

                <EscolhaAgenda
                    establishmentId={id}
                    establishment={establishment}
                    date={bookingDate}
                    onDateChange={setBookingDate}
                    time={bookingTime}
                    onTimeChange={setBookingTime}
                    services={selectedServices}
                    onServicesChange={setSelectedServices}
                    onAviso={error}
                />

                {/* Resumo só existe depois que há escolha: a página não abre
                    com uma caixa explicando o que o cliente tem que fazer. */}
                {bookingDate && (
                    <div className="card mb-8 p-3 sm:p-6">
                        <h3 className="text-lg font-bold mb-3">Resumo</h3>
                        <div className="text-sm mb-3">
                            <div>📅 {new Date(`${toDateString(bookingDate)}T12:00:00`).toLocaleDateString('pt-BR')}</div>
                            {bookingTime && <div>🕐 {bookingTime}</div>}
                        </div>

                        {selectedServices.length > 0 && (
                            <>
                                <div className="mb-3">
                                    {getSelectedServicesData().map(service => {
                                        const qualifiedEmployees = getQualifiedEmployees(service.id)
                                        return (
                                            <div key={service.id} style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.75rem' }}>
                                                <div className="flex justify-between gap-3">
                                                    <span style={{ minWidth: 0, wordBreak: 'break-word' }}>{service.name}</span>
                                                    <span style={{ flexShrink: 0 }}>R$ {Number(service.price || 0).toFixed(2)}</span>
                                                </div>
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

                                <div className="flex justify-between font-bold mb-1">
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
                            {selectedServices.length === 0 ? 'Escolha o serviço'
                                : !bookingTime ? 'Escolha o horário'
                                : 'Continuar agendamento'}
                        </button>
                    </div>
                )}

                {/* Informações do estabelecimento vêm depois do agendamento:
                    quem chega nesta página quer marcar horário. */}
                {establishment.description && (
                    <div className="mb-8">
                        <h2 className="text-xl font-bold mb-3">Sobre</h2>
                        <p className="text-secondary mb-4">{establishment.description}</p>
                        <EstablishmentLocationCard establishment={establishment} />
                    </div>
                )}

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
