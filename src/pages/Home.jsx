import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import * as api from '../services/api'
import { getCurrentPosition, sortByDistance } from '../services/geolocation'
import EstablishmentCard from '../components/EstablishmentCard'
import * as LucideIcons from 'lucide-react'

const CategoryIcon = ({ iconName, color }) => {
    const Icon = LucideIcons[iconName] || LucideIcons.Sparkles
    return <Icon size={32} color={color} />
}

function HeroDecorations() {
    return (
        <div className="hero-bg-decorations">
            {/* Glowing orbs */}
            <div className="hero-glow-1" />
            <div className="hero-glow-2" />
            <div className="hero-glow-3" />

            {/* Woman silhouette - left side */}
            <svg viewBox="0 0 300 500" style={{ position: 'absolute', left: '-2%', top: '5%', width: '280px', opacity: 0.07 }}>
                <path d="M150,20 C180,20 200,40 210,70 C220,100 215,130 200,155 C190,172 175,185 170,200 C165,220 170,240 175,260 C178,275 180,290 180,310 C180,350 170,380 155,410 C145,430 130,450 120,470 C115,480 110,490 105,500 L95,500 C100,490 105,478 110,465 C120,440 135,415 142,390 C150,365 155,340 152,310 C150,285 145,265 140,245 C135,225 132,205 140,185 C148,165 165,148 175,130 C185,112 190,90 185,68 C180,46 165,32 150,30 C135,28 118,38 108,55 C98,72 92,95 90,118 C88,140 90,162 85,182 C80,202 68,218 55,235 C42,252 28,270 20,292 C12,315 10,340 15,365 C20,385 30,400 35,420 L25,420 C18,400 8,380 4,355 C-2,328 0,300 8,275 C16,250 32,230 46,212 C58,196 68,180 72,160 C76,140 74,118 76,98 C78,75 85,52 100,35 C115,18 135,12 150,20 Z" fill="white" />
                <circle cx="145" cy="62" r="3" fill="white" opacity="0.5" />
            </svg>

            {/* Lotus flower - right side */}
            <svg viewBox="0 0 200 200" style={{ position: 'absolute', right: '5%', top: '35%', width: '160px', opacity: 0.06 }} className="beauty-decoration lotus">
                <g transform="translate(100,100)">
                    <ellipse cx="0" cy="-40" rx="18" ry="45" fill="white" transform="rotate(0)" />
                    <ellipse cx="0" cy="-40" rx="18" ry="45" fill="white" transform="rotate(30)" />
                    <ellipse cx="0" cy="-40" rx="18" ry="45" fill="white" transform="rotate(60)" />
                    <ellipse cx="0" cy="-40" rx="18" ry="45" fill="white" transform="rotate(90)" />
                    <ellipse cx="0" cy="-40" rx="18" ry="45" fill="white" transform="rotate(120)" />
                    <ellipse cx="0" cy="-40" rx="18" ry="45" fill="white" transform="rotate(150)" />
                    <ellipse cx="0" cy="-40" rx="14" ry="38" fill="white" opacity="0.5" transform="rotate(15)" />
                    <ellipse cx="0" cy="-40" rx="14" ry="38" fill="white" opacity="0.5" transform="rotate(45)" />
                    <ellipse cx="0" cy="-40" rx="14" ry="38" fill="white" opacity="0.5" transform="rotate(75)" />
                    <ellipse cx="0" cy="-40" rx="14" ry="38" fill="white" opacity="0.5" transform="rotate(105)" />
                    <ellipse cx="0" cy="-40" rx="14" ry="38" fill="white" opacity="0.5" transform="rotate(135)" />
                    <ellipse cx="0" cy="-40" rx="14" ry="38" fill="white" opacity="0.5" transform="rotate(165)" />
                    <circle cx="0" cy="0" r="12" fill="white" opacity="0.3" />
                </g>
            </svg>

            {/* Scissors - bottom left */}
            <svg viewBox="0 0 120 120" style={{ position: 'absolute', left: '8%', bottom: '10%', width: '90px', opacity: 0.05, transform: 'rotate(-30deg)' }}>
                <circle cx="25" cy="95" r="14" fill="none" stroke="white" strokeWidth="3" />
                <circle cx="95" cy="95" r="14" fill="none" stroke="white" strokeWidth="3" />
                <line x1="32" y1="83" x2="88" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" />
                <line x1="88" y1="83" x2="32" y2="20" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>

            {/* Sparkle dots */}
            <svg viewBox="0 0 20 20" style={{ position: 'absolute', right: '20%', top: '15%', width: '12px', opacity: 0.4 }} className="beauty-decoration sparkle">
                <circle cx="10" cy="10" r="3" fill="#ec4899" />
            </svg>
            <svg viewBox="0 0 20 20" style={{ position: 'absolute', left: '25%', top: '25%', width: '8px', opacity: 0.3 }} className="beauty-decoration sparkle" >
                <circle cx="10" cy="10" r="4" fill="#a855f7" />
            </svg>
            <svg viewBox="0 0 20 20" style={{ position: 'absolute', right: '35%', bottom: '20%', width: '10px', opacity: 0.35 }} className="beauty-decoration sparkle">
                <circle cx="10" cy="10" r="3" fill="#c084fc" />
            </svg>

            {/* Comb - right bottom */}
            <svg viewBox="0 0 100 160" style={{ position: 'absolute', right: '2%', bottom: '5%', width: '60px', opacity: 0.04, transform: 'rotate(15deg)' }}>
                <rect x="10" y="0" width="80" height="50" rx="8" fill="white" />
                <rect x="18" y="50" width="8" height="100" rx="2" fill="white" />
                <rect x="32" y="50" width="8" height="110" rx="2" fill="white" />
                <rect x="46" y="50" width="8" height="100" rx="2" fill="white" />
                <rect x="60" y="50" width="8" height="110" rx="2" fill="white" />
                <rect x="74" y="50" width="8" height="100" rx="2" fill="white" />
            </svg>

            {/* Flowing curves / hair lines */}
            <svg viewBox="0 0 400 200" style={{ position: 'absolute', left: '0', bottom: '0', width: '100%', height: '200px', opacity: 0.04 }}>
                <path d="M0,150 Q100,80 200,120 T400,100" fill="none" stroke="white" strokeWidth="1.5" />
                <path d="M0,170 Q120,100 240,140 T480,110" fill="none" stroke="white" strokeWidth="1" />
                <path d="M-50,180 Q80,120 200,160 T450,130" fill="none" stroke="white" strokeWidth="0.8" />
            </svg>
        </div>
    )
}

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
            const cats = await api.getCategories()
            setCategories(cats)

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
                <HeroDecorations />
                <div className="container hero-content">
                    <h1 className="hero-title">
                        Encontre os melhores <br />
                        <span className="highlight">
                            profissionais de beleza
                        </span>
                    </h1>
                    <p className="hero-subtitle">
                        Agende serviços de beleza e estética com os melhores estabelecimentos na sua região.
                    </p>

                    <form onSubmit={handleSearch} className="search-bar">
                        <input
                            type="text"
                            className="search-input"
                            placeholder="O que você procura? Ex: corte de cabelo, manicure..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <button type="submit" className="search-btn">
                            <LucideIcons.Search size={20} />
                            Buscar
                        </button>
                    </form>

                    <div className="popular-tags">
                        <span className="popular-label">Popular:</span>
                        {['Corte', 'Manicure', 'Maquiagem', 'Barba'].map(term => (
                            <button
                                key={term}
                                type="button"
                                onClick={() => navigate(`/buscar?q=${term}`)}
                                className="popular-tag"
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
                                <div className="category-icon" style={{ backgroundColor: `${category.color}15`, padding: '1rem', borderRadius: '1rem' }}>
                                    <CategoryIcon iconName={category.icon} color={category.color} />
                                </div>
                                <span className="category-name">{category.name}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Nearby Establishments */}
            <section className="py-16 section-dark">
                <div className="container">
                    <div className="flex justify-between items-center mb-8">
                        <h2 className="text-2xl font-bold">
                            <LucideIcons.MapPin size={24} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--accent-400)' }} />
                            Próximos a você
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
            <section className="py-20" style={{ position: 'relative', overflow: 'hidden' }}>
                {/* Decorative glow */}
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(236, 72, 153, 0.06)', filter: 'blur(80px)', pointerEvents: 'none' }} />
                <div className="container text-center" style={{ position: 'relative', zIndex: 1 }}>
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
