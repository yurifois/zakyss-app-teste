import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import * as api from '../../services/api'
import { useToast } from '../../contexts/ToastContext'
import ImageUploader from '../../components/ImageUploader'

export default function AdminImages() {
    const { admin } = useAuth()
    const { success, error } = useToast()
    const [establishment, setEstablishment] = useState(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (admin) loadEstablishment()
    }, [admin])

    const loadEstablishment = async () => {
        try {
            setLoading(true)
            const est = await api.getEstablishmentById(admin.establishmentId)
            setEstablishment(est)
        } catch (err) {
            error(err.message || 'Erro ao carregar dados do estabelecimento')
        } finally {
            setLoading(false)
        }
    }

    const handleLogoUpload = async (file) => {
        try {
            const result = await api.uploadEstablishmentLogo(admin.establishmentId, file)
            setEstablishment(prev => ({ ...prev, image: result.image }))
            success('Logo atualizada com sucesso!')
        } catch (err) {
            console.error('Error uploading logo:', err)
            throw err
        }
    }

    const handleServiceImageUpload = async (file) => {
        try {
            const result = await api.uploadServiceImage(admin.establishmentId, file)
            setEstablishment(prev => ({ ...prev, serviceImages: result.serviceImages }))
            success('Imagem adicionada com sucesso!')
        } catch (err) {
            console.error('Error uploading service image:', err)
            throw err
        }
    }

    const handleDeleteServiceImage = async (index) => {
        try {
            await api.deleteServiceImage(admin.establishmentId, index)
            setEstablishment(prev => ({
                ...prev,
                serviceImages: prev.serviceImages.filter((_, i) => i !== index)
            }))
            success('Imagem removida')
        } catch (err) {
            console.error('Error deleting image:', err)
        }
    }

    if (loading) {
        return <div className="text-center py-16">⏳ Carregando...</div>
    }

    return (
        <div>
            <h1 className="text-2xl font-bold mb-2">🖼️ Imagens do Estabelecimento</h1>
            <p className="text-secondary mb-6">
                Essas imagens aparecem pros clientes na página do seu estabelecimento e na tela de agendamento.
            </p>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Logo Upload */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 className="font-bold mb-4">Logo / Imagem Principal</h3>
                    <p className="text-sm text-secondary mb-4">
                        Esta imagem será exibida no card do seu estabelecimento.
                    </p>
                    <ImageUploader
                        label=""
                        currentImage={api.getImageUrl(establishment?.image)}
                        onUpload={handleLogoUpload}
                    />
                </div>

                {/* Service Images */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 className="font-bold mb-4">Galeria de Serviços</h3>
                    <p className="text-sm text-secondary mb-4">
                        Adicione fotos do seu trabalho para atrair mais clientes.
                    </p>

                    <ImageUploader
                        label="Adicionar novas imagens"
                        onUpload={handleServiceImageUpload}
                        multiple
                    />

                    {establishment?.serviceImages && establishment.serviceImages.length > 0 && (
                        <div className="service-images-gallery">
                            {establishment.serviceImages.map((img, index) => (
                                <div key={index} className="service-image-item">
                                    <img src={api.getImageUrl(img)} alt={`Serviço ${index + 1}`} />
                                    <button
                                        className="service-image-remove"
                                        onClick={() => handleDeleteServiceImage(index)}
                                        title="Remover imagem"
                                    >
                                        ×
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
