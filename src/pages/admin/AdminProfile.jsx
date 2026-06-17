import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getEstablishmentById, updateEstablishment } from '../../services/api'

export default function AdminProfile() {
    const { admin } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const [formData, setFormData] = useState({
        email: '',
        phone: ''
    })

    useEffect(() => {
        if (admin?.establishmentId) {
            loadEstablishment()
        } else {
            setLoading(false)
        }
    }, [admin])

    const loadEstablishment = async () => {
        try {
            setLoading(true)
            // request() já retorna data.data, então 'establishment' é o objeto direto
            const establishment = await getEstablishmentById(admin.establishmentId)
            if (establishment) {
                setFormData({
                    email: establishment.email || admin.email || '',
                    phone: establishment.phone || ''
                })
            }
        } catch (err) {
            setError(err.message || 'Erro ao carregar dados do estabelecimento')
        } finally {
            setLoading(false)
        }
    }

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
        setSuccess(false)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError(null)
        setSuccess(false)
        
        try {
            setSaving(true)
            // request() já retorna data.data, então 'updated' é o objeto direto
            const updated = await updateEstablishment(admin.establishmentId, {
                email: formData.email,
                phone: formData.phone
            })

            setSuccess(true)
            if (updated) {
                setFormData({
                    email: updated.email || formData.email,
                    phone: updated.phone || formData.phone
                })
            }
        } catch (err) {
            setError(err.message || 'Erro ao salvar os dados')
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-4xl animate-bounce">⏳</div>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">Dados Cadastrados</h1>
            </div>

            <div className="card">
                <div className="p-6">
                    <p className="text-sm opacity-70 mb-6">
                        Estes são os dados de contato do seu estabelecimento. O email cadastrado aqui será usado para receber as notificações de novos agendamentos feitos pelos clientes.
                    </p>

                    {(!formData.email || formData.email.trim() === '') && (
                        <div className="p-4 bg-yellow-100 text-yellow-800 rounded-xl mb-6 text-sm flex items-start gap-2">
                            <span>⚠️</span>
                            <div>
                                <strong>Atenção:</strong> O email do seu estabelecimento ainda não foi configurado! Por favor, preencha o campo abaixo e clique em "Salvar Alterações" para começar a receber as notificações.
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-4 bg-red-100 text-red-700 rounded-xl mb-4 text-sm">
                                {error}
                            </div>
                        )}
                        
                        {success && (
                            <div className="p-4 bg-green-100 text-green-700 rounded-xl mb-4 text-sm">
                                ✅ Dados atualizados com sucesso!
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-1">Email Principal (Para Notificações)</label>
                            <input
                                type="email"
                                name="email"
                                className="input w-full"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="Email do estabelecimento"
                                required
                            />
                            <p className="text-xs opacity-60 mt-1">Este é o email que receberá os avisos de novos agendamentos.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Telefone (WhatsApp)</label>
                            <input
                                type="tel"
                                name="phone"
                                className="input w-full"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="(00) 00000-0000"
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                className="btn btn-primary w-full sm:w-auto"
                                disabled={saving}
                            >
                                {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    )
}
