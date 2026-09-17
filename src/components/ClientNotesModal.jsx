import { useState, useEffect } from 'react'
import * as api from '../services/api'
import { useToast } from '../contexts/ToastContext'

// Marcações objetivas de comportamento — mesmas do backend. Ficam opcionais:
// o centro da tela é o campo de texto livre, pra anotação do procedimento.
export const FLAG_OPTIONS = [
    { value: 'atraso', label: '⏰ Atrasou' },
    { value: 'falta', label: '🚫 Faltou' },
    { value: 'cancelamento_recorrente', label: '🔁 Cancela com frequência' },
    { value: 'pontual', label: '✅ Pontual' },
    { value: 'comunicacao_dificil', label: '⚠️ Comunicação difícil' },
    { value: 'boa_comunicacao', label: '💬 Boa comunicação' },
]
export const FLAG_LABELS = Object.fromEntries(FLAG_OPTIONS.map(f => [f.value, f.label]))

const formatBrDate = (dateStr) => {
    if (!dateStr) return ''
    const [y, m, d] = String(dateStr).split('-')
    if (!y || !m || !d) return dateStr
    return `${d}/${m}/${y}`
}

/**
 * Card de anotações de um cliente. Usado na ficha do cliente e dentro do
 * card do agendamento — mesma lista nos dois lugares, porque a chave é a
 * mesma (telefone normalizado, ou email como fallback).
 *
 * props:
 *  - clientKey   (obrigatório) identificador do cliente
 *  - clientName  nome exibido no cabeçalho
 *  - appointment (opcional) { id, date, serviceName } — quando a anotação
 *                nasce de um atendimento, fica marcada com esse procedimento
 *  - initialNotes (opcional) lista já carregada, evita um request
 *  - onClose     fecha o modal
 *  - onNotesChange(notes) avisa quem abriu, pra atualizar contador/cache
 */
