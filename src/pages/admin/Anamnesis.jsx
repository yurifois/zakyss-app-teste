import { useState, useEffect } from 'react'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

const QUESTION_TYPES = [
    { value: 'texto_curto', label: 'Texto curto' },
    { value: 'sim_nao', label: 'Sim / Não' },
    { value: 'multipla_escolha', label: 'Múltipla escolha' },
    { value: 'data', label: 'Data' },
    { value: 'escala', label: 'Escala (1 a 5)' },
    { value: 'aceite', label: 'Aceite / Termo' },
]

const emptyQuestion = () => ({ id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, type: 'texto_curto', label: '', required: false, options: [] })

export default function AdminAnamnesis() {
    const { success, error } = useToast()

    const [forms, setForms] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingId, setEditingId] = useState(null)
    const [formName, setFormName] = useState('')
    const [questions, setQuestions] = useState([emptyQuestion()])
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadForms()
    }, [])

    const loadForms = async () => {
        setLoading(true)
        try {
            const data = await api.getAnamnesisForms()
            setForms(data)
        } catch (err) {
            console.error('Erro ao carregar fichas:', err)
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setEditingId(null)
        setFormName('')
        setQuestions([emptyQuestion()])
    }

    const startEdit = (form) => {
        setEditingId(form.id)
        setFormName(form.name)
        setQuestions(form.questions.map(q => ({ ...q, options: q.options || [] })))
    }

    const updateQuestion = (id, patch) => {
        setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
    }

    const addQuestion = () => setQuestions(prev => [...prev, emptyQuestion()])
    const removeQuestion = (id) => setQuestions(prev => prev.filter(q => q.id !== id))

    const handleSave = async () => {
        if (!formName.trim()) {
            error('Dê um nome pra ficha')
            return
        }
        if (questions.some(q => !q.label.trim())) {
            error('Toda pergunta precisa de um texto')
            return
        }
        setSaving(true)
        try {
            const payload = { name: formName, questions }
            if (editingId) {
                await api.updateAnamnesisForm(editingId, payload)
                success('Ficha atualizada!')
            } else {
                await api.createAnamnesisForm(payload)
                success('Ficha criada!')
            }
            resetForm()
            loadForms()
        } catch (err) {
            error(err.message || 'Erro ao salvar ficha')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id, name) => {
        if (!confirm(`Remover a ficha "${name}"? Ela será desanexada de qualquer serviço que a use.`)) return
        try {
            await api.deleteAnamnesisForm(id)
            success('Ficha removida!')
            if (editingId === id) resetForm()
            loadForms()
        } catch (err) {
            error(err.message || 'Erro ao remover ficha')
        }
    }

    if (loading) {
        return <div className="text-center py-16">⏳ Carregando...</div>
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">📋 Fichas de Anamnese</h1>
                <p className="text-secondary">
                    Crie fichas de triagem e anexe a um serviço em Serviços → Editar. Quando o cliente
                    agendar esse serviço, a ficha aparece pra ele preencher antes de confirmar — sem
                    precisar mandar nada manualmente depois.
                </p>
            </div>

            {/* Criar/editar ficha */}
            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">{editingId ? '✏️ Editar Ficha' : 'Criar Ficha'}</h3>
                <input
                    type="text"
                    className="form-input mb-4"
                    placeholder="Nome da ficha (ex: Anamnese - Coloração)"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                />

                <div className="flex flex-col gap-3 mb-4">
                    {questions.map((q, idx) => (
                        <div key={q.id} style={{ padding: '0.75rem', background: 'var(--secondary-500)', borderRadius: '0.5rem' }}>
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                                <span className="text-sm text-muted" style={{ width: '20px' }}>{idx + 1}.</span>
                                <input
                                    type="text"
                                    className="form-input flex-1"
                                    style={{ minWidth: '160px' }}
                                    placeholder="Texto da pergunta"
                                    value={q.label}
                                    onChange={(e) => updateQuestion(q.id, { label: e.target.value })}
                                />
                                <select
                                    className="form-select"
                                    style={{ width: '160px' }}
                                    value={q.type}
                                    onChange={(e) => updateQuestion(q.id, { type: e.target.value })}
                                >
                                    {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                                <label className="flex items-center gap-1 text-sm cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={q.required}
                                        onChange={(e) => updateQuestion(q.id, { required: e.target.checked })}
                                    />
                                    Obrigatória
                                </label>
                                <button
                                    onClick={() => removeQuestion(q.id)}
                                    className="btn btn-ghost btn-sm"
                                    style={{ color: 'var(--error-500)' }}
                                    disabled={questions.length === 1}
                                >
                                    🗑️
                                </button>
                            </div>

                            {q.type === 'multipla_escolha' && (
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="Opções separadas por vírgula (ex: Leve, Moderado, Intenso)"
                                    value={(q.options || []).join(', ')}
                                    onChange={(e) => updateQuestion(q.id, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                                />
                            )}
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <button onClick={addQuestion} className="btn btn-outline btn-sm">+ Adicionar pergunta</button>
                    <div className="flex-1" />
                    <button onClick={handleSave} className="btn btn-primary" disabled={saving}>
                        {saving ? 'Salvando...' : editingId ? 'Salvar Alteração' : 'Criar Ficha'}
                    </button>
                    {editingId && <button onClick={resetForm} className="btn btn-ghost">Cancelar</button>}
                </div>
            </div>

            {/* Lista de fichas */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">Fichas Cadastradas</h3>
                {forms.length === 0 ? (
                    <p className="text-center text-muted py-4">Nenhuma ficha cadastrada ainda.</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {forms.map(form => (
                            <div key={form.id} className="flex items-center justify-between gap-3" style={{ padding: '0.75rem', background: 'var(--secondary-500)', borderRadius: '0.5rem' }}>
                                <div>
                                    <span className="font-medium" style={{ color: 'var(--primary-500)' }}>{form.name}</span>
                                    <div className="text-sm text-muted">{form.questions.length} pergunta(s)</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => startEdit(form)} className="btn btn-outline btn-sm">✏️</button>
                                    <button onClick={() => handleDelete(form.id, form.name)} className="btn btn-ghost btn-sm" style={{ color: 'var(--error-500)' }}>🗑️</button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
