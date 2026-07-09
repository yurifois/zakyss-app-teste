import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'
import { sendConfirmationEmail, sendNewAppointmentEmail } from '../services/emailService.js'
import nodemailer from 'nodemailer'

const router = Router()
const appointmentsRepo = getRepository('appointments.json')
const servicesRepo = getRepository('services.json')

// Política de remarcação: cliente que falta a um agendamento (no_show) fica
// impedido de criar novos agendamentos pelo site/app por alguns dias.
const NO_SHOW_RESTRICTION_DAYS = 7

const normalizePhone = (phone) => (phone || '').replace(/\D/g, '')

// Verifica se o telefone/usuário tem uma falta (no_show) recente que ainda restringe novos agendamentos.
// Retorna a data em que a restrição termina, ou null se não houver restrição ativa.
async function getActiveNoShowRestriction(customerPhone, userId) {
    const normalizedPhone = normalizePhone(customerPhone)
    if (!normalizedPhone && !userId) return null

    const allAppointments = await appointmentsRepo.findAll()
    const now = new Date()

    let restrictionEnd = null
    for (const apt of allAppointments) {
        if (apt.status !== 'no_show') continue

        const matchesPhone = normalizedPhone && normalizePhone(apt.customerPhone) === normalizedPhone
        const matchesUser = userId && apt.userId === userId
        if (!matchesPhone && !matchesUser) continue

        const end = new Date(apt.date + 'T00:00:00')
        end.setDate(end.getDate() + NO_SHOW_RESTRICTION_DAYS)

        if (end > now && (!restrictionEnd || end > restrictionEnd)) {
            restrictionEnd = end
        }
    }

    return restrictionEnd
}

// Verifica se um horário cai dentro da pausa para almoço (recorrente, faz parte
// do horário semanal do estabelecimento) do dia da semana correspondente à data.
function isWithinLunchBreak(establishment, date, time) {
    const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const lunchBreak = establishment.workingHours?.[dayOfWeek]?.lunchBreak
    if (!lunchBreak?.start || !lunchBreak?.end) return false
    return time >= lunchBreak.start && time < lunchBreak.end
}

// Um admin autenticado (dashboard) pode criar agendamentos "de encaixe" mesmo
// para um cliente restrito — a restrição vale apenas para autoagendamento público.
function isAuthenticatedAdminRequest(req) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return false
    try {
        const decoded = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET)
        return decoded?.type === 'admin'
    } catch (error) {
        return false
    }
}

// Verifica se o usuário autenticado (req.user, via authMiddleware) pode gerenciar
// este agendamento: o admin do estabelecimento dono do agendamento, ou o próprio
// cliente (conta logada) dono do agendamento.
function canManageAppointment(req, appointment) {
    const user = req.user
    if (!user || !appointment) return false
    if (user.type === 'admin') return user.establishmentId === appointment.establishmentId
    if (user.type === 'customer') return Boolean(appointment.userId) && user.id === appointment.userId
    return false
}

// Endpoint temporário de diagnóstico de Email
router.get('/test-email', async (req, res) => {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT) || 465,
            secure: true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            },
            connectionTimeout: 10000,
            tls: { rejectUnauthorized: false }
        })

        await transporter.verify()
        
        // Tenta enviar um email para o próprio remetente para testar
        const info = await transporter.sendMail({
            from: `"Zakys Diagnóstico" <${process.env.SMTP_USER}>`,
            to: process.env.SMTP_USER,
            subject: 'Teste de Diagnóstico Zakys',
            text: 'Se você recebeu este email, o SMTP está funcionando perfeitamente no Render!'
        })

        res.json({
            success: true,
            message: 'Conexão SMTP verificada e email de teste enviado com sucesso!',
            user_configurado: process.env.SMTP_USER,
            messageId: info.messageId
        })
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Falha no SMTP',
            detalhes: error.message,
            user_configurado: process.env.SMTP_USER,
            dica: 'Se o erro for "Invalid login" ou "Username and Password not accepted", a senha de aplicativo está incorreta ou o Google bloqueou o acesso.'
        })
    }
})

// Buscar agendamento por ID
router.get('/:id', async (req, res, next) => {
    try {
        const appointment = await appointmentsRepo.findById(req.params.id)

        if (!appointment) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        // Enriquecer com serviços
        const allServices = await servicesRepo.findAll()
        const services = allServices.filter(s => appointment.services.includes(s.id))

        res.json({
            success: true,
            data: {
                ...appointment,
                servicesList: services
            }
        })
    } catch (error) {
        next(error)
    }
})

