import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

const FLAG_OPTIONS = [
    { value: 'atraso', label: '⏰ Atrasou' },
    { value: 'falta', label: '🚫 Faltou' },
    { value: 'cancelamento_recorrente', label: '🔁 Cancela com frequência' },
    { value: 'pontual', label: '✅ Pontual' },
    { value: 'comunicacao_dificil', label: '⚠️ Comunicação difícil' },
    { value: 'boa_comunicacao', label: '💬 Boa comunicação' },
]
const FLAG_LABELS = Object.fromEntries(FLAG_OPTIONS.map(f => [f.value, f.label]))

export default function AdminClients() {
    const { admin } = useAuth()
    const { success, error } = useToast()
    const [clients, setClients] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [expandedKey, setExpandedKey] = useState(null)

    // Notas internas: carregadas sob demanda, por cliente (key = telefone
    // normalizado, ou email como fallback — igual ao backend usa).
    const [notesByKey, setNotesByKey] = useState({})
    const [loadingNotes, setLoadingNotes] = useState(false)
    const [newFlags, setNewFlags] = useState([])
    const [newNoteText, setNewNoteText] = useState('')
    const [savingNote, setSavingNote] = useState(false)

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

    const toggleExpand = async (client) => {
        const key = client.key
        const opening = expandedKey !== key
        setExpandedKey(opening ? key : null)
        setNewFlags([])
        setNewNoteText('')

        if (opening && !notesByKey[key]) {
            setLoadingNotes(true)
            try {
                const notes = await api.getClientNotes(key)
                setNotesByKey(prev => ({ ...prev, [key]: notes }))
            } catch (err) {
                console.error('Erro ao carregar notas internas:', err)
            } finally {
                setLoadingNotes(false)
            }
        }
    }

    const toggleFlag = (flag) => {
        setNewFlags(prev => prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag])
    }

    const handleAddNote = async (client) => {
        if (newFlags.length === 0 && !newNoteText.trim()) {
            error('Selecione ao menos uma marcação ou escreva uma observação')
            return
        }
        setSavingNote(true)
        try {
            const entry = await api.addClientNote({
                clientKey: client.key,
                clientName: client.name,
                flags: newFlags,
                note: newNoteText
            })
            setNotesByKey(prev => ({ ...prev, [client.key]: [entry, ...(prev[client.key] || [])] }))
            setNewFlags([])
            setNewNoteText('')
            success('Nota registrada!')
        } catch (err) {
            error(err.message || 'Erro ao registrar nota')
        } finally {
            setSavingNote(false)
        }
    }

    const handleDeleteNote = async (client, noteId) => {
        if (!confirm('Remover essa nota interna?')) return
        try {
            await api.deleteClientNote(noteId)
            setNotesByKey(prev => ({ ...prev, [client.key]: prev[client.key].filter(n => n.id !== noteId) }))
        } catch (err) {
            error(err.message || 'Erro ao remover nota')
        }
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
                        const key = client.key
                        const isExpanded = expandedKey === key
                        const notes = notesByKey[key] || []

                        return (
                            <div key={key} className="card" style={{ padding: '1.25rem' }}>
                                <div className="flex items-start justify-between gap-4" style={{ cursor: 'pointer' }} onClick={() => toggleExpand(client)}>
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
                                        <div className="flex flex-col gap-2 mb-4">
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

                                        {/* Notas internas: só o próprio estabelecimento vê, cliente nunca vê */}
                                        <div className="pt-3" style={{ borderTop: '1px solid var(--border-color)' }}>
                                            <p className="text-sm font-medium mb-2">📋 Notas Internas <span className="text-xs text-muted font-normal">(privado — o cliente não vê)</span></p>

                                            {loadingNotes ? (
                                                <p className="text-sm text-muted">Carregando...</p>
                                            ) : notes.length === 0 ? (
                                                <p className="text-sm text-muted mb-2">Nenhuma nota registrada ainda.</p>
                                            ) : (
                                                <div className="flex flex-col gap-2 mb-3">
                                                    {notes.map(n => (
                                                        <div key={n.id} className="text-sm" style={{ padding: '0.5rem', background: 'var(--secondary-500)', borderRadius: '0.5rem' }}>
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div>
                                                                    {n.flags?.length > 0 && (
                                                                        <div className="flex flex-wrap gap-1 mb-1">
                                                                            {n.flags.map(f => (
                                                                                <span key={f} className="text-xs" style={{ background: 'var(--primary-50)', padding: '0.1rem 0.4rem', borderRadius: '0.375rem' }}>
                                                                                    {FLAG_LABELS[f] || f}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                    {n.note && <p>{n.note}</p>}
                                                                    <p className="text-xs text-muted mt-1">
                                                                        {n.createdByName} · {new Date(n.createdAt).toLocaleDateString('pt-BR')}
                                                                    </p>
                                                                </div>
                                                                <button
                                                                    onClick={() => handleDeleteNote(client, n.id)}
                                                                    className="btn btn-ghost btn-sm"
                                                                    style={{ color: 'var(--error-500)' }}
                                                                    title="Remover"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {FLAG_OPTIONS.map(f => (
                                                    <button
                                                        key={f.value}
                                                        onClick={() => toggleFlag(f.value)}
                                                        className="text-xs"
                                                        style={{
                                                            padding: '0.25rem 0.5rem',
                                                            borderRadius: '0.375rem',
                                                            border: '1px solid var(--border-color)',
                                                            background: newFlags.includes(f.value) ? 'var(--primary-500)' : 'transparent',
                                                            color: newFlags.includes(f.value) ? 'white' : 'inherit',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        {f.label}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    className="form-input flex-1"
                                                    placeholder="Observação (opcional)"
                                                    value={newNoteText}
                                                    onChange={(e) => setNewNoteText(e.target.value)}
                                                />
                                                <button
                                                    onClick={() => handleAddNote(client)}
                                                    className="btn btn-primary btn-sm"
                                                    disabled={savingNote}
                                                >
                                                    {savingNote ? 'Salvando...' : 'Registrar'}
                                                </button>
                                            </div>
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
