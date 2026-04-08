import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import MarketPriceIndicator from '../../components/MarketPriceIndicator'
export default function AdminServices() {
    const { admin } = useAuth()
    const { success, info } = useToast()

    const [establishment, setEstablishment] = useState(null)
    const [services, setServices] = useState([])
    const [allServices, setAllServices] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [showAddModal, setShowAddModal] = useState(false)

    // Market prices state (Premium feature)
    const [marketPricesData, setMarketPricesData] = useState(null)
    const [isPremium, setIsPremium] = useState(false)

    const [editingService, setEditingService] = useState(null)
    const [editForm, setEditForm] = useState({ name: '', price: '', duration: '', commission: 50 })
    const [isCreatingCustom, setIsCreatingCustom] = useState(false)
    const [customForm, setCustomForm] = useState({ name: '', categoryId: '', price: '', duration: '', commission: 50 })

    useEffect(() => {
        if (admin) {
            loadData()
        }
    }, [admin])

    const loadData = async () => {
        setLoading(true)
        try {
            const [est, allServs, cats] = await Promise.all([
                api.getEstablishmentById(admin.establishmentId),
                api.getServices(admin.establishmentId),
                api.getCategories()
            ])

            setEstablishment(est)
            setAllServices(allServs)
            setCategories(cats)
            setIsPremium(est.plan === 'premium')

            const estServices = allServs.filter(s => est.services.includes(s.id))
            setServices(estServices)

            // Try to load market prices (only works for premium)
            if (est.plan === 'premium') {
                try {
                    const marketData = await api.getMarketPrices(admin.establishmentId)
                    setMarketPricesData(marketData)
                } catch (err) {
                    console.log('Market prices not available:', err.message)
                }
            }
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const getCategory = (categoryId) => {
        return categories.find(c => c.id === categoryId)
    }

    const getServiceDetails = (service) => {
        const prefs = establishment?.servicePreferences?.[service.id]
        return {
            price: prefs?.price ?? service.price,
            duration: prefs?.duration ?? service.duration,
            commission: prefs?.commission ?? 50
        }
    }

    const handleRemoveService = async (serviceId) => {
        try {
            const updatedServices = establishment.services.filter(id => id !== serviceId)
            const updatedPreferences = { ...establishment.servicePreferences }
            delete updatedPreferences[serviceId]

            await api.updateEstablishment(admin.establishmentId, {
                services: updatedServices,
                servicePreferences: updatedPreferences
            })
            loadData()
            info('Serviço removido')
        } catch (error) {
            console.error('Error removing service:', error)
        }
    }

    const handleAddService = async (serviceId) => {
        if (establishment.services.includes(serviceId)) {
            info('Este serviço já está na lista')
            return
        }

        try {
            const updatedServices = [...establishment.services, serviceId]

            // Initialize with default values
            const service = allServices.find(s => s.id === serviceId)
            const updatedPreferences = {
                ...establishment.servicePreferences,
                [serviceId]: { price: service.price, duration: service.duration }
            }

            // Also update categories if needed
            let updatedCategories = [...establishment.categories]
            if (!updatedCategories.includes(service.categoryId)) {
                updatedCategories.push(service.categoryId)
            }

            await api.updateEstablishment(admin.establishmentId, {
                services: updatedServices,
                categories: updatedCategories,
                servicePreferences: updatedPreferences
            })
            loadData()
            success('Serviço adicionado!')
            setShowAddModal(false)
        } catch (error) {
            console.error('Error adding service:', error)
        }
    }

    const handleCreateCustomService = async (e) => {
        e.preventDefault()
        try {
            const price = parseFloat(String(customForm.price).replace(',', '.'))
            const duration = parseInt(customForm.duration)
            const commission = parseInt(customForm.commission)

            if (isNaN(price) || isNaN(duration) || isNaN(commission)) {
                return info('Valores numéricos inválidos')
            }
            if (commission < 0 || commission > 100) {
                return info('A comissão deve ser entre 0 e 100%')
            }

            const newService = await api.createService({
                name: customForm.name,
                categoryId: customForm.categoryId,
                price: price,
                duration: duration,
                establishmentId: admin.establishmentId
            })

            const updatedServices = [...establishment.services, newService.id]
            const updatedPreferences = {
                ...(establishment.servicePreferences || {}),
                [newService.id]: { price, duration, commission }
            }
            
            let updatedCategories = [...establishment.categories]
            if (!updatedCategories.includes(newService.categoryId)) {
                updatedCategories.push(newService.categoryId)
            }

            await api.updateEstablishment(admin.establishmentId, {
                services: updatedServices,
                categories: updatedCategories,
                servicePreferences: updatedPreferences
            })
            
            await loadData()
            success('Serviço personalizado criado com sucesso!')
            setShowAddModal(false)
            setIsCreatingCustom(false)
            setCustomForm({ name: '', categoryId: '', price: '', duration: '', commission: 50 })
        } catch (error) {
            info('Erro ao criar serviço: ' + error.message)
        }
    }

    const startEditing = (service) => {
        const details = getServiceDetails(service)
        setEditingService(service)
        setEditForm({ name: service.name, price: details.price, duration: details.duration, commission: details.commission })
    }

    const handleUpdateService = async (e) => {
        e.preventDefault()
        if (!editingService) return

        // Verify admin token exists
        const adminToken = localStorage.getItem('zakys_admin_token')
        if (!adminToken) {
            info('Sessão expirada. Por favor, faça login novamente.')
            return
        }

        try {
            // Handle both string and number inputs
            const priceStr = String(editForm.price).replace(',', '.')
            const newPrice = parseFloat(priceStr)
            const newDuration = parseInt(editForm.duration)
            const newCommission = parseInt(editForm.commission)

            if (isNaN(newPrice) || isNaN(newDuration) || isNaN(newCommission)) {
                info('Por favor, insira valores válidos para preço, duração e comissão.')
                return
            }

            if (newCommission < 0 || newCommission > 100) {
                info('A comissão deve estar entre 0% e 100%.')
                return
            }

            const updatedPreferences = {
                ...(establishment.servicePreferences || {}),
                [editingService.id]: {
                    price: newPrice,
                    duration: newDuration,
                    commission: newCommission
                }
            }

            console.log('Sending update:', updatedPreferences)
            console.log('Admin token exists:', !!adminToken)

            if (editingService.establishmentId === admin.establishmentId) {
                await api.updateService(editingService.id, {
                    name: editForm.name,
                    price: newPrice,
                    duration: newDuration
                })
            }

            await api.updateEstablishment(admin.establishmentId, {
                servicePreferences: updatedPreferences
            })

            // Update local state
            setEstablishment(prev => ({
                ...prev,
                servicePreferences: updatedPreferences
            }))

            // Reload to be sure
            await loadData()
            success('Serviço atualizado!')
            setEditingService(null)
        } catch (error) {
            console.error('Error updating service:', error)
            if (error.message.includes('Token')) {
                info('Sessão expirada. Por favor, faça login novamente.')
            } else {
                info('Erro ao salvar alteração: ' + error.message)
            }
        }
    }

    const availableServices = allServices.filter(s => !establishment?.services.includes(s.id))

    if (loading) return <div className="p-8">Carregando...</div>

    return (
        <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Serviços</h1>
                    <p className="text-secondary">Gerencie os serviços oferecidos pelo seu estabelecimento</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button
                        onClick={() => { setIsCreatingCustom(false); setShowAddModal(true); }}
                        className="btn btn-outline flex-1 sm:flex-none"
                    >
                        📚 Catálogo
                    </button>
                    <button
                        onClick={() => { setIsCreatingCustom(true); setShowAddModal(true); }}
                        className="btn btn-primary flex-1 sm:flex-none"
                    >
                        + Personalizado
                    </button>
                </div>
            </div>

            {/* Services List */}
            {services.length === 0 ? (
                <div className="card text-center py-12">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✂️</div>
                    <p className="text-secondary mb-4">Nenhum serviço cadastrado</p>
                    <div className="flex justify-center gap-4">
                        <button
                            onClick={() => { setIsCreatingCustom(false); setShowAddModal(true); }}
                            className="btn btn-outline"
                        >
                            Ver Catálogo
                        </button>
                        <button
                            onClick={() => { setIsCreatingCustom(true); setShowAddModal(true); }}
                            className="btn btn-primary"
                        >
                            Criar Personalizado
                        </button>
                    </div>
                </div>
            ) : (
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Serviço</th>
                                <th>Categoria</th>
                                <th>Duração</th>
                                <th>Preço</th>
                                <th>Preço Mercado</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {services.map(service => {
                                const category = getCategory(service.categoryId)
                                const details = getServiceDetails(service)

                                return (
                                    <tr key={service.id}>
                                        <td>
                                            <span className="font-medium">{service.name}</span>
                                        </td>
                                        <td>
                                            <span className="badge badge-primary">
                                                {category?.icon} {category?.name}
                                            </span>
                                        </td>
                                        <td>{details.duration} min</td>
                                        <td>
                                            <span className="font-semibold">R$ {details.price.toFixed(2)}</span>
                                        </td>
                                        <td>
                                            <MarketPriceIndicator
                                                marketData={marketPricesData?.marketPrices?.find(mp => mp.serviceId === service.id)}
                                                isPremium={isPremium}
                                                onUpgradeClick={() => info('Entre em contato para fazer upgrade para o plano Premium!')}
                                            />
                                        </td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => startEditing(service)}
                                                    className="btn btn-secondary btn-sm"
                                                >
                                                    ✏️ Editar
                                                </button>
                                                <button
                                                    onClick={() => handleRemoveService(service.id)}
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: 'var(--error-500)' }}
                                                >
                                                    🗑️ Remover
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add Service Modal */}
            {showAddModal && (
                <div className="modal-backdrop" onClick={() => { setShowAddModal(false); setIsCreatingCustom(false) }}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">{isCreatingCustom ? 'Criar Serviço Personalizado' : 'Adicionar Serviço'}</h3>
                            <button
                                onClick={() => { setShowAddModal(false); setIsCreatingCustom(false) }}
                                className="btn btn-ghost btn-icon"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="modal-body" style={{ maxHeight: '400px', overflow: 'auto' }}>
                            {/* O botão interior foi removido pois virou um botão principal */}

                            {isCreatingCustom ? (
                                <form onSubmit={handleCreateCustomService} className="flex flex-col gap-4">
                                    <div className="form-group">
                                        <label className="form-label">Nome do Serviço</label>
                                        <input type="text" className="form-input" value={customForm.name} onChange={e => setCustomForm({...customForm, name: e.target.value})} required />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Categoria</label>
                                        <select className="form-select" value={customForm.categoryId} onChange={e => setCustomForm({...customForm, categoryId: e.target.value})} required>
                                            <option value="">Selecione uma categoria</option>
                                            {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="grid sm:grid-cols-2 gap-4">
                                        <div className="form-group">
                                            <label className="form-label">Preço (R$)</label>
                                            <input type="number" step="0.01" className="form-input" value={customForm.price} onChange={e => setCustomForm({...customForm, price: e.target.value})} required />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Duração (min)</label>
                                            <input type="number" className="form-input" value={customForm.duration} onChange={e => setCustomForm({...customForm, duration: e.target.value})} required />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Comissão Funcionário (%)</label>
                                        <input type="number" min="0" max="100" className="form-input" value={customForm.commission} onChange={e => setCustomForm({...customForm, commission: e.target.value})} required />
                                    </div>
                                    <div className="flex gap-2">
                                        <button type="button" onClick={() => setIsCreatingCustom(false)} className="btn btn-secondary flex-1">Voltar</button>
                                        <button type="submit" className="btn btn-primary flex-1">Salvar Serviço</button>
                                    </div>
                                </form>
                            ) : availableServices.length === 0 ? (
                                <p className="text-center text-muted py-8">
                                    Todos os serviços disponíveis já foram adicionados
                                </p>
                            ) : (
                                <div className="flex flex-col gap-2">
                                    {categories.map(category => {
                                        const categoryServices = availableServices.filter(s => s.categoryId === category.id)
                                        if (categoryServices.length === 0) return null

                                        return (
                                            <div key={category.id}>
                                                <div className="font-semibold mb-2 flex items-center gap-2">
                                                    <span>{category.icon}</span>
                                                    <span>{category.name}</span>
                                                </div>
                                                {categoryServices.map(service => (
                                                    <div
                                                        key={service.id}
                                                        className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary"
                                                        style={{ background: 'var(--bg-secondary)', marginBottom: '0.5rem' }}
                                                    >
                                                        <div>
                                                            <div className="font-medium">{service.name}</div>
                                                            <div className="text-sm text-muted">
                                                                {service.duration} min • R$ {service.price.toFixed(2)}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleAddService(service.id)}
                                                            className="btn btn-primary btn-sm"
                                                        >
                                                            + Adicionar
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Service Modal */}
            {editingService && (
                <div className="modal-backdrop" onClick={() => setEditingService(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Editar Serviço</h3>
                            <button
                                onClick={() => setEditingService(null)}
                                className="btn btn-ghost btn-icon"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleUpdateService}>
                            <div className="modal-body">
                                {editingService.establishmentId === admin.establishmentId ? (
                                    <div className="form-group mb-4">
                                        <label className="form-label">Nome do Serviço</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={editForm.name}
                                            onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                            required
                                        />
                                    </div>
                                ) : (
                                    <h4 className="font-medium mb-4">{editingService.name}</h4>
                                )}
                                <div className="grid sm:grid-cols-2 gap-4">
                                    <div className="form-group">
                                        <label className="form-label">Preço (R$)</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            onFocus={(e) => e.target.select()}
                                            value={editForm.price}
                                            onChange={e => setEditForm({ ...editForm, price: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Duração (min)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            onFocus={(e) => e.target.select()}
                                            value={editForm.duration}
                                            onChange={e => setEditForm({ ...editForm, duration: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group mt-4">
                                    <label className="form-label">Comissão Funcionário (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        className="form-input"
                                        onFocus={(e) => e.target.select()}
                                        value={editForm.commission}
                                        onChange={e => setEditForm({ ...editForm, commission: e.target.value })}
                                        required
                                    />
                                    <p className="text-sm text-muted mt-1">
                                        Funcionário: {editForm.commission}% • Estabelecimento: {100 - (editForm.commission || 0)}%
                                    </p>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button
                                    type="button"
                                    onClick={() => setEditingService(null)}
                                    className="btn btn-secondary"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary"
                                >
                                    Salvar Alterações
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