export default function ClientNotesModal({
    clientKey,
    clientName,
    appointment = null,
    initialNotes = null,
    onClose,
    onNotesChange
}) {
    const { success, error } = useToast()

    // initialNotes só conta como "já carregado" se for mesmo um array.
    // undefined = o pai ainda não buscou, então o modal busca sozinho.
    const hasInitial = Array.isArray(initialNotes)
    const [notes, setNotes] = useState(hasInitial ? initialNotes : [])
    const [loading, setLoading] = useState(!hasInitial)
    const [noteText, setNoteText] = useState('')
    const [flags, setFlags] = useState([])
    const [showFlags, setShowFlags] = useState(false)
    const [saving, setSaving] = useState(false)
    const [linkToAppointment, setLinkToAppointment] = useState(!!appointment)

    const [editingId, setEditingId] = useState(null)
    const [editText, setEditText] = useState('')
    const [savingEdit, setSavingEdit] = useState(false)

    useEffect(() => {
        let active = true
        if (hasInitial) return

        const load = async () => {
            setLoading(true)
            try {
                const data = await api.getClientNotes(clientKey)
                if (active) setNotes(data || [])
            } catch (err) {
                console.error('Erro ao carregar anotações:', err)
                if (active) error('Não foi possível carregar as anotações')
            } finally {
                if (active) setLoading(false)
            }
        }
        load()
        return () => { active = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientKey])

    const publish = (next) => {
        setNotes(next)
        if (onNotesChange) onNotesChange(next)
    }

    const toggleFlag = (flag) => {
        setFlags(prev => prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag])
    }

    const handleSave = async () => {
        if (!noteText.trim() && flags.length === 0) {
            error('Escreva uma anotação ou selecione uma marcação')
            return
        }
        setSaving(true)
        try {
            const payload = {
                clientKey,
                clientName: clientName || '',
                flags,
                note: noteText
            }
            if (appointment && linkToAppointment) {
                payload.appointmentId = appointment.id
                payload.serviceName = appointment.serviceName || ''
                payload.appointmentDate = appointment.date || ''
            }
            const entry = await api.addClientNote(payload)
            publish([entry, ...notes])
            setNoteText('')
            setFlags([])
            setShowFlags(false)
            success('Anotação salva!')
        } catch (err) {
            error(err.message || 'Erro ao salvar anotação')
        } finally {
            setSaving(false)
        }
    }

    const startEdit = (note) => {
        setEditingId(note.id)
        setEditText(note.note || '')
    }

    const handleSaveEdit = async (note) => {
        if (!editText.trim() && (note.flags || []).length === 0) {
            error('A anotação não pode ficar vazia')
            return
        }
        setSavingEdit(true)
        try {
            const updated = await api.updateClientNote(note.id, { note: editText, flags: note.flags || [] })
            publish(notes.map(n => n.id === note.id ? { ...n, ...updated } : n))
            setEditingId(null)
            setEditText('')
            success('Anotação atualizada!')
        } catch (err) {
            error(err.message || 'Erro ao atualizar anotação')
        } finally {
            setSavingEdit(false)
        }
    }

    const handleDelete = async (note) => {
        if (!confirm('Remover esta anotação? Essa ação não pode ser desfeita.')) return
        try {
            await api.deleteClientNote(note.id)
            publish(notes.filter(n => n.id !== note.id))
            success('Anotação removida')
        } catch (err) {
            error(err.message || 'Erro ao remover anotação')
        }
    }

    return (
        <div
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
                zIndex: 1100
            }}
            onClick={onClose}
        >
            <div
                className="card"
                style={{
                    width: '100%',
                    maxWidth: '620px',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    padding: '1.5rem',
                    margin: '1rem'
                }}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start justify-between gap-3 mb-1">
                    <div style={{ minWidth: 0 }}>
                        <h2 className="text-xl font-bold">📝 Anotações</h2>
                        {clientName && (
                            <p className="text-sm text-secondary" style={{ wordBreak: 'break-word' }}>{clientName}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="btn btn-ghost btn-sm"
                        title="Fechar"
                        style={{ flexShrink: 0 }}
                    >
                        ✕
                    </button>
                </div>

                <p className="text-xs text-muted mb-4">
                    Privado — só este estabelecimento vê. O cliente nunca tem acesso.
                </p>

                {/* Nova anotação */}
                <div
                    className="mb-4"
                    style={{
                        padding: '1rem',
                        border: '1px solid var(--border-color)',
                        borderRadius: '0.75rem'
                    }}
                >
                    {appointment && (
                        <label
                            className="flex items-center gap-2 text-xs mb-2"
                            style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}
                        >
                            <input
                                type="checkbox"
                                checked={linkToAppointment}
                                onChange={(e) => setLinkToAppointment(e.target.checked)}
                            />
                            <span>
                                Vincular ao atendimento de {formatBrDate(appointment.date)}
                                {appointment.serviceName ? ` · ${appointment.serviceName}` : ''}
                            </span>
                        </label>
                    )}

                    <textarea
                        className="form-textarea"
                        rows={4}
                        placeholder="Anotação do procedimento: produtos usados, tempo de pausa, reação do cliente, o que ajustar no próximo atendimento..."
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        style={{ resize: 'vertical' }}
                    />

                    <button
                        type="button"
                        onClick={() => setShowFlags(v => !v)}
                        className="text-xs mt-2"
                        style={{ background: 'none', border: 'none', color: 'var(--primary-400)', cursor: 'pointer', padding: 0 }}
                    >
                        {showFlags ? '▲ Ocultar marcações' : '▼ Marcações rápidas (opcional)'}
                    </button>

                    {showFlags && (
                        <div className="flex flex-wrap gap-1 mt-2">
                            {FLAG_OPTIONS.map(f => (
                                <button
                                    key={f.value}
                                    type="button"
                                    onClick={() => toggleFlag(f.value)}
                                    className="text-xs"
                                    style={{
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '0.375rem',
                                        border: '1px solid var(--border-color)',
                                        background: flags.includes(f.value) ? 'var(--primary-500)' : 'transparent',
                                        color: flags.includes(f.value) ? 'white' : 'inherit',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <button
                        onClick={handleSave}
                        className="btn btn-primary btn-sm mt-3 w-full"
                        disabled={saving}
                    >
                        {saving ? 'Salvando...' : '💾 Salvar anotação'}
                    </button>
                </div>

                {/* Histórico */}
                <p className="text-sm font-medium mb-2">
                    Histórico {notes.length > 0 && <span className="text-muted font-normal">({notes.length})</span>}
                </p>

                {loading ? (
                    <p className="text-sm text-muted">Carregando...</p>
                ) : notes.length === 0 ? (
                    <p className="text-sm text-muted">Nenhuma anotação registrada para este cliente ainda.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {notes.map(n => (
                            <div
                                key={n.id}
                                style={{
                                    padding: '0.75rem',
                                    background: 'var(--secondary-500)',
                                    borderRadius: '0.5rem'
                                }}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div style={{ minWidth: 0, flex: 1 }}>
                                        {(n.serviceName || n.appointmentDate) && (
                                            <p className="text-xs mb-1" style={{ color: 'var(--primary-400)' }}>
                                                💈 {n.serviceName || 'Atendimento'}
                                                {n.appointmentDate ? ` · ${formatBrDate(n.appointmentDate)}` : ''}
                                            </p>
                                        )}

                                        {n.flags?.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mb-1">
                                                {n.flags.map(f => (
                                                    <span
                                                        key={f}
                                                        className="text-xs"
                                                        style={{ background: 'var(--primary-50)', padding: '0.1rem 0.4rem', borderRadius: '0.375rem' }}
                                                    >
                                                        {FLAG_LABELS[f] || f}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {editingId === n.id ? (
                                            <div className="mt-1">
                                                <textarea
                                                    className="form-textarea"
                                                    rows={3}
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    style={{ resize: 'vertical' }}
                                                />
                                                <div className="flex gap-2 mt-2">
                                                    <button
                                                        onClick={() => handleSaveEdit(n)}
                                                        className="btn btn-primary btn-sm"
                                                        disabled={savingEdit}
                                                    >
                                                        {savingEdit ? 'Salvando...' : 'Salvar'}
                                                    </button>
                                                    <button
                                                        onClick={() => { setEditingId(null); setEditText('') }}
                                                        className="btn btn-ghost btn-sm"
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            n.note && (
                                                <p className="text-sm" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                    {n.note}
                                                </p>
                                            )
                                        )}

                                        <p className="text-xs text-muted mt-1">
                                            {n.createdByName || 'Admin'} · {n.createdAt ? new Date(n.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''}
                                        </p>
                                    </div>

                                    {editingId !== n.id && (
                                        <div className="flex gap-1" style={{ flexShrink: 0 }}>
                                            <button
                                                onClick={() => startEdit(n)}
                                                className="btn btn-ghost btn-sm"
                                                title="Editar"
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                onClick={() => handleDelete(n)}
                                                className="btn btn-ghost btn-sm"
                                                style={{ color: 'var(--error-500)' }}
                                                title="Remover"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
