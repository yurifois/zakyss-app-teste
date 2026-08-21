import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

const STATUS_LABELS = {
    ativo: { label: '✅ Ativo', color: 'var(--success-500, #10b981)' },
    esgotado: { label: '⚫ Esgotado', color: 'var(--gray-500, #6b7280)' },
    expirado: { label: '⏰ Vencido', color: 'var(--error-500)' }
}

export default function AdminPackages() {
    const { admin } = useAuth()
    const { success, error } = useToast()

    const [packages, setPackages] = useState([])
    const [sold, setSold] = useState([])
    const [services, setServices] = useState([])
    const [loading, setLoading] = useState(true)

    const [newPkg, setNewPkg] = useState({ name: '', description: '', serviceIds: [], totalCredits: '', price: '', validityDays: '' })
    const [adding, setAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)

    const [sellForm, setSellForm] = useState({ packageId: '', customerName: '', customerPhone: '', customerEmail: '' })
    const [selling, setSelling] = useState(false)

    const [useModalFor, setUseModalFor] = useState(null) // customerPackage sendo consumido
    const [useForm, setUseForm] = useState({ serviceId: '', quantity: 1, note: '' })
    const [usingCredit, setUsingCredit] = useState(false)

    useEffect(() => {
        loadData()
    }, [admin])

    const loadData = async () => {
        if (!admin) return
        setLoading(true)
        try {
            const [pkgData, soldData, establishment] = await Promise.all([
                api.getPackages(),
                api.getSoldPackages(),
                api.getEstablishmentById(admin.establishmentId)
            ])
            setPackages(pkgData)
            setSold(soldData)
            const allServices = await api.getServices(admin.establishmentId)
            setServices(allServices.filter(s => establishment.services?.includes(s.id)))
        } catch (err) {
            console.error('Erro ao carregar pacotes:', err)
        } finally {
            setLoading(false)
        }
    }

    const resetNewPkg = () => setNewPkg({ name: '', description: '', serviceIds: [], totalCredits: '', price: '', validityDays: '' })

    const toggleServiceInForm = (id) => {
        setNewPkg(prev => ({
            ...prev,
            serviceIds: prev.serviceIds.includes(id) ? prev.serviceIds.filter(s => s !== id) : [...prev.serviceIds, id]
        }))
    }

    const handleSavePackage = async () => {
        if (!newPkg.name.trim() || !newPkg.totalCredits || newPkg.price === '') {
            error('Preencha nome, créditos e preço')
            return
        }
        setAdding(true)
        try {
            if (editingId) {
                await api.updatePackage(editingId, newPkg)
                success('Pacote atualizado!')
            } else {
                await api.createPackage(newPkg)
                success('Pacote criado!')
            }
            resetNewPkg()
            setEditingId(null)
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao salvar pacote')
        } finally {
            setAdding(false)
        }
    }

    const startEditPackage = (pkg) => {
        setEditingId(pkg.id)
        setNewPkg({
            name: pkg.name, description: pkg.description || '', serviceIds: pkg.serviceIds || [],
            totalCredits: pkg.totalCredits, price: pkg.price, validityDays: pkg.validityDays || ''
        })
    }

    const handleDeletePackage = async (id, name) => {
        if (!confirm(`Remover o pacote "${name}"? Isso não afeta pacotes já vendidos.`)) return
        try {
            await api.deletePackage(id)
            success('Pacote removido!')
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao remover pacote')
        }
    }

    const handleSell = async () => {
        if (!sellForm.packageId || !sellForm.customerName.trim() || !sellForm.customerPhone.trim()) {
            error('Escolha o pacote e preencha nome e telefone do cliente')
            return
        }
        setSelling(true)
        try {
            await api.sellPackage(sellForm)
            success('Pacote vendido!')
            setSellForm({ packageId: '', customerName: '', customerPhone: '', customerEmail: '' })
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao vender pacote')
        } finally {
            setSelling(false)
        }
    }

    const handleUseCredit = async (cp) => {
        setUsingCredit(true)
        try {
            await api.useCustomerPackage(cp.id, useForm)
            success('Crédito consumido!')
            setUseModalFor(null)
            setUseForm({ serviceId: '', quantity: 1, note: '' })
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao consumir crédito')
        } finally {
            setUsingCredit(false)
        }
    }

    const serviceName = (id) => services.find(s => s.id === id)?.name || 'Serviço removido'

    if (loading) {
        return <div className="text-center py-16">⏳ Carregando...</div>
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">🎟️ Pacotes de Serviço</h1>
                <p className="text-secondary">
                    Venda combos de créditos de serviço pros seus clientes e controle o consumo.
                    Vendido presencialmente (sem gateway de pagamento) — o valor entra automaticamente no faturamento do dia.
                </p>
            </div>

            {/* Criar/editar definição de pacote */}
            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">{editingId ? '✏️ Editar Pacote' : 'Criar Pacote'}</h3>
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-3">
                        <input
                            type="text" className="form-input flex-1" style={{ minWidth: '180px' }}
                            placeholder="Nome do pacote (ex: Combo 5 Cortes)"
                            value={newPkg.name} onChange={(e) => setNewPkg(prev => ({ ...prev, name: e.target.value }))}
                        />
                        <input
                            type="number" className="form-input" style={{ width: '110px' }}
                            placeholder="Créditos" value={newPkg.totalCredits}
                            onChange={(e) => setNewPkg(prev => ({ ...prev, totalCredits: e.target.value }))}
                        />
                        <input
                            type="number" step="0.01" className="form-input" style={{ width: '130px' }}
                            placeholder="Preço total (R$)" value={newPkg.price}
                            onChange={(e) => setNewPkg(prev => ({ ...prev, price: e.target.value }))}
                        />
                        <input
                            type="number" className="form-input" style={{ width: '150px' }}
                            placeholder="Validade (dias, opcional)" value={newPkg.validityDays}
                            onChange={(e) => setNewPkg(prev => ({ ...prev, validityDays: e.target.value }))}
                        />
                    </div>
                    <input
                        type="text" className="form-input"
                        placeholder="Descrição (opcional)"
                        value={newPkg.description} onChange={(e) => setNewPkg(prev => ({ ...prev, description: e.target.value }))}
                    />
                    <div>
                        <p className="text-sm text-secondary mb-2">Serviços incluídos (o crédito vale pra qualquer um destes):</p>
                        <div className="flex flex-wrap gap-2">
                            {services.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => toggleServiceInForm(s.id)}
                                    className="text-sm"
                                    style={{
                                        padding: '0.3rem 0.6rem', borderRadius: '0.375rem',
                                        border: '1px solid var(--border-color)', cursor: 'pointer',
                                        background: newPkg.serviceIds.includes(s.id) ? 'var(--primary-500)' : 'transparent',
                                        color: newPkg.serviceIds.includes(s.id) ? 'white' : 'inherit'
                                    }}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={handleSavePackage} className="btn btn-primary" disabled={adding}>
                            {adding ? 'Salvando...' : editingId ? 'Salvar Alteração' : '+ Criar Pacote'}
                        </button>
                        {editingId && (
                            <button onClick={() => { setEditingId(null); resetNewPkg() }} className="btn btn-ghost">Cancelar</button>
                        )}
                    </div>
                </div>
            </div>

            {/* Lista de definições */}
            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">Pacotes Cadastrados</h3>
                {packages.length === 0 ? (
                    <p className="text-center text-muted py-4">Nenhum pacote cadastrado ainda.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {packages.map(pkg => (
                            <div key={pkg.id} className="flex items-center justify-between gap-3" style={{ padding: '0.75rem', background: 'var(--secondary-500)', borderRadius: '0.5rem' }}>
                                <div>
                                    <span className="font-medium" style={{ color: 'var(--primary-500)' }}>{pkg.name}</span>
                                    <div className="text-sm text-muted">
                                        {pkg.totalCredits} créditos · R$ {pkg.price.toFixed(2)}
                                        {pkg.validityDays && ` · válido ${pkg.validityDays} dias`}
                                        {pkg.serviceIds?.length > 0 && ` · ${pkg.serviceIds.map(serviceName).join(', ')}`}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => startEditPackage(pkg)} className="btn btn-outline btn-sm">✏️</button>
                                    <button onClick={() => handleDeletePackage(pkg.id, pkg.name)} className="btn btn-ghost btn-sm" style={{ color: 'var(--error-500)' }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Vender pacote pra cliente */}
            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">💰 Vender Pacote</h3>
                <div className="flex flex-wrap gap-3">
                    <select
                        className="form-select flex-1" style={{ minWidth: '180px' }}
                        value={sellForm.packageId}
                        onChange={(e) => setSellForm(prev => ({ ...prev, packageId: e.target.value }))}
                    >
                        <option value="">Escolha o pacote...</option>
                        {packages.map(p => <option key={p.id} value={p.id}>{p.name} — R$ {p.price.toFixed(2)}</option>)}
                    </select>
                    <input type="text" className="form-input" style={{ width: '180px' }} placeholder="Nome do cliente"
                        value={sellForm.customerName} onChange={(e) => setSellForm(prev => ({ ...prev, customerName: e.target.value }))} />
                    <input type="text" className="form-input" style={{ width: '150px' }} placeholder="Telefone"
                        value={sellForm.customerPhone} onChange={(e) => setSellForm(prev => ({ ...prev, customerPhone: e.target.value }))} />
                    <input type="email" className="form-input" style={{ width: '180px' }} placeholder="E-mail (opcional)"
                        value={sellForm.customerEmail} onChange={(e) => setSellForm(prev => ({ ...prev, customerEmail: e.target.value }))} />
                    <button onClick={handleSell} className="btn btn-primary" disabled={selling}>
                        {selling ? 'Vendendo...' : 'Vender'}
                    </button>
                </div>
            </div>

            {/* Pacotes vendidos */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">📋 Pacotes Vendidos</h3>
                {sold.length === 0 ? (
                    <p className="text-center text-muted py-4">Nenhum pacote vendido ainda.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {sold.map(cp => {
                            const statusInfo = STATUS_LABELS[cp.status]
                            const expiringSoon = cp.status === 'ativo' && cp.daysToExpire !== null && cp.daysToExpire <= 7
                            return (
                                <div key={cp.id} style={{ padding: '0.75rem', background: 'var(--secondary-500)', borderRadius: '0.5rem' }}>
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <span className="font-medium">{cp.customerName}</span>
                                            <span className="text-muted"> · {cp.packageName}</span>
                                            <div className="text-sm text-muted">
                                                {cp.remainingCredits}/{cp.totalCredits} créditos restantes
                                                {cp.expiresAt && ` · vence em ${new Date(cp.expiresAt + 'T12:00:00').toLocaleDateString('pt-BR')}`}
                                                {expiringSoon && <span style={{ color: 'var(--error-500)' }}> (vence em {cp.daysToExpire}d!)</span>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                                            {cp.status === 'ativo' && (
                                                <button onClick={() => { setUseModalFor(cp.id); setUseForm({ serviceId: '', quantity: 1, note: '' }) }} className="btn btn-outline btn-sm">
                                                    Usar crédito
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {useModalFor === cp.id && (
                                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                            {cp.serviceIds?.length > 0 && (
                                                <select
                                                    className="form-select" style={{ width: '160px' }}
                                                    value={useForm.serviceId}
                                                    onChange={(e) => setUseForm(prev => ({ ...prev, serviceId: e.target.value }))}
                                                >
                                                    <option value="">Serviço (opcional)</option>
                                                    {cp.serviceIds.map(sId => <option key={sId} value={sId}>{serviceName(sId)}</option>)}
                                                </select>
                                            )}
                                            <input
                                                type="number" min="1" max={cp.remainingCredits} className="form-input" style={{ width: '80px' }}
                                                value={useForm.quantity} onChange={(e) => setUseForm(prev => ({ ...prev, quantity: e.target.value }))}
                                            />
                                            <input
                                                type="text" className="form-input flex-1" style={{ minWidth: '140px' }} placeholder="Observação (opcional)"
                                                value={useForm.note} onChange={(e) => setUseForm(prev => ({ ...prev, note: e.target.value }))}
                                            />
                                            <button onClick={() => handleUseCredit(cp)} className="btn btn-primary btn-sm" disabled={usingCredit}>
                                                {usingCredit ? 'Salvando...' : 'Confirmar'}
                                            </button>
                                            <button onClick={() => setUseModalFor(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
