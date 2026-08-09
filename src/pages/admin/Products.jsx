import { useState, useEffect } from 'react'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

export default function AdminProducts() {
    const { success, error } = useToast()

    const [products, setProducts] = useState([])
    const [sales, setSales] = useState([])
    const [loading, setLoading] = useState(true)

    const [newName, setNewName] = useState('')
    const [newPrice, setNewPrice] = useState('')
    const [newQuantity, setNewQuantity] = useState('')
    const [adding, setAdding] = useState(false)

    const [editingId, setEditingId] = useState(null)
    const [editForm, setEditForm] = useState({ name: '', price: '', quantity: '' })

    const [sellQty, setSellQty] = useState({}) // { [productId]: quantidade digitada }
    const [selling, setSelling] = useState(null) // productId em processamento

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            const [productsData, salesData] = await Promise.all([
                api.getProducts(),
                api.getProductSalesHistory()
            ])
            setProducts(productsData)
            setSales(salesData)
        } catch (err) {
            console.error('Error loading products:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleAdd = async () => {
        if (!newName.trim() || newPrice === '' || newQuantity === '') {
            error('Preencha nome, preço e quantidade')
            return
        }

        setAdding(true)
        try {
            await api.createProduct({
                name: newName.trim(),
                price: parseFloat(newPrice),
                quantity: parseInt(newQuantity)
            })
            success('Produto cadastrado!')
            setNewName('')
            setNewPrice('')
            setNewQuantity('')
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao cadastrar produto')
        } finally {
            setAdding(false)
        }
    }

    const startEdit = (product) => {
        setEditingId(product.id)
        setEditForm({ name: product.name, price: product.price, quantity: product.quantity })
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
                quantity: parseInt(editForm.quantity)
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

    if (loading) {
        return <div className="text-center py-16">⏳ Carregando...</div>
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">🛍️ Produtos</h1>
                <p className="text-secondary">
                    Produtos vendidos presencialmente no estabelecimento (não aparecem pro cliente no app).
                    Ao dar baixa numa venda, o estoque reduz e o valor entra automaticamente no faturamento do dia no Analytics.
                </p>
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
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                    />
                    <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        style={{ width: '140px' }}
                        placeholder="Preço (R$)"
                        value={newPrice}
                        onChange={(e) => setNewPrice(e.target.value)}
                    />
                    <input
                        type="number"
                        className="form-input"
                        style={{ width: '140px' }}
                        placeholder="Quantidade"
                        value={newQuantity}
                        onChange={(e) => setNewQuantity(e.target.value)}
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
                        {products.map(product => (
                            <div
                                key={product.id}
                                style={{
                                    padding: '1rem',
                                    background: 'var(--secondary-500)',
                                    borderRadius: '0.75rem',
                                    border: '1px solid var(--gray-200)'
                                }}
                            >
                                {editingId === product.id ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <input
                                            type="text"
                                            className="form-input flex-1"
                                            style={{ minWidth: '150px' }}
                                            value={editForm.name}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                        />
                                        <input
                                            type="number"
                                            step="0.01"
                                            className="form-input"
                                            style={{ width: '110px' }}
                                            value={editForm.price}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, price: e.target.value }))}
                                        />
                                        <input
                                            type="number"
                                            className="form-input"
                                            style={{ width: '110px' }}
                                            value={editForm.quantity}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, quantity: e.target.value }))}
                                        />
                                        <button onClick={handleSaveEdit} className="btn btn-primary btn-sm">✓</button>
                                        <button onClick={() => setEditingId(null)} className="btn btn-ghost btn-sm">✕</button>
                                    </div>
                                ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <span className="font-medium" style={{ color: 'var(--primary-500)' }}>{product.name}</span>
                                            <div className="text-sm text-muted">
                                                R$ {product.price.toFixed(2)} · Estoque: {' '}
                                                <strong style={{ color: product.quantity === 0 ? 'var(--error-500)' : 'inherit' }}>
                                                    {product.quantity}
                                                </strong>
                                                {product.quantity === 0 && ' (esgotado)'}
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
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Histórico de Vendas */}
            <div className="card" style={{ padding: '1.5rem' }}>
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
        </div>
    )
}
