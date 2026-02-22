import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js'
import { premiumMiddleware } from '../middleware/plan.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const establishmentsRepo = getRepository('establishments.json')
const servicesRepo = getRepository('services.json')
const appointmentsRepo = getRepository('appointments.json')

// Configurações de preços de mercado
const MARKET_PRICE_RADIUS_KM = 10
const MARKET_PRICE_MIN_SAMPLES = 2

// Calcular distância (Haversine)
function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371 // km
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLng = (lng2 - lng1) * Math.PI / 180
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// Listar estabelecimentos (com filtros)
router.get('/', async (req, res, next) => {
    try {
        let establishments = await establishmentsRepo.findAll()

        // Filtrar por categoria
        if (req.query.category) {
            establishments = establishments.filter(e =>
                e.categories.includes(req.query.category)
            )
        }

        // Busca por texto
        if (req.query.q) {
            const query = req.query.q.toLowerCase()
            establishments = establishments.filter(e =>
                e.name.toLowerCase().includes(query) ||
                e.description.toLowerCase().includes(query) ||
                e.address.toLowerCase().includes(query)
            )
        }

        // Ordenar por distância se coordenadas fornecidas
        if (req.query.lat && req.query.lng) {
            const userLat = parseFloat(req.query.lat)
            const userLng = parseFloat(req.query.lng)

            establishments = establishments.map(e => ({
                ...e,
                distance: calculateDistance(userLat, userLng, e.lat, e.lng)
            })).sort((a, b) => a.distance - b.distance)

            // Filtrar por raio máximo
            if (req.query.maxDistance) {
                const maxDist = parseFloat(req.query.maxDistance)
                establishments = establishments.filter(e => e.distance <= maxDist)
            }
        }

        res.json({
            success: true,
            data: establishments
        })
    } catch (error) {
        next(error)
    }
})

