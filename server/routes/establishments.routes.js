import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js'
import { premiumMiddleware } from '../middleware/plan.middleware.js'
import { AppError } from '../middleware/error.middleware.js'
import { buildDaySchedule, MOTIVOS_LONGOS } from '../utils/daySchedule.js'

const router = Router()
const establishmentsRepo = getRepository('establishments.json')
const servicesRepo = getRepository('services.json')
const categoriesRepo = getRepository('categories.json')
const appointmentsRepo = getRepository('appointments.json')
const employeesRepo = getRepository('employees.json')
const adminsRepo = getRepository('admins.json')

// Remove acentos e caixa alta, pra "sao paulo" achar "São Paulo".
const normalize = (str) => (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

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

        // Filtrar por estacionamento
        if (req.query.estacionamento === 'true') {
            establishments = establishments.filter(e => e.parking === true)
        }

        // Avaliação real: calcula a média a partir das notas de agendamentos
        // concluídos (appointment.rating), não do campo estático de seed.
        if (req.query.minRating) {
            const allAppointments = await appointmentsRepo.findAll()
            const ratingSums = {}
            allAppointments.forEach(a => {
                if (typeof a.rating === 'number' && a.rating >= 1) {
                    const key = a.establishmentId
                    if (!ratingSums[key]) ratingSums[key] = { sum: 0, count: 0 }
                    ratingSums[key].sum += a.rating
                    ratingSums[key].count += 1
                }
            })
            establishments = establishments
                .map(e => {
                    const agg = ratingSums[e.id]
                    return agg ? { ...e, rating: agg.sum / agg.count, reviewCount: agg.count } : e
                })
                .filter(e => ratingSums[e.id] && ratingSums[e.id].sum / ratingSums[e.id].count >= parseFloat(req.query.minRating))
        }

        // Filtrar por faixa de preço (com base no menor preço entre os serviços do estabelecimento)
        if (req.query.minPrice || req.query.maxPrice) {
            const allServices = await servicesRepo.findAll()
            const priceById = new Map(allServices.map(s => [s.id, s.price]))
            const min = req.query.minPrice ? parseFloat(req.query.minPrice) : 0
            const max = req.query.maxPrice ? parseFloat(req.query.maxPrice) : Infinity

            establishments = establishments.filter(e => {
                const prices = (e.services || []).map(id => priceById.get(id)).filter(p => typeof p === 'number')
                if (prices.length === 0) return false
                const cheapest = Math.min(...prices)
                return cheapest >= min && cheapest <= max
            })
        }

        // Busca por texto: olha nome, descrição, endereço, cidade, estado e
        // também nos nomes dos serviços/categorias do estabelecimento (antes
        // só olhava nome/descrição/endereço — buscar "corte" ou "manicure"
        // nunca achava nada, porque esses termos só existem nos serviços).
        // Quebra a busca em palavras: cada palavra precisa aparecer em algum
        // desses campos, não precisa ser a frase inteira igual — assim
        // "corte sobradinho" acha um salão com o serviço "Corte" mesmo que
        // só o endereço tenha "Sobradinho".
        if (req.query.q) {
            const allServices = await servicesRepo.findAll()
            const allCategories = await categoriesRepo.findAll()
            const serviceNamesById = new Map(allServices.map(s => [s.id, s.name]))
            const categoryNamesById = new Map(allCategories.map(c => [c.id, c.name]))

            const queryWords = normalize(req.query.q).split(/\s+/).filter(Boolean)

            establishments = establishments.filter(e => {
                const serviceNames = (e.services || []).map(id => serviceNamesById.get(id)).filter(Boolean)
                const categoryNames = (e.categories || []).map(id => categoryNamesById.get(id)).filter(Boolean)
                const searchableText = normalize([
                    e.name, e.description, e.address, e.city, e.state,
                    ...serviceNames, ...categoryNames
                ].filter(Boolean).join(' '))

                return queryWords.every(word => searchableText.includes(word))
            })
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

// Avaliações públicas do estabelecimento: agendamentos concluídos com nota
// e comentário escrito. Nome do cliente é mostrado abreviado (privacidade).
router.get('/:id/reviews', async (req, res, next) => {
    try {
        const allAppointments = await appointmentsRepo.findAll({ establishmentId: parseInt(req.params.id) })

        const reviews = allAppointments
            .filter(a => typeof a.rating === 'number' && a.comment)
            .map(a => {
                const nameParts = (a.customerName || 'Cliente').trim().split(' ')
                const displayName = nameParts.length > 1
                    ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
                    : nameParts[0]
                return {
                    id: a.id,
                    name: displayName,
                    rating: a.rating,
                    comment: a.comment,
                    date: a.ratedAt || a.date
                }
            })
            .sort((a, b) => new Date(b.date) - new Date(a.date))

        res.json({
            success: true,
            data: reviews
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

        const clients = Object.entries(clientsByKey).map(([key, apts]) => {
            const sorted = [...apts].sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))
            const latest = sorted[0]
            return {
                key,
                name: latest.customerName,
                phone: latest.customerPhone,
                email: latest.customerEmail,
                userId: latest.userId || null,
                visitCount: sorted.length,
                lastVisit: latest.date,
                history: sorted.map(apt => {
                    let parsedNotes = apt.notes;
                    let isManual = false;
                    let manualDescription = "";
                    try {
                        const parsed = JSON.parse(apt.notes);
                        if (parsed && parsed.type === 'MANUAL_FINANCE') {
                            isManual = true;
                            manualDescription = parsed.description;
                        }
                    } catch (e) {}

                    return {
                        date: apt.date,
                        time: apt.time,
                        services: isManual ? ['Lançamento Manual'] : (apt.services || []).map(id => serviceNameById[id] || 'Serviço removido'),
                        totalPrice: apt.totalPrice,
                        notes: isManual ? manualDescription : apt.notes || null
                    };
                })
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
// Retrato completo do dia: todos os horários com motivo (reservado, almoço,
// fechado) e quais serviços cabem em cada um. Substitui a lógica de "horário
// some da tela", que confundia cliente e estabelecimento.
router.get('/:id/day-schedule', async (req, res, next) => {
    try {
        const { date } = req.query
        if (!date) throw new AppError('Data é obrigatória', 400)

        // Serviços já escolhidos pelo cliente: os horários passam a ser
        // avaliados pela soma das durações, não serviço a serviço.
        const comboServiceIds = (req.query.services || '')
            .split(',')
            .map(Number)
            .filter(n => Number.isInteger(n) && n > 0)

        const establishmentId = parseInt(req.params.id)
        const establishment = await establishmentsRepo.findById(establishmentId)
        if (!establishment) throw new AppError('Estabelecimento não encontrado', 404)

        const [allServices, employees, appointments] = await Promise.all([
            servicesRepo.findAll(),
            employeesRepo.findAll({ establishmentId }),
            appointmentsRepo.findAll({ establishmentId })
        ])

        const services = allServices.filter(s => (establishment.services || []).includes(s.id))

        const schedule = buildDaySchedule({
            date,
            workingHours: establishment.workingHours,
            scheduleException: establishment.scheduleExceptions?.[date] || null,
            appointments,
            employees,
            services,
            servicePreferences: establishment.servicePreferences || {},
            comboServiceIds
        })

        // Devolve os serviços com nome/preço junto, pra tela não precisar cruzar
        const serviceById = new Map(services.map(s => [s.id, s]))
        schedule.slots = schedule.slots.map(slot => ({
            ...slot,
            services: slot.services.map(item => {
                const svc = serviceById.get(item.id)
                const prefs = establishment.servicePreferences?.[item.id]
                return {
                    ...item,
                    name: svc?.name,
                    price: prefs?.price ?? svc?.price,
                    duration: prefs?.duration ?? svc?.duration,
                    // reason cabe na caixinha; reasonLong explica no tooltip
                    reasonLong: item.reason ? MOTIVOS_LONGOS[item.reason] || item.reason : null
                }
            })
        }))

        schedule.resumoServicos = (schedule.resumoServicos || []).map(item => {
            const svc = serviceById.get(item.id)
            const prefs = establishment.servicePreferences?.[item.id]
            return {
                ...item,
                name: svc?.name,
                price: prefs?.price ?? svc?.price,
                duration: prefs?.duration ?? svc?.duration,
                reasonLong: item.reason ? MOTIVOS_LONGOS[item.reason] || item.reason : null
            }
        })

        res.json({ success: true, data: schedule })
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
        const id = req.params.id

        // Bloqueio de fechamento de dia com cliente agendado: se esta atualização
        // está fechando um dia inteiro ou bloqueando um horário que antes estava
        // livre, e já existe agendamento pendente/confirmado bem ali, recusa e avisa
        // — em vez de deixar o admin fechar o dia e sumir com o cliente sem perceber.
        // Nunca cancela ninguém automaticamente, só impede o fechamento silencioso.
        if (req.body.scheduleExceptions) {
            const current = await establishmentsRepo.findById(id)
            const oldExceptions = current?.scheduleExceptions || {}

            const newExceptions = req.body.scheduleExceptions

            for (const [date, newVal] of Object.entries(newExceptions)) {
                const oldVal = oldExceptions[date] || { isClosed: false, blockedRanges: [] }
                const newlyClosingWholeDay = !!newVal.isClosed && !oldVal.isClosed
                const newRanges = newVal.isClosed
                    ? []
                    : (newVal.blockedRanges || []).filter(nr =>
                        !(oldVal.blockedRanges || []).some(or => or.start === nr.start && or.end === nr.end)
                      )

                if (!newlyClosingWholeDay && newRanges.length === 0) continue

                const dayAppointments = (await appointmentsRepo.findAll({ establishmentId: parseInt(id), date }))
                    .filter(a => ['pending', 'confirmed'].includes(a.status))

                const conflicts = newlyClosingWholeDay
                    ? dayAppointments
                    : dayAppointments.filter(a => newRanges.some(r => a.time >= r.start && a.time < r.end))

                if (conflicts.length > 0) {
                    const [, month, day] = date.split('-')
                    const preview = conflicts.slice(0, 5).map(a => `${a.time} - ${a.customerName}`).join('; ')
                    throw new AppError(
                        `Não é possível fechar ${day}/${month}: ${conflicts.length} agendamento(s) já marcado(s) nesse horário (${preview}${conflicts.length > 5 ? '...' : ''}). Cancele ou remarque esses agendamentos antes de fechar.`,
                        409
                    )
                }
            }

            console.log(`[Establishments] Admin ${req.user?.id} alterou horários/exceções do estabelecimento ${id}`)
        }

        // Mesma proteção, mas para o expediente semanal (tela de Horários):
        // fechar um dia da semana ou encurtar o expediente também não pode
        // deixar agendamento futuro já marcado fora do horário de atendimento.
        if (req.body.workingHours) {
            const current = await establishmentsRepo.findById(id)
            const oldHours = current?.workingHours || {}
            const newHours = req.body.workingHours
            const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            const today = new Date().toISOString().split('T')[0]

            const future = (await appointmentsRepo.findAll({ establishmentId: parseInt(id) }))
                .filter(a => ['pending', 'confirmed'].includes(a.status) && a.date >= today)

            const conflicts = future.filter(a => {
                const day = dayNames[new Date(a.date + 'T12:00:00').getDay()]
                const oldDay = oldHours[day]
                const newDay = newHours[day]
                // Se já estava fora do expediente antigo, não foi esta mudança que criou o problema
                const wasInside = oldDay?.open && a.time >= oldDay.open && a.time < oldDay.close
                if (!wasInside) return false
                if (!newDay?.open || !newDay?.close) return true // dia fechado agora
                return a.time < newDay.open || a.time >= newDay.close
            })

            if (conflicts.length > 0) {
                const preview = conflicts.slice(0, 5)
                    .map(a => `${a.date.split('-').reverse().slice(0, 2).join('/')} ${a.time} - ${a.customerName}`)
                    .join('; ')
                throw new AppError(
                    `Não é possível alterar o expediente: ${conflicts.length} agendamento(s) futuro(s) ficariam fora do horário de atendimento (${preview}${conflicts.length > 5 ? '...' : ''}). Cancele ou remarque antes de mudar o horário.`,
                    409
                )
            }
        }

        const establishment = await establishmentsRepo.update(id, req.body)

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
