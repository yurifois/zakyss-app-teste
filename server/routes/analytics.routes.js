import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()
const appointmentsRepo = getRepository('appointments.json')
const employeesRepo = getRepository('employees.json')
const establishmentsRepo = getRepository('establishments.json')
const servicesRepo = getRepository('services.json')

// Analytics completo do estabelecimento
router.get('/:establishmentId', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.params.establishmentId)
        const {
            startDate,
            endDate,
            months,
            year,
            employees: employeeFilter,
            services: serviceFilter,
            statuses,
            weekdays
        } = req.query

        // Buscar dados base
        const establishment = await establishmentsRepo.findById(establishmentId)
        const servicePreferences = establishment?.servicePreferences || {}

        const allServices = await servicesRepo.findAll()
        const allEmployees = await employeesRepo.findAll()
        const employees = allEmployees.filter(e => e.establishmentId === establishmentId)

        // Buscar agendamentos
        let appointments = (await appointmentsRepo.findAll())
            .filter(a => a.establishmentId === establishmentId)

        // Aplicar filtros

        // Filtro por data início/fim
        if (startDate) {
            appointments = appointments.filter(a => a.date >= startDate)
        }
        if (endDate) {
            appointments = appointments.filter(a => a.date <= endDate)
        }

        // Filtro por meses e ano
        if (months && year) {
            const targetYear = parseInt(year)
            const selectedMonths = months.split(',').map(m => parseInt(m))
            appointments = appointments.filter(a => {
                const [aptYear, aptMonth] = a.date.split('-').map(Number)
                return aptYear === targetYear && selectedMonths.includes(aptMonth)
            })
        } else if (year && !months) {
            const targetYear = parseInt(year)
            appointments = appointments.filter(a => {
                const [aptYear] = a.date.split('-').map(Number)
                return aptYear === targetYear
            })
        }

        // Filtro por status
        if (statuses) {
            const statusList = statuses.split(',')
            appointments = appointments.filter(a => statusList.includes(a.status))
        }

        // Filtro por dia da semana (0=Dom, 1=Seg, ..., 6=Sáb)
        if (weekdays) {
            const weekdayList = weekdays.split(',').map(d => parseInt(d))
            appointments = appointments.filter(a => {
                const [year, month, day] = a.date.split('-').map(Number)
                const date = new Date(year, month - 1, day)
                return weekdayList.includes(date.getDay())
            })
        }

        // Filtro por funcionários
        let employeeFilterList = null
        if (employeeFilter) {
            employeeFilterList = employeeFilter.split(',').map(e => parseInt(e))
        }

        // Filtro por serviços
        let serviceFilterList = null
        if (serviceFilter) {
            serviceFilterList = serviceFilter.split(',').map(s => parseInt(s))
        }

        // Funções auxiliares
        const getServicePrice = (serviceId) => {
            const prefs = servicePreferences[serviceId]
            if (prefs?.price !== undefined) return prefs.price
            const service = allServices.find(s => s.id === serviceId)
            return service?.price || 0
        }

        const getServiceCommission = (serviceId) => {
            return servicePreferences[serviceId]?.commission ?? 50
        }

        const getServiceName = (serviceId) => {
            const service = allServices.find(s => s.id === serviceId)
            return service?.name || 'Serviço removido'
        }

        const getEmployeeName = (employeeId) => {
            const emp = employees.find(e => e.id === employeeId)
            return emp?.name || 'Funcionário removido'
        }

        // ===== CALCULAR MÉTRICAS =====

        let totalAppointments = 0
        let totalRevenue = 0
        let totalCommission = 0
        let totalEstablishment = 0
        let totalManual = 0

        // Dados por funcionário
        const employeeStats = {}
        employees.forEach(emp => {
            employeeStats[emp.id] = {
                id: emp.id,
                name: emp.name,
                appointments: 0,
                services: 0,
                revenue: 0,
                commission: 0
            }
        })

        // Dados por serviço
        const serviceStats = {}

        // Dados por mês
        const monthlyStats = {}

        // Dados por dia (data exata, não dia da semana) — usado no gráfico
        // "Faturamento por Dia", que mostra o período filtrado no grão certo
        // em vez de agrupar tudo debaixo de um único mês.
        const dailyStats = {}

        // Dados por dia da semana
        const weekdayStats = {
            0: { day: 'Domingo', appointments: 0, revenue: 0 },
            1: { day: 'Segunda', appointments: 0, revenue: 0 },
            2: { day: 'Terça', appointments: 0, revenue: 0 },
            3: { day: 'Quarta', appointments: 0, revenue: 0 },
            4: { day: 'Quinta', appointments: 0, revenue: 0 },
            5: { day: 'Sexta', appointments: 0, revenue: 0 },
            6: { day: 'Sábado', appointments: 0, revenue: 0 }
        }

        const manualEntries = []

        // Processar agendamentos
        appointments.forEach(apt => {
            const isManual = apt.notes && typeof apt.notes === 'string' && apt.notes.includes('"type":"MANUAL_FINANCE"');

            if (isManual) {
                totalManual += (apt.totalPrice || 0);
                totalRevenue += (apt.totalPrice || 0);

                try {
                    const parsed = JSON.parse(apt.notes);
                    manualEntries.push({
                        id: apt.id,
                        date: apt.date,
                        value: apt.totalPrice,
                        description: parsed.description
                    });
                } catch (e) {}

                const [year, month] = apt.date.split('-').map(Number);
                const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                if (!monthlyStats[monthKey]) {
                    monthlyStats[monthKey] = { month: monthKey, appointments: 0, revenue: 0, commission: 0, manual: 0 };
                }
                monthlyStats[monthKey].revenue += (apt.totalPrice || 0);
                monthlyStats[monthKey].manual = (monthlyStats[monthKey].manual || 0) + (apt.totalPrice || 0);

                if (!dailyStats[apt.date]) {
                    dailyStats[apt.date] = { date: apt.date, appointments: 0, revenue: 0 };
                }
                dailyStats[apt.date].revenue += (apt.totalPrice || 0);
                return;
            }

            if (apt.status !== 'completed') return

            const assignments = apt.assignments || []
            const services = apt.services || []

            // Filtro por funcionário só dá pra aplicar olhando quem foi atribuído
            // (sem atribuição, não combina com nenhum funcionário específico).
            // Filtro por serviço usa os serviços do próprio agendamento, que
            // sempre existem — não depende de ter funcionário atribuído.
            const matchesEmployeeFilter = !employeeFilterList || assignments.some(a => employeeFilterList.includes(a.employeeId))
            const matchesServiceFilter = !serviceFilterList || services.some(id => serviceFilterList.includes(id))
            if (!matchesEmployeeFilter || !matchesServiceFilter) return

            totalAppointments++

            // Stats por dia da semana
            const [year, month, day] = apt.date.split('-').map(Number)
            const date = new Date(year, month - 1, day)
            const weekday = date.getDay()
            weekdayStats[weekday].appointments++
            weekdayStats[weekday].revenue += apt.totalPrice || 0

            // Stats por mês
            const monthKey = `${year}-${String(month).padStart(2, '0')}`
            if (!monthlyStats[monthKey]) {
                monthlyStats[monthKey] = { month: monthKey, appointments: 0, revenue: 0, commission: 0 }
            }
            monthlyStats[monthKey].appointments++
            monthlyStats[monthKey].revenue += apt.totalPrice || 0

            // Stats por dia exato (usado no gráfico "Faturamento por Dia")
            if (!dailyStats[apt.date]) {
                dailyStats[apt.date] = { date: apt.date, appointments: 0, revenue: 0 }
            }
            dailyStats[apt.date].appointments++
            dailyStats[apt.date].revenue += apt.totalPrice || 0

            // Receita total: usa o valor real cobrado no agendamento — antes só
            // era somado dentro do loop de assignments, então um agendamento
            // concluído sem funcionário atribuído (estabelecimento sem
            // funcionário cadastrado, ou atribuição perdida) sumia do
            // faturamento do Analytics mesmo aparecendo como concluído na
            // lista de agendamentos. Comissão/repasse usa os serviços do
            // agendamento pelo mesmo motivo — não depende de atribuição.
            totalRevenue += apt.totalPrice || 0

            services.forEach(serviceId => {
                if (serviceFilterList && !serviceFilterList.includes(serviceId)) return

                const price = getServicePrice(serviceId)
                const commissionPercent = getServiceCommission(serviceId)
                const commission = price * (commissionPercent / 100)

                totalCommission += commission
                totalEstablishment += (price - commission)

                if (!serviceStats[serviceId]) {
                    serviceStats[serviceId] = {
                        id: serviceId,
                        name: getServiceName(serviceId),
                        count: 0,
                        revenue: 0,
                        commission: 0
                    }
                }
                serviceStats[serviceId].count++
                serviceStats[serviceId].revenue += price
                serviceStats[serviceId].commission += commission

                monthlyStats[monthKey].commission += commission
            })

            // Stats por funcionário: aqui sim depende de quem foi atribuído —
            // não dá pra creditar um funcionário que não atendeu.
            assignments.forEach(assignment => {
                const { serviceId, employeeId } = assignment
                if (employeeFilterList && !employeeFilterList.includes(employeeId)) return
                if (serviceFilterList && !serviceFilterList.includes(serviceId)) return
                if (!employeeStats[employeeId]) return

                const price = getServicePrice(serviceId)
                const commissionPercent = getServiceCommission(serviceId)
                const commission = price * (commissionPercent / 100)

                employeeStats[employeeId].services++
                employeeStats[employeeId].revenue += price
                employeeStats[employeeId].commission += commission
            })

            const uniqueEmployees = [...new Set(assignments.map(a => a.employeeId))]
            uniqueEmployees.forEach(empId => {
                if (employeeStats[empId]) {
                    employeeStats[empId].appointments++
                }
            })
        })

        // Preparar resultados
        const ticketMedio = totalAppointments > 0 ? totalRevenue / totalAppointments : 0

        const employeeRanking = Object.values(employeeStats)
            .filter(e => e.services > 0)
            .sort((a, b) => b.commission - a.commission)

        const serviceRanking = Object.values(serviceStats)
            .sort((a, b) => b.count - a.count)

        const monthlyData = Object.values(monthlyStats)
            .sort((a, b) => a.month.localeCompare(b.month))

        const dailyData = Object.values(dailyStats)
            .sort((a, b) => a.date.localeCompare(b.date))

        const weekdayData = Object.values(weekdayStats)

        // Serviço mais executado
        const topService = serviceRanking[0] || null

        // Funcionário top
        const topEmployee = employeeRanking[0] || null

        res.json({
            success: true,
            data: {
                summary: {
                    totalAppointments,
                    totalRevenue,
                    totalCommission,
                    totalEstablishment,
                    totalManual,
                    ticketMedio,
                    topService: topService ? topService.name : null,
                    topEmployee: topEmployee ? topEmployee.name : null
                },
                employeeRanking,
                serviceRanking,
                monthlyData,
                dailyData,
                weekdayData,
                manualEntries: manualEntries.sort((a, b) => new Date(b.date) - new Date(a.date)),
                employees: employees.map(e => ({ id: e.id, name: e.name })),
                services: allServices.filter(s =>
                    establishment?.services?.includes(s.id)
                ).map(s => ({ id: s.id, name: s.name }))
            }
        })
    } catch (error) {
        next(error)
    }
})

// Adicionar lançamento manual
router.post('/:establishmentId/manual-finance', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.params.establishmentId);
        const { date, value, description, customerName, customerPhone, customerEmail, userId } = req.body;
        
        if (!date || value === undefined || !description) {
            throw new AppError('Dados incompletos', 400);
        }

        const apt = await appointmentsRepo.create({
            establishmentId,
            userId: userId || null,
            services: [],
            date: date,
            time: "00:00",
            status: "completed",
            totalPrice: parseFloat(value),
            totalDuration: 0,
            customerName: customerName || "Lançamento Manual",
            customerPhone: customerPhone || "00000000000",
            customerEmail: customerEmail || "",
            notes: JSON.stringify({ type: 'MANUAL_FINANCE', description })
        });
        
        res.json({ success: true, data: apt });
    } catch (e) { 
        next(e); 
    }
});

export default router
