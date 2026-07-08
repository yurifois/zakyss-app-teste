import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

const DAYS = [
    { key: 'monday', label: 'Segunda-feira' },
    { key: 'tuesday', label: 'Terça-feira' },
    { key: 'wednesday', label: 'Quarta-feira' },
    { key: 'thursday', label: 'Quinta-feira' },
    { key: 'friday', label: 'Sexta-feira' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' },
]

export default function AdminSchedule() {
    const { admin } = useAuth()
    const { success } = useToast()

    const [establishment, setEstablishment] = useState(null)
    const [workingHours, setWorkingHours] = useState({})
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [quickLunchBreak, setQuickLunchBreak] = useState({ start: '12:00', end: '13:00' })

    useEffect(() => {
        if (admin) {
            loadData()
        }
    }, [admin])

    const loadData = async () => {
        setLoading(true)
        try {
            const est = await api.getEstablishmentById(admin.establishmentId)
            setEstablishment(est)

            // Convert workingHours to editable format
            const hours = {}
            DAYS.forEach(({ key }) => {
                const dayHours = est.workingHours[key]
                hours[key] = {
                    enabled: !!dayHours,
                    open: dayHours?.open || '09:00',
                    close: dayHours?.close || '18:00',
                    lunchBreak: {
                        enabled: !!dayHours?.lunchBreak,
                        start: dayHours?.lunchBreak?.start || '12:00',
                        end: dayHours?.lunchBreak?.end || '13:00',
                    },
                }
            })
            setWorkingHours(hours)
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const toggleDay = (day) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day].enabled },
        }))
    }

    const updateHours = (day, field, value) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: { ...prev[day], [field]: value },
        }))
    }

    const toggleLunchBreak = (day) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: { ...prev[day], lunchBreak: { ...prev[day].lunchBreak, enabled: !prev[day].lunchBreak.enabled } },
        }))
    }

    const updateLunchBreak = (day, field, value) => {
        setWorkingHours(prev => ({
            ...prev,
            [day]: { ...prev[day], lunchBreak: { ...prev[day].lunchBreak, [field]: value } },
        }))
    }

    // Aplica o mesmo intervalo de almoço a todos os dias abertos, evitando
    // configurar dia por dia manualmente
    const applyLunchBreakToAllDays = () => {
        setWorkingHours(prev => {
            const next = { ...prev }
            DAYS.forEach(({ key }) => {
                if (next[key]?.enabled) {
                    next[key] = {
                        ...next[key],
                        lunchBreak: { enabled: true, start: quickLunchBreak.start, end: quickLunchBreak.end },
                    }
                }
            })
            return next
        })
        success('Pausa para almoço aplicada a todos os dias abertos!')
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            // Convert back to storage format
            const formattedHours = {}
            Object.entries(workingHours).forEach(([day, data]) => {
                formattedHours[day] = data.enabled
                    ? {
                        open: data.open,
                        close: data.close,
                        ...(data.lunchBreak.enabled ? { lunchBreak: { start: data.lunchBreak.start, end: data.lunchBreak.end } } : {}),
                    }
                    : null
            })

            await api.updateEstablishment(admin.establishmentId, { workingHours: formattedHours })
            success('Horários salvos com sucesso!')
        } catch (error) {
            console.error('Error saving:', error)
        } finally {
            setSaving(false)
        }
    }

    if (loading) return <div className="p-8">Carregando...</div>

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Horários de Funcionamento</h1>
                <p className="text-secondary">Configure os dias e horários de atendimento</p>
            </div>

            <div className="card mb-6" style={{ padding: '1.5rem', maxWidth: '700px' }}>
                <h3 className="font-semibold mb-1">🍽️ Pausa para almoço</h3>
                <p className="text-sm text-secondary mb-4">
                    Defina um intervalo e aplique a todos os dias abertos de uma vez, em vez de configurar dia por dia.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-muted">Início:</label>
                        <input
                            type="time"
                            value={quickLunchBreak.start}
                            onChange={(e) => setQuickLunchBreak(prev => ({ ...prev, start: e.target.value }))}
                            className="form-input"
                            style={{ width: '130px', padding: '0.5rem' }}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-muted">Fim:</label>
                        <input
                            type="time"
                            value={quickLunchBreak.end}
                            onChange={(e) => setQuickLunchBreak(prev => ({ ...prev, end: e.target.value }))}
                            className="form-input"
                            style={{ width: '130px', padding: '0.5rem' }}
                        />
                    </div>
                    <button onClick={applyLunchBreakToAllDays} className="btn btn-secondary btn-sm">
                        Aplicar a todos os dias
                    </button>
                </div>
            </div>

            <div className="card" style={{ padding: '1.5rem', maxWidth: '700px' }}>
                {DAYS.map(({ key, label }) => {
                    const dayData = workingHours[key]
                    if (!dayData) return null

                    return (
                        <div
                            key={key}
                            className="py-4"
                            style={{ borderBottom: key !== 'sunday' ? '1px solid var(--border-color)' : 'none' }}
                        >
                            <div className="flex items-center gap-4">
                                <label className="form-checkbox" style={{ width: '180px' }}>
                                    <input
                                        type="checkbox"
                                        checked={dayData.enabled}
                                        onChange={() => toggleDay(key)}
                                    />
                                    <span className={dayData.enabled ? 'font-medium' : 'text-muted'}>{label}</span>
                                </label>

                                {dayData.enabled ? (
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-muted">Abre:</label>
                                            <input
                                                type="time"
                                                value={dayData.open}
                                                onChange={(e) => updateHours(key, 'open', e.target.value)}
                                                className="form-input"
                                                style={{ width: '130px', padding: '0.5rem' }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-sm text-muted">Fecha:</label>
                                            <input
                                                type="time"
                                                value={dayData.close}
                                                onChange={(e) => updateHours(key, 'close', e.target.value)}
                                                className="form-input"
                                                style={{ width: '130px', padding: '0.5rem' }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-muted">Fechado</span>
                                )}
                            </div>

                            {dayData.enabled && (
                                <div className="flex items-center gap-3 mt-2" style={{ marginLeft: '180px' }}>
                                    <label className="form-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={dayData.lunchBreak.enabled}
                                            onChange={() => toggleLunchBreak(key)}
                                        />
                                        <span className="text-sm text-muted">Pausa para almoço</span>
                                    </label>

                                    {dayData.lunchBreak.enabled && (
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="time"
                                                value={dayData.lunchBreak.start}
                                                onChange={(e) => updateLunchBreak(key, 'start', e.target.value)}
                                                className="form-input"
                                                style={{ width: '110px', padding: '0.4rem' }}
                                            />
                                            <span className="text-sm text-muted">até</span>
                                            <input
                                                type="time"
                                                value={dayData.lunchBreak.end}
                                                onChange={(e) => updateLunchBreak(key, 'end', e.target.value)}
                                                className="form-input"
                                                style={{ width: '110px', padding: '0.4rem' }}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}

                <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                    <button
                        onClick={handleSave}
                        className="btn btn-primary btn-lg"
                        disabled={saving}
                    >
                        {saving ? 'Salvando...' : '💾 Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    )
}
