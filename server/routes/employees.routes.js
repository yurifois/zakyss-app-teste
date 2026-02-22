import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const employeesRepo = getRepository('employees.json')
const appointmentsRepo = getRepository('appointments.json')

// Listar funcionários de um estabelecimento (PÚBLICO - para usuários verem ao agendar)
router.get('/:establishmentId/public', async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.params.establishmentId)
        const employees = await employeesRepo.findAll()
        const filtered = employees.filter(e => e.establishmentId === establishmentId)

        // Retornar apenas dados públicos (id, name, services)
        const publicData = filtered.map(e => ({
            id: e.id,
            name: e.name,
            services: e.services || []
        }))

        res.json({
            success: true,
            data: publicData.sort((a, b) => a.name.localeCompare(b.name))
        })
    } catch (error) {
        next(error)
    }
})

// Listar funcionários de um estabelecimento (ADMIN - requer auth)
router.get('/:establishmentId', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.params.establishmentId)
        const employees = await employeesRepo.findAll()
        const filtered = employees.filter(e => e.establishmentId === establishmentId)

        res.json({
            success: true,
            data: filtered.sort((a, b) => a.name.localeCompare(b.name))
        })
    } catch (error) {
        next(error)
    }
})

// Criar novo funcionário
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { establishmentId, name } = req.body

        if (!establishmentId || !name?.trim()) {
            throw new AppError('establishmentId e name são obrigatórios', 400)
        }

        const employee = await employeesRepo.create({
            establishmentId: parseInt(establishmentId),
            name: name.trim()
        })

        res.status(201).json({
            success: true,
            data: employee
        })
    } catch (error) {
        next(error)
    }
})

// Atualizar funcionário
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const { name, services } = req.body

        // Build update data - only include provided fields
        const updateData = {}

        if (name !== undefined) {
            if (!name?.trim()) {
                throw new AppError('name não pode estar vazio', 400)
            }
            updateData.name = name.trim()
        }

        if (services !== undefined) {
            // Validate services is an array of numbers
            if (!Array.isArray(services)) {
                throw new AppError('services deve ser um array', 400)
            }
            updateData.services = services.map(id => parseInt(id))
        }

        if (Object.keys(updateData).length === 0) {
            throw new AppError('Nenhum dado para atualizar', 400)
        }

        const employee = await employeesRepo.update(req.params.id, updateData)

        if (!employee) {
            throw new AppError('Funcionário não encontrado', 404)
        }

        res.json({
            success: true,
            data: employee
        })
    } catch (error) {
        next(error)
    }
})

// Remover funcionário
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const deleted = await employeesRepo.delete(req.params.id)

        if (!deleted) {
            throw new AppError('Funcionário não encontrado', 404)
        }

        // Remove referência deste funcionário dos agendamentos
        const appointments = await appointmentsRepo.findAll()
        const toUpdate = appointments.filter(a => a.employeeId === parseInt(req.params.id))

        for (const apt of toUpdate) {
            await appointmentsRepo.update(apt.id, { employeeId: null })
        }

        res.json({
            success: true,
            data: { message: 'Funcionário removido com sucesso' }
        })
    } catch (error) {
        next(error)
    }
})