// Criar agendamento
router.post('/', async (req, res, next) => {
    try {
        const {
            establishmentId,
            userId,
            services,
            date,
            time,
            customerName,
            customerPhone,
            customerEmail,
            notes,
            assignments
        } = req.body

        // Validar dados obrigatórios
        if (!establishmentId || !services || !date || !time || !customerName || !customerPhone) {
            throw new AppError('Dados incompletos', 400)
        }

        // Cliente com falta (no_show) recente fica restrito de se autoagendar por alguns dias.
        // Um admin autenticado (agendamento de encaixe pelo dashboard) pode ignorar a restrição.
        if (!isAuthenticatedAdminRequest(req)) {
            const restrictionEnd = await getActiveNoShowRestriction(customerPhone, userId)
            if (restrictionEnd) {
                const formattedDate = restrictionEnd.toLocaleDateString('pt-BR')
                throw new AppError(`Devido a uma falta (no-show) recente, novos agendamentos ficam temporariamente indisponíveis para este contato até ${formattedDate}.`, 403)
            }
        }

        // Get establishment for custom prices
        const establishmentsRepo = getRepository('establishments.json')
        const establishment = await establishmentsRepo.findById(establishmentId)
        if (!establishment) throw new AppError('Estabelecimento não encontrado', 404)

        // Verificar se a data/horário foi bloqueada pelo estabelecimento (exceção de calendário)
        const scheduleException = establishment.scheduleExceptions?.[date]
        if (scheduleException) {
            if (scheduleException.isClosed) {
                throw new AppError('O estabelecimento não está disponível nesta data. Por favor, escolha outro dia.', 409)
            }
            if (scheduleException.blockedRanges?.some(range => time >= range.start && time < range.end)) {
                throw new AppError('Este horário foi bloqueado pelo estabelecimento. Por favor, escolha outro horário.', 409)
            }
        }

        if (isWithinLunchBreak(establishment, date, time)) {
            throw new AppError('Este horário cai na pausa para almoço do estabelecimento. Por favor, escolha outro horário.', 409)
        }

        // Calcular preço e duração total
        const allServices = await servicesRepo.findAll()
        const selectedServices = allServices.filter(s => services.includes(s.id))

        let totalPrice = 0
        let totalDuration = 0

        selectedServices.forEach(service => {
            const prefs = establishment?.servicePreferences?.[service.id]
            totalPrice += prefs?.price ?? service.price
            totalDuration += prefs?.duration ?? service.duration
        })

        if (totalDuration === 0) totalDuration = 30; // fallback

        // Helpers
        const timeToMinutes = (t) => {
            const [h, m] = t.split(':').map(Number)
            return h * 60 + m
        }

        const checkOverlap = (start1, duration1, start2, duration2) => {
            const s1 = timeToMinutes(start1)
            const e1 = s1 + duration1
            const s2 = timeToMinutes(start2)
            const e2 = s2 + (duration2 || 30)
            return s1 < e2 && e1 > s2
        }

        const employeesRepo = getRepository('employees.json')
        const employees = await employeesRepo.findAll({ establishmentId: parseInt(establishmentId) })
        const isSolo = employees.length === 0

        const existingAppointments = await appointmentsRepo.findAll({ establishmentId: parseInt(establishmentId) })
        const activeAppointments = existingAppointments.filter(apt => apt.date === date && apt.status !== 'cancelled' && apt.status !== 'no_show')

        let finalAssignments = []

        if (isSolo) {
            const hasConflict = activeAppointments.some(apt => checkOverlap(time, totalDuration, apt.time, apt.totalDuration))
            if (hasConflict) {
                throw new AppError('Este horário já está ocupado. Por favor, escolha outro horário.', 409)
            }
        } else {
            let requestedAssignments = assignments || []

            const availableEmployees = employees.filter(emp => {
                return !activeAppointments.some(apt => {
                    if (!apt.assignments || apt.assignments.length === 0) {
                        return checkOverlap(time, totalDuration, apt.time, apt.totalDuration)
                    }
                    const isAssigned = apt.assignments.some(a => a.employeeId === emp.id)
                    return isAssigned && checkOverlap(time, totalDuration, apt.time, apt.totalDuration)
                })
            })

            for (const serviceId of services) {
                const preference = requestedAssignments.find(a => a.serviceId === serviceId && a.employeeId !== null && a.employeeId !== "")
                
                let assignedEmp = null
                if (preference) {
                    const empId = parseInt(preference.employeeId)
                    assignedEmp = availableEmployees.find(emp => emp.id === empId && (emp.services || []).includes(serviceId))
                } else {
                    assignedEmp = availableEmployees.find(emp => (emp.services || []).includes(serviceId))
                }

                if (!assignedEmp) {
                    throw new AppError(`Não há profissionais disponíveis para o serviço selecionado neste horário.`, 409)
                }

                finalAssignments.push({
                    serviceId: serviceId,
                    employeeId: assignedEmp.id
                })
            }
        }

        const appointment = await appointmentsRepo.create({
            establishmentId: parseInt(establishmentId),
            userId: userId || null,
            services,
            date,
            time,
            status: 'pending',
            totalPrice,
            totalDuration,
            customerName,
            customerPhone,
            customerEmail: customerEmail || null,
            notes: notes || null,
            assignments: finalAssignments

        })

        // Enviar email ao estabelecimento (await garante envio antes da resposta)
        try {
            let targetEmail = establishment?.email
            if (!targetEmail) {
                const adminsRepo = getRepository('admins.json')
                const admin = await adminsRepo.findOne({ establishmentId: parseInt(establishmentId) })
                targetEmail = admin?.email
            }
            if (targetEmail) {
                const servicesListStr = selectedServices.map(s => s.name).join(', ')
                await sendNewAppointmentEmail(
                    targetEmail,
                    establishment?.name || 'Estabelecimento',
                    customerName,
                    date,
                    time,
                    servicesListStr
                )
                console.log(`[Appointments] Email de novo agendamento enviado para ${targetEmail}`)
            } else {
                console.log(`[Appointments] Nenhum email encontrado para o estabelecimento ID ${establishmentId}`)
            }
        } catch (emailErr) {
            console.error('[Appointments] Erro ao enviar email ao estabelecimento:', emailErr.message)
        }

        res.status(201).json({
            success: true,
            data: appointment
        })
    } catch (error) {
        next(error)
    }
})

