import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'

export default function Analytics() {
    const { admin } = useAuth()
    const now = new Date()

    // Filters
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [selectedMonths, setSelectedMonths] = useState([])
    const [year, setYear] = useState(now.getFullYear())
    const [selectedEmployees, setSelectedEmployees] = useState([])
    const [selectedServices, setSelectedServices] = useState([])
    const [selectedStatuses, setSelectedStatuses] = useState(['completed'])
    const [selectedWeekdays, setSelectedWeekdays] = useState([])

    // Data
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(false)
    const [employees, setEmployees] = useState([])
    const [services, setServices] = useState([])

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const statuses = [
        { value: 'pending', label: 'Pendente' },
        { value: 'confirmed', label: 'Confirmado' },
        { value: 'completed', label: 'Concluído' },
        { value: 'cancelled', label: 'Cancelado' },
        { value: 'no_show', label: 'Não compareceu' }
    ]

    const years = []
    for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) {
        years.push(y)
    }

    useEffect(() => {
        loadData()
    }, [admin])

    const loadData = async () => {
        if (!admin) return
        setLoading(true)

        try {
            const result = await api.getAnalytics(admin.establishmentId, {
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                months: selectedMonths.length > 0 ? selectedMonths : undefined,
                year: year,
                employees: selectedEmployees.length > 0 ? selectedEmployees : undefined,
                services: selectedServices.length > 0 ? selectedServices : undefined,
                statuses: selectedStatuses.length > 0 ? selectedStatuses : undefined,
                weekdays: selectedWeekdays.length > 0 ? selectedWeekdays : undefined
            })
            setData(result)
            setEmployees(result.employees || [])
            setServices(result.services || [])
        } catch (err) {
            console.error('Error loading analytics:', err)
        } finally {
            setLoading(false)
        }
    }

    const toggleMonth = (m) => {
        setSelectedMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m].sort((a, b) => a - b))
    }

    const toggleWeekday = (d) => {
        setSelectedWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b))
    }

    const toggleEmployee = (id) => {
        setSelectedEmployees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const toggleService = (id) => {
        setSelectedServices(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
    }

    const toggleStatus = (s) => {
        setSelectedStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
    }

    const clearAllFilters = () => {
        setStartDate('')
        setEndDate('')
        setSelectedMonths([])
        setSelectedEmployees([])
        setSelectedServices([])
        setSelectedStatuses(['completed'])
        setSelectedWeekdays([])
    }

    const getBarWidth = (value, max) => {
        if (!max || max === 0) return 0
        return Math.max(5, (value / max) * 100)
    }

    return (
        <div>
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">📊 Analytics</h1>
                <p className="text-secondary">Análise detalhada do estabelecimento</p>
            </div>

            {/* Filters Panel */}
            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold">Filtros</h3>
                    <div className="flex gap-2">
                        <button onClick={clearAllFilters} className="btn btn-ghost btn-sm">Limpar</button>
                        <button onClick={loadData} className="btn btn-primary btn-sm">🔍 Aplicar Filtros</button>
                    </div>
                </div>

                {/* Date Range */}
                <div className="mb-4">
                    <label className="text-sm font-medium mb-2 block">📅 Período</label>
                    <div className="flex flex-wrap gap-2 items-center">
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: 'auto' }}
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                        />
                        <span>até</span>
                        <input
                            type="date"
                            className="form-input"
                            style={{ width: 'auto' }}
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                        />
                    </div>
                </div>

                {/* Year and Months */}
                <div className="mb-4">
                    <div className="flex items-center gap-4 mb-2">
                        <label className="text-sm font-medium">📆 Ano:</label>
                        <select
                            className="form-select"
                            style={{ width: 'auto' }}
                            value={year}
                            onChange={e => setYear(parseInt(e.target.value))}
                        >
                            {years.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                    <div className="flex flex-wrap gap-1">
                        {months.map((m, idx) => (
                            <button
                                key={idx}
                                className={`btn btn-sm ${selectedMonths.includes(idx + 1) ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => toggleMonth(idx + 1)}
                                style={{ minWidth: '45px' }}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Weekdays */}
                <div className="mb-4">
                    <label className="text-sm font-medium mb-2 block">📅 Dias da Semana</label>
                    <div className="flex flex-wrap gap-1">
                        {weekdays.map((d, idx) => (
                            <button
                                key={idx}
                                className={`btn btn-sm ${selectedWeekdays.includes(idx) ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => toggleWeekday(idx)}
                                style={{ minWidth: '45px' }}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Status */}
                <div className="mb-4">
                    <label className="text-sm font-medium mb-2 block">📋 Status</label>
                    <div className="flex flex-wrap gap-1">
                        {statuses.map(s => (
                            <button
                                key={s.value}
                                className={`btn btn-sm ${selectedStatuses.includes(s.value) ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => toggleStatus(s.value)}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Employees */}
                {employees.length > 0 && (
                    <div className="mb-4">
                        <label className="text-sm font-medium mb-2 block">👤 Funcionários</label>
                        <div className="flex flex-wrap gap-1">
                            {employees.map(e => (
                                <button
                                    key={e.id}
                                    className={`btn btn-sm ${selectedEmployees.includes(e.id) ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => toggleEmployee(e.id)}
                                >
                                    {e.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Services */}
                {services.length > 0 && (
                    <div className="mb-4">
                        <label className="text-sm font-medium mb-2 block">✂️ Serviços</label>
                        <div className="flex flex-wrap gap-1">
                            {services.map(s => (
                                <button
                                    key={s.id}
                                    className={`btn btn-sm ${selectedServices.includes(s.id) ? 'btn-primary' : 'btn-outline'}`}
                                    onClick={() => toggleService(s.id)}
                                >
                                    {s.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {loading ? (
                <div className="card py-8 text-center">Carregando...</div>
            ) : !data ? (
                <div className="card py-8 text-center text-muted">Clique em "Aplicar Filtros" para ver os dados</div>
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <div className="text-sm text-muted mb-1">Atendimentos</div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--primary-600)' }}>
                                {data.summary?.totalAppointments || 0}
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <div className="text-sm text-muted mb-1">Faturamento</div>
                            <div className="text-2xl font-bold">
                                R$ {(data.summary?.totalRevenue || 0).toFixed(2)}
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <div className="text-sm text-muted mb-1">Ticket Médio</div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--success-600)' }}>
                                R$ {(data.summary?.ticketMedio || 0).toFixed(2)}
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <div className="text-sm text-muted mb-1">Comissões</div>
                            <div className="text-2xl font-bold" style={{ color: 'var(--primary-500)' }}>
                                R$ {(data.summary?.totalCommission || 0).toFixed(2)}
                            </div>
                        </div>
                    </div>

                    {/* Top Performers */}
                    <div className="grid md:grid-cols-2 gap-4 mb-6">
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <div className="text-sm text-muted mb-1">🏆 Top Funcionário</div>
                            <div className="text-xl font-bold" style={{ color: 'var(--primary-500)' }}>
                                {data.summary?.topEmployee || '-'}
                            </div>
                        </div>
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <div className="text-sm text-muted mb-1">⭐ Serviço Mais Popular</div>
                            <div className="text-xl font-bold" style={{ color: 'var(--primary-500)' }}>
                                {data.summary?.topService || '-'}
                            </div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div className="grid lg:grid-cols-2 gap-6 mb-6">
                        {/* Monthly Chart */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h3 className="font-bold mb-4">📈 Faturamento por Mês</h3>
                            {data.monthlyData?.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                    {data.monthlyData.map(m => {
                                        const max = Math.max(...data.monthlyData.map(x => x.revenue))
                                        return (
                                            <div key={m.month} className="flex items-center gap-2">
                                                <span className="text-xs text-muted" style={{ width: '60px' }}>
                                                    {m.month}
                                                </span>
                                                <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: '4px', height: '24px', position: 'relative' }}>
                                                    <div
                                                        style={{
                                                            width: `${getBarWidth(m.revenue, max)}%`,
                                                            background: 'linear-gradient(90deg, var(--primary-400), var(--primary-600))',
                                                            height: '100%',
                                                            borderRadius: '4px',
                                                            transition: 'width 0.3s'
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs font-medium" style={{ width: '80px', textAlign: 'right' }}>
                                                    R$ {m.revenue.toFixed(0)}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center text-muted py-4">Sem dados</div>
                            )}
                        </div>

                        {/* Weekday Chart */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h3 className="font-bold mb-4">📊 Atendimentos por Dia</h3>
                            {data.weekdayData ? (
                                <div className="flex flex-col gap-2">
                                    {data.weekdayData.map((d, idx) => {
                                        const max = Math.max(...data.weekdayData.map(x => x.appointments))
                                        return (
                                            <div key={idx} className="flex items-center gap-2">
                                                <span className="text-xs text-muted" style={{ width: '60px' }}>
                                                    {d.day}
                                                </span>
                                                <div style={{ flex: 1, background: 'var(--gray-100)', borderRadius: '4px', height: '24px' }}>
                                                    <div
                                                        style={{
                                                            width: `${getBarWidth(d.appointments, max)}%`,
                                                            background: 'linear-gradient(90deg, var(--success-400), var(--success-600))',
                                                            height: '100%',
                                                            borderRadius: '4px'
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-xs font-medium" style={{ width: '40px', textAlign: 'right' }}>
                                                    {d.appointments}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            ) : (
                                <div className="text-center text-muted py-4">Sem dados</div>
                            )}
                        </div>
                    </div>

                    {/* Rankings */}
                    <div className="grid lg:grid-cols-2 gap-6">
                        {/* Employee Ranking */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h3 className="font-bold mb-4">👤 Ranking Funcionários</h3>
                            {data.employeeRanking?.length > 0 ? (
                                <div className="table-container">
                                    <table className="table" style={{ fontSize: '0.875rem' }}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Nome</th>
                                                <th style={{ textAlign: 'center' }}>Serv.</th>
                                                <th style={{ textAlign: 'right' }}>Comissão</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.employeeRanking.map((e, idx) => (
                                                <tr key={e.id}>
                                                    <td>
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? '#cd7f32' : 'var(--gray-200)',
                                                            fontWeight: 'bold',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            {idx + 1}
                                                        </span>
                                                    </td>
                                                    <td className="font-medium" style={{ color: 'var(--primary-500)' }}>{e.name}</td>
                                                    <td style={{ textAlign: 'center' }}>{e.services}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {e.commission.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center text-muted py-4">Sem dados</div>
                            )}
                        </div>

                        {/* Service Ranking */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h3 className="font-bold mb-4">✂️ Ranking Serviços</h3>
                            {data.serviceRanking?.length > 0 ? (
                                <div className="table-container">
                                    <table className="table" style={{ fontSize: '0.875rem' }}>
                                        <thead>
                                            <tr>
                                                <th>#</th>
                                                <th>Serviço</th>
                                                <th style={{ textAlign: 'center' }}>Qtd</th>
                                                <th style={{ textAlign: 'right' }}>Faturamento</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.serviceRanking.map((s, idx) => (
                                                <tr key={s.id}>
                                                    <td>
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            background: idx === 0 ? 'gold' : idx === 1 ? 'silver' : idx === 2 ? '#cd7f32' : 'var(--gray-200)',
                                                            fontWeight: 'bold',
                                                            fontSize: '0.75rem'
                                                        }}>
                                                            {idx + 1}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <span className="badge badge-secondary">{s.name}</span>
                                                    </td>
                                                    <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{s.count}x</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>R$ {s.revenue.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center text-muted py-4">Sem dados</div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
