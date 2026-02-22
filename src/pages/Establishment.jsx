import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import * as api from '../services/api'
import { getImageUrl } from '../services/api'
import { useToast } from '../contexts/ToastContext'
import ServiceCard from '../components/ServiceCard'

export default function Establishment() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { error } = useToast()

    const [establishment, setEstablishment] = useState(null)
    const [services, setServices] = useState([])
    const [categories, setCategories] = useState([])
    const [employees, setEmployees] = useState([])
    const [selectedServices, setSelectedServices] = useState([])
    const [employeePreferences, setEmployeePreferences] = useState({}) // { serviceId: employeeId }
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        loadData()
    }, [id])

    const loadData = async () => {
        setLoading(true)
        try {
            const [est, servs, cats, emps] = await Promise.all([
                api.getEstablishmentById(id),
                api.getEstablishmentServices(id),
                api.getCategories(),
                api.getPublicEmployees(id)
            ])
            setEstablishment(est)
            setServices(servs)
            setCategories(cats)
            setEmployees(emps)
        } catch (err) {
            error('Erro ao carregar estabelecimento')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    const toggleService = (serviceId) => {
        setSelectedServices(prev => {
            if (prev.includes(serviceId)) {
                // Remove service and its employee preference
                setEmployeePreferences(prefs => {
                    const newPrefs = { ...prefs }
                    delete newPrefs[serviceId]
                    return newPrefs
                })
                return prev.filter(id => id !== serviceId)
            }
            return [...prev, serviceId]
        })
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
        return services.filter(s => selectedServices.includes(s.id))
    }

    const getTotalPrice = () => {
        return getSelectedServicesData().reduce((sum, s) => sum + s.price, 0)
    }

    const getTotalDuration = () => {
        return getSelectedServicesData().reduce((sum, s) => sum + s.duration, 0)
    }

    const handleBooking = () => {
        if (selectedServices.length === 0) {
            error('Selecione pelo menos um serviço')
            return
        }
        // Store selected services and employee preferences
        sessionStorage.setItem('booking_services', JSON.stringify(selectedServices))

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

    const getCategoryName = (categoryId) => {
        const cat = categories.find(c => c.id === categoryId)
        return cat ? cat.name : ''
    }

    const formatWorkingHours = () => {
        if (!establishment?.workingHours) return []
        const days = {
            monday: 'Segunda', tuesday: 'Terça', wednesday: 'Quarta',
            thursday: 'Quinta', friday: 'Sexta', saturday: 'Sábado', sunday: 'Domingo'
        }
        return Object.entries(days).map(([key, label]) => {
            const hours = establishment.workingHours[key]
            return { day: label, hours: hours ? `${hours.open} - ${hours.close}` : 'Fechado' }
        })
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
                            <div className="flex items-center gap-4 text-secondary mb-4">
                                <span className="flex items-center gap-1">
                                    ⭐ <strong>{establishment.rating}</strong> ({establishment.reviewCount} avaliações)
                                </span>
                                <span>📍 {establishment.address}</span>
                            </div>
                            <p className="text-secondary">{establishment.description}</p>
                        </div>

                        {/* Services */}
                        <div className="mb-8">
                            <h2 className="text-xl font-bold mb-4">Serviços disponíveis</h2>

                            {categories.filter(cat => services.some(s => s.categoryId === cat.id)).map(category => (
                                <div key={category.id} className="mb-6">
                                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                                        <span>{category.icon}</span>
                                        {category.name}
                                    </h3>
                                    <div className="flex flex-col gap-2">
                                        {services.filter(s => s.categoryId === category.id).map(service => (
                                            <ServiceCard
                                                key={service.id}
                                                service={service}
                                                selected={selectedServices.includes(service.id)}
                                                onToggle={() => toggleService(service.id)}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Service Images Gallery */}
                        {establishment.serviceImages && establishment.serviceImages.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold mb-4">Galeria de Serviços</h2>
                                <div className="service-images-gallery">
                                    {establishment.serviceImages.map((img, index) => (
                                        <div key={index} className="service-image-item" style={{ cursor: 'pointer' }}>
                                            <img src={getImageUrl(img)} alt={`Serviço ${index + 1}`} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Working Hours */}
                        <div>
                            <h2 className="text-xl font-bold mb-4">Horário de funcionamento</h2>
                            <div className="card" style={{ padding: '1rem' }}>
                                {formatWorkingHours().map(({ day, hours }) => (
                                    <div key={day} className="flex justify-between py-2" style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <span className="text-secondary">{day}</span>
                                        <span className={hours === 'Fechado' ? 'text-muted' : 'font-medium'}>{hours}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Booking Sidebar */}
                    <div>
                        <div className="card" style={{ padding: '1.5rem', position: 'sticky', top: '5rem' }}>
                            <h3 className="text-lg font-bold mb-4">Resumo do agendamento</h3>

                            {selectedServices.length === 0 ? (
                                <p className="text-muted text-center py-8">
                                    Selecione os serviços desejados
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

                            <button
                                onClick={handleBooking}
                                className="btn btn-primary btn-lg w-full"
                                disabled={selectedServices.length === 0}
                            >
                                Continuar agendamento
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
