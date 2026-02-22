import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'

export default function AdminEmployees() {
    const { admin } = useAuth()
    const { success, error } = useToast()

    const [employees, setEmployees] = useState([])
    const [services, setServices] = useState([]) // Services offered by establishment
    const [loading, setLoading] = useState(true)
    const [newName, setNewName] = useState('')
    const [adding, setAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [editingName, setEditingName] = useState('')

    useEffect(() => {
        loadData()
    }, [admin])

    const loadData = async () => {
        if (!admin) return
        setLoading(true)

        try {
            const [employeesData, establishment] = await Promise.all([
                api.getEmployees(admin.establishmentId),
                api.getEstablishmentById(admin.establishmentId)
            ])

            setEmployees(employeesData)

            // Get services for this establishment
            const allServices = await api.getServices()
            const estServices = allServices.filter(s => establishment.services?.includes(s.id))
            setServices(estServices)
        } catch (err) {
            console.error('Error loading data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleAdd = async () => {
        if (!newName.trim()) {
            error('Digite o nome do funcionário')
            return
        }

        setAdding(true)
        try {
            await api.createEmployee({
                establishmentId: admin.establishmentId,
                name: newName.trim()
            })
            success('Funcionário adicionado!')
            setNewName('')
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao adicionar funcionário')
        } finally {
            setAdding(false)
        }
    }

    const startEdit = (employee) => {
        setEditingId(employee.id)
        setEditingName(employee.name)
    }

    const handleSaveEdit = async () => {
        if (!editingName.trim()) {
            error('Nome não pode estar vazio')
            return
        }

        try {
            await api.updateEmployee(editingId, { name: editingName.trim() })
            success('Funcionário atualizado!')
            setEditingId(null)
            setEditingName('')
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao atualizar funcionário')
        }
    }

    const handleDelete = async (id, name) => {
        if (!confirm(`Deseja remover o funcionário "${name}"?`)) return

        try {
            await api.deleteEmployee(id)
            success('Funcionário removido!')
            loadData()
        } catch (err) {
            error(err.message || 'Erro ao remover funcionário')
        }
    }

    const toggleService = async (employeeId, serviceId) => {
        const employee = employees.find(e => e.id === employeeId)
        const currentServices = employee.services || []

        let newServices
        if (currentServices.includes(serviceId)) {
            newServices = currentServices.filter(id => id !== serviceId)
        } else {
            newServices = [...currentServices, serviceId]
        }

        try {
            await api.updateEmployee(employeeId, { services: newServices })
            // Update local state immediately for responsive UI
            setEmployees(prev => prev.map(e =>
                e.id === employeeId ? { ...e, services: newServices } : e
            ))
        } catch (err) {
            error('Erro ao atualizar serviços')
        }
    }

    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">👥 Funcionários</h1>
                <p className="text-secondary">Gerencie os funcionários do seu estabelecimento</p>
            </div>

            {/* Adicionar Funcionário */}
            <div className="card mb-6" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">Adicionar Funcionário</h3>
                <div className="flex gap-3">
                    <input
                        type="text"
                        className="form-input flex-1"
                        placeholder="Nome do funcionário"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                    />
                    <button
                        onClick={handleAdd}
                        className="btn btn-primary"
                        disabled={adding}
                    >
                        {adding ? 'Adicionando...' : '+ Adicionar'}
                    </button>
                </div>
            </div>

            {/* Lista de Funcionários */}
            <div className="card" style={{ padding: '1.5rem' }}>
                <h3 className="font-semibold mb-4">Funcionários Cadastrados</h3>

                {loading ? (
                    <div className="text-center py-8">Carregando...</div>
                ) : employees.length === 0 ? (
                    <div className="text-center py-8">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
                        <p className="text-secondary">Nenhum funcionário cadastrado</p>
                        <p className="text-sm text-muted">Adicione funcionários para atribuí-los aos agendamentos</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4">
                        {employees.map(employee => (
                            <div
                                key={employee.id}
                                style={{
                                    padding: '1rem',
                                    background: 'var(--secondary-500)',
                                    borderRadius: '0.75rem',
                                    border: '1px solid var(--gray-200)'
                                }}
                            >
                                {/* Header row with name and actions */}
                                <div className="flex items-center justify-between mb-3">
                                    {editingId === employee.id ? (
                                        <div className="flex gap-2 flex-1 mr-4">
                                            <input
                                                type="text"
                                                className="form-input flex-1"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleSaveEdit}
                                                className="btn btn-primary btn-sm"
                                            >
                                                ✓
                                            </button>
                                            <button
                                                onClick={() => setEditingId(null)}
                                                className="btn btn-ghost btn-sm"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
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
                                                        fontWeight: '600',
                                                        fontSize: '1rem'
                                                    }}
                                                >
                                                    {employee.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium" style={{ color: 'var(--primary-500)' }}>{employee.name}</span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => startEdit(employee)}
                                                    className="btn btn-outline btn-sm"
                                                    title="Editar"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(employee.id, employee.name)}
                                                    className="btn btn-ghost btn-sm"
                                                    title="Remover"
                                                    style={{ color: 'var(--error-500)' }}
                                                >
                                                    🗑️
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Services badges row */}
                                {editingId !== employee.id && services.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {services.map(service => {
                                            const isSelected = (employee.services || []).includes(service.id)
                                            return (
                                                <button
                                                    key={service.id}
                                                    onClick={() => toggleService(employee.id, service.id)}
                                                    style={{
                                                        padding: '0.25rem 0.75rem',
                                                        borderRadius: '9999px',
                                                        fontSize: '0.75rem',
                                                        fontWeight: '500',
                                                        border: 'none',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                        background: isSelected ? 'var(--primary-500)' : 'var(--gray-200)',
                                                        color: isSelected ? 'white' : 'var(--gray-600)'
                                                    }}
                                                    title={isSelected ? 'Clique para remover' : 'Clique para adicionar'}
                                                >
                                                    {service.name}
                                                </button>
                                            )
                                        })}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Info */}
            <div className="card mt-6" style={{ padding: '1rem', background: 'var(--primary-50)' }}>
                <div className="flex items-start gap-3">
                    <span style={{ fontSize: '1.5rem' }}>💡</span>
                    <div>
                        <p className="font-medium" style={{ color: 'var(--primary-600)' }}>Dica</p>
                        <p className="text-sm text-muted">
                            Clique nos serviços para marcar quais cada funcionário pode executar.
                            Os serviços selecionados ficam em <strong>rosa</strong>.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    )
}
