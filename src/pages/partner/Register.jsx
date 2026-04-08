import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../contexts/ToastContext'
import { validateCNPJ, maskCNPJ, lookupCNPJ, validateCPF, maskCPF, lookupCEP } from '../../services/validation'
import GooglePlacesInput from '../../components/GooglePlacesInput'

export default function PartnerRegister() {
    const navigate = useNavigate()
    const { success, error, info } = useToast()

    const [documentType, setDocumentType] = useState('cnpj') // 'cnpj' | 'cpf'
    const [formData, setFormData] = useState({
        document: '', // cnpj or cpf
        razaoSocial: '', // or Nome Completo
        nomeFantasia: '', // or Nome do Negócio
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
        cep: '',
        address: '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
        locationType: 'fixed', // 'fixed' | 'domicile' | 'both'
        serviceRadius: '', // in km
        lat: null,
        lng: null
    })
    const [loading, setLoading] = useState(false)
    const [loadingCnpj, setLoadingCnpj] = useState(false)

    const handleChange = (e) => {
        const { name, value } = e.target

        if (name === 'document') {
            const masked = documentType === 'cnpj' ? maskCNPJ(value) : maskCPF(value)
            setFormData(prev => ({ ...prev, [name]: masked }))
        } else if (name === 'cep') {
            const masked = value.replace(/[^\d]/g, '').slice(0, 8)
            setFormData(prev => ({ ...prev, [name]: masked }))

            if (masked.length === 8) {
                handleCepLookup(masked)
            }
        } else {
            setFormData(prev => ({ ...prev, [name]: value }))
        }
    }

    const handlePlaceSelected = (place) => {
        if (!place.geometry) return

        const addressComponents = place.address_components
        const getComponent = (type) => {
            const comp = addressComponents.find(c => c.types.includes(type))
            return comp ? comp.long_name : ''
        }
        const getShortComponent = (type) => {
            const comp = addressComponents.find(c => c.types.includes(type))
            return comp ? comp.short_name : ''
        }

        const street = getComponent('route')
        const number = getComponent('street_number')
        const neighborhood = getComponent('sublocality_level_1') || getComponent('neighborhood') || getComponent('sublocality')
        const city = getComponent('administrative_area_level_2') || getComponent('locality')
        const state = getShortComponent('administrative_area_level_1')
        const postCode = getComponent('postal_code')

        setFormData(prev => ({
            ...prev,
            nomeFantasia: place.name || prev.nomeFantasia,
            razaoSocial: place.name || prev.razaoSocial, // Default razao social to name if empty
            address: street || prev.address,
            number: number || prev.number,
            neighborhood: neighborhood || prev.neighborhood,
            city: city || prev.city,
            state: state || prev.state,
            cep: postCode ? postCode.replace(/[^\d]/g, '') : prev.cep,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
        }))

        info('Dados do estabelecimento carregados do Google')
    }

    const handleCepLookup = async (cep) => {
        try {
            const data = await lookupCEP(cep)
            setFormData(prev => ({
                ...prev,
                address: data.logradouro,
                neighborhood: data.bairro,
                city: data.cidade,
                state: data.uf
            }))
            info('Endereço preenchido pelo CEP')
        } catch (err) {
            console.error('Erro ao buscar CEP:', err)
        }
    }

    const handleDocumentTypeChange = (type) => {
        setDocumentType(type)
        setFormData(prev => ({
            ...prev,
            document: '',
            razaoSocial: '',
            nomeFantasia: '',
            // Reset location defaults based on type? Not necessarily
        }))
    }

    const handleCnpjLookup = async () => {
        if (documentType === 'cpf') return // No lookup for CPF

        if (!formData.document || formData.document.length < 18) {
            error('Digite o CNPJ completo')
            return
        }

        if (!validateCNPJ(formData.document)) {
            error('CNPJ inválido')
            return
        }

        setLoadingCnpj(true)
        try {
            const data = await lookupCNPJ(formData.document)
            setFormData(prev => ({
                ...prev,
                razaoSocial: data.razaoSocial,
                nomeFantasia: data.nomeFantasia || prev.nomeFantasia,
                address: data.endereco.logradouro,
                number: data.endereco.numero,
                neighborhood: data.endereco.bairro,
                city: data.endereco.cidade,
                state: data.endereco.uf,
                cep: data.endereco.cep,
            }))
            info('Dados do CNPJ carregados')
        } catch (err) {
            error(err.message)
        } finally {
            setLoadingCnpj(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()

        // Validation
        if (documentType === 'cnpj' && !validateCNPJ(formData.document)) {
            error('CNPJ inválido')
            return
        }
        if (documentType === 'cpf' && !validateCPF(formData.document)) {
            error('CPF inválido')
            return
        }

        if (formData.password !== formData.confirmPassword) {
            error('As senhas não coincidem')
            return
        }

        if ((formData.locationType === 'domicile' || formData.locationType === 'both') && !formData.serviceRadius) {
            error('Informe o raio de atendimento')
            return
        }

        setLoading(true)

        // Prepare data package
        const dataToSave = {
            ...formData,
            documentType
        }

        // Save partner data to session for next step
        sessionStorage.setItem('partner_register', JSON.stringify(dataToSave))

        success('Dados salvos! Agora selecione os serviços.')
        navigate('/parceiro/servicos')

        setLoading(false)
    }

    return (
        <div className="py-12">
            <div className="container" style={{ maxWidth: '700px' }}>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">Cadastrar Estabelecimento</h1>
                    <p className="text-secondary">Preencha os dados para começar</p>

                    {/* Progress */}
                    <div className="flex justify-center gap-4 mt-6">
                        <div className="flex items-center gap-2">
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--gradient-primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>1</div>
                            <span className="text-sm font-medium">Dados</span>
                        </div>
                        <div style={{ width: '3rem', height: '2px', background: 'var(--border-color)', alignSelf: 'center' }}></div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>2</div>
                            <span className="text-sm text-muted">Serviços</span>
                        </div>
                        <div style={{ width: '3rem', height: '2px', background: 'var(--border-color)', alignSelf: 'center' }}></div>
                        <div className="flex items-center gap-2">
                            <div style={{ width: '2rem', height: '2rem', borderRadius: '50%', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>3</div>
                            <span className="text-sm text-muted">Horários</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Document Type Selection */}
                    <div className="flex justify-center mb-6">
                        <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                                type="button"
                                className={`px-4 py-2 rounded-md transition-all ${documentType === 'cnpj' ? 'bg-white shadow text-primary font-bold' : 'text-gray-500'}`}
                                onClick={() => handleDocumentTypeChange('cnpj')}
                            >
                                Pessoa Jurídica (CNPJ)
                            </button>
                            <button
                                type="button"
                                className={`px-4 py-2 rounded-md transition-all ${documentType === 'cpf' ? 'bg-white shadow text-primary font-bold' : 'text-gray-500'}`}
                                onClick={() => handleDocumentTypeChange('cpf')}
                            >
                                Pessoa Física (CPF)
                            </button>
                        </div>
                    </div>

                    {/* Business Data Section */}
                    <div className="card mb-6" style={{ padding: '1.5rem' }}>
                        <h2 className="text-lg font-semibold mb-2">
                            {documentType === 'cnpj' ? '📋 Dados da Empresa' : '👤 Dados Pessoais'}
                        </h2>

                        {/* Google Places Search */}
                        <div className="form-group mb-6 pb-6 border-b">
                            <label className="form-label text-primary font-bold">🔍 Busca Rápida (Google Maps)</label>
                            <GooglePlacesInput
                                onPlaceSelected={handlePlaceSelected}
                                className="form-input"
                                placeholder="Digite o nome do seu estabelecimento..."
                            />
                            <p className="form-helper">Encontre seu negócio no Google para preencher os dados automaticamente</p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">{documentType === 'cnpj' ? 'CNPJ *' : 'CPF *'}</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    name="document"
                                    className="form-input"
                                    placeholder={documentType === 'cnpj' ? "00.000.000/0000-00" : "000.000.000-00"}
                                    value={formData.document}
                                    onChange={handleChange}
                                    maxLength={documentType === 'cnpj' ? 18 : 14}
                                    required
                                    style={{ flex: 1 }}
                                />
                                {documentType === 'cnpj' && (
                                    <button
                                        type="button"
                                        onClick={handleCnpjLookup}
                                        className="btn btn-secondary"
                                        disabled={loadingCnpj}
                                    >
                                        {loadingCnpj ? '...' : '🔍 Buscar'}
                                    </button>
                                )}
                            </div>
                            {documentType === 'cnpj' && (
                                <p className="form-helper">Digite o CNPJ e clique em buscar para preencher automaticamente</p>
                            )}
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label className="form-label" style={{ color: 'var(--primary-500)', fontWeight: 'bold' }}>
                                    {documentType === 'cnpj' ? 'Nome Fantasia *' : 'Nome do Negócio *'}
                                </label>
                                <input
                                    type="text"
                                    name="nomeFantasia"
                                    className="form-input"
                                    placeholder={documentType === 'cnpj' ? "Como seu estabelecimento é conhecido" : "Ex: Estética da Silva"}
                                    value={formData.nomeFantasia}
                                    onChange={handleChange}
                                    required
                                    style={{ borderColor: 'var(--primary-300)' }}
                                />
                                <p className="form-helper" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                    Este é o nome que aparecerá para os clientes (Ex: Barbearia do Isaac)
                                </p>
                            </div>
                            <div className="form-group">
                                <label className="form-label">
                                    {documentType === 'cnpj' ? 'Razão Social *' : 'Nome Completo *'}
                                </label>
                                <input
                                    type="text"
                                    name="razaoSocial"
                                    className="form-input"
                                    value={formData.razaoSocial}
                                    onChange={handleChange}
                                    required
                                />
                                <p className="form-helper" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                                    Nome que consta no documento (CPF/CNPJ)
                                </p>
                            </div>
                        </div>

                        {/* Location Type & Radius */}
                        <div className="grid sm:grid-cols-2 gap-4 pt-4 border-t mt-4">
                            <div className="form-group">
                                <label className="form-label">Tipo de Atendimento *</label>
                                <select
                                    name="locationType"
                                    className="form-input"
                                    value={formData.locationType}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="fixed">Apenas Local Fixo</option>
                                    <option value="domicile">Apenas Domicílio</option>
                                    <option value="both">Fixo e Domicílio</option>
                                </select>
                            </div>
                            {(formData.locationType === 'domicile' || formData.locationType === 'both') && (
                                <div className="form-group">
                                    <label className="form-label">Raio de Atendimento (km) *</label>
                                    <input
                                        type="number"
                                        name="serviceRadius"
                                        className="form-input"
                                        placeholder="Ex: 10"
                                        onFocus={(e) => e.target.select()}
                                        value={formData.serviceRadius}
                                        onChange={handleChange}
                                        required
                                        min="1"
                                    />
                                    <p className="form-helper">Distância máxima que você atende</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contact Section */}
                    <div className="card mb-6" style={{ padding: '1.5rem' }}>
                        <h2 className="text-lg font-semibold mb-4">📞 Contato</h2>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label className="form-label">E-mail *</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="form-input"
                                    placeholder="contato@empresa.com"
                                    value={formData.email}
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
                                    placeholder="(11) 99999-9999"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-4">
                            <div className="form-group">
                                <label className="form-label">Senha de acesso *</label>
                                <input
                                    type="password"
                                    name="password"
                                    className="form-input"
                                    placeholder="Mínimo 6 caracteres"
                                    value={formData.password}
                                    onChange={handleChange}
                                    minLength={6}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Confirmar senha *</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    className="form-input"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address Section - Always required for base location */}
                    <div className="card mb-6" style={{ padding: '1.5rem' }}>
                        <h2 className="text-lg font-semibold mb-4">
                            {formData.locationType === 'domicile' ? '📍 Endereço Base (Não visível publicamente)' : '📍 Endereço do Estabelecimento'}
                        </h2>

                        <div className="grid sm:grid-cols-3 gap-4">
                            <div className="form-group">
                                <label className="form-label">CEP *</label>
                                <input
                                    type="text"
                                    name="cep"
                                    className="form-input"
                                    placeholder="00000-000"
                                    value={formData.cep}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label">Endereço *</label>
                                <input
                                    type="text"
                                    name="address"
                                    className="form-input"
                                    value={formData.address}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="grid sm:grid-cols-4 gap-4">
                            <div className="form-group">
                                <label className="form-label">Número *</label>
                                <input
                                    type="text"
                                    name="number"
                                    className="form-input"
                                    value={formData.number}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Bairro *</label>
                                <input
                                    type="text"
                                    name="neighborhood"
                                    className="form-input"
                                    value={formData.neighborhood}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cidade *</label>
                                <input
                                    type="text"
                                    name="city"
                                    className="form-input"
                                    value={formData.city}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Estado *</label>
                                <input
                                    type="text"
                                    name="state"
                                    className="form-input"
                                    maxLength={2}
                                    value={formData.state}
                                    onChange={handleChange}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-lg w-full"
                        disabled={loading}
                    >
                        {loading ? 'Salvando...' : 'Continuar → Selecionar Serviços'}
                    </button>
                </form>
            </div>
        </div>
    )
}
