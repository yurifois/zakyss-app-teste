import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../services/api'
import { getCurrentPosition, sortByDistance } from '../services/geolocation'
import EstablishmentCard from '../components/EstablishmentCard'

export default function Home() {
    const [searchQuery, setSearchQuery] = useState('')
    const [categories, setCategories] = useState([])
    const [nearbyEstablishments, setNearbyEstablishments] = useState([])
    const [loading, setLoading] = useState(true)
    const navigate = useNavigate()

    useEffect(() => {
        loadData()
    }, [])

    const loadData = async () => {
        setLoading(true)
        try {
            // Load categories
            const cats = await api.getCategories()
            setCategories(cats)

            // Get user location and fetch establishments
            const position = await getCurrentPosition()
            const establishments = await api.getEstablishments({
                lat: position.lat,
                lng: position.lng
            })
            setNearbyEstablishments(establishments.slice(0, 6))
        } catch (error) {
            console.error('Error loading data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSearch = (e) => {
        e.preventDefault()
        if (searchQuery.trim()) {
            navigate(`/buscar?q=${encodeURIComponent(searchQuery)}`)
        }
    }

    const handleCategoryClick = (categoryId) => {
        navigate(`/buscar?categoria=${categoryId}`)
    }

    return (
        <div>
            {/* Hero Section */}
            <section className="hero">
                <div className="container hero-content">
                    <h1 className="hero-title">
                        Encontre os melhores <br />
                        <span style={{ background: 'linear-gradient(135deg, #fa8072, #f08060)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            profissionais de beleza
                        </span>
                    </h1>
                    <p className="hero-subtitle">
                        Agende serviços de beleza e estética com os melhores estabelecimentos em Brasília
                    </p>

                    <form onSubmit={handleSearch} className="search-bar">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="O que você procura? Ex: corte de cabelo, manicure..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" className="btn btn-primary search-btn">
                            🔍 Buscar
                        </button>
                    </form>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.875rem' }}>Popular:</span>
                        {['Corte', 'Manicure', 'Maquiagem', 'Barba'].map(term => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => navigate(`/buscar?q=${term}`)}
                                style={{
                                    background: 'rgba(255,255,255,0.1)',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: 'white',
                                    padding: '0.5rem 1rem',
                                    borderRadius: '9999px',
                                    cursor: 'pointer',
                                    fontSize: '0.875rem',
                                    transition: 'all 0.2s',
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.2)'}
                                onMouseLeave={(e) => e.target.style.background = 'rgba(255,255,255,0.1)'}
                            >
                                {term}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* Categories Section */}
            <section className="py-16">
                <div className="container">
                    <h2 className="text-2xl font-bold mb-8 text-center">
                        Explore por categoria
                    </h2>

                    <div className="category-grid">
                        {categories.map(category => (
                            <div
                                key={category.id}
                                className="category-card"
                                onClick={() => handleCategoryClick(category.id)}
                            >
                                <div className="category-icon">
                                    {category.icon}
                                </div>
                                <span className="category-name">{category.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Nearby Establishments */}
            <section className="py-16" style={{ background: 'var(--bg-secondary)' }}>
                <div className="container">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-bold">
                            📍 Próximos a você
                        </h2>
                        <Link to="/buscar" className="btn btn-outline btn-sm">
                            Ver todos →
                        </Link>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="card">
                                    <div className="skeleton" style={{ height: '180px' }}></div>
                                    <div className="card-body">
                                        <div className="skeleton" style={{ height: '1.5rem', width: '70%', marginBottom: '0.5rem' }}></div>
                                        <div className="skeleton" style={{ height: '1rem', width: '90%' }}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {nearbyEstablishments.map(establishment => (
                                <EstablishmentCard
                                    key={establishment.id}
                                    establishment={establishment}
                                    distance={establishment.distance}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20">
                <div className="container text-center">
                    <h2 className="text-3xl font-bold mb-4">
                        É profissional de beleza?
                    </h2>
                    <p className="text-secondary mb-8" style={{ maxWidth: '600px', margin: '0 auto 2rem' }}>
                        Cadastre seu estabelecimento e alcance milhares de novos clientes na sua região
                    </p>
                    <Link to="/parceiro/cadastro" className="btn btn-primary btn-lg">
                        Cadastrar meu estabelecimento
                    </Link>
                </div>
            </section>
        </div>
    )
}
