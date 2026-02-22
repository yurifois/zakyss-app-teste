import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../contexts/ToastContext'
import * as api from '../../services/api'

const DAYS = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
]

export default function PartnerSetup() {
    const navigate = useNavigate()
    const { success, error } = useToast()

    const [partnerData, setPartnerData] = useState(null)
    const [servicesData, setServicesData] = useState(null)
    const [loading, setLoading] = useState(false)

    const [workingHours, setWorkingHours] = useState({
        monday: { enabled: true, open: '09:00', close: '18:00' },
        tuesday: { enabled: true, open: '09:00', close: '18:00' },
        wednesday: { enabled: true, open: '09:00', close: '18:00' },
        thursday: { enabled: true, open: '09:00', close: '18:00' },
        friday: { enabled: true, open: '09:00', close: '18:00' },
        saturday: { enabled: true, open: '09:00', close: '14:00' },
        sunday: { enabled: false, open: '09:00', close: '14:00' },
    })

    useEffect(() => {
        const partner = sessionStorage.getItem('partner_register')
        const services = sessionStorage.getItem('partner_services')

        if (!partner) {
            navigate('/parceiro/cadastro')
            return
        }
        if (!services) {
            navigate('/parceiro/servicos')
            return
        }

        setPartnerData(JSON.parse(partner))
        setServicesData(JSON.parse(services))
    }, [navigate])

    const toggleDay = (day) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day].enabled },
        }))
    }

    const updateHours = (day, field, value) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value },
        }))
    }

    const handleSubmit = async () => {
        setLoading(true)

        try {
            // Format working hours
            const formattedHours = {}
            Object.entries(workingHours).forEach(([day, data]) => {
                formattedHours[day] = data.enabled
                    ? { open: data.open, close: data.close }
                    : null
            })

            // Get category IDs from selected services
            const categorySet = new Set()
            Object.values(servicesData).forEach(service => {
                categorySet.add(service.categoryId)
            })

            // Create establishment
            const servicePreferences = {}
            Object.values(servicesData).forEach(s => {
                servicePreferences[s.id] = {
                    price: parseFloat(s.customPrice),
                    duration: parseInt(s.customDuration)
                }
            })

            const establishment = await api.createEstablishment({
                name: partnerData.nomeFantasia,
                description: `${partnerData.nomeFantasia} - ${partnerData.documentType === 'cpf' ? 'Profissional' : 'Empresa'}`,
                cnpj: partnerData.document, // Sending document as cnpj for backward compatibility if backend expects it, or add new field
                document: partnerData.document,
                documentType: partnerData.documentType,
                locationType: partnerData.locationType,
                serviceRadius: partnerData.serviceRadius ? parseInt(partnerData.serviceRadius) : null,
                phone: partnerData.phone,
                email: partnerData.email,
                address: `${partnerData.address}, ${partnerData.number}`,
                city: partnerData.city,
                state: partnerData.state,
                zipCode: partnerData.cep,
                lat: -15.7942 + (Math.random() - 0.5) * 0.1,
                lng: -47.8822 + (Math.random() - 0.5) * 0.1,
                image: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800',
                images: ['https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800'],
                categories: Array.from(categorySet),
                services: Object.values(servicesData).map(s => s.id),
                servicePreferences,
                workingHours: formattedHours,
            })

            // Create admin user
            await api.adminRegister({
                name: `Admin ${partnerData.nomeFantasia}`,
                email: partnerData.email,
                password: partnerData.password,
                establishmentId: establishment.id,
            })

            // Clear session storage
            sessionStorage.removeItem('partner_register')
            sessionStorage.removeItem('partner_services')

            success('Estabelecimento cadastrado com sucesso!')
            navigate('/admin')
        } catch (err) {
            error(err.message || 'Erro ao cadastrar estabelecimento')
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

    if (!partnerData || !servicesData) {
        return <div className="container py-16 text-center">Carregando...</div>
    }

    return (
        <div className="py-12">
            <div className="container" style={{ maxWidth: '700px' }}>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Configure os Horários</h1>
                    <p className="text-secondary">Defina os dias e horários de funcionamento</p>

                    {/* Progress */}
                    <div className="flex justify-center gap-4 mt-6">
                        <div className="flex items-center gap-2">
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--success-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                            <span className="text-sm text-muted">Dados</span>
                        </div>
                        <div style={{ width: '3rem', height: '2px', background: 'var(--success-500)', alignSelf: 'center' }}></div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--success-500)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
                            <span className="text-sm text-muted">Serviços</span>
                        </div>
                        <div style={{ width: '3rem', height: '2px', background: 'var(--success-500)', alignSelf: 'center' }}></div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--gradient-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</div>
                            <span className="text-sm font-medium">Horários</span>
                        </div>
                    </div>
                </div>

                {/* Summary Card */}
                <div className="card mb-6" style={{ padding: '1.5rem', background: 'var(--bg-secondary)' }}>
                    <h3 className="font-semibold mb-2">{partnerData.nomeFantasia}</h3>
                    <p className="text-sm text-secondary mb-1">
                        {partnerData.documentType === 'cpf' ? 'CPF' : 'CNPJ'}: {partnerData.document}
                    </p>
                    <p className="text-sm text-secondary">{Object.keys(servicesData).length} serviço(s) selecionado(s)</p>
                </div>

                {/* Working Hours */}
                <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 className="text-lg font-semibold mb-4">🕐 Horários de Funcionamento</h2>

                    {DAYS.map(({ key, label }) => {
                        const dayData = workingHours[key]

                        return (
                            <div
                                key={key}
                                className="flex items-center gap-4 py-3"
                                style={{ borderBottom: key !== 'sunday' ? '1px solid var(--border-color)' : 'none' }}
                            >
                                <label className="flex items-center gap-3 cursor-pointer" style={{ width: '180px' }}>
                                    <input
                                        type="checkbox"
                                        checked={dayData.enabled}
                                        onChange={() => toggleDay(key)}
                                        style={{
                                            width: '1.25rem',
                                            height: '1.25rem',
                                            accentColor: 'var(--primary-500)',
                                            cursor: 'pointer'
                                        }}
                                    />
                                    <span className={dayData.enabled ? 'font-medium' : 'text-muted'}>{label}</span>
                                </label>

                                {dayData.enabled ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="time"
                                            value={dayData.open}
                                            onChange={(e) => updateHours(key, 'open', e.target.value)}
                                            className="form-input"
                                            style={{ width: '120px', padding: '0.5rem' }}
                                        />
                                        <span className="text-muted">até</span>
                                        <input
                                            type="time"
                                            value={dayData.close}
                                            onChange={(e) => updateHours(key, 'close', e.target.value)}
                                            className="form-input"
                                            style={{ width: '120px', padding: '0.5rem' }}
                                        />
                                    </div>
                                ) : (
                                    <span className="text-muted">Fechado</span>
                                )}
                            </div>
                        )
                    })}
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/parceiro/servicos')}
                        className="btn btn-secondary"
                    >
                        ← Voltar
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="btn btn-primary btn-lg flex-1"
                        disabled={loading}
                    >
                        {loading ? 'Finalizando...' : '✓ Finalizar Cadastro'}
                    </button>
                </div>
            </div>
        </div>
    )
}
