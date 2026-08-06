import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { getEstablishmentById, updateEstablishment } from '../../services/api'

export default function AdminLinks() {
    const { admin } = useAuth()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    const [formData, setFormData] = useState({
        instagram: '',
        mapsLink: ''
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
            const establishment = await getEstablishmentById(admin.establishmentId)
            if (establishment) {
                setFormData({
                    instagram: establishment.instagram || '',
                    mapsLink: establishment.mapsLink || ''
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
            const updated = await updateEstablishment(admin.establishmentId, {
                instagram: formData.instagram,
                mapsLink: formData.mapsLink
            })

            setSuccess(true)
            if (updated) {
                setFormData({
                    instagram: updated.instagram ?? formData.instagram,
                    mapsLink: updated.mapsLink ?? formData.mapsLink
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
                <h1 className="text-2xl font-bold">🔗 Links</h1>
            </div>

            <div className="card">
                <div className="p-6">
                    <p className="text-sm opacity-70 mb-6">
                        Esses links aparecem como botões pros clientes na página do seu estabelecimento e na tela de agendamento.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-4 bg-red-100 text-red-700 rounded-xl mb-4 text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-4 bg-green-100 text-green-700 rounded-xl mb-4 text-sm">
                                ✅ Links atualizados com sucesso!
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium mb-1">Instagram</label>
                            <input
                                type="text"
                                name="instagram"
                                className="input w-full"
                                placeholder="@seuinstagram ou link completo"
                                value={formData.instagram}
                                onChange={handleChange}
                            />
                            <p className="text-xs opacity-60 mt-1">Aparece como botão "Instagram" na página do estabelecimento.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-1">Link do Google Maps</label>
                            <input
                                type="text"
                                name="mapsLink"
                                className="input w-full"
                                placeholder="Cole aqui o link que o Google Maps te dá em Compartilhar"
                                value={formData.mapsLink}
                                onChange={handleChange}
                            />
                            <p className="text-xs opacity-60 mt-1">
                                No Google Maps, procure seu estabelecimento → Compartilhar → Copiar link, e cole aqui.
                                Aparece como botão "Como chegar" na página do estabelecimento e na tela de agendamento.
                                Sem esse link, o local não aparece pro cliente.
                            </p>
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