// Atualizar agendamento (reagendar, modificar serviços, dados do cliente)
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const appointmentId = req.params.id
        const {
            date,
            time,
            services,
            customerName,
            customerPhone,
            customerEmail,
            notes,
            assignments,
            customPrice
        } = req.body

        // Buscar agendamento existente
        const existingAppointment = await appointmentsRepo.findById(appointmentId)
        if (!existingAppointment) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        // Edição completa (serviços, preço, reagendamento) é uma ação administrativa
        if (req.user?.type !== 'admin' || req.user.establishmentId !== existingAppointment.establishmentId) {
            throw new AppError('Você não tem permissão para editar este agendamento', 403)
        }

        // Preparar dados para atualização
        const updateData = {}

        // Se está mudando serviços, recalcular preço e duração
        let newTotalDuration = existingAppointment.totalDuration
        if (services && services.length > 0) {
            const establishmentsRepo = getRepository('establishments.json')
            const establishment = await establishmentsRepo.findById(existingAppointment.establishmentId)

            const allServices = await servicesRepo.findAll()
            const selectedServices = allServices.filter(s => services.includes(s.id))

            let totalPrice = 0
            let totalDuration = 0

            selectedServices.forEach(service => {
                const prefs = establishment?.servicePreferences?.[service.id]
                totalPrice += prefs?.price ?? service.price
                totalDuration += prefs?.duration ?? service.duration
            })

            if (totalDuration === 0) totalDuration = 30 // fallback

            updateData.services = services
            updateData.totalPrice = totalPrice
            updateData.totalDuration = totalDuration
            newTotalDuration = totalDuration
        }

        // Se está mudando data/horário/serviços/assignments, verificar conflito
        const newDate = date || existingAppointment.date
        const newTime = time || existingAppointment.time
        const newServices = services || existingAppointment.services
        const newAssignments = assignments || existingAppointment.assignments

        if (date || time || services || assignments) {
            // Verificar se a nova data/horário foi bloqueada pelo estabelecimento (exceção de calendário)
            if (date || time) {
                const establishmentsRepo = getRepository('establishments.json')
                const establishment = await establishmentsRepo.findById(existingAppointment.establishmentId)
                const scheduleException = establishment?.scheduleExceptions?.[newDate]
                if (scheduleException) {
                    if (scheduleException.isClosed) {
                        throw new AppError('O estabelecimento não está disponível nesta data. Por favor, escolha outro dia.', 409)
                    }
                    if (scheduleException.blockedRanges?.some(range => newTime >= range.start && newTime < range.end)) {
                        throw new AppError('Este horário foi bloqueado pelo estabelecimento. Por favor, escolha outro horário.', 409)
                    }
                }

                if (establishment && isWithinLunchBreak(establishment, newDate, newTime)) {
                    throw new AppError('Este horário cai na pausa para almoço do estabelecimento. Por favor, escolha outro horário.', 409)
                }
            }

            // Helpers
            const timeToMinutes = (t) => {
                const [h, m] = t.split(':').map(Number)
                return h * 60 + m
            }

            const checkOverlap = (start1, duration1, start2, duration2) => {
                const s1 = timeToMinutes(start1)
                const e1 = s1 + duration1
                const s2 = timeToMinutes(start2)
                const e2 = s2 + (duration2 || 30)
                return s1 < e2 && e1 > s2
            }

            const employeesRepo = getRepository('employees.json')
            const employees = await employeesRepo.findAll({ establishmentId: parseInt(existingAppointment.establishmentId) })
            const isSolo = employees.length === 0

            const allAppointments = await appointmentsRepo.findAll({ establishmentId: parseInt(existingAppointment.establishmentId) })
            const activeAppointments = allAppointments.filter(apt => 
                apt.id !== parseInt(appointmentId) && 
                apt.date === newDate && 
                apt.status !== 'cancelled' && 
                apt.status !== 'no_show'
            )

            let finalAssignments = []

            if (isSolo) {
                const hasConflict = activeAppointments.some(apt => checkOverlap(newTime, newTotalDuration, apt.time, apt.totalDuration))
                if (hasConflict) {
                    throw new AppError('Este horário já está ocupado. Por favor, escolha outro horário.', 409)
                }
            } else {
                const availableEmployees = employees.filter(emp => {
                    return !activeAppointments.some(apt => {
                        if (!apt.assignments || apt.assignments.length === 0) {
                            return checkOverlap(newTime, newTotalDuration, apt.time, apt.totalDuration)
                        }
                        const isAssigned = apt.assignments.some(a => a.employeeId === emp.id)
                        return isAssigned && checkOverlap(newTime, newTotalDuration, apt.time, apt.totalDuration)
                    })
                })

                for (const serviceId of newServices) {
                    const preference = newAssignments.find(a => a.serviceId === serviceId && a.employeeId !== null && a.employeeId !== "")
                    
                    let assignedEmp = null
                    if (preference) {
                        const empId = parseInt(preference.employeeId)
                        assignedEmp = availableEmployees.find(emp => emp.id === empId && (emp.services || []).includes(serviceId))
                    } else {
                        assignedEmp = availableEmployees.find(emp => (emp.services || []).includes(serviceId))
                    }

                    if (!assignedEmp) {
                        throw new AppError(`Não há profissionais disponíveis para o serviço selecionado neste horário.`, 409)
                    }

                    finalAssignments.push({
                        serviceId: serviceId,
                        employeeId: assignedEmp.id
                    })
                }
            }
            
            updateData.assignments = finalAssignments
            if (date) updateData.date = date
            if (time) updateData.time = time
        }

        // Atualizar dados do cliente se fornecidos
        if (customerName) updateData.customerName = customerName
        if (customerPhone) updateData.customerPhone = customerPhone
        if (customerEmail !== undefined) updateData.customerEmail = customerEmail
        if (notes !== undefined) updateData.notes = notes
        if (assignments !== undefined) updateData.assignments = assignments

        // Permitir override manual do preço pelo admin
        if (customPrice !== undefined && customPrice !== null) {
            updateData.totalPrice = parseFloat(customPrice)
        }

        // Aplicar atualizações
        const updatedAppointment = await appointmentsRepo.update(appointmentId, updateData)

        // Enriquecer com serviços para retorno
        const allServices = await servicesRepo.findAll()
        const servicesList = allServices.filter(s => updatedAppointment.services.includes(s.id))

        res.json({
            success: true,
            data: {
                ...updatedAppointment,
                servicesList
            }
        })
    } catch (error) {
        next(error)
    }
})