// Buscar estabelecimento por ID
router.get('/:id', async (req, res, next) => {
    try {
        const establishment = await establishmentsRepo.findById(req.params.id)

        if (!establishment) {
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        res.json({
            success: true,
            data: establishment
        })
    } catch (error) {
        next(error)
    }
})

// Serviços do estabelecimento (com preços personalizados)
router.get('/:id/services', async (req, res, next) => {
    try {
        const establishment = await establishmentsRepo.findById(req.params.id)

        if (!establishment) {
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        const allServices = await servicesRepo.findAll()

        // Filter services that belong to this establishment and apply custom prices
        const services = allServices
            .filter(s => establishment.services.includes(s.id))
            .map(service => {
                // Check if establishment has custom price/duration for this service
                const prefs = establishment.servicePreferences?.[service.id]
                return {
                    ...service,
                    price: prefs?.price ?? service.price,
                    duration: prefs?.duration ?? service.duration
                }
            })

        res.json({
            success: true,
            data: services
        })
    } catch (error) {
        next(error)
    }
})

// Preços de mercado (Premium only)
router.get('/:id/market-prices', authMiddleware, premiumMiddleware, async (req, res, next) => {
    try {
        const establishment = req.establishment // Vem do premiumMiddleware
        const allEstablishments = await establishmentsRepo.findAll()
        const allServices = await servicesRepo.findAll()

        // Filtrar estabelecimentos próximos (exceto o próprio)
        const nearbyEstablishments = allEstablishments
            .filter(e => e.id !== establishment.id)
            .map(e => ({
                ...e,
                distance: calculateDistance(establishment.lat, establishment.lng, e.lat, e.lng)
            }))
            .filter(e => e.distance <= MARKET_PRICE_RADIUS_KM)

        // Para cada serviço do estabelecimento, calcular média de mercado
        const marketPrices = []

        for (const serviceId of establishment.services) {
            const service = allServices.find(s => s.id === serviceId)
            if (!service) continue

            // Coletar preços dos concorrentes para este serviço
            const competitorPrices = []

            for (const competitor of nearbyEstablishments) {
                if (!competitor.services.includes(serviceId)) continue

                // Pegar preço personalizado ou padrão
                const prefs = competitor.servicePreferences?.[serviceId]
                const price = prefs?.price ?? service.price
                competitorPrices.push(price)
            }

            // Se não tem amostras suficientes, pular
            if (competitorPrices.length < MARKET_PRICE_MIN_SAMPLES) continue

            // Calcular estatísticas
            const sum = competitorPrices.reduce((a, b) => a + b, 0)
            const average = sum / competitorPrices.length
            const min = Math.min(...competitorPrices)
            const max = Math.max(...competitorPrices)

            // Preço do estabelecimento atual
            const estPrefs = establishment.servicePreferences?.[serviceId]
            const yourPrice = estPrefs?.price ?? service.price

            // Determinar posição relativa
            let position = 'average'
            const tolerance = average * 0.1 // 10% de tolerância
            if (yourPrice < average - tolerance) {
                position = 'below'
            } else if (yourPrice > average + tolerance) {
                position = 'above'
            }

            marketPrices.push({
                serviceId,
                serviceName: service.name,
                categoryId: service.categoryId,
                yourPrice,
                averagePrice: Math.round(average * 100) / 100,
                minPrice: min,
                maxPrice: max,
                sampleCount: competitorPrices.length,
                position
            })
        }

        res.json({
            success: true,
            data: {
                marketPrices,
                radius: MARKET_PRICE_RADIUS_KM,
                establishmentsAnalyzed: nearbyEstablishments.length,
                minSamplesRequired: MARKET_PRICE_MIN_SAMPLES
            }
        })
    } catch (error) {
        next(error)
    }
})

// Agendamentos do estabelecimento (admin only)
router.get('/:id/appointments', authMiddleware, async (req, res, next) => {
    try {
        const appointments = await appointmentsRepo.findAll({
            establishmentId: parseInt(req.params.id)
        })

        // Filtrar por data se fornecido
        let filtered = appointments
        if (req.query.date) {
            filtered = filtered.filter(a => a.date === req.query.date)
        }
        if (req.query.status) {
            filtered = filtered.filter(a => a.status === req.query.status)
        }

        res.json({
            success: true,
            data: filtered.sort((a, b) => {
                const dateCompare = b.date.localeCompare(a.date)
                if (dateCompare !== 0) return dateCompare
                return a.time.localeCompare(b.time)
            })
        })
    } catch (error) {
        next(error)
    }
})

// Horários disponíveis
router.get('/:id/available-slots', async (req, res, next) => {
    try {
        const { date } = req.query

        if (!date) {
            throw new AppError('Data é obrigatória', 400)
        }

        const establishment = await establishmentsRepo.findById(req.params.id)

        if (!establishment) {
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        // Verificar dia da semana
        const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
        const hours = establishment.workingHours[dayOfWeek]

        if (!hours) {
            return res.json({
                success: true,
                data: []
            })
        }

        // Gerar slots de 30 minutos
        const slots = []
        const [openH, openM] = hours.open.split(':').map(Number)
        const [closeH, closeM] = hours.close.split(':').map(Number)

        let currentH = openH
        let currentM = openM

        while (currentH < closeH || (currentH === closeH && currentM < closeM)) {
            slots.push(`${String(currentH).padStart(2, '0')}:${String(currentM).padStart(2, '0')}`)
            currentM += 30
            if (currentM >= 60) {
                currentH++
                currentM = 0
            }
        }

        // Remover horários já agendados (exceto cancelados e no_show)
        const appointments = await appointmentsRepo.findAll({
            establishmentId: parseInt(req.params.id)
        })
        const bookedTimes = appointments
            .filter(a => a.date === date && a.status !== 'cancelled' && a.status !== 'no_show')
            .map(a => a.time)

        const availableSlots = slots.filter(s => !bookedTimes.includes(s))

        res.json({
            success: true,
            data: availableSlots
        })
    } catch (error) {
        next(error)
    }
})

// Criar estabelecimento
router.post('/', async (req, res, next) => {
    try {
        const establishment = await establishmentsRepo.create({
            ...req.body,
            rating: 5.0,
            reviewCount: 0,
            plan: 'free' // Novos estabelecimentos começam no plano free
        })

        res.status(201).json({
            success: true,
            data: establishment
        })
    } catch (error) {
        next(error)
    }
})

// Atualizar estabelecimento
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const establishment = await establishmentsRepo.update(req.params.id, req.body)

        if (!establishment) {
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        res.json({
            success: true,
            data: establishment
        })
    } catch (error) {
        next(error)
    }
})

export default router

