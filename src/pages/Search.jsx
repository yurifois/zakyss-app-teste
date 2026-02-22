import { useState, useEffect } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import * as api from '../services/api'
import { getCurrentPosition } from '../services/geolocation'
import EstablishmentCard from '../components/EstablishmentCard'

export default function Search() {
    const [searchParams, setSearchParams] = useSearchParams()
    const [results, setResults] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [userPosition, setUserPosition] = useState(null)

    const query = searchParams.get('q') || ''
    const categoryFilter = searchParams.get('categoria') || ''
    const distanceFilter = searchParams.get('distancia') || ''

    useEffect(() => {
        loadCategories()
        getUserLocation()
    }, [])

    useEffect(() => {
        if (userPosition) {
            loadResults()
        }
    }, [query, categoryFilter, distanceFilter, userPosition])

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

            const establishments = await api.getEstablishments(params)

            // Sort by distance
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
                    <h1 className="text-3xl font-bold mb-2">
                        {query ? `Resultados para "${query}"` : 'Todos os serviços de beleza'}
                    </h1>
                    <p className="text-secondary">
                        {loading ? 'Buscando...' : `${results.length} resultado(s) encontrado(s)`}
                    </p>
                </div>



                {/* Cards Grid */}
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="card">
                                <div className="skeleton" style={{ height: '220px' }}></div>
                                <div className="card-body">
                                    <div className="skeleton" style={{ height: '1.5rem', width: '70%', marginBottom: '0.5rem' }}></div>
                                    <div className="skeleton" style={{ height: '1rem', width: '90%' }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : results.length === 0 ? (
                    <div className="card text-center py-16">
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
                        <h3 className="text-xl font-semibold mb-2">Nenhum resultado encontrado</h3>
                        <p className="text-secondary">Tente fazer uma nova busca</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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

// Professional Card Component


