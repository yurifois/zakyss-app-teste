import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

const CATEGORIES = [
    { value: 'material', label: 'Material' },
    { value: 'aluguel', label: 'Aluguel' },
    { value: 'comissao', label: 'Comissão' },
    { value: 'marketing', label: 'Marketing' },
    { value: 'taxas', label: 'Taxas' },
    { value: 'equipamento', label: 'Equipamento' },
    { value: 'outro', label: 'Outro' }
]

const STATUSES = [
    { value: 'pago', label: 'Pago' },
    { value: 'previsto', label: 'Previsto' },
    { value: 'cancelado', label: 'Cancelado' }
]

const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

export default function CashFlow() {
    const { admin } = useAuth()
    const { success, error } = useToast()

    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())

    const [loading, setLoading] = useState(true)
    const [totalEntradas, setTotalEntradas] = useState(0)
    const [entries, setEntries] = useState([]) // saídas (todas do estabelecimento)

    // Form de nova saída
    const [savingExpense, setSavingExpense] = useState(false)
    const [expenseForm, setExpenseForm] = useState({
        date: now.toISOString().slice(0, 10),
        category: 'material',
        description: '',
        value: '',
        paymentMethod: '',
        status: 'pago'
    })
    const [editingId, setEditingId] = useState(null)

    // Form de entrada manual (lançamento manual — reaproveita endpoint que já existia sem tela)
    const [savingIncome, setSavingIncome] = useState(false)
    const [incomeForm, setIncomeForm] = useState({
        date: now.toISOString().slice(0, 10),
        description: '',
        value: ''
    })

    const years = []
    for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) years.push(y)

    useEffect(() => {
        loadData()
    }, [admin, month, year])

    const loadData = async () => {
        if (!admin?.establishmentId) return
        setLoading(true)
        try {
            const [analyticsData, cashflowData] = await Promise.all([
                api.getAnalytics(admin.establishmentId, { months: [month], year }),
                api.getCashflowEntries()
            ])
            setTotalEntradas(analyticsData?.summary?.totalRevenue || 0)
            setEntries(cashflowData || [])
        } catch (err) {
            console.error('Erro ao carregar fluxo de caixa:', err)
        } finally {
            setLoading(false)
        }
    }

    // Só saídas do mês/ano selecionado, com status "pago" contando pro saldo real
    // (previsto ainda não saiu do caixa, cancelado não conta).
    const expensesInPeriod = entries.filter(e => {
        const [y, m] = e.date.split('-').map(Number)
        return y === year && m === month
    })
    const totalSaidas = expensesInPeriod
        .filter(e => e.status === 'pago')
        .reduce((sum, e) => sum + e.value, 0)
    const saldo = totalEntradas - totalSaidas

    const resetExpenseForm = () => {
        setExpenseForm({
            date: now.toISOString().slice(0, 10),
            category: 'material',
            description: '',
            value: '',
            paymentMethod: '',
            status: 'pago'
        })
        setEditingId(null)
    }

    const handleSaveExpense = async () => {
        if (!expenseForm.description.trim() || !expenseForm.value) {
            error('Preencha descrição e valor')
            return
        }
        setSavingExpense(true)
        try {
            if (editingId) {
                await api.updateCashflowEntry(editingId, expenseForm)
                success('Saída atualizada!')
            } else {
                await api.createCashflowEntry(expenseForm)
                success('Saída registrada!')
            }
            resetExpenseForm()
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao salvar saída')
        } finally {
            setSavingExpense(false)
        }
    }

    const startEditExpense = (entry) => {
        setEditingId(entry.id)
        setExpenseForm({
            date: entry.date,
            category: entry.category,
            description: entry.description,
            value: entry.value,
            paymentMethod: entry.paymentMethod || '',
            status: entry.status
        })
    }

    const handleDeleteExpense = async (id, description) => {
        if (!confirm(`Remover a saída "${description}"?`)) return
        try {
            await api.deleteCashflowEntry(id)
            success('Saída removida!')
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao remover saída')
        }
    }

    const handleSaveIncome = async () => {
        if (!incomeForm.description.trim() || !incomeForm.value) {
            error('Preencha descrição e valor')
            return
        }
        setSavingIncome(true)
        try {
            await api.addManualFinance(admin.establishmentId, {
                date: incomeForm.date,
                description: incomeForm.description,
                value: parseFloat(incomeForm.value)
            })
            success('Entrada registrada!')
            setIncomeForm({ date: now.toISOString().slice(0, 10), description: '', value: '' })
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao registrar entrada')
        } finally {
            setSavingIncome(false)
        }
    }

    const categoryLabel = (value) => CATEGORIES.find(c => c.value === value)?.label || value

    if (loading && entries.length === 0) {
        return <div className="text-center py-16">⏳ Carregando...</div>
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">💵 Fluxo de Caixa</h1>
                <p className="text-secondary">
                    Entradas (serviços, produtos e lançamentos manuais) e saídas (despesas) do período, com o saldo calculado.
                    Pra ver a lista detalhada de entradas, use o Analytics.
                </p>
            </div>

            {/* Filtro de período */}
            <div className="card mb-6" style={{ padding: '1rem' }}>
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Mês:</label>
                        <select className="form-select" value={month} onChange={(e) => setMonth(parseInt(e.target.value))} style={{ width: 'auto' }}>
                            {months.map((m, idx) => <option key={idx} value={idx + 1}>{m}</option>)}
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Ano:</label>
                        <select className="form-select" value={year} onChange={(e) => setYear(parseInt(e.target.value))} style={{ width: 'auto' }}>
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Resumo */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="card text-center" style={{ padding: '1.25rem' }}>
                    <div className="text-sm text-muted mb-1">Entradas</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--success-500, #10b981)' }}>R$ {totalEntradas.toFixed(2)}</div>
                </div>
                <div className="card text-center" style={{ padding: '1.25rem' }}>
                    <div className="text-sm text-muted mb-1">Saídas (pagas)</div>
                    <div className="text-2xl font-bold" style={{ color: 'var(--error-500)' }}>R$ {totalSaidas.toFixed(2)}</div>
                </div>
                <div className="card text-center" style={{ padding: '1.25rem' }}>
                    <div className="text-sm text-muted mb-1">Saldo</div>
                    <div className="text-2xl font-bold" style={{ color: saldo >= 0 ? 'var(--primary-500)' : 'var(--error-500)' }}>R$ {saldo.toFixed(2)}</div>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {/* Registrar entrada manual */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 className="font-semibold mb-4">+ Entrada Manual</h3>
                    <div className="flex flex-col gap-3">
                        <input
                            type="date"
                            className="form-input"
                            value={incomeForm.date}
                            onChange={(e) => setIncomeForm(prev => ({ ...prev, date: e.target.value }))}
                        />
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Descrição (ex: Sinal recebido em dinheiro)"
                            value={incomeForm.description}
                            onChange={(e) => setIncomeForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                        <input
                            type="number"
                            step="0.01"
                            className="form-input"
                            placeholder="Valor (R$)"
                            value={incomeForm.value}
                            onChange={(e) => setIncomeForm(prev => ({ ...prev, value: e.target.value }))}
                        />
                        <button onClick={handleSaveIncome} className="btn btn-primary" disabled={savingIncome}>
                            {savingIncome ? 'Salvando...' : 'Registrar Entrada'}
                        </button>
                    </div>
                </div>

                {/* Registrar/editar saída */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 className="font-semibold mb-4">{editingId ? '✏️ Editar Saída' : '+ Nova Saída'}</h3>
                    <div className="flex flex-col gap-3">
                        <input
                            type="date"
                            className="form-input"
                            value={expenseForm.date}
                            onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                        />
                        <select
                            className="form-select"
                            value={expenseForm.category}
                            onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                        >
                            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Descrição (ex: Compra de shampoo)"
                            value={expenseForm.description}
                            onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                        />
                        <div className="flex gap-3">
                            <input
                                type="number"
                                step="0.01"
                                className="form-input flex-1"
                                placeholder="Valor (R$)"
                                value={expenseForm.value}
                                onChange={(e) => setExpenseForm(prev => ({ ...prev, value: e.target.value }))}
                            />
                            <select
                                className="form-select"
                                style={{ width: '140px' }}
                                value={expenseForm.status}
                                onChange={(e) => setExpenseForm(prev => ({ ...prev, status: e.target.value }))}
                            >
                                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                            </select>
                        </div>
                        <input
                            type="text"
                            className="form-input"
                            placeholder="Forma de pagamento (opcional)"
                            value={expenseForm.paymentMethod}
                            onChange={(e) => setExpenseForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                        />
                        <div className="flex gap-2">
                            <button onClick={handleSaveExpense} className="btn btn-primary flex-1" disabled={savingExpense}>
                                {savingExpense ? 'Salvando...' : editingId ? 'Salvar Alteração' : 'Registrar Saída'}
                            </button>
                            {editingId && (
                                <button onClick={resetExpenseForm} className="btn btn-ghost">Cancelar</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Lista de saídas do período */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">📋 Saídas de {months[month - 1]}/{year}</h3>
                {expensesInPeriod.length === 0 ? (
                    <p className="text-center text-muted py-4">Nenhuma saída registrada nesse período.</p>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-muted">
                                    <th className="pb-2">Data</th>
                                    <th className="pb-2">Categoria</th>
                                    <th className="pb-2">Descrição</th>
                                    <th className="pb-2">Status</th>
                                    <th className="pb-2 text-right">Valor</th>
                                    <th className="pb-2"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {expensesInPeriod
                                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                                    .map(entry => (
                                        <tr key={entry.id} style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <td className="py-2">{new Date(entry.date + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                                            <td className="py-2">{categoryLabel(entry.category)}</td>
                                            <td className="py-2">{entry.description}</td>
                                            <td className="py-2">
                                                <span className={entry.status === 'pago' ? 'text-secondary' : entry.status === 'cancelado' ? 'text-muted' : ''}>
                                                    {STATUSES.find(s => s.value === entry.status)?.label || entry.status}
                                                </span>
                                            </td>
                                            <td className="py-2 text-right font-medium">R$ {entry.value.toFixed(2)}</td>
                                            <td className="py-2 text-right">
                                                <button onClick={() => startEditExpense(entry)} className="btn btn-outline btn-sm" title="Editar">✏️</button>
                                                <button
                                                    onClick={() => handleDeleteExpense(entry.id, entry.description)}
                                                    className="btn btn-ghost btn-sm"
                                                    title="Remover"
                                                    style={{ color: 'var(--error-500)' }}
                                                >
                                                    🗑️
                                                </button>
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
