import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

export default function AdminAppointments() {
    const { admin } = useAuth()
    const { success, error } = useToast()

    const [appointments, setAppointments] = useState([])
    const [filteredAppointments, setFilteredAppointments] = useState([])
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState('all')
    const [dateFilter, setDateFilter] = useState('')

    // Modal de edição
    const [editingAppointment, setEditingAppointment] = useState(null)
    const [availableServices, setAvailableServices] = useState([])
    const [availableSlots, setAvailableSlots] = useState([])
    const [editForm, setEditForm] = useState({
        date: '',
        time: '',
        services: [],
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        notes: '',
        assignments: []
    })
    const [saving, setSaving] = useState(false)

    // Modal de novo agendamento
    const [showNewModal, setShowNewModal] = useState(false)
    const [newForm, setNewForm] = useState({
        date: '',
        time: '',
        services: [],
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        notes: ''
    })
    const [newSlots, setNewSlots] = useState([])
    const [creatingNew, setCreatingNew] = useState(false)

    // Funcionários
    const [employees, setEmployees] = useState([])

    useEffect(() => {
        loadAppointments()
        loadServices()
        loadEmployees()
    }, [admin])

    useEffect(() => {
        filterAppointments()
    }, [appointments, statusFilter, dateFilter])

    const loadAppointments = async () => {
        if (!admin) return
        setLoading(true)

        try {
            const apts = await api.getAppointmentsByEstablishment(admin.establishmentId)

            const enriched = await Promise.all(apts.map(async (apt) => {
                const servicesList = await api.getServicesByIds(apt.services)
                return { ...apt, servicesList }
            }))

            setAppointments(enriched.sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date)
                if (dateCompare !== 0) return dateCompare
                return a.time.localeCompare(b.time)
            }))
        } catch (err) {
            console.error('Error loading appointments:', err)
        } finally {
            setLoading(false)
        }
    }

    const loadServices = async () => {
        if (!admin) return
        try {
            const services = await api.getEstablishmentServices(admin.establishmentId)
            setAvailableServices(services)
        } catch (err) {
            console.error('Error loading services:', err)
        }
    }

    const loadEmployees = async () => {
        if (!admin) return
        try {
            const data = await api.getEmployees(admin.establishmentId)
            setEmployees(data)
        } catch (err) {
            console.error('Error loading employees:', err)
        }
    }

    const getEmployeeName = (employeeId) => {
        const emp = employees.find(e => e.id === employeeId)
        return emp?.name || null
    }

    const getQualifiedEmployees = (serviceId) => {
        return employees.filter(emp => (emp.services || []).includes(serviceId))
    }

    const filterAppointments = () => {
        let filtered = [...appointments]

        if (statusFilter !== 'all') {
            filtered = filtered.filter(a => a.status === statusFilter)
        }

        if (dateFilter) {
            filtered = filtered.filter(a => a.date === dateFilter)
        }

        setFilteredAppointments(filtered)
    }

    const handleStatusChange = async (appointmentId, newStatus) => {
        try {
            await api.updateAppointmentStatus(appointmentId, newStatus)
            loadAppointments()
            success(`Status atualizado para ${newStatus}`)
        } catch (err) {
            console.error('Error updating status:', err)
        }
    }

    // Abrir modal de edição
    const openEditModal = async (apt) => {
        setEditingAppointment(apt)
        setEditForm({
            date: apt.date,
            time: apt.time,
            services: apt.services,
            customerName: apt.customerName,
            customerPhone: apt.customerPhone,
            customerEmail: apt.customerEmail || '',
            notes: apt.notes || '',
            assignments: apt.assignments || []
        })
        await loadSlotsForDate(apt.date, apt.time)
    }

    const loadSlotsForDate = async (date, currentTime = null) => {
        try {
            const slots = await api.getAvailableSlots(admin.establishmentId, date)
            if (currentTime && !slots.includes(currentTime)) {
                slots.push(currentTime)
                slots.sort()
            }
            setAvailableSlots(slots)
        } catch (err) {
            console.error('Error loading slots:', err)
            setAvailableSlots([])
        }
    }

    const handleEditFormChange = async (e) => {
        const { name, value } = e.target
        setEditForm(prev => ({ ...prev, [name]: value }))

        if (name === 'date' && value) {
            await loadSlotsForDate(value, editingAppointment?.time)
            setEditForm(prev => ({ ...prev, time: '' }))
        }
    }

    const handleServiceToggle = (serviceId) => {
        setEditForm(prev => {
            const newServices = prev.services.includes(serviceId)
                ? prev.services.filter(id => id !== serviceId)
                : [...prev.services, serviceId]

            // Remove assignments for removed services
            const newAssignments = prev.assignments.filter(a =>
                newServices.includes(a.serviceId)
            )

            return { ...prev, services: newServices, assignments: newAssignments }
        })
    }

    const handleAssignmentChange = (serviceId, employeeId) => {
        setEditForm(prev => {
            const newAssignments = prev.assignments.filter(a => a.serviceId !== serviceId)
            if (employeeId) {
                newAssignments.push({ serviceId, employeeId: parseInt(employeeId) })
            }
            return { ...prev, assignments: newAssignments }
        })
    }

    const getAssignedEmployee = (serviceId) => {
        const assignment = editForm.assignments.find(a => a.serviceId === serviceId)
        return assignment?.employeeId || ''
    }

    const handleSaveEdit = async () => {
        if (editForm.services.length === 0) {
            error('Selecione pelo menos um serviço')
            return
        }

        setSaving(true)
        try {
            await api.updateAppointment(editingAppointment.id, {
                date: editForm.date,
                time: editForm.time,
                services: editForm.services,
                customerName: editForm.customerName,
                customerPhone: editForm.customerPhone,
                customerEmail: editForm.customerEmail,
                notes: editForm.notes,
                assignments: editForm.assignments
            })
            success('Agendamento atualizado com sucesso!')
            setEditingAppointment(null)
            loadAppointments()
        } catch (err) {
            error(err.message || 'Erro ao atualizar agendamento')
        } finally {
            setSaving(false)
        }
    }

    // ===== FUNÇÕES PARA NOVO AGENDAMENTO =====

    const openNewModal = () => {
        setNewForm({
            date: new Date().toISOString().split('T')[0],
            time: '',
            services: [],
            customerName: '',
            customerPhone: '',
            customerEmail: '',
            notes: ''
        })
        setNewSlots([])
        setShowNewModal(true)
        loadNewSlots(new Date().toISOString().split('T')[0])
    }

    const loadNewSlots = async (date) => {
        try {
            const slots = await api.getAvailableSlots(admin.establishmentId, date)
            setNewSlots(slots)
        } catch (err) {
            console.error('Error loading slots:', err)
            setNewSlots([])
        }
    }

    const handleNewFormChange = async (e) => {
        const { name, value } = e.target
        setNewForm(prev => ({ ...prev, [name]: value }))

        if (name === 'date' && value) {
            await loadNewSlots(value)
            setNewForm(prev => ({ ...prev, time: '' }))
        }
    }

    const handleNewServiceToggle = (serviceId) => {
        setNewForm(prev => ({
            ...prev,
            services: prev.services.includes(serviceId)
                ? prev.services.filter(id => id !== serviceId)
                : [...prev.services, serviceId]
        }))
    }

    const handleCreateAppointment = async () => {
        if (newForm.services.length === 0) {
            error('Selecione pelo menos um serviço')
            return
        }
        if (!newForm.date || !newForm.time) {
            error('Selecione data e horário')
            return
        }
        if (!newForm.customerName || !newForm.customerPhone) {
            error('Preencha nome e telefone do cliente')
            return
        }

        setCreatingNew(true)
        try {
            await api.createAppointment({
                establishmentId: admin.establishmentId,
                userId: null,
                services: newForm.services,
                date: newForm.date,
                time: newForm.time,
                customerName: newForm.customerName,
                customerPhone: newForm.customerPhone,
                customerEmail: newForm.customerEmail,
                notes: newForm.notes ? `[ENCAIXE] ${newForm.notes}` : '[ENCAIXE]'
            })
            success('Agendamento criado com sucesso!')
            setShowNewModal(false)
            loadAppointments()
        } catch (err) {
            error(err.message || 'Erro ao criar agendamento')
        } finally {
            setCreatingNew(false)
        }
    }

    const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-')
        const date = new Date(year, month - 1, day)
        return date.toLocaleDateString('pt-BR', {
            weekday: 'short',
            day: '2-digit',
            month: 'short'
        })
    }

    const getStatusBadge = (status) => {
        const styles = {
            pending: { class: 'badge-warning', label: 'Pendente' },
            confirmed: { class: 'badge-success', label: 'Confirmado' },
            cancelled: { class: 'badge-error', label: 'Cancelado' },
            completed: { class: 'badge-secondary', label: 'Concluído' },
            no_show: { class: 'badge-error', label: 'Não compareceu' },
        }
        const { class: cls, label } = styles[status] || styles.pending
        return <span className={`badge ${cls}`}>{label}</span>
    }

    const getServiceAssignment = (apt, serviceId) => {
        const assignment = (apt.assignments || []).find(a => a.serviceId === serviceId)
        if (assignment) {
            return getEmployeeName(assignment.employeeId)
        }
        return null
    }

    return (
        <div>
            <div className="flex justify-between items-start mb-8">
                <div>
                    <h1 className="text-3xl font-bold mb-2">Agendamentos</h1>
                    <p className="text-secondary">Gerencie todos os agendamentos do seu estabelecimento</p>
                </div>
                <button onClick={openNewModal} className="btn btn-primary">
                    ➕ Novo Agendamento
                </button>
            </div>

            {/* Filters */}
            <div className="card mb-6" style={{ padding: '1rem' }}>
                <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Status:</label>
                        <select
                            className="form-select"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            style={{ width: 'auto' }}
                        >
                            <option value="all">Todos</option>
                            <option value="pending">Pendente</option>
                            <option value="confirmed">Confirmado</option>
                            <option value="completed">Concluído</option>
                            <option value="cancelled">Cancelado</option>
                            <option value="no_show">Não compareceu</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Data:</label>
                        <input
                            type="date"
                            className="form-input"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            style={{ width: 'auto' }}
                        />
                        {dateFilter && (
                            <button
                                onClick={() => setDateFilter('')}
                                className="btn btn-ghost btn-sm"
                            >
                                ✕
                            </button>
                        )}
                    </div>

                    <div style={{ marginLeft: 'auto' }}>
                        <span className="text-sm text-muted">
                            {filteredAppointments.length} agendamento(s)
                        </span>
                    </div>
                </div>
            </div>

            {/* Appointments Grid */}
            {loading ? (
                <div className="card py-8 text-center">Carregando...</div>
            ) : filteredAppointments.length === 0 ? (
                <div className="card text-center py-12">
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                    <p className="text-secondary">Nenhum agendamento encontrado</p>
                </div>
            ) : (
                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredAppointments.map(apt => (
                        <div
                            key={apt.id}
                            className="card"
                            style={{ padding: '1.25rem' }}
                        >
                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <div className="font-semibold" style={{ color: 'var(--primary-600)' }}>
                                        📅 {formatDate(apt.date)} • {apt.time}
                                    </div>
                                </div>
                                <button
                                    onClick={() => openEditModal(apt)}
                                    className="btn btn-outline btn-sm"
                                    title="Editar"
                                >
                                    ✏️ Editar
                                </button>
                            </div>

                            {/* Cliente */}
                            <div className="mb-3" style={{ borderBottom: '1px solid var(--gray-200)', paddingBottom: '0.75rem' }}>
                                <div className="font-medium">👤 {apt.customerName}</div>
                                <div className="text-sm text-muted">📱 {apt.customerPhone}</div>
                            </div>

                            {/* Serviços */}
                            <div className="mb-3">
                                <div className="text-sm font-medium mb-2">Serviços:</div>
                                <div className="flex flex-col gap-1">
                                    {apt.servicesList?.map(s => {
                                        const assignedEmployee = getServiceAssignment(apt, s.id)
                                        return (
                                            <div key={s.id} className="flex justify-between items-center text-sm">
                                                <span className="badge badge-primary text-xs">{s.name}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--primary-500)', fontWeight: '500' }}>
                                                    {assignedEmployee ? `→ ${assignedEmployee}` : '(não atribuído)'}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                                <div className="text-xs text-muted mt-2">{apt.totalDuration} min</div>
                            </div>

                            {/* Footer */}
                            <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '0.75rem' }}>
                                <span className="font-bold" style={{ color: 'var(--success-600)' }}>
                                    R$ {apt.totalPrice?.toFixed(2)}
                                </span>
                                {getStatusBadge(apt.status)}
                            </div>

                            {/* Actions */}
                            {(apt.status === 'pending' || apt.status === 'confirmed') && (
                                <div className="flex gap-2 mt-3" style={{ borderTop: '1px solid var(--gray-200)', paddingTop: '0.75rem' }}>
                                    {apt.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleStatusChange(apt.id, 'confirmed')}
                                                className="btn btn-primary btn-sm flex-1"
                                            >
                                                ✓ Confirmar
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(apt.id, 'cancelled')}
                                                className="btn btn-secondary btn-sm"
                                            >
                                                ✕
                                            </button>
                                        </>
                                    )}
                                    {apt.status === 'confirmed' && (
                                        <>
                                            <button
                                                onClick={() => handleStatusChange(apt.id, 'completed')}
                                                className="btn btn-secondary btn-sm flex-1"
                                            >
                                                ✓ Concluir
                                            </button>
                                            <button
                                                onClick={() => handleStatusChange(apt.id, 'no_show')}
                                                className="btn btn-ghost btn-sm"
                                                style={{ color: 'var(--error-500)' }}
                                            >
                                                🚫 Faltou
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Modal de Edição */}
            {editingAppointment && (
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
                    onClick={() => setEditingAppointment(null)}
                >
                    <div
                        className="card"
                        style={{
                            width: '100%',
                            maxWidth: '700px',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            padding: '2rem',
                            margin: '1rem'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold mb-6">✏️ Editar Agendamento</h2>

                        {/* Data e Horário */}
                        <div className="grid sm:grid-cols-2 gap-4 mb-4">
                            <div className="form-group">
                                <label className="form-label">📅 Data</label>
                                <input
                                    type="date"
                                    name="date"
                                    className="form-input"
                                    value={editForm.date}
                                    onChange={handleEditFormChange}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">🕐 Horário</label>
                                <select
                                    name="time"
                                    className="form-select"
                                    value={editForm.time}
                                    onChange={handleEditFormChange}
                                >
                                    <option value="">Selecione...</option>
                                    {availableSlots.map(slot => (
                                        <option key={slot} value={slot}>{slot}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Serviços e Atribuições */}
                        <div className="form-group mb-4">
                            <label className="form-label">✂️ Serviços e Funcionários</label>
                            <div className="flex flex-col gap-3" style={{ background: 'var(--gray-50)', padding: '1rem', borderRadius: '0.5rem' }}>
                                {availableServices.map(service => {
                                    const isSelected = editForm.services.includes(service.id)
                                    const qualifiedEmployees = getQualifiedEmployees(service.id)

                                    return (
                                        <div key={service.id} className="flex items-center gap-3">
                                            <button
                                                type="button"
                                                className={`btn btn-sm ${isSelected ? 'btn-primary' : 'btn-outline'}`}
                                                onClick={() => handleServiceToggle(service.id)}
                                                style={{ minWidth: '150px' }}
                                            >
                                                {service.name}
                                            </button>

                                            {isSelected && (
                                                <select
                                                    className="form-select"
                                                    style={{ flex: 1 }}
                                                    value={getAssignedEmployee(service.id)}
                                                    onChange={(e) => handleAssignmentChange(service.id, e.target.value)}
                                                >
                                                    <option value="">Selecione funcionário...</option>
                                                    {qualifiedEmployees.length > 0 ? (
                                                        qualifiedEmployees.map(emp => (
                                                            <option key={emp.id} value={emp.id}>{emp.name}</option>
                                                        ))
                                                    ) : (
                                                        <option disabled>Nenhum funcionário qualificado</option>
                                                    )}
                                                </select>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Dados do Cliente */}
                        <div className="grid sm:grid-cols-2 gap-4 mb-4">
                            <div className="form-group">
                                <label className="form-label">👤 Nome</label>
                                <input
                                    type="text"
                                    name="customerName"
                                    className="form-input"
                                    value={editForm.customerName}
                                    onChange={handleEditFormChange}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📱 Telefone</label>
                                <input
                                    type="tel"
                                    name="customerPhone"
                                    className="form-input"
                                    value={editForm.customerPhone}
                                    onChange={handleEditFormChange}
                                />
                            </div>
                        </div>

                        <div className="form-group mb-4">
                            <label className="form-label">📧 E-mail</label>
                            <input
                                type="email"
                                name="customerEmail"
                                className="form-input"
                                value={editForm.customerEmail}
                                onChange={handleEditFormChange}
                            />
                        </div>

                        <div className="form-group mb-6">
                            <label className="form-label">📝 Observações</label>
                            <textarea
                                name="notes"
                                className="form-textarea"
                                rows={2}
                                value={editForm.notes}
                                onChange={handleEditFormChange}
                            ></textarea>
                        </div>

                        {/* Botões */}
                        <div className="flex gap-4">
                            <button
                                onClick={handleSaveEdit}
                                className="btn btn-primary flex-1"
                                disabled={saving}
                            >
                                {saving ? 'Salvando...' : 'Salvar alterações'}
                            </button>
                            <button
                                onClick={() => setEditingAppointment(null)}
                                className="btn btn-secondary"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal de Novo Agendamento */}
            {showNewModal && (
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
                    onClick={() => setShowNewModal(false)}
                >
                    <div
                        className="card"
                        style={{
                            width: '100%',
                            maxWidth: '600px',
                            maxHeight: '90vh',
                            overflow: 'auto',
                            padding: '2rem',
                            margin: '1rem'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold mb-6">➕ Novo Agendamento (Encaixe)</h2>
                        <p className="text-sm text-muted mb-6">Agende um cliente manualmente</p>

                        {/* Data e Horário */}
                        <div className="grid sm:grid-cols-2 gap-4 mb-4">
                            <div className="form-group">
                                <label className="form-label">📅 Data</label>
                                <input
                                    type="date"
                                    name="date"
                                    className="form-input"
                                    value={newForm.date}
                                    onChange={handleNewFormChange}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">🕐 Horário</label>
                                <select
                                    name="time"
                                    className="form-select"
                                    value={newForm.time}
                                    onChange={handleNewFormChange}
                                >
                                    <option value="">Selecione...</option>
                                    {newSlots.map(slot => (
                                        <option key={slot} value={slot}>{slot}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Serviços */}
                        <div className="form-group mb-4">
                            <label className="form-label">✂️ Serviços</label>
                            <div className="flex flex-wrap gap-2">
                                {availableServices.map(service => (
                                    <button
                                        key={service.id}
                                        type="button"
                                        className={`btn btn-sm ${newForm.services.includes(service.id) ? 'btn-primary' : 'btn-outline'}`}
                                        onClick={() => handleNewServiceToggle(service.id)}
                                    >
                                        {service.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Dados do Cliente */}
                        <div className="grid sm:grid-cols-2 gap-4 mb-4">
                            <div className="form-group">
                                <label className="form-label">👤 Nome *</label>
                                <input
                                    type="text"
                                    name="customerName"
                                    className="form-input"
                                    value={newForm.customerName}
                                    onChange={handleNewFormChange}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">📱 Telefone *</label>
                                <input
                                    type="tel"
                                    name="customerPhone"
                                    className="form-input"
                                    value={newForm.customerPhone}
                                    onChange={handleNewFormChange}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group mb-4">
                            <label className="form-label">📧 E-mail</label>
                            <input
                                type="email"
                                name="customerEmail"
                                className="form-input"
                                value={newForm.customerEmail}
                                onChange={handleNewFormChange}
                            />
                        </div>

                        <div className="form-group mb-6">
                            <label className="form-label">📝 Observações</label>
                            <textarea
                                name="notes"
                                className="form-textarea"
                                rows={2}
                                value={newForm.notes}
                                onChange={handleNewFormChange}
                            ></textarea>
                        </div>

                        {/* Botões */}
                        <div className="flex gap-4">
                            <button
                                onClick={handleCreateAppointment}
                                className="btn btn-primary flex-1"
                                disabled={creatingNew}
                            >
                                {creatingNew ? 'Criando...' : 'Criar Agendamento'}
                            </button>
                            <button
                                onClick={() => setShowNewModal(false)}
                                className="btn btn-secondary"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