// Atualizar status do agendamento
router.patch('/:id/status', authMiddleware, async (req, res, next) => {
    try {
        const { status } = req.body

        // Incluir 'no_show' como status válido
        if (!['pending', 'confirmed', 'cancelled', 'completed', 'no_show'].includes(status)) {
            throw new AppError('Status inválido', 400)
        }

        // Buscar agendamento atual para verificar status anterior
        const currentAppointment = await appointmentsRepo.findById(req.params.id)
        if (!currentAppointment) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        if (!canManageAppointment(req, currentAppointment)) {
            throw new AppError('Você não tem permissão para alterar este agendamento', 403)
        }

        // Cliente só pode cancelar; os demais status são de gestão do estabelecimento
        if (req.user.type === 'customer' && status !== 'cancelled') {
            throw new AppError('Você só pode cancelar seu agendamento', 403)
        }

        // Preparar dados de atualização
        const updateData = { status }

        // Se está confirmando, inicializar campo de notificações
        if (status === 'confirmed') {
            updateData.notificationsSent = {
                '24h': false,
                '12h': false,
                '4h': false
            }
        }

        const appointment = await appointmentsRepo.update(req.params.id, updateData)

        // Se está confirmando (e não estava confirmado antes), enviar email ao cliente
        if (status === 'confirmed' && currentAppointment.status !== 'confirmed') {
            try {
                const establishmentsRepo = getRepository('establishments.json')
                const establishment = await establishmentsRepo.findById(appointment.establishmentId)

                let recipientEmail = appointment.customerEmail
                let recipientName = appointment.customerName

                if (appointment.userId) {
                    const usersRepo = getRepository('users.json')
                    const user = await usersRepo.findById(appointment.userId)
                    if (user?.email) {
                        recipientEmail = user.email
                        recipientName = user.name || appointment.customerName
                    }
                }

                if (recipientEmail) {
                    await sendConfirmationEmail(
                        recipientEmail,
                        recipientName,
                        appointment.date,
                        appointment.time,
                        establishment?.name || 'Estabelecimento'
                    )
                    console.log(`[Appointments] Email de confirmação enviado para ${recipientEmail}`)
                } else {
                    console.log(`[Appointments] Nenhum email encontrado para o cliente do agendamento ID ${appointment.id}`)
                }
            } catch (emailErr) {
                console.error('[Appointments] Erro ao enviar email de confirmação ao cliente:', emailErr.message)
            }
        }

        res.json({
            success: true,
            data: appointment
        })
    } catch (error) {
        next(error)
    }
})

