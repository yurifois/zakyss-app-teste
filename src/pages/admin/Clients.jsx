import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'

export default function AdminClients() {
    const { admin } = useAuth()
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [expandedKey, setExpandedKey] = useState(null)

    useEffect(() => {
        if (admin) {
            loadClients()
        }
    }, [admin])

    const loadClients = async () => {
        setLoading(true)
        try {
            const data = await api.getEstablishmentClients(admin.establishmentId)
            setClients(data)
        } catch (err) {
            console.error('Error loading clients:', err)
        } finally {
            setLoading(false)
        }
    }

    const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-')
        return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
    }

    const filteredClients = clients.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.phone?.includes(search) ||
        c.email?.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Clientes</h1>
                <p className="text-secondary">
                    Ficha de cada cliente com o histórico de serviços já concluídos neste estabelecimento
                </p>
            </div>

            <div className="mb-4">
                <input
                    type="text"
                    className="form-input"
                    style={{ maxWidth: '360px' }}
                    placeholder="Buscar por nome, telefone ou email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="card py-8 text-center">Carregando...</div>
            ) : filteredClients.length === 0 ? (
                <div className="card text-center py-12">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🗂️</div>
                    <p className="text-secondary">
                        {clients.length === 0
                            ? 'Nenhum cliente com serviço concluído ainda — a ficha é preenchida automaticamente quando você marcar um agendamento como concluído.'
                            : 'Nenhum cliente encontrado com esse filtro.'}
                    </p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 gap-4 items-start">
                    {filteredClients.map(client => {
                        const key = client.phone || client.email
                        const isExpanded = expandedKey === key

                        return (
                            <div key={key} className="card" style={{ padding: '1.25rem', cursor: 'pointer' }} onClick={() => setExpandedKey(isExpanded ? null : key)}>
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-base font-semibold">{client.name}</h3>
                                        <p className="text-sm text-secondary">📱 {client.phone}</p>
                                        {client.email && <p className="text-sm text-secondary">✉️ {client.email}</p>}
                                    </div>
                                    <div className="text-right" style={{ flexShrink: 0 }}>
                                        <span className="badge badge-primary">{client.visitCount} atendimento(s)</span>
                                        <p className="text-xs text-muted mt-1">Último: {formatDate(client.lastVisit)}</p>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                                        <p className="text-sm text-muted mb-2">Histórico de serviços</p>
                                        <div className="flex flex-col gap-2">
                                            {client.history.map((visit, index) => (
                                                <div key={index} className="flex items-center justify-between text-sm" style={{ padding: '0.4rem 0' }}>
                                                    <div>
                                                        <strong>{formatDate(visit.date)}</strong>{' '}
                                                        <span className="text-secondary">{visit.services.join(', ')}</span>
                                                        {visit.notes && (
                                                            <div className="text-xs text-muted italic">📝 {visit.notes}</div>
                                                        )}
                                                    </div>
                                                    <span className="text-muted">R$ {visit.totalPrice?.toFixed(2)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
