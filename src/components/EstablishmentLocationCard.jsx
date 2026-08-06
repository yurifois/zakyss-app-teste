import * as LucideIcons from 'lucide-react'

/**
 * Localização (link do Google Maps colado manualmente pelo estabelecimento no
 * admin) + link de Instagram. Usado na página do estabelecimento e na tela
 * de agendamento.
 *
 * Por que o link é manual em vez de calculado a partir do endereço: geocodificação
 * automática pode errar o local. O dono do estabelecimento sabe exatamente onde
 * fica — ele mesmo copia o link em Google Maps > Compartilhar > Copiar link.
 * Enquanto ele não preencher esse campo no admin, nenhuma localização é exibida
 * pro cliente (melhor não mostrar nada do que mostrar um lugar errado).
 */
export default function EstablishmentLocationCard({ establishment }) {
    if (!establishment) return null

    const mapsLink = establishment.mapsLink || null

    // Se o link colado tiver coordenadas embutidas (comum nos links do Google Maps,
    // ex: .../@-15.79,-47.88,15z/...), usa pra mostrar uma miniatura visual do mapa.
    // Se não tiver, o botão "Como chegar" ainda funciona normalmente, só não tem prévia visual.
    const coordsMatch = mapsLink?.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
    const previewCoords = coordsMatch ? { lat: coordsMatch[1], lng: coordsMatch[2] } : null

    const instagramUrl = establishment.instagram
        ? (establishment.instagram.startsWith('http') ? establishment.instagram : `https://instagram.com/${establishment.instagram.replace('@', '')}`)
        : null

    if (!mapsLink && !instagramUrl) return null

    return (
        <div className="mb-4">
            {previewCoords && (
                <a
                    href={mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir no Google Maps"
                    style={{ display: 'block', borderRadius: '0.75rem', overflow: 'hidden', marginBottom: '0.75rem', border: '1px solid var(--border-color)' }}
                >
                    <iframe
                        src={`https://www.google.com/maps?q=${previewCoords.lat},${previewCoords.lng}&output=embed`}
                        width="100%"
                        height="160"
                        style={{ border: 0, display: 'block', pointerEvents: 'none' }}
                        loading="lazy"
                        title={`Mapa de ${establishment.name}`}
                    />
                </a>
            )}
            <div className="flex flex-wrap gap-3">
                {mapsLink && (
                    <a href={mapsLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm flex items-center gap-2">
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
            </div>
        </div>
    )
}
