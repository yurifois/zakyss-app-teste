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
    const [servicesModalFor, setServicesModalFor] = useState(null) // employee sendo editado no modal de serviços

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

            // Get services for this establishment (precisa passar establishmentId,
            // senão o backend só devolve o catálogo global e ignora os serviços
            // personalizados cadastrados manualmente pelo estabelecimento)
            const allServices = await api.getServices(admin.establishmentId)
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

                                {/* Aviso: funcionário sem nenhum serviço atribuído fica impossível de agendar */}
                                {(employee.services || []).length === 0 && (
                                    <div
                                        className="flex items-center gap-2"
                                        style={{
                                            padding: '0.6rem 0.85rem',
                                            borderRadius: '0.5rem',
                                            background: 'rgba(239, 68, 68, 0.12)',
                                            border: '1px solid rgba(239, 68, 68, 0.4)',
                                            color: 'var(--error-600, #dc2626)',
                                            fontSize: '0.85rem',
                                            fontWeight: 500
                                        }}
                                    >
                                        ⚠️ Nenhum serviço atribuído — clientes não conseguem agendar horário com {employee.name} até você marcar pelo menos um serviço abaixo.
                                    </div>
                                )}

                                {/* Resumo compacto + botão que abre o modal de seleção */}
                                {editingId !== employee.id && services.length > 0 && (
                                    <div className="flex items-center justify-between gap-3">
                                        <p className="text-sm text-muted" style={{ margin: 0 }}>
                                            {(employee.services || []).length === 0
                                                ? 'Nenhum serviço atribuído'
                                                : `${(employee.services || []).length} serviço${(employee.services || []).length > 1 ? 's' : ''} atribuído${(employee.services || []).length > 1 ? 's' : ''}`}
                                        </p>
                                        <button
                                            onClick={() => setServicesModalFor(employee.id)}
                                            className="btn btn-outline btn-sm"
                                        >
                                            Atribuir serviços
                                        </button>
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
                            Clique em "Atribuir serviços" no funcionário pra marcar quais ele pode executar.
                        </p>
                    </div>
                </div>
            </div>

            {/* Modal de seleção de serviços */}
            {servicesModalFor && (() => {
                const employee = employees.find(e => e.id === servicesModalFor)
                if (!employee) return null
                const assignedIds = employee.services || []
                return (
                    <div
                        className="modal-backdrop"
                        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', zIndex: 1000 }}
                        onClick={() => setServicesModalFor(null)}
                    >
                        <div
                            className="card"
                            style={{ width: '100%', maxWidth: '28rem', maxHeight: '80vh', display: 'flex', flexDirection: 'column', padding: '1.5rem' }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg font-bold">Serviços de {employee.name}</h2>
                                <button
                                    onClick={() => setServicesModalFor(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}
                                >
                                    ✕
                                </button>
                            </div>

                            <div style={{ overflowY: 'auto', flex: 1 }}>
                                {services.map(service => {
                                    const isSelected = assignedIds.includes(service.id)
                                    return (
                                        <div
                                            key={service.id}
                                            onClick={() => toggleService(employee.id, service.id)}
                                            className="flex items-center justify-between"
                                            style={{
                                                padding: '0.75rem 0.5rem',
                                                borderBottom: '1px solid var(--border-color)',
                                                cursor: 'pointer',
                                                background: isSelected ? 'rgba(236, 72, 153, 0.08)' : 'transparent'
                                            }}
                                        >
                                            <span style={{ fontWeight: isSelected ? 600 : 400 }}>{service.name}</span>
                                            {isSelected && <span style={{ color: 'var(--primary-500)' }}>✓</span>}
                                        </div>
                                    )
                                })}
                            </div>

                            <button
                                onClick={() => setServicesModalFor(null)}
                                className="btn btn-primary w-full mt-4"
                            >
                                Concluído
                            </button>
                        </div>
                    </div>
                )
            })()}
        </div>
    )
}
