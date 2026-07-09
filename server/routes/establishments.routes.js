import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js'
import { premiumMiddleware } from '../middleware/plan.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const establishmentsRepo = getRepository('establishments.json')
const servicesRepo = getRepository('services.json')
const appointmentsRepo = getRepository('appointments.json')
const employeesRepo = getRepository('employees.json')
const adminsRepo = getRepository('admins.json')

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

        // Filtrar por atendimento domiciliar
        if (req.query.domiciliar === 'true') {
            establishments = establishments.filter(e =>
                e.locationType === 'domicile' || e.locationType === 'both'
            )
        }

        // Filtrar por acessibilidade
        if (req.query.acessivel === 'true') {
            establishments = establishments.filter(e => e.accessible === true)
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
        const establishmentId = parseInt(req.params.id)
        if (req.user.type !== 'admin' || req.user.establishmentId !== establishmentId) {
            throw new AppError('Você não tem permissão para ver os agendamentos deste estabelecimento', 403)
        }

        const appointments = await appointmentsRepo.findAll({ establishmentId })

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

// Ficha de clientes: agrupa os agendamentos concluídos por cliente, com o
// histórico de serviços já realizados no estabelecimento
router.get('/:id/clients', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.params.id)
        if (req.user.type !== 'admin' || req.user.establishmentId !== establishmentId) {
            throw new AppError('Você não tem permissão para ver os clientes deste estabelecimento', 403)
        }

        const appointments = await appointmentsRepo.findAll({ establishmentId })
        const completed = appointments.filter(a => a.status === 'completed')

        const servicesRepo = getRepository('services.json')
        const allServices = await servicesRepo.findAll()
        const serviceNameById = {}
        allServices.forEach(s => { serviceNameById[s.id] = s.name })

        const normalizePhone = (phone) => (phone || '').replace(/\D/g, '')
        const clientsByKey = {}

        for (const apt of completed) {
            const key = normalizePhone(apt.customerPhone) || `email:${(apt.customerEmail || '').toLowerCase()}`
            if (!clientsByKey[key]) clientsByKey[key] = []
            clientsByKey[key].push(apt)
        }

        const clients = Object.values(clientsByKey).map(apts => {
            const sorted = [...apts].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
            const latest = sorted[0]
            return {
                name: latest.customerName,
                phone: latest.customerPhone,
                email: latest.customerEmail,
                userId: latest.userId || null,
                visitCount: sorted.length,
                lastVisit: latest.date,
                history: sorted.map(apt => ({
                    date: apt.date,
                    time: apt.time,
                    services: (apt.services || []).map(id => serviceNameById[id] || 'Serviço removido'),
                    totalPrice: apt.totalPrice,
                    notes: apt.notes || null
                }))
            }
        }).sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || ''))

        res.json({
            success: true,
            data: clients
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
        let hours = establishment.workingHours?.[dayOfWeek]

        // Verificar exceções de calendário para o dia específico
        let blockedRanges = []
        if (establishment.scheduleExceptions && establishment.scheduleExceptions[date]) {
            const exception = establishment.scheduleExceptions[date]
            if (exception.isClosed) {
                hours = null
            } else if (exception.blockedRanges) {
                blockedRanges = exception.blockedRanges
            }
        }

        if (!hours) {
            return res.json({
                success: true,
                data: []
            })
        }

        // Pausa para almoço: faz parte do horário semanal (recorrente), então usa
        // a mesma lógica de bloqueio das exceções de calendário
        if (hours.lunchBreak?.start && hours.lunchBreak?.end) {
            blockedRanges = [...blockedRanges, hours.lunchBreak]
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
        const activeAppointments = appointments.filter(a => a.date === date && a.status !== 'cancelled' && a.status !== 'no_show')

        const employeesRepo = getRepository('employees.json')
        const employees = await employeesRepo.findAll({ establishmentId: parseInt(req.params.id) })
        const isSolo = employees.length === 0

        const timeToMinutes = (time) => {
            const [h, m] = time.split(':').map(Number)
            return h * 60 + m
        }

        const checkOverlap = (start1, duration1, start2, duration2) => {
            const s1 = timeToMinutes(start1)
            const e1 = s1 + duration1
            const s2 = timeToMinutes(start2)
            const e2 = s2 + (duration2 || 30)
            return s1 < e2 && e1 > s2
        }

        const requestedServices = req.query.services ? req.query.services.split(',').map(Number) : []
        let requestedAssignments = []
        if (req.query.assignments) {
            try {
                requestedAssignments = JSON.parse(req.query.assignments)
            } catch (e) {
                // Ignore parse error
            }
        }

        const servicesRepo = getRepository('services.json')
        const allServices = await servicesRepo.findAll()
        const selectedServices = allServices.filter(s => requestedServices.includes(s.id))
        let requestedDuration = 0
        selectedServices.forEach(service => {
            const prefs = establishment?.servicePreferences?.[service.id]
            requestedDuration += prefs?.duration ?? service.duration
        })
        if (requestedDuration === 0) requestedDuration = 30 // fallback

        let availableSlots = slots.filter(slot => {
            if (isSolo) {
                const hasConflict = activeAppointments.some(apt => checkOverlap(slot, requestedDuration, apt.time, apt.totalDuration))
                if (hasConflict) return false
            } else {
                const availableEmployees = employees.filter(emp => {
                    return !activeAppointments.some(apt => {
                        if (!apt.assignments || apt.assignments.length === 0) {
                            return checkOverlap(slot, requestedDuration, apt.time, apt.totalDuration)
                        }
                        const isAssigned = apt.assignments.some(a => a.employeeId === emp.id)
                        return isAssigned && checkOverlap(slot, requestedDuration, apt.time, apt.totalDuration)
                    })
                })

                if (requestedServices.length === 0) {
                    if (availableEmployees.length === 0) return false
                } else {
                    for (const serviceId of requestedServices) {
                        const preference = requestedAssignments.find(a => a.serviceId === serviceId && a.employeeId !== null && a.employeeId !== "")
                        
                        let canFulfill = false
                        if (preference) {
                            const empId = parseInt(preference.employeeId)
                            canFulfill = availableEmployees.some(emp => emp.id === empId && (emp.services || []).includes(serviceId))
                        } else {
                            canFulfill = availableEmployees.some(emp => (emp.services || []).includes(serviceId))
                        }

                        if (!canFulfill) return false
                    }
                }
            }
            return true
        })

        // Remover slots que caem nos horários bloqueados (exceções de calendário)
        if (blockedRanges.length > 0) {
            availableSlots = availableSlots.filter(slot => {
                for (const range of blockedRanges) {
                    if (slot >= range.start && slot < range.end) {
                        return false // Bloqueado
                    }
                }
                return true
            })
        }

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

// Excluir estabelecimento e todos os dados relacionados (Zerar dados)
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const id = parseInt(req.params.id)

        // Verificar se é o próprio estabelecimento (ou admin master se houvesse)
        if (req.user.type !== 'admin' || req.user.establishmentId !== id) {
            throw new AppError('Não autorizado a excluir este estabelecimento', 403)
        }

        // 1. Excluir agendamentos
        await appointmentsRepo.deleteMany({ establishmentId: id })

        // 2. Excluir funcionários
        await employeesRepo.deleteMany({ establishmentId: id })

        // 3. Excluir admins vinculados
        await adminsRepo.deleteMany({ establishmentId: id })

        // 4. Excluir o estabelecimento
        const deleted = await establishmentsRepo.delete(id)

        if (!deleted) {
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        res.json({
            success: true,
            message: 'Estabelecimento e todos os registros foram excluídos com sucesso'
        })
    } catch (error) {
        next(error)
    }
})

export default router
