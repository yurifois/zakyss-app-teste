import { useState, useEffect, useRef } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import * as api from '../services/api'

export default function Profile() {
    const { user, isAuthenticated, updateProfile, refreshUser, logout, loading: authLoading } = useAuth()
    const { success, error } = useToast()

    const [tab, setTab] = useState('appointments')
    const [appointments, setAppointments] = useState([])
    const [statusFilter, setStatusFilter] = useState('upcoming')
    const [editing, setEditing] = useState(false)
    const [loading, setLoading] = useState(true)
    const [uploadingAvatar, setUploadingAvatar] = useState(false)
    const [avatarPreview, setAvatarPreview] = useState(null)
    const fileInputRef = useRef(null)

    // Favoritos
    const [favorites, setFavorites] = useState([])
    const [loadingFavorites, setLoadingFavorites] = useState(false)

    // Endereço
    const [addressData, setAddressData] = useState({
        cep: '',
        street: '',
        number: '',
        complement: '',
        neighborhood: '',
        city: '',
        state: ''
    })
    const [editingAddress, setEditingAddress] = useState(false)

    // Senha
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    })
    const [changingPassword, setChangingPassword] = useState(false)

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
    })

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                phone: user.phone || '',
            })
            setAvatarPreview(user.avatar ? api.getImageUrl(user.avatar) : null)

            // Se não tem nome, iniciar em modo de edição
            if (!user.name) {
                setEditing(true)
            }

            // Carregar endereço se existir
            if (user.address) {
                setAddressData(user.address)
            } else {
                // Se não tem endereço, iniciar em modo de edição
                setEditingAddress(true)
            }
            loadAppointments()
        }
    }, [user])

    const loadAppointments = async () => {
        if (!user) return
        setLoading(true)
        try {
            const apts = await api.getAppointmentsByUser(user.id)

            // Enrich with establishment data
            const enriched = await Promise.all(apts.map(async (apt) => {
                const establishment = await api.getEstablishmentById(apt.establishmentId)
                const servicesList = await api.getServicesByIds(apt.services)
                return { ...apt, establishment, servicesList }
            }))

            setAppointments(enriched.sort((a, b) => new Date(b.date) - new Date(a.date)))
        } catch (err) {
            console.error('Error loading appointments:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    const handleSave = async () => {
        try {
            await updateProfile(formData)
            success('Perfil atualizado com sucesso!')
            setEditing(false)
        } catch (err) {
            error('Erro ao atualizar perfil')
        }
    }

    const handleAvatarClick = () => {
        fileInputRef.current?.click()
    }

    const handleAvatarChange = async (e) => {
        const file = e.target.files[0]
        if (!file) return

        // Validações
        if (!file.type.startsWith('image/')) {
            error('Por favor, selecione uma imagem')
            return
        }
        if (file.size > 5 * 1024 * 1024) {
            error('A imagem deve ter no máximo 5MB')
            return
        }

        // Preview imediato
        const reader = new FileReader()
        reader.onload = (e) => setAvatarPreview(e.target.result)
        reader.readAsDataURL(file)

        // Upload
        setUploadingAvatar(true)
        try {
            const result = await api.uploadUserAvatar(user.id, file)
            setAvatarPreview(api.getImageUrl(result.avatar))
            // O upload já salvou o usuário atualizado no localStorage
            // Atualizar o contexto sem recarregar a página
            refreshUser()
            success('Foto atualizada com sucesso!')
        } catch (err) {
            error('Erro ao atualizar foto')
            setAvatarPreview(user.avatar ? api.getImageUrl(user.avatar) : null)
        } finally {
            setUploadingAvatar(false)
        }
    }

    // ========== FAVORITOS ==========
    const loadFavorites = async () => {
        if (!user) return
        setLoadingFavorites(true)
        try {
            const favoriteIds = await api.getUserFavorites(user.id)
            // Carregar dados dos estabelecimentos
            const establishments = await Promise.all(
                favoriteIds.map(id => api.getEstablishmentById(id))
            )
            setFavorites(establishments.filter(Boolean))
        } catch (err) {
            console.error('Error loading favorites:', err)
        } finally {
            setLoadingFavorites(false)
        }
    }

    const handleRemoveFavorite = async (establishmentId) => {
        try {
            await api.toggleFavorite(user.id, establishmentId)
            setFavorites(prev => prev.filter(f => f.id !== establishmentId))
            success('Removido dos favoritos!')
        } catch (err) {
            error('Erro ao remover favorito')
        }
    }

    // ========== ENDEREÇO ==========
    const handleAddressChange = (e) => {
        const { name, value } = e.target
        setAddressData(prev => ({ ...prev, [name]: value }))
    }

    const handleAddressSave = async () => {
        try {
            await updateProfile({ address: addressData })
            success('Endereço salvo com sucesso!')
            setEditingAddress(false)
        } catch (err) {
            error('Erro ao salvar endereço')
        }
    }

    const handleCepSearch = async () => {
        const cep = addressData.cep.replace(/\D/g, '')
        if (cep.length !== 8) return

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)
            const data = await response.json()
            if (!data.erro) {
                setAddressData(prev => ({
                    ...prev,
                    street: data.logradouro || '',
                    neighborhood: data.bairro || '',
                    city: data.localidade || '',
                    state: data.uf || ''
                }))
            }
        } catch (err) {
            console.error('Erro ao buscar CEP:', err)
        }
    }

    // ========== SEGURANÇA (SENHA) ==========
    const handlePasswordChange = (e) => {
        const { name, value } = e.target
        setPasswordData(prev => ({ ...prev, [name]: value }))
    }

    const handlePasswordSave = async () => {
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            error('As senhas não coincidem')
            return
        }
        if (passwordData.newPassword.length < 6) {
            error('A senha deve ter pelo menos 6 caracteres')
            return
        }

        setChangingPassword(true)
        try {
            await api.changePassword(user.id, {
                currentPassword: passwordData.currentPassword,
                newPassword: passwordData.newPassword
            })
            success('Senha alterada com sucesso!')
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
        } catch (err) {
            error(err.message || 'Erro ao alterar senha')
        } finally {
            setChangingPassword(false)
        }
    }

    // Carregar favoritos quando aba for selecionada
    useEffect(() => {
        if (tab === 'favorites' && favorites.length === 0) {
            loadFavorites()
        }
    }, [tab])

    // Aguardar carregamento do localStorage
    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="text-4xl mb-4">⏳</div>
                    <p>Carregando...</p>
                </div>
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/entrar" replace />
    }

    const formatDate = (dateStr) => {
        const [year, month, day] = dateStr.split('-')
        const date = new Date(year, month - 1, day)
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const handleCancelAppointment = async (appointmentId) => {
        if (!confirm('Tem certeza que deseja cancelar este agendamento?')) return
        try {
            await api.updateAppointmentStatus(appointmentId, 'cancelled')
            success('Agendamento cancelado com sucesso!')
            loadAppointments()
        } catch (err) {
            error(err.message || 'Erro ao cancelar agendamento')
        }
    }

    const getStatusBadge = (status) => {
        const styles = {
            pending: { class: 'badge-warning', label: 'Pendente' },
            confirmed: { class: 'badge-success', label: 'Confirmado' },
            cancelled: { class: 'badge-error', label: 'Cancelado' },
            completed: { class: 'badge-secondary', label: 'Concluído' },
            no_show: { class: 'badge-error', label: 'Não Compareceu' },
        }
        const { class: cls, label } = styles[status] || styles.pending
        return <span className={`badge ${cls}`}>{label}</span>
    }

    return (
        <div className="py-8">
            <div className="container">
                <div className="grid md:grid-cols-4 gap-8">
                    {/* Sidebar */}
                    <div>
                        <div className="card" style={{ padding: '1.5rem', textAlign: 'center' }}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp,image/gif"
                                onChange={handleAvatarChange}
                                style={{ display: 'none' }}
                            />
                            <div
                                className="profile-avatar-upload"
                                onClick={handleAvatarClick}
                                title="Clique para alterar a foto"
                            >
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="profile-avatar-img" />
                                ) : (
                                    <div className="avatar avatar-xl">
                                        {user.name?.charAt(0).toUpperCase() || 'U'}
                                    </div>
                                )}
                                <div className="profile-avatar-overlay">
                                    {uploadingAvatar ? (
                                        <span className="spinner-small"></span>
                                    ) : (
                                        <span>📷</span>
                                    )}
                                </div>
                            </div>
                            <h2 className="text-lg font-bold mt-4">{user.name}</h2>
                            <p className="text-sm text-secondary">{user.email}</p>
                        </div>

                        <div className="card mt-4 profile-sidebar-nav" style={{ overflow: 'hidden' }}>
                            <button
                                onClick={() => setTab('appointments')}
                                className="w-full text-left p-4"
                                style={{ border: 'none', background: tab === 'appointments' ? 'var(--primary-50)' : 'transparent', cursor: 'pointer' }}
                            >
                                📅 Meus Agendamentos
                            </button>
                            <button
                                onClick={() => setTab('favorites')}
                                className="w-full text-left p-4"
                                style={{ border: 'none', background: tab === 'favorites' ? 'var(--primary-50)' : 'transparent', cursor: 'pointer', borderTop: '1px solid var(--border-color)' }}
                            >
                                ❤️ Favoritos
                            </button>
                            <button
                                onClick={() => setTab('profile')}
                                className="w-full text-left p-4"
                                style={{ border: 'none', background: tab === 'profile' ? 'var(--primary-50)' : 'transparent', cursor: 'pointer', borderTop: '1px solid var(--border-color)' }}
                            >
                                👤 Dados Pessoais
                            </button>
                            <button
                                onClick={() => setTab('address')}
                                className="w-full text-left p-4"
                                style={{ border: 'none', background: tab === 'address' ? 'var(--primary-50)' : 'transparent', cursor: 'pointer', borderTop: '1px solid var(--border-color)' }}
                            >
                                📍 Endereço
                            </button>
                            <button
                                onClick={() => setTab('security')}
                                className="w-full text-left p-4"
                                style={{ border: 'none', background: tab === 'security' ? 'var(--primary-50)' : 'transparent', cursor: 'pointer', borderTop: '1px solid var(--border-color)' }}
                            >
                                🔒 Segurança
                            </button>
                            <button
                                onClick={logout}
                                className="w-full text-left p-4"
                                style={{ border: 'none', background: 'transparent', cursor: 'pointer', borderTop: '1px solid var(--border-color)', color: 'var(--error-500)' }}
                            >
                                🚪 Sair
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="md:col-span-3">
                        {tab === 'appointments' && (
                            <>
                                <h1 className="text-2xl font-bold mb-6">Meus Agendamentos</h1>

                                {loading ? (
                                    <div className="card py-8 text-center">Carregando...</div>
                                ) : appointments.length === 0 ? (
                                    <div className="card text-center py-16">
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                                        <h3 className="text-xl font-semibold mb-2">Nenhum agendamento</h3>
                                        <p className="text-secondary mb-6">Você ainda não fez nenhum agendamento</p>
                                        <Link to="/buscar" className="btn btn-primary">
                                            Buscar serviços
                                        </Link>
                                    </div>
                                ) : (
                                    <>
                                        {/* Status Filter Tabs */}
                                        <div className="appointment-status-tabs mb-6">
                                            {[
                                                { key: 'upcoming', label: '📅 Próximos', filter: a => a.status === 'pending' || a.status === 'confirmed' },
                                                { key: 'completed', label: '✓ Concluídos', filter: a => a.status === 'completed' },
                                                { key: 'cancelled', label: '✕ Cancelados', filter: a => a.status === 'cancelled' || a.status === 'no_show' },
                                                { key: 'all', label: '📋 Todos', filter: () => true },
                                            ].map(({ key, label, filter }) => {
                                                const count = appointments.filter(filter).length
                                                return (
                                                    <button
                                                        key={key}
                                                        onClick={() => setStatusFilter(key)}
                                                        className={`status-tab ${statusFilter === key ? 'active' : ''}`}
                                                    >
                                                        {label}
                                                        <span className="status-tab-count">{count}</span>
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        {/* Filtered Appointments */}
                                        {(() => {
                                            const filters = {
                                                upcoming: a => a.status === 'pending' || a.status === 'confirmed',
                                                completed: a => a.status === 'completed',
                                                cancelled: a => a.status === 'cancelled' || a.status === 'no_show',
                                                all: () => true,
                                            }
                                            const filtered = appointments.filter(filters[statusFilter] || filters.all)

                                            if (filtered.length === 0) {
                                                return (
                                                    <div className="card text-center py-12">
                                                        <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.5 }}>
                                                            {statusFilter === 'upcoming' && '📅'}
                                                            {statusFilter === 'completed' && '✓'}
                                                            {statusFilter === 'cancelled' && '✕'}
                                                        </div>
                                                        <p className="text-secondary">
                                                            {statusFilter === 'upcoming' && 'Nenhum agendamento próximo'}
                                                            {statusFilter === 'completed' && 'Nenhum agendamento concluído'}
                                                            {statusFilter === 'cancelled' && 'Nenhum agendamento cancelado'}
                                                        </p>
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div className="flex flex-col gap-4">
                                                    {filtered.map(apt => (
                                                        <div key={apt.id} className={`card appointment-card ${apt.status}`} style={{ padding: '1.5rem' }}>
                                                            <div className="flex justify-between items-start mb-4">
                                                                <div>
                                                                    <h3 className="text-lg font-semibold">{apt.establishment?.name}</h3>
                                                                    <p className="text-sm text-secondary">{apt.establishment?.address}</p>
                                                                </div>
                                                                {getStatusBadge(apt.status)}
                                                            </div>

                                                            <div className="flex flex-wrap gap-6 text-sm">
                                                                <div>
                                                                    <span className="text-muted">📅 Data:</span>{' '}
                                                                    <strong>{formatDate(apt.date)}</strong>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted">🕐 Horário:</span>{' '}
                                                                    <strong>{apt.time}</strong>
                                                                </div>
                                                                <div>
                                                                    <span className="text-muted">💰 Total:</span>{' '}
                                                                    <strong>R$ {apt.totalPrice?.toFixed(2)}</strong>
                                                                </div>
                                                            </div>

                                                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                                                                <div className="flex justify-between items-center">
                                                                    <div>
                                                                        <span className="text-sm text-muted">Serviços: </span>
                                                                        {apt.servicesList?.map(s => (
                                                                            <span key={s.id} className="badge badge-primary mr-2">{s.name}</span>
                                                                        ))}
                                                                    </div>
                                                                    {(apt.status === 'pending' || apt.status === 'confirmed') && (
                                                                        <button
                                                                            onClick={() => handleCancelAppointment(apt.id)}
                                                                            className="btn btn-sm"
                                                                            style={{ backgroundColor: 'var(--error-500)', color: 'white', fontSize: '0.8rem', padding: '0.4rem 1rem' }}
                                                                        >
                                                                            ✕ Cancelar
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        })()}
                                    </>
                                )}
                            </>
                        )}

                        {tab === 'profile' && (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h1 className="text-2xl font-bold">Dados Pessoais</h1>
                                    {!editing && (
                                        <button onClick={() => setEditing(true)} className="btn btn-secondary">
                                            ✏️ Editar
                                        </button>
                                    )}
                                </div>

                                <div className="card" style={{ padding: '2rem' }}>
                                    <div className="form-group">
                                        <label className="form-label">Nome completo</label>
                                        <input
                                            type="text"
                                            name="name"
                                            className="form-input"
                                            value={formData.name}
                                            onChange={handleChange}
                                            disabled={!editing}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">E-mail</label>
                                        <input
                                            type="email"
                                            name="email"
                                            className="form-input"
                                            value={formData.email}
                                            onChange={handleChange}
                                            disabled={!editing}
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Telefone</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            className="form-input"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            disabled={!editing}
                                        />
                                    </div>

                                    {editing && (
                                        <div className="flex gap-4 mt-6">
                                            <button onClick={handleSave} className="btn btn-primary">
                                                Salvar alterações
                                            </button>
                                            <button onClick={() => setEditing(false)} className="btn btn-secondary">
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Favoritos */}
                        {tab === 'favorites' && (
                            <>
                                <h1 className="text-2xl font-bold mb-6">Meus Favoritos</h1>
                                {loadingFavorites ? (
                                    <div className="card py-8 text-center">Carregando...</div>
                                ) : favorites.length === 0 ? (
                                    <div className="card text-center py-16">
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❤️</div>
                                        <h3 className="text-xl font-semibold mb-2">Nenhum favorito</h3>
                                        <p className="text-secondary mb-6">Você ainda não favoritou nenhum estabelecimento</p>
                                        <Link to="/buscar" className="btn btn-primary">
                                            Buscar estabelecimentos
                                        </Link>
                                    </div>
                                ) : (
                                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {favorites.map(est => (
                                            <div key={est.id} className="card" style={{ padding: '1rem' }}>
                                                <div className="flex gap-4">
                                                    <img
                                                        src={api.getImageUrl(est.image) || '/placeholder.jpg'}
                                                        alt={est.name}
                                                        style={{ width: '80px', height: '80px', borderRadius: 'var(--radius-lg)', objectFit: 'cover' }}
                                                    />
                                                    <div className="flex-1">
                                                        <h3 className="font-semibold">{est.name}</h3>
                                                        <p className="text-sm text-secondary">{est.category}</p>
                                                        <div className="flex items-center gap-1 text-sm mt-1">
                                                            <span>⭐</span>
                                                            <span>{est.rating?.toFixed(1) || 'N/A'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 mt-4">
                                                    <Link to={`/estabelecimento/${est.id}`} className="btn btn-secondary btn-sm flex-1">
                                                        Ver detalhes
                                                    </Link>
                                                    <button
                                                        onClick={() => handleRemoveFavorite(est.id)}
                                                        className="btn btn-outline btn-sm"
                                                        style={{ color: 'var(--error-500)', borderColor: 'var(--error-500)' }}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        {/* Endereço */}
                        {tab === 'address' && (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    <h1 className="text-2xl font-bold">Meu Endereço</h1>
                                    {!editingAddress && (
                                        <button onClick={() => setEditingAddress(true)} className="btn btn-secondary">
                                            ✏️ Editar
                                        </button>
                                    )}
                                </div>

                                <div className="card" style={{ padding: '2rem' }}>
                                    <div className="grid md:grid-cols-3 gap-4">
                                        <div className="form-group">
                                            <label className="form-label">CEP</label>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    name="cep"
                                                    className="form-input"
                                                    value={addressData.cep}
                                                    onChange={handleAddressChange}
                                                    onBlur={handleCepSearch}
                                                    placeholder="00000-000"
                                                    disabled={!editingAddress}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-4 gap-4">
                                        <div className="form-group" style={{ gridColumn: 'span 3' }}>
                                            <label className="form-label">Rua</label>
                                            <input
                                                type="text"
                                                name="street"
                                                className="form-input"
                                                value={addressData.street}
                                                onChange={handleAddressChange}
                                                disabled={!editingAddress}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Número</label>
                                            <input
                                                type="text"
                                                name="number"
                                                className="form-input"
                                                value={addressData.number}
                                                onChange={handleAddressChange}
                                                disabled={!editingAddress}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="form-group">
                                            <label className="form-label">Complemento</label>
                                            <input
                                                type="text"
                                                name="complement"
                                                className="form-input"
                                                value={addressData.complement}
                                                onChange={handleAddressChange}
                                                placeholder="Apto, Bloco, etc."
                                                disabled={!editingAddress}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Bairro</label>
                                            <input
                                                type="text"
                                                name="neighborhood"
                                                className="form-input"
                                                value={addressData.neighborhood}
                                                onChange={handleAddressChange}
                                                disabled={!editingAddress}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid md:grid-cols-2 gap-4">
                                        <div className="form-group">
                                            <label className="form-label">Cidade</label>
                                            <input
                                                type="text"
                                                name="city"
                                                className="form-input"
                                                value={addressData.city}
                                                onChange={handleAddressChange}
                                                disabled={!editingAddress}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Estado</label>
                                            <input
                                                type="text"
                                                name="state"
                                                className="form-input"
                                                value={addressData.state}
                                                onChange={handleAddressChange}
                                                maxLength={2}
                                                disabled={!editingAddress}
                                            />
                                        </div>
                                    </div>

                                    {editingAddress && (
                                        <div className="flex gap-4 mt-6">
                                            <button onClick={handleAddressSave} className="btn btn-primary">
                                                Salvar endereço
                                            </button>
                                            <button onClick={() => setEditingAddress(false)} className="btn btn-secondary">
                                                Cancelar
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}

                        {/* Segurança */}
                        {tab === 'security' && (
                            <>
                                <h1 className="text-2xl font-bold mb-6">Segurança</h1>

                                <div className="card" style={{ padding: '2rem' }}>
                                    <h2 className="text-lg font-semibold mb-4">Alterar Senha</h2>

                                    <div className="form-group">
                                        <label className="form-label">Senha atual</label>
                                        <input
                                            type="password"
                                            name="currentPassword"
                                            className="form-input"
                                            value={passwordData.currentPassword}
                                            onChange={handlePasswordChange}
                                            placeholder="Digite sua senha atual"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Nova senha</label>
                                        <input
                                            type="password"
                                            name="newPassword"
                                            className="form-input"
                                            value={passwordData.newPassword}
                                            onChange={handlePasswordChange}
                                            placeholder="Digite a nova senha (mín. 6 caracteres)"
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Confirmar nova senha</label>
                                        <input
                                            type="password"
                                            name="confirmPassword"
                                            className="form-input"
                                            value={passwordData.confirmPassword}
                                            onChange={handlePasswordChange}
                                            placeholder="Confirme a nova senha"
                                        />
                                    </div>

                                    <button
                                        onClick={handlePasswordSave}
                                        className="btn btn-primary mt-4"
                                        disabled={changingPassword}
                                    >
                                        {changingPassword ? 'Alterando...' : '🔒 Alterar senha'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