// Relatório financeiro por funcionário
router.get('/:establishmentId/report', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.params.establishmentId)
        const { month, year } = req.query

        // Buscar estabelecimento para obter servicePreferences
        const establishmentsRepo = getRepository('establishments.json')
        const establishment = await establishmentsRepo.findById(establishmentId)
        const servicePreferences = establishment?.servicePreferences || {}

        // Buscar todos os serviços para obter preços
        const servicesRepo = getRepository('services.json')
        const allServices = await servicesRepo.findAll()

        // Buscar funcionários do estabelecimento
        const allEmployees = await employeesRepo.findAll()
        const employees = allEmployees.filter(e => e.establishmentId === establishmentId)

        // Buscar agendamentos completos do estabelecimento
        const allAppointments = await appointmentsRepo.findAll()
        let appointments = allAppointments.filter(a =>
            a.establishmentId === establishmentId &&
            a.status === 'completed'
        )

        // Filtrar por mês/ano se fornecido
        if (month && year) {
            const targetMonth = parseInt(month)
            const targetYear = parseInt(year)

            appointments = appointments.filter(a => {
                const [aptYear, aptMonth] = a.date.split('-').map(Number)
                return aptYear === targetYear && aptMonth === targetMonth
            })
        }

        // Função para obter preço de um serviço (com preferências do estabelecimento)
        const getServicePrice = (serviceId) => {
            const prefs = servicePreferences[serviceId]
            if (prefs?.price !== undefined) return prefs.price
            const service = allServices.find(s => s.id === serviceId)
            return service?.price || 0
        }

        // Função para obter comissão de um serviço
        const getServiceCommission = (serviceId) => {
            return servicePreferences[serviceId]?.commission ?? 50
        }

        // Inicializar dados por funcionário
        const employeeData = {}
        employees.forEach(emp => {
            employeeData[emp.id] = {
                employeeId: emp.id,
                employeeName: emp.name,
                appointmentCount: 0,
                totalRevenue: 0,
                employeeRevenue: 0,
                establishmentRevenue: 0,
                servicesPerformed: new Set()
            }
        })

        // Dados para serviços não atribuídos
        let unassignedData = {
            appointmentCount: 0,
            totalRevenue: 0,
            employeeRevenue: 0,
            establishmentRevenue: 0
        }

        // Processar cada agendamento
        appointments.forEach(apt => {
            const assignments = apt.assignments || []
            const assignedServiceIds = assignments.map(a => a.serviceId)

            // Processar serviços atribuídos
            assignments.forEach(assignment => {
                const serviceId = assignment.serviceId
                const employeeId = assignment.employeeId

                if (employeeData[employeeId]) {
                    const servicePrice = getServicePrice(serviceId)
                    const commission = getServiceCommission(serviceId)
                    const empRevenue = servicePrice * (commission / 100)
                    const estRevenue = servicePrice - empRevenue

                    employeeData[employeeId].servicesPerformed.add(apt.id)
                    employeeData[employeeId].totalRevenue += servicePrice
                    employeeData[employeeId].employeeRevenue += empRevenue
                    employeeData[employeeId].establishmentRevenue += estRevenue
                }
            })

            // Processar serviços não atribuídos
            const unassignedServices = apt.services.filter(sId => !assignedServiceIds.includes(sId))
            unassignedServices.forEach(serviceId => {
                const servicePrice = getServicePrice(serviceId)
                const commission = getServiceCommission(serviceId)
                const empRevenue = servicePrice * (commission / 100)
                const estRevenue = servicePrice - empRevenue

                unassignedData.totalRevenue += servicePrice
                unassignedData.employeeRevenue += empRevenue
                unassignedData.establishmentRevenue += estRevenue
            })

            // Se o agendamento não tem nenhuma atribuição, contar como não atribuído
            if (assignments.length === 0) {
                unassignedData.appointmentCount++
                apt.services.forEach(serviceId => {
                    const servicePrice = getServicePrice(serviceId)
                    const commission = getServiceCommission(serviceId)
                    const empRevenue = servicePrice * (commission / 100)
                    const estRevenue = servicePrice - empRevenue

                    unassignedData.totalRevenue += servicePrice
                    unassignedData.employeeRevenue += empRevenue
                    unassignedData.establishmentRevenue += estRevenue
                })
            }
        })

        // Calcular contagem de atendimentos por funcionário (baseado em agendamentos únicos)
        Object.values(employeeData).forEach(data => {
            data.appointmentCount = data.servicesPerformed.size
            delete data.servicesPerformed // Remover Set do resultado
        })

        // Construir relatório
        const report = Object.values(employeeData)

        // Adicionar categoria "Sem funcionário atribuído" se houver
        if (unassignedData.totalRevenue > 0 || unassignedData.appointmentCount > 0) {
            report.push({
                employeeId: null,
                employeeName: 'Sem funcionário atribuído',
                appointmentCount: unassignedData.appointmentCount,
                totalRevenue: unassignedData.totalRevenue,
                employeeRevenue: unassignedData.employeeRevenue,
                establishmentRevenue: unassignedData.establishmentRevenue
            })
        }

        // Calcular totais
        const totalAppointments = appointments.length
        const totalRevenue = appointments.reduce((sum, a) => sum + (a.totalPrice || 0), 0)
        const totalEmployeeRevenue = report.reduce((sum, r) => sum + (r.employeeRevenue || 0), 0)
        const totalEstablishmentRevenue = report.reduce((sum, r) => sum + (r.establishmentRevenue || 0), 0)

        res.json({
            success: true,
            data: {
                report,
                summary: {
                    totalAppointments,
                    totalRevenue,
                    totalEmployeeRevenue,
                    totalEstablishmentRevenue,
                    period: month && year ? `${month}/${year}` : 'Todos os períodos'
                }
            }
        })
    } catch (error) {
        next(error)
    }
})

