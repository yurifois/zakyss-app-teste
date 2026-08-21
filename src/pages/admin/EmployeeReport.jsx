import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'

export default function EmployeeReport() {
    const { admin } = useAuth()

    const [report, setReport] = useState([])
    const [summary, setSummary] = useState(null)
    const [loading, setLoading] = useState(true)

    // Default to current month
    const now = new Date()
    const [month, setMonth] = useState(now.getMonth() + 1)
    const [year, setYear] = useState(now.getFullYear())

    // Detail Modal
    const [showDetailModal, setShowDetailModal] = useState(false)
    const [detailData, setDetailData] = useState([])
    const [detailLoading, setDetailLoading] = useState(false)
    const [detailYear, setDetailYear] = useState(now.getFullYear())
    const [selectedMonths, setSelectedMonths] = useState([now.getMonth() + 1])

    useEffect(() => {
        loadReport()
    }, [admin, month, year])

    const [togglingId, setTogglingId] = useState(null)

    const handleTogglePayment = async (row) => {
        if (!admin || !row.employeeId) return
        setTogglingId(row.employeeId)
        try {
            if (row.paymentStatus === 'pago') {
                await api.markCommissionPending(admin.establishmentId, { employeeId: row.employeeId, month, year })
            } else {
                await api.markCommissionPaid(admin.establishmentId, {
                    employeeId: row.employeeId, month, year, amount: row.employeeRevenue
                })
            }
            loadReport()
        } catch (err) {
            console.error('Erro ao atualizar status de pagamento:', err)
        } finally {
            setTogglingId(null)
        }
    }

    const loadReport = async () => {
        if (!admin) return
        setLoading(true)

        try {
            const data = await api.getEmployeeReport(admin.establishmentId, month, year)
            setReport(data.report || [])
            setSummary(data.summary || null)
        } catch (err) {
            console.error('Error loading report:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadDetailData = async () => {
        if (!admin || selectedMonths.length === 0) return
        setDetailLoading(true)

        try {
            const data = await api.getEmployeeDetailReport(admin.establishmentId, selectedMonths, detailYear)
            setDetailData(data.report || [])
        } catch (err) {
            console.error('Error loading detail data:', err)
        } finally {
            setDetailLoading(false)
        }
    }

    useEffect(() => {
        if (showDetailModal && selectedMonths.length > 0) {
            loadDetailData()
        }
    }, [showDetailModal, selectedMonths, detailYear])

    const toggleMonth = (m) => {
        setSelectedMonths(prev => {
            if (prev.includes(m)) {
                return prev.filter(x => x !== m)
            }
            return [...prev, m].sort((a, b) => a - b)
        })
    }

    const selectAllMonths = () => {
        setSelectedMonths([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    }

    const clearMonths = () => {
        setSelectedMonths([])
    }

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]

    const shortMonths = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    // Generate year options (current year + 2 years back)
    const years = []
    for (let y = now.getFullYear(); y >= now.getFullYear() - 2; y--) {
        years.push(y)
    }

    const getSelectedMonthsLabel = () => {
        if (selectedMonths.length === 0) return 'Nenhum mês'
        if (selectedMonths.length === 12) return 'Ano completo'
        return selectedMonths.map(m => shortMonths[m - 1]).join(', ')
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">📊 Relatório Financeiro</h1>
                <p className="text-secondary">Acompanhe o faturamento gerado por cada funcionário</p>
            </div>

            {/* Filtros */}
            <div className="card mb-6" style={{ padding: '1rem' }}>
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Mês:</label>
                        <select
                            className="form-select"
                            value={month}
                            onChange={(e) => setMonth(parseInt(e.target.value))}
                            style={{ width: 'auto' }}
                        >
                            {months.map((m, idx) => (
                                <option key={idx} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Ano:</label>
                        <select
                            className="form-select"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            style={{ width: 'auto' }}
                        >
                            {years.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={() => setShowDetailModal(true)}
                        className="btn btn-primary btn-sm"
                        title="Ver detalhamento de serviços"
                    >
                        📋 Detalhamento
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div className="text-sm text-muted mb-1">Total de Atendimentos</div>
                        <div className="text-3xl font-bold" style={{ color: 'var(--primary-600)' }}>
                            {summary.totalAppointments}
                        </div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div className="text-sm text-muted mb-1">Faturamento Total</div>
                        <div className="text-3xl font-bold" style={{ color: 'var(--gray-700)' }}>
                            R$ {summary.totalRevenue?.toFixed(2)}
                        </div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div className="text-sm text-muted mb-1">💼 Comissão Funcionários</div>
                        <div className="text-3xl font-bold" style={{ color: 'var(--primary-500)' }}>
                            R$ {summary.totalEmployeeRevenue?.toFixed(2) || '0.00'}
                        </div>
                    </div>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <div className="text-sm text-muted mb-1">🏢 Receita Estabelecimento</div>
                        <div className="text-3xl font-bold" style={{ color: 'var(--success-600)' }}>
                            R$ {summary.totalEstablishmentRevenue?.toFixed(2) || '0.00'}
                        </div>
                    </div>
                </div>
            )}

            {/* Tabela de Relatório */}
            {loading ? (
                <div className="card py-8 text-center">Carregando...</div>
            ) : report.length === 0 ? (
                <div className="card text-center py-12">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                    <p className="text-secondary">Nenhum dado encontrado para este período</p>
                    <p className="text-sm text-muted mt-2">
                        Atribua funcionários aos agendamentos para ver o relatório
                    </p>
                </div>
            ) : (
                <div className="card" style={{ padding: 0 }}>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Funcionário</th>
                                    <th style={{ textAlign: 'center' }}>Atendimentos</th>
                                    <th style={{ textAlign: 'right' }}>Faturamento</th>
                                    <th style={{ textAlign: 'right' }}>💼 Comissão</th>
                                    <th style={{ textAlign: 'right' }}>🏢 Estabelecimento</th>
                                    <th style={{ textAlign: 'center' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.map((row, idx) => (
                                    <tr key={row.employeeId || `unassigned-${idx}`}>
                                        <td>
                                            <div className="flex items-center gap-3">
                                                <div
                                                    style={{
                                                        width: '36px',
                                                        height: '36px',
                                                        borderRadius: '50%',
                                                        background: row.employeeId
                                                            ? 'var(--primary-500)'
                                                            : 'var(--gray-400)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        color: 'white',
                                                        fontWeight: '600',
                                                        fontSize: '0.875rem'
                                                    }}
                                                >
                                                    {row.employeeId
                                                        ? row.employeeName.charAt(0).toUpperCase()
                                                        : '?'}
                                                </div>
                                                <span className={!row.employeeId ? 'text-muted' : 'font-medium'}>
                                                    {row.employeeName}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className="badge badge-primary">
                                                {row.appointmentCount}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="font-semibold" style={{ color: 'var(--gray-700)' }}>
                                                R$ {row.totalRevenue?.toFixed(2)}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="font-semibold" style={{ color: 'var(--primary-500)' }}>
                                                R$ {row.employeeRevenue?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <span className="font-semibold" style={{ color: 'var(--success-600)' }}>
                                                R$ {row.establishmentRevenue?.toFixed(2) || '0.00'}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }}>
                                            {row.employeeId && (
                                                <button
                                                    onClick={() => handleTogglePayment(row)}
                                                    disabled={togglingId === row.employeeId}
                                                    className={`badge ${row.paymentStatus === 'pago' ? 'badge-success' : 'badge-warning'}`}
                                                    style={{ cursor: 'pointer', border: 'none' }}
                                                    title={row.paymentStatus === 'pago' ? 'Clique para marcar como pendente' : 'Clique para marcar como pago'}
                                                >
                                                    {togglingId === row.employeeId ? '...' : row.paymentStatus === 'pago' ? '✅ Pago' : '⏳ Pendente'}
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Info */}
            <div className="card mt-6" style={{ padding: '1rem', background: 'var(--primary-50)' }}>
                <div className="flex items-start gap-3">
                    <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
                    <div>
                        <p className="text-sm text-muted">
                            Este relatório considera apenas agendamentos com status <strong>"Concluído"</strong>.
                            A comissão é calculada com base no percentual configurado em cada serviço (padrão 50%).
                            Para ajustar, acesse a página de <strong>Serviços</strong> e edite cada serviço.
                        </p>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {showDetailModal && (
                <div
                    className="modal-backdrop"
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setShowDetailModal(false)}
                >
                    <div
                        className="card"
                        style={{
                            width: '100%',
                            maxWidth: '900px',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            padding: '2rem',
                            margin: '1rem'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">📋 Detalhamento por Funcionário</h2>
                            <button onClick={() => setShowDetailModal(false)} className="btn btn-ghost btn-sm">✕</button>
                        </div>

                        {/* Year and Month Selection */}
                        <div className="card mb-4" style={{ padding: '1rem', background: 'var(--gray-50)' }}>
                            <div className="flex items-center gap-4 mb-3">
                                <label className="text-sm font-medium">Ano:</label>
                                <select
                                    className="form-select"
                                    value={detailYear}
                                    onChange={(e) => setDetailYear(parseInt(e.target.value))}
                                    style={{ width: 'auto' }}
                                >
                                    {years.map(y => (
                                        <option key={y} value={y}>{y}</option>
                                    ))}
                                </select>
                                <button onClick={selectAllMonths} className="btn btn-outline btn-sm">Todos</button>
                                <button onClick={clearMonths} className="btn btn-ghost btn-sm">Limpar</button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                {shortMonths.map((m, idx) => (
                                    <button
                                        key={idx}
                                        className={`btn btn-sm ${selectedMonths.includes(idx + 1) ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => toggleMonth(idx + 1)}
                                        style={{ minWidth: '50px' }}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>

                            <div className="text-sm text-muted mt-2">
                                Período: <strong>{getSelectedMonthsLabel()}</strong> de {detailYear}
                            </div>
                        </div>

                        {detailLoading ? (
                            <div className="py-8 text-center">Carregando detalhamento...</div>
                        ) : selectedMonths.length === 0 ? (
                            <div className="py-8 text-center text-muted">Selecione pelo menos um mês</div>
                        ) : detailData.length === 0 ? (
                            <div className="py-8 text-center text-muted">Nenhum atendimento encontrado no período</div>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {detailData.map(emp => (
                                    <div key={emp.employeeId} className="card" style={{ padding: '1rem', border: '1px solid var(--primary-200)' }}>
                                        <div className="flex items-center gap-3 mb-3">
                                            <div
                                                style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    background: 'var(--primary-500)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    fontWeight: '600'
                                                }}
                                            >
                                                {emp.employeeName.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <div className="font-bold" style={{ color: 'var(--primary-500)' }}>{emp.employeeName}</div>
                                                <div className="text-sm text-muted">
                                                    {emp.totalCount} serviços • R$ {emp.totalCommission.toFixed(2)} comissão
                                                </div>
                                            </div>
                                        </div>

                                        <div className="table-container" style={{ maxHeight: '200px' }}>
                                            <table className="table" style={{ fontSize: '0.875rem' }}>
                                                <thead>
                                                    <tr>
                                                        <th>Serviço</th>
                                                        <th style={{ textAlign: 'center' }}>Qtd</th>
                                                        <th style={{ textAlign: 'right' }}>Faturamento</th>
                                                        <th style={{ textAlign: 'right' }}>Comissão</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {emp.services.map(s => (
                                                        <tr key={s.serviceId}>
                                                            <td>
                                                                <span className="badge badge-secondary">{s.serviceName}</span>
                                                            </td>
                                                            <td style={{ textAlign: 'center' }}>
                                                                <strong>{s.count}x</strong>
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                R$ {s.revenue.toFixed(2)}
                                                            </td>
                                                            <td style={{ textAlign: 'right' }}>
                                                                <span style={{ color: 'var(--primary-500)', fontWeight: '600' }}>
                                                                    R$ {s.commission.toFixed(2)}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                                <tfoot>
                                                    <tr style={{ fontWeight: 'bold', background: 'var(--gray-50)' }}>
                                                        <td>Total</td>
                                                        <td style={{ textAlign: 'center' }}>{emp.totalCount}x</td>
                                                        <td style={{ textAlign: 'right' }}>R$ {emp.totalRevenue.toFixed(2)}</td>
                                                        <td style={{ textAlign: 'right', color: 'var(--primary-600)' }}>
                                                            R$ {emp.totalCommission.toFixed(2)}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
