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

    const handleSave = async () => {
        setSaving(true)
        try {
            // Convert back to storage format
            const formattedHours = {}
            Object.entries(workingHours).forEach(([day, data]) => {
                formattedHours[day] = data.enabled
                    ? { open: data.open, close: data.close }
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

            <div className="card" style={{ padding: '1.5rem', maxWidth: '700px' }}>
                {DAYS.map(({ key, label }) => {
                    const dayData = workingHours[key]
                    if (!dayData) return null

                    return (
                        <div
                            key={key}
                            className="flex items-center gap-4 py-4"
                            style={{ borderBottom: key !== 'sunday' ? '1px solid var(--border-color)' : 'none' }}
                        >
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