// Cancelamento de agendamento feito sem conta (convidado): confirma a identidade
// pelo telefone usado no agendamento, já que não há login para autenticar.
router.patch('/:id/cancel-guest', async (req, res, next) => {
    try {
        const { phone } = req.body
        if (!phone) {
            throw new AppError('Informe o telefone usado no agendamento', 400)
        }

        const appointment = await appointmentsRepo.findById(req.params.id)
        if (!appointment) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        if (appointment.userId) {
            throw new AppError('Este agendamento pertence a uma conta. Faça login para cancelá-lo.', 403)
        }

        if (normalizePhone(phone) !== normalizePhone(appointment.customerPhone)) {
            throw new AppError('Telefone não confere com o agendamento.', 403)
        }

        if (!['pending', 'confirmed'].includes(appointment.status)) {
            throw new AppError('Este agendamento não pode mais ser cancelado.', 409)
        }

        const updated = await appointmentsRepo.update(req.params.id, { status: 'cancelled' })

        res.json({
            success: true,
            data: updated
        })
    } catch (error) {
        next(error)
    }
})

// Cancelar agendamento
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const existingAppointment = await appointmentsRepo.findById(req.params.id)
        if (!existingAppointment) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        if (!canManageAppointment(req, existingAppointment)) {
            throw new AppError('Você não tem permissão para cancelar este agendamento', 403)
        }

        await appointmentsRepo.update(req.params.id, {
            status: 'cancelled'
        })

        res.json({
            success: true,
            data: { message: 'Agendamento cancelado' }
        })
    } catch (error) {
        next(error)
    }
})

// Atualizar atribuições de funcionários a um agendamento
router.patch('/:id/assignments', authMiddleware, async (req, res, next) => {
    try {
        const { assignments } = req.body

        const appointment = await appointmentsRepo.findById(req.params.id)
        if (!appointment) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        // Validate assignments format
        if (assignments && !Array.isArray(assignments)) {
            throw new AppError('assignments deve ser um array', 400)
        }

        const updatedAppointment = await appointmentsRepo.update(req.params.id, {
            assignments: assignments || []
        })

        res.json({
            success: true,
            data: updatedAppointment
        })
    } catch (error) {
        next(error)
    }
})

export default router
