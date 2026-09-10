import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import Calendar from '../../components/Calendar'
import { WEEKDAY_KEYS, getClosedWeekdays, toDateString } from '../../utils/schedule'

const STATUS_BADGE = {
    pending: { class: 'badge-warning', label: 'Pendente' },
    confirmed: { class: 'badge-success', label: 'Confirmado' },
    completed: { class: 'badge-secondary', label: 'Concluído' },
    cancelled: { class: 'badge-error', label: 'Cancelado' },
    no_show: { class: 'badge-error', label: 'Não compareceu' }
}

const emptyException = { isClosed: false, blockedRanges: [] }

export default function AdminCalendarView() {
    const { admin } = useAuth()
    const { success, error } = useToast()

    const [appointments, setAppointments] = useState([])
    const [establishment, setEstablishment] = useState(null)
    const [loading, setLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const [selectedDate, setSelectedDate] = useState(new Date())
    const [showDayModal, setShowDayModal] = useState(false)
    const [daySchedule, setDaySchedule] = useState(null)
    const [exceptionForm, setExceptionForm] = useState(emptyException)
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        loadData()
    }, [admin])

    const loadData = async () => {
        if (!admin) return
        setLoading(true)
        setLoadError(false)
        try {
            const [apts, est] = await Promise.all([
                api.getAppointmentsByEstablishment(admin.establishmentId),
                api.getEstablishmentById(admin.establishmentId)
            ])
            setAppointments(await api.attachServicesToAppointments(apts))
            setEstablishment(est)
            syncExceptionForm(est, selectedDate)
        } catch (err) {
            // Sem os horários do estabelecimento o calendário não pode ser
            // desenhado: dado ausente não pode virar "tudo fechado" na tela.
            console.error('Erro ao carregar calendário:', err)
            setLoadError(true)
        } finally {
            setLoading(false)
        }
    }

    const syncExceptionForm = (est, date) => {
        const exception = est?.scheduleExceptions?.[toDateString(date)]
        setExceptionForm(exception
            ? { isClosed: exception.isClosed || false, blockedRanges: exception.blockedRanges || [] }
            : emptyException)
    }

    const handleSelectDate = async (date) => {
        setSelectedDate(date)
        syncExceptionForm(establishment, date)
        setShowDayModal(true)
        setDaySchedule(null)
        try {
            setDaySchedule(await api.getDaySchedule(admin.establishmentId, toDateString(date)))
        } catch (err) {
            console.error('Erro ao carregar horários do dia:', err)
        }
    }

    // Dias da semana fechados no expediente + datas fechadas por exceção,
    // pra o calendário pintar igual ao que o cliente enxerga.
    const closedWeekdays = getClosedWeekdays(establishment?.workingHours)

    const closedDates = Object.entries(establishment?.scheduleExceptions || {})
        .filter(([, exc]) => exc?.isClosed)
        .map(([date]) => date)

    const dateStr = toDateString(selectedDate)
    const dayAppointments = appointments
        .filter(apt => apt.date === dateStr)
        .sort((a, b) => (a.time || '').localeCompare(b.time || ''))

    const activeCount = dayAppointments.filter(a => ['pending', 'confirmed'].includes(a.status)).length

    const handleSaveException = async () => {
        setSaving(true)
        try {
            const newExceptions = { ...(establishment.scheduleExceptions || {}) }
            const existing = newExceptions[dateStr] || {}

            if (exceptionForm.isClosed || exceptionForm.blockedRanges.length > 0) {
                newExceptions[dateStr] = {
                    ...existing, // preserva homeVisit e outros campos já configurados nesse dia
                    isClosed: exceptionForm.isClosed,
                    blockedRanges: exceptionForm.isClosed ? [] : exceptionForm.blockedRanges
                }
            } else if (existing.homeVisit?.active) {
                newExceptions[dateStr] = { ...existing, isClosed: false, blockedRanges: [] }
            } else {
                delete newExceptions[dateStr]
            }

            const updated = await api.updateEstablishment(admin.establishmentId, { scheduleExceptions: newExceptions })
            setEstablishment(updated)
            success('Horários do dia atualizados!')
        } catch (err) {
            // O backend recusa fechar dia que já tem cliente agendado e explica quem seria afetado
            error(err.message || 'Erro ao atualizar horários')
        } finally {
            setSaving(false)
        }
    }

    const handleStatusChange = async (id, status) => {
        try {
            await api.updateAppointmentStatus(id, status, status === 'cancelled' ? 'establishment' : undefined)
            setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a))
            success('Status atualizado!')
        } catch (err) {
            error(err.message || 'Erro ao atualizar status')
        }
    }

    const addRange = () => setExceptionForm(prev => ({
        ...prev, blockedRanges: [...prev.blockedRanges, { start: '', end: '' }]
    }))

    const updateRange = (index, field, value) => setExceptionForm(prev => {
        const ranges = [...prev.blockedRanges]
        ranges[index] = { ...ranges[index], [field]: value }
        return { ...prev, blockedRanges: ranges }
    })

    const removeRange = (index) => setExceptionForm(prev => ({
        ...prev, blockedRanges: prev.blockedRanges.filter((_, i) => i !== index)
    }))

    if (loading) return <div className="text-center py-16">⏳ Carregando...</div>

    if (loadError || !establishment) {
        return (
            <div className="card text-center py-12" style={{ padding: '2rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚠️</div>
                <p className="mb-4">Não foi possível carregar os horários do estabelecimento.</p>
                <button onClick={loadData} className="btn btn-primary">Tentar de novo</button>
            </div>
        )
    }

    const weekdayKey = WEEKDAY_KEYS[selectedDate.getDay()]
    const dayHours = establishment?.workingHours?.[weekdayKey]

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">🗓️ Calendário</h1>
                <p className="text-secondary">
                    Clique em um dia para ver os agendamentos e abrir ou fechar horários.
                </p>
            </div>

            {/* Calendário */}
            <div className="card" style={{ padding: '1.25rem', maxWidth: '760px', margin: '0 auto' }}>
                <Calendar
                    selectedDate={selectedDate}
                    onSelectDate={handleSelectDate}
                    closedDays={closedWeekdays}
                    closedDates={closedDates}
                    allowPastDates
                />
                <div className="text-sm text-muted mt-4">
                    Dias em cinza estão fechados (expediente semanal ou fechamento manual).
                </div>
            </div>

            {/* Detalhe do dia — sobreposição, pra não empurrar o calendário pra fora da tela */}
            {showDayModal && (
                <div className="modal-backdrop" onClick={() => setShowDayModal(false)}>
                    <div className="modal" style={{ maxWidth: '640px' }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <h2 className="modal-title">
                                    {selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                                </h2>
                                <p className="text-sm text-muted">
                                    {dayHours ? `Expediente: ${dayHours.open} às ${dayHours.close}` : 'Fechado no expediente semanal'}
                                    {' · '}{dayAppointments.length} agendamento(s)
                                </p>
                            </div>
                            <button onClick={() => setShowDayModal(false)} className="btn btn-ghost btn-icon">✕</button>
                        </div>

                        <div className="modal-body">

                        {dayAppointments.length === 0 ? (
                            <p className="text-center text-muted py-6">Nenhum agendamento neste dia.</p>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {dayAppointments.map(apt => {
                                    const badge = STATUS_BADGE[apt.status] || { class: 'badge-secondary', label: apt.status }
                                    return (
                                        <div key={apt.id} style={{ padding: '0.85rem', background: 'var(--secondary-500)', borderRadius: '0.75rem' }}>
                                            <div className="flex justify-between items-start gap-3">
                                                {/* minWidth 0 deixa o bloco encolher no celular em vez de
                                                    estourar a largura com e-mail longo */}
                                                <div style={{ minWidth: 0, wordBreak: 'break-word' }}>
                                                    <div className="font-semibold">
                                                        {apt.time} · {apt.customerName}
                                                        {apt.serviceLocation === 'home_visit' && <span title="Atendimento em domicílio"> 🏠</span>}
                                                    </div>
                                                    <div className="text-sm text-muted">
                                                        {apt.servicesList?.map(s => s.name).join(', ') || 'Sem serviço'}
                                                    </div>
                                                    <div className="text-xs text-muted mt-1">📱 {apt.customerPhone}</div>
                                                    {apt.customerEmail && <div className="text-xs text-muted">✉️ {apt.customerEmail}</div>}
                                                    {apt.createdAt && (
                                                        <div className="text-xs text-muted">
                                                            🗓️ Agendado em: {new Date(apt.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`badge ${badge.class}`} style={{ flexShrink: 0 }}>{badge.label}</span>
                                            </div>

                                            {['pending', 'confirmed'].includes(apt.status) && (
                                                <div className="flex flex-wrap gap-2 mt-3">
                                                    {apt.status === 'pending' && (
                                                        <button onClick={() => handleStatusChange(apt.id, 'confirmed')} className="btn btn-primary btn-sm">✓ Confirmar</button>
                                                    )}
                                                    <button onClick={() => handleStatusChange(apt.id, 'completed')} className="btn btn-outline btn-sm">Concluir</button>
                                                    <button onClick={() => handleStatusChange(apt.id, 'no_show')} className="btn btn-outline btn-sm">Não compareceu</button>
                                                    <button
                                                        onClick={() => confirm(`Cancelar o agendamento de ${apt.customerName}?`) && handleStatusChange(apt.id, 'cancelled')}
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ color: 'var(--error-500)' }}
                                                    >
                                                        Cancelar
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Grade de horários do dia: mostra o que está livre e,
                            quando não está, o porquê — é o que o estabelecimento
                            precisa pra responder "por que o cliente não consegue agendar?" */}
                        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                            <h3 className="font-semibold mb-3">🕐 Horários do dia</h3>
                            {!daySchedule ? (
                                <p className="text-sm text-muted">Carregando...</p>
                            ) : daySchedule.closed ? (
                                <p className="text-sm text-muted">🚫 {daySchedule.closedReason}</p>
                            ) : (
                                <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
                                    {daySchedule.slots.map(slot => {
                                        const livre = slot.status === 'disponivel'
                                        const agendado = dayAppointments.find(a => a.time === slot.time && ['pending', 'confirmed'].includes(a.status))
                                        return (
                                            <div
                                                key={slot.time}
                                                style={{
                                                    padding: '0.6rem',
                                                    borderRadius: '0.6rem',
                                                    background: 'var(--secondary-500)',
                                                    border: `1px solid ${livre ? 'var(--border-color)' : 'var(--error-500)'}`,
                                                    opacity: livre ? 1 : 0.85
                                                }}
                                            >
                                                <div className="font-semibold">{slot.time}</div>
                                                <div className="text-xs" style={{ color: livre ? 'inherit' : 'var(--error-500)' }}>
                                                    {livre ? `✅ ${slot.availableCount} serviço(s) disponíveis` : `⛔ ${slot.reason}`}
                                                </div>
                                                {agendado && (
                                                    <div className="text-xs text-muted mt-1">
                                                        {agendado.customerName}
                                                        {agendado.servicesList?.length > 0 && ` · ${agendado.servicesList.map(x => x.name).join(', ')}`}
                                                    </div>
                                                )}
                                                {livre && slot.services.some(x => !x.available) && (
                                                    <div className="text-xs text-muted mt-1">
                                                        Não cabe: {slot.services.filter(x => !x.available).map(x => x.name).slice(0, 3).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Abrir/fechar horários do dia */}
                        <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--border-color)' }}>
                            <h3 className="font-semibold mb-4">⚙️ Abrir / fechar horários deste dia</h3>

                            <label className="flex items-center gap-2 cursor-pointer mb-4">
                            <input
                                type="checkbox"
                                className="form-checkbox"
                                checked={exceptionForm.isClosed}
                                onChange={(e) => setExceptionForm(prev => ({ ...prev, isClosed: e.target.checked }))}
                            />
                            <span>Dia fechado (não atender)</span>
                        </label>

                        {!exceptionForm.isClosed && (
                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="form-label mb-0">Pausas / horários bloqueados</label>
                                    <button onClick={addRange} className="btn btn-outline btn-sm">+ Adicionar</button>
                                </div>

                                {exceptionForm.blockedRanges.length === 0 && (
                                    <p className="text-sm text-secondary italic">Nenhum horário bloqueado.</p>
                                )}

                                {exceptionForm.blockedRanges.map((range, index) => (
                                    <div key={index} className="flex flex-wrap gap-2 mb-2 items-center">
                                        <input type="time" className="form-input flex-1" style={{ minWidth: '110px' }} value={range.start}
                                            onChange={(e) => updateRange(index, 'start', e.target.value)} />
                                        <span className="text-secondary">até</span>
                                        <input type="time" className="form-input flex-1" style={{ minWidth: '110px' }} value={range.end}
                                            onChange={(e) => updateRange(index, 'end', e.target.value)} />
                                        <button onClick={() => removeRange(index)} className="btn btn-ghost btn-sm" style={{ color: 'var(--error-500)' }}>🗑️</button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeCount > 0 && (
                            <p className="text-sm mb-3" style={{ color: 'var(--error-500)' }}>
                                ⚠️ Este dia tem {activeCount} agendamento(s) ativo(s). Fechar o dia ou bloquear esses
                                horários será recusado até cancelar ou remarcar.
                            </p>
                        )}

                            <button onClick={handleSaveException} className="btn btn-primary w-full" disabled={saving}>
                                {saving ? 'Salvando...' : 'Salvar horários do dia'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            )}
        </div>
    )
}
