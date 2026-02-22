import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getImageUrl, toggleFavorite, getUserFavorites } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function EstablishmentCard({ establishment }) {
    const { user, isAuthenticated } = useAuth()
    const { success, error } = useToast()
    const [isFavorite, setIsFavorite] = useState(false)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (isAuthenticated && user) {
            // Verificar se está nos favoritos
            checkIfFavorite()
        }
    }, [user, establishment.id])

    const checkIfFavorite = async () => {
        try {
            const favorites = await getUserFavorites(user.id)
            setIsFavorite(favorites.includes(establishment.id))
        } catch (err) {
            console.error('Error checking favorites:', err)
        }
    }

    const handleFavoriteClick = async (e) => {
        e.preventDefault()
        e.stopPropagation()

        if (!isAuthenticated) {
            error('Faça login para favoritar')
            return
        }

        setLoading(true)
        try {
            await toggleFavorite(user.id, establishment.id)
            setIsFavorite(!isFavorite)
            success(isFavorite ? 'Removido dos favoritos' : 'Adicionado aos favoritos!')
        } catch (err) {
            error('Erro ao atualizar favorito')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Link to={`/estabelecimento/${establishment.id}`} className="establishment-card">
            <div className="establishment-image-container">
                <img
                    src={getImageUrl(establishment.image)}
                    alt={establishment.name}
                    className="establishment-image"
                />
                <div className="establishment-rating-badge">
                    <span className="star">⭐</span>
                    <span>{establishment.rating}</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
                        ({establishment.reviewCount})
                    </span>
                </div>

                {/* Botão de Favorito */}
                <button
                    className={`favorite-btn ${isFavorite ? 'favorited' : ''}`}
                    onClick={handleFavoriteClick}
                    disabled={loading}
                    title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
                >
                    {isFavorite ? '❤️' : '🤍'}
                </button>
            </div>
            <div className="establishment-content">
                <h3 className="establishment-name">{establishment.name}</h3>

                <div className="establishment-categories">
                    {establishment.categories.slice(0, 4).map(cat => (
                        <span key={cat} className="badge">{cat}</span>
                    ))}
                </div>

                <p className="establishment-address">
                    <span className="icon">📍</span>
                    <span>{establishment.city}, {establishment.state}</span>
                </p>
            </div>
        </Link>
    )
}
