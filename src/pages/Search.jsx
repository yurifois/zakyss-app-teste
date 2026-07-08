import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import * as api from '../services/api'
import { getCurrentPosition } from '../services/geolocation'
import EstablishmentCard from '../components/EstablishmentCard'
import { Search as SearchIcon, MapPin, Filter } from 'lucide-react'

export default function Search() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [results, setResults] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [userPosition, setUserPosition] = useState(null)

    const query = searchParams.get('q') || ''
    const categoryFilter = searchParams.get('categoria') || ''
    const distanceFilter = searchParams.get('distancia') || ''
    const domiciliarFilter = searchParams.get('domiciliar') === 'true'
    const acessivelFilter = searchParams.get('acessivel') === 'true'

    useEffect(() => {
        loadCategories()
        getUserLocation()
    }, [])

    useEffect(() => {
        if (userPosition) {
            loadResults()
        }
    }, [query, categoryFilter, distanceFilter, domiciliarFilter, acessivelFilter, userPosition])

    const updateFilter = (key, value) => {
        const next = new URLSearchParams(searchParams)
        if (value) {
            next.set(key, value)
        } else {
            next.delete(key)
        }
        setSearchParams(next)
    }

    const loadCategories = async () => {
        try {
            const cats = await api.getCategories()
            setCategories(cats)
        } catch (error) {
            console.error('Error loading categories:', error)
        }
    }

    const getUserLocation = async () => {
        const position = await getCurrentPosition()
        setUserPosition(position)
    }

    const loadResults = async () => {
        setLoading(true)
        try {
            const params = {
                lat: userPosition.lat,
                lng: userPosition.lng
            }

            if (query) params.q = query
            if (categoryFilter) params.category = categoryFilter
            if (distanceFilter) params.maxDistance = distanceFilter
            if (domiciliarFilter) params.domiciliar = 'true'
            if (acessivelFilter) params.acessivel = 'true'

            const establishments = await api.getEstablishments(params)

            const sorted = (establishments || []).sort((a, b) => (a.distance || 999) - (b.distance || 999))
            setResults(sorted)
        } catch (error) {
            console.error('Error loading results:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="py-8">
            <div className="container">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                        <SearchIcon size={28} style={{ color: 'var(--accent-400)' }} />
                        {query ? `Resultados para "${query}"` : 'Todos os serviços de beleza'}
                    </h1>
                    <p className="text-secondary">
                        {loading ? 'Buscando...' : `${results.length} resultado(s) encontrado(s)`}
                    </p>
                </div>

                {/* Filtros */}
                <div className="card mb-6 p-4 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Filter size={18} style={{ color: 'var(--text-muted)' }} />
                        <span className="text-sm font-medium">Filtros:</span>
                    </div>

                    <select
                        className="form-input"
                        style={{ width: 'auto' }}
                        value={categoryFilter}
                        onChange={(e) => updateFilter('categoria', e.target.value)}
                    >
                        <option value="">Todos os tipos de serviço</option>
                        {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                    </select>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={domiciliarFilter}
                            onChange={(e) => updateFilter('domiciliar', e.target.checked ? 'true' : '')}
                        />
                        Atendimento domiciliar
                    </label>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={acessivelFilter}
                            onChange={(e) => updateFilter('acessivel', e.target.checked ? 'true' : '')}
                        />
                        Acessível
                    </label>
                </div>

                {/* Cards Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="card">
                                <div className="skeleton" style={{ aspectRatio: '1/1' }}></div>
                                <div className="card-body">
                                    <div className="skeleton" style={{ height: '1.5rem', width: '70%', marginBottom: '0.5rem' }}></div>
                                    <div className="skeleton" style={{ height: '1rem', width: '90%' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : results.length === 0 ? (
                    <div className="card text-center py-16" style={{ borderStyle: 'dashed' }}>
                        <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                            <SearchIcon size={64} style={{ color: 'var(--text-muted)' }} strokeWidth={1.5} />
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Nenhum resultado encontrado</h3>
                        <p className="text-secondary">Tente fazer uma nova busca ou mude os filtros</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                        {results.map(item => (
                            <EstablishmentCard
                                key={`est-${item.id}`}
                                establishment={item}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
