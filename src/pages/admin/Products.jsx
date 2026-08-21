import { useState, useEffect } from 'react'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

const MOVEMENT_LABELS = {
    entrada: '📥 Entrada',
    perda: '📉 Perda',
    uso_interno: '🧴 Uso interno',
    ajuste: '⚖️ Ajuste',
    venda: '💰 Venda'
}

export default function AdminProducts() {
    const { success, error } = useToast()

    const [products, setProducts] = useState([])
    const [sales, setSales] = useState([])
    const [movements, setMovements] = useState([])
    const [loading, setLoading] = useState(true)

    const [newProduct, setNewProduct] = useState({
        name: '', price: '', quantity: '', cost: '', unit: 'un', minStock: '', supplier: ''
    })
    const [adding, setAdding] = useState(false)

    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ name: '', price: '', cost: '', unit: '', minStock: '', supplier: '' })

    const [sellQty, setSellQty] = useState({}) // { [productId]: quantidade digitada }
    const [selling, setSelling] = useState(null) // productId em processamento

    // Movimentação de estoque (entrada/perda/uso interno/ajuste)
    const [movementFor, setMovementFor] = useState(null) // productId
    const [movementForm, setMovementForm] = useState({ type: 'entrada', quantity: '', direction: 'increase', note: '' })
    const [savingMovement, setSavingMovement] = useState(false)

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [productsData, salesData, movementsData] = await Promise.all([
                api.getProducts(),
                api.getProductSalesHistory(),
                api.getStockMovements()
            ])
            setProducts(productsData)
            setSales(salesData)
            setMovements(movementsData)
        } catch (err) {
            console.error('Error loading products:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleAdd = async () => {
        if (!newProduct.name.trim() || newProduct.price === '' || newProduct.quantity === '') {
            error('Preencha nome, preço e quantidade')
            return
        }

        setAdding(true)
        try {
            await api.createProduct({
                name: newProduct.name.trim(),
                price: parseFloat(newProduct.price),
                quantity: parseInt(newProduct.quantity),
                cost: newProduct.cost === '' ? 0 : parseFloat(newProduct.cost),
                unit: newProduct.unit.trim() || 'un',
                minStock: newProduct.minStock === '' ? 0 : parseInt(newProduct.minStock),
                supplier: newProduct.supplier.trim()
            })
            success('Produto cadastrado!')
            setNewProduct({ name: '', price: '', quantity: '', cost: '', unit: 'un', minStock: '', supplier: '' })
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao cadastrar produto')
        } finally {
            setAdding(false)
        }
    }

    const startEdit = (product) => {
        setEditingId(product.id)
        setEditForm({
            name: product.name,
            price: product.price,
            cost: product.cost || 0,
            unit: product.unit || 'un',
            minStock: product.minStock || 0,
            supplier: product.supplier || ''
        })
    }

    const handleSaveEdit = async () => {
        if (!editForm.name.trim()) {
            error('Nome não pode estar vazio')
            return
        }
        try {
            await api.updateProduct(editingId, {
                name: editForm.name.trim(),
                price: parseFloat(editForm.price),
                cost: parseFloat(editForm.cost) || 0,
                unit: editForm.unit.trim() || 'un',
                minStock: parseInt(editForm.minStock) || 0,
                supplier: editForm.supplier.trim()
            })
            success('Produto atualizado!')
            setEditingId(null)
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao atualizar produto')
        }
    }

    const handleDelete = async (id, name) => {
        if (!confirm(`Remover o produto "${name}"?`)) return
        try {
            await api.deleteProduct(id)
            success('Produto removido!')
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao remover produto')
        }
    }

    const handleSell = async (product) => {
        const qty = parseInt(sellQty[product.id]) || 1
        setSelling(product.id)
        try {
            await api.sellProduct(product.id, qty)
            success(`Venda registrada: ${qty}x ${product.name}`)
            setSellQty(prev => ({ ...prev, [product.id]: '' }))
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao registrar venda')
        } finally {
            setSelling(null)
        }
    }

    const startMovement = (product) => {
        setMovementFor(product.id)
        setMovementForm({ type: 'entrada', quantity: '', direction: 'increase', note: '' })
    }

    const handleSaveMovement = async (product) => {
        if (!movementForm.quantity || parseInt(movementForm.quantity) < 1) {
            error('Informe uma quantidade válida')
            return
        }
        setSavingMovement(true)
        try {
            await api.registerStockMovement(product.id, movementForm)
            success('Movimentação registrada!')
            setMovementFor(null)
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao registrar movimentação')
        } finally {
            setSavingMovement(false)
        }
    }

    if (loading) {
        return <div className="text-center py-16">⏳ Carregando...</div>
    }

    // Resumo: valor do estoque a custo e a preço de venda, margem média ponderada.
    const stockAtCost = products.reduce((sum, p) => sum + (p.quantity * (p.cost || 0)), 0)
    const stockAtPrice = products.reduce((sum, p) => sum + (p.quantity * p.price), 0)
    const marginPercent = stockAtPrice > 0 ? ((stockAtPrice - stockAtCost) / stockAtPrice * 100) : 0

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">🛍️ Produtos</h1>
                <p className="text-secondary">
                    Produtos vendidos presencialmente no estabelecimento (não aparecem pro cliente no app).
                    Ao dar baixa numa venda, o estoque reduz e o valor entra automaticamente no faturamento do dia no Analytics.
                </p>
            </div>

            {/* Resumo do estoque */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="card text-center" style={{ padding: '1.25rem' }}>
                    <div className="text-sm text-muted mb-1">Valor do estoque (custo)</div>
                    <div className="text-2xl font-bold">R$ {stockAtCost.toFixed(2)}</div>
                </div>
                <div className="card text-center" style={{ padding: '1.25rem' }}>
                    <div className="text-sm text-muted mb-1">Valor do estoque (venda)</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--primary-500)' }}>R$ {stockAtPrice.toFixed(2)}</div>
                </div>
                <div className="card text-center" style={{ padding: '1.25rem' }}>
                    <div className="text-sm text-muted mb-1">Margem estimada</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--success-500, #10b981)' }}>{marginPercent.toFixed(1)}%</div>
                </div>
            </div>

            {/* Cadastrar Produto */}
            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">Cadastrar Produto</h3>
                <div className="flex flex-wrap gap-3">
                    <input
                        type="text"
                        className="form-input flex-1"
                        style={{ minWidth: '180px' }}
                        placeholder="Nome do produto (ex: Shampoo)"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, name: e.target.value }))}
                    />
                    <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        style={{ width: '130px' }}
                        placeholder="Custo (R$)"
                        title="Custo unitário — quanto você pagou pelo produto"
                        value={newProduct.cost}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, cost: e.target.value }))}
                    />
                    <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        style={{ width: '130px' }}
                        placeholder="Preço de venda (R$)"
                        value={newProduct.price}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, price: e.target.value }))}
                    />
                    <input
                        type="number"
                        className="form-input"
                        style={{ width: '110px' }}
                        placeholder="Quantidade"
                        value={newProduct.quantity}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, quantity: e.target.value }))}
                    />
                    <input
                        type="text"
                        className="form-input"
                        style={{ width: '90px' }}
                        placeholder="Unidade"
                        title="ex: un, ml, g, kg"
                        value={newProduct.unit}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, unit: e.target.value }))}
                    />
                    <input
                        type="number"
                        className="form-input"
                        style={{ width: '130px' }}
                        placeholder="Estoque mínimo"
                        value={newProduct.minStock}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, minStock: e.target.value }))}
                    />
                    <input
                        type="text"
                        className="form-input"
                        style={{ minWidth: '150px' }}
                        placeholder="Fornecedor (opcional)"
                        value={newProduct.supplier}
                        onChange={(e) => setNewProduct(prev => ({ ...prev, supplier: e.target.value }))}
                    />
                    <button onClick={handleAdd} className="btn btn-primary" disabled={adding}>
                        {adding ? 'Adicionando...' : '+ Adicionar'}
                    </button>
                </div>
            </div>

            {/* Lista de Produtos */}
            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">Produtos Cadastrados</h3>

                {products.length === 0 ? (
                    <div className="text-center py-8">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📦</div>
                        <p className="text-secondary">Nenhum produto cadastrado</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {products.map(product => {
                            const lowStock = product.quantity <= (product.minStock || 0)
                            const margin = product.price > 0 && product.cost
                                ? ((product.price - product.cost) / product.price * 100)
                                : null

                            return (
                                <div
                                    key={product.id}
                                    style={{
                                        padding: '1rem',
                                        background: 'var(--secondary-500)',
                                        borderRadius: '0.75rem',
                                        border: lowStock ? '1px solid var(--error-500)' : '1px solid var(--gray-200)'
                                    }}
                                >
                                    {editingId === product.id ? (
                                        <div className="flex flex-wrap items-center gap-2">
                                            <input type="text" className="form-input flex-1" style={{ minWidth: '150px' }}
                                                value={editForm.name} onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nome" />
                                            <input type="number" step="0.01" className="form-input" style={{ width: '100px' }}
                                                value={editForm.cost} onChange={(e) => setEditForm(prev => ({ ...prev, cost: e.target.value }))} placeholder="Custo" />
                                            <input type="number" step="0.01" className="form-input" style={{ width: '100px' }}
                                                value={editForm.price} onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))} placeholder="Preço" />
                                            <input type="text" className="form-input" style={{ width: '70px' }}
                                                value={editForm.unit} onChange={(e) => setEditForm(prev => ({ ...prev, unit: e.target.value }))} placeholder="Un." />
                                            <input type="number" className="form-input" style={{ width: '110px' }}
                                                value={editForm.minStock} onChange={(e) => setEditForm(prev => ({ ...prev, minStock: e.target.value }))} placeholder="Estoque mín." />
                                            <input type="text" className="form-input" style={{ width: '130px' }}
                                                value={editForm.supplier} onChange={(e) => setEditForm(prev => ({ ...prev, supplier: e.target.value }))} placeholder="Fornecedor" />
                                            <button onClick={handleSaveEdit} className="btn btn-primary btn-sm">✓</button>
                                            <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">✕</button>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <div>
                                                <span className="font-medium" style={{ color: 'var(--primary-500)' }}>{product.name}</span>
                                                <div className="text-sm text-muted">
                                                    R$ {product.price.toFixed(2)} / {product.unit || 'un'}
                                                    {product.cost > 0 && ` · custo R$ ${product.cost.toFixed(2)}`}
                                                    {margin !== null && ` · margem ${margin.toFixed(0)}%`}
                                                    {' '}· Estoque:{' '}
                                                    <strong style={{ color: lowStock ? 'var(--error-500)' : 'inherit' }}>
                                                        {product.quantity}
                                                    </strong>
                                                    {product.quantity === 0 && ' (esgotado)'}
                                                    {product.quantity > 0 && lowStock && ' (abaixo do mínimo)'}
                                                    {product.supplier && ` · ${product.supplier}`}
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max={product.quantity}
                                                    className="form-input"
                                                    style={{ width: '70px' }}
                                                    placeholder="1"
                                                    value={sellQty[product.id] || ''}
                                                    onChange={(e) => setSellQty(prev => ({ ...prev, [product.id]: e.target.value }))}
                                                    disabled={product.quantity === 0}
                                                />
                                                <button
                                                    onClick={() => handleSell(product)}
                                                    className="btn btn-primary btn-sm"
                                                    disabled={product.quantity === 0 || selling === product.id}
                                                    title="Registrar venda: reduz o estoque e soma no faturamento de hoje"
                                                >
                                                    {selling === product.id ? 'Registrando...' : '💰 Vender'}
                                                </button>
                                                <button onClick={() => startMovement(product)} className="btn btn-outline btn-sm" title="Registrar entrada, perda, uso interno ou ajuste">📦 Movimentar</button>
                                                <button onClick={() => startEdit(product)} className="btn btn-outline btn-sm" title="Editar">✏️</button>
                                                <button
                                                    onClick={() => handleDelete(product.id, product.name)}
                                                    className="btn btn-ghost btn-sm"
                                                    title="Remover"
                                                    style={{ color: 'var(--error-500)' }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {movementFor === product.id && (
                                        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <select
                                                className="form-select"
                                                style={{ width: '150px' }}
                                                value={movementForm.type}
                                                onChange={(e) => setMovementForm(prev => ({ ...prev, type: e.target.value }))}
                                            >
                                                <option value="entrada">Entrada (reposição)</option>
                                                <option value="perda">Perda</option>
                                                <option value="uso_interno">Uso interno</option>
                                                <option value="ajuste">Ajuste de contagem</option>
                                            </select>
                                            {movementForm.type === 'ajuste' && (
                                                <select
                                                    className="form-select"
                                                    style={{ width: '110px' }}
                                                    value={movementForm.direction}
                                                    onChange={(e) => setMovementForm(prev => ({ ...prev, direction: e.target.value }))}
                                                >
                                                    <option value="increase">Aumentar</option>
                                                    <option value="decrease">Diminuir</option>
                                                </select>
                                            )}
                                            <input
                                                type="number"
                                                min="1"
                                                className="form-input"
                                                style={{ width: '90px' }}
                                                placeholder="Qtd"
                                                value={movementForm.quantity}
                                                onChange={(e) => setMovementForm(prev => ({ ...prev, quantity: e.target.value }))}
                                            />
                                            <input
                                                type="text"
                                                className="form-input flex-1"
                                                style={{ minWidth: '140px' }}
                                                placeholder="Observação (opcional)"
                                                value={movementForm.note}
                                                onChange={(e) => setMovementForm(prev => ({ ...prev, note: e.target.value }))}
                                            />
                                            <button onClick={() => handleSaveMovement(product)} className="btn btn-primary btn-sm" disabled={savingMovement}>
                                                {savingMovement ? 'Salvando...' : 'Confirmar'}
                                            </button>
                                            <button onClick={() => setMovementFor(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Histórico de Vendas */}
            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">📋 Histórico de Vendas</h3>
                {sales.length === 0 ? (
                    <p className="text-center text-muted py-4">Nenhuma venda registrada ainda.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-muted">
                                    <th className="pb-2">Data</th>
                                    <th className="pb-2">Produto</th>
                                    <th className="pb-2">Qtd</th>
                                    <th className="pb-2 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sales.map(sale => (
                                    <tr key={sale.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td className="py-2">{new Date(sale.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="py-2">{sale.productName}</td>
                                        <td className="py-2">{sale.quantity}x</td>
                                        <td className="py-2 text-right font-medium">R$ {sale.total.toFixed(2)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Histórico de Movimentações de Estoque */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">📦 Movimentações de Estoque</h3>
                {movements.length === 0 ? (
                    <p className="text-center text-muted py-4">Nenhuma movimentação registrada ainda.</p>
                ) : (
                    <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-muted" style={{ position: 'sticky', top: 0, background: 'var(--bg-secondary, #fff)' }}>
                                    <th className="pb-2">Data</th>
                                    <th className="pb-2">Produto</th>
                                    <th className="pb-2">Tipo</th>
                                    <th className="pb-2">Observação</th>
                                    <th className="pb-2 text-right">Qtd</th>
                                </tr>
                            </thead>
                            <tbody>
                                {movements.map(m => (
                                    <tr key={m.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <td className="py-2">{new Date(m.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                        <td className="py-2">{m.productName}</td>
                                        <td className="py-2">{MOVEMENT_LABELS[m.type] || m.type}</td>
                                        <td className="py-2 text-muted">{m.note}</td>
                                        <td className="py-2 text-right font-medium" style={{ color: m.quantity < 0 ? 'var(--error-500)' : 'var(--success-500, #10b981)' }}>
                                            {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
