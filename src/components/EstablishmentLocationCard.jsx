import * as LucideIcons from 'lucide-react'

/**
 * Miniatura de mapa (clicável, abre o Google Maps) + links de Instagram e
 * WhatsApp do estabelecimento. Usado na página do estabelecimento e na tela
 * de agendamento.
 *
 * O mapa usa a URL de embed "sem chave" do Google Maps (?output=embed) —
 * não precisa de Google Maps API key.
 */
export default function EstablishmentLocationCard({ establishment }) {
    if (!establishment) return null

    const hasLocation = establishment.lat && establishment.lng
    const mapsUrl = hasLocation
        ? `https://www.google.com/maps/search/?api=1&query=${establishment.lat},${establishment.lng}`
        : null
    const instagramUrl = establishment.instagram
        ? (establishment.instagram.startsWith('http') ? establishment.instagram : `https://instagram.com/${establishment.instagram.replace('@', '')}`)
        : null
    const whatsappUrl = establishment.phone
        ? `https://wa.me/${establishment.phone.replace(/\D/g, '').replace(/^(?!55)/, '55')}`
        : null

    if (!hasLocation && !instagramUrl && !whatsappUrl) return null

    return (
        <div className="mb-4">
            {hasLocation && (
                <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir no Google Maps"
                    style={{ display: 'block', borderRadius: '0.75rem', overflow: 'hidden', marginBottom: '0.75rem', border: '1px solid var(--border-color)' }}
                >
                    <iframe
                        src={`https://www.google.com/maps?q=${establishment.lat},${establishment.lng}&output=embed`}
                        width="100%"
                        height="160"
                        style={{ border: 0, display: 'block', pointerEvents: 'none' }}
                        loading="lazy"
                        title={`Mapa de ${establishment.name}`}
                    />
                </a>
            )}
            <div className="flex flex-wrap gap-3">
                {hasLocation && (
                    <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm flex items-center gap-2">
                        <LucideIcons.MapPin size={16} />
                        Como chegar
                    </a>
                )}
                {instagramUrl && (
                    <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm flex items-center gap-2">
                        <LucideIcons.Instagram size={16} />
                        Instagram
                    </a>
                )}
                {whatsappUrl && (
                    <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm flex items-center gap-2">
                        <LucideIcons.MessageCircle size={16} />
                        WhatsApp
                    </a>
                )}
            </div>
        </div>
    )
}
