import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../contexts/ToastContext'
import * as api from '../../services/api'

export default function PartnerSelectServices() {
    const navigate = useNavigate()
    const { error } = useToast()

    const [allServices, setAllServices] = useState([])
    const [categories, setCategories] = useState([])
    const [selectedServices, setSelectedServices] = useState({})
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const partnerData = sessionStorage.getItem('partner_register')
        if (!partnerData) {
            navigate('/parceiro/cadastro')
            return
        }
        loadData()
    }, [navigate])

    const loadData = async () => {
        setLoading(true)
        try {
            const [servs, cats] = await Promise.all([
                api.getServices(),
                api.getCategories()
            ])
            setAllServices(servs)
            setCategories(cats)
        } catch (err) {
            console.error('Error loading services:', err)
        } finally {
            setLoading(false)
        }
    }

    const toggleService = (service) => {
        setSelectedServices(prev => {
            const newSelected = { ...prev }
            if (newSelected[service.id]) {
                delete newSelected[service.id]
            } else {
                newSelected[service.id] = {
                    ...service,
                    customPrice: service.price,
                    customDuration: service.duration,
                }
            }
            return newSelected
        })
    }

    const updateServicePrice = (serviceId, price) => {
        setSelectedServices(prev => ({
            ...prev,
            [serviceId]: { ...prev[serviceId], customPrice: parseFloat(price) || 0 },
        }))
    }

    const updateServiceDuration = (serviceId, duration) => {
        setSelectedServices(prev => ({
            ...prev,
            [serviceId]: { ...prev[serviceId], customDuration: parseInt(duration) || 0 },
        }))
    }

    const handleContinue = () => {
        if (Object.keys(selectedServices).length === 0) {
            error('Selecione pelo menos um serviço')
            return
        }
        sessionStorage.setItem('partner_services', JSON.stringify(selectedServices))
        navigate('/parceiro/configuracao')
    }

    if (loading) return <div className="container py-16 text-center">Carregando...</div>

    return (
        <div className="py-12">
            <div className="container" style={{ maxWidth: '900px' }}>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Selecione os Serviços</h1>
                    <p className="text-secondary">Escolha os serviços que seu estabelecimento oferece</p>

                    <div className="flex justify-center gap-4 mt-6">
                        <div className="flex items-center gap-2">
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--success-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                            <span className="text-sm text-muted">Dados</span>
                        </div>
                        <div style={{ width: '3rem', height: '2px', background: 'var(--success-500)', alignSelf: 'center' }}></div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--gradient-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</div>
                            <span className="text-sm font-medium">Serviços</span>
                        </div>
                        <div style={{ width: '3rem', height: '2px', background: 'var(--border-color)', alignSelf: 'center' }}></div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--bg-secondary)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>3</div>
                            <span className="text-sm text-muted">Horários</span>
                        </div>
                    </div>
                </div>

                {/* Selected count */}
                <div className="card mb-6" style={{ padding: '1rem', background: 'var(--bg-secondary)' }}>
                    <span className="font-medium">{Object.keys(selectedServices).length}</span>
                    <span className="text-muted"> serviço(s) selecionado(s)</span>
                </div>

                {/* Services by category */}
                {categories.map(category => {
                    const categoryServices = allServices.filter(s => s.categoryId === category.id)
                    if (categoryServices.length === 0) return null

                    return (
                        <div key={category.id} className="mb-8">
                            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                <span>{category.icon}</span>
                                <span>{category.name}</span>
                            </h2>

                            <div className="grid sm:grid-cols-2 gap-3">
                                {categoryServices.map(service => {
                                    const isSelected = !!selectedServices[service.id]
                                    const selectedData = selectedServices[service.id]

                                    return (
                                        <div
                                            key={service.id}
                                            className={`card cursor-pointer ${isSelected ? 'ring-2 ring-primary-500' : ''}`}
                                            style={{ padding: '1rem' }}
                                            onClick={() => toggleService(service)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <div className="font-medium">{service.name}</div>
                                                    <div className="text-sm text-muted">
                                                        {service.duration} min • R$ {service.price.toFixed(2)}
                                                    </div>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => { }}
                                                    style={{
                                                        width: '1.25rem',
                                                        height: '1.25rem',
                                                        accentColor: 'var(--primary-500)',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                            </div>

                                            {isSelected && (
                                                <div className="mt-4 pt-4 flex gap-4" style={{ borderTop: '1px solid var(--border-color)' }} onClick={e => e.stopPropagation()}>
                                                    <div className="flex-1">
                                                        <label className="text-xs text-muted">Seu preço (R$)</label>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            value={selectedData.customPrice}
                                                            onChange={(e) => updateServicePrice(service.id, e.target.value)}
                                                            style={{ padding: '0.5rem' }}
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="text-xs text-muted">Duração (min)</label>
                                                        <input
                                                            type="number"
                                                            className="form-input"
                                                            value={selectedData.customDuration}
                                                            onChange={(e) => updateServiceDuration(service.id, e.target.value)}
                                                            style={{ padding: '0.5rem' }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}

                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/parceiro/cadastro')}
                        className="btn btn-secondary"
                    >
                        ← Voltar
                    </button>
                    <button
                        onClick={handleContinue}
                        className="btn btn-primary btn-lg flex-1"
                        disabled={Object.keys(selectedServices).length === 0}
                    >
                        Continuar →
                    </button>
                </div>
            </div>
        </div>
    )
}