// Detalhamento de serviços por funcionário (para KPI)
router.get('/:establishmentId/detail-report', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.params.establishmentId)
        const { months, year } = req.query // months = "1,2,3" (comma separated)

        const targetYear = parseInt(year) || new Date().getFullYear()
        const selectedMonths = months ? months.split(',').map(m => parseInt(m)) : [new Date().getMonth() + 1]

        // Buscar estabelecimento para obter servicePreferences
        const establishmentsRepo = getRepository('establishments.json')
        const establishment = await establishmentsRepo.findById(establishmentId)
        const servicePreferences = establishment?.servicePreferences || {}

        // Buscar todos os serviços
        const servicesRepo = getRepository('services.json')
        const allServices = await servicesRepo.findAll()

        // Buscar funcionários do estabelecimento
        const allEmployees = await employeesRepo.findAll()
        const employees = allEmployees.filter(e => e.establishmentId === establishmentId)

        // Buscar agendamentos completos do estabelecimento
        const allAppointments = await appointmentsRepo.findAll()
        let appointments = allAppointments.filter(a =>
            a.establishmentId === establishmentId &&
            a.status === 'completed'
        )

        // Filtrar por meses/ano selecionados
        appointments = appointments.filter(a => {
            const [aptYear, aptMonth] = a.date.split('-').map(Number)
            return aptYear === targetYear && selectedMonths.includes(aptMonth)
        })

        // Função para obter preço de um serviço
        const getServicePrice = (serviceId) => {
            const prefs = servicePreferences[serviceId]
            if (prefs?.price !== undefined) return prefs.price
            const service = allServices.find(s => s.id === serviceId)
            return service?.price || 0
        }

        // Função para obter comissão
        const getServiceCommission = (serviceId) => {
            return servicePreferences[serviceId]?.commission ?? 50
        }

        // Construir detalhamento por funcionário
        const detailReport = employees.map(emp => {
            const servicesPerformed = {} // { serviceId: { count, revenue, commission } }

            appointments.forEach(apt => {
                const assignments = apt.assignments || []
                assignments.forEach(assignment => {
                    if (assignment.employeeId === emp.id) {
                        const serviceId = assignment.serviceId
                        const price = getServicePrice(serviceId)
                        const commissionPercent = getServiceCommission(serviceId)
                        const commission = price * (commissionPercent / 100)

                        if (!servicesPerformed[serviceId]) {
                            const service = allServices.find(s => s.id === serviceId)
                            servicesPerformed[serviceId] = {
                                serviceId,
                                serviceName: service?.name || 'Serviço removido',
                                count: 0,
                                revenue: 0,
                                commission: 0
                            }
                        }
                        servicesPerformed[serviceId].count++
                        servicesPerformed[serviceId].revenue += price
                        servicesPerformed[serviceId].commission += commission
                    }
                })
            })

            const servicesList = Object.values(servicesPerformed)
            const totalCount = servicesList.reduce((sum, s) => sum + s.count, 0)
            const totalRevenue = servicesList.reduce((sum, s) => sum + s.revenue, 0)
            const totalCommission = servicesList.reduce((sum, s) => sum + s.commission, 0)

            return {
                employeeId: emp.id,
                employeeName: emp.name,
                services: servicesList.sort((a, b) => b.count - a.count),
                totalCount,
                totalRevenue,
                totalCommission
            }
        }).filter(e => e.totalCount > 0) // Só retorna funcionários com atendimentos

        res.json({
            success: true,
            data: {
                report: detailReport,
                selectedMonths,
                year: targetYear
            }
        })
    } catch (error) {
        next(error)
    }
})

export default router
