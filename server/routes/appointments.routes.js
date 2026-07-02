import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'
import { sendConfirmationEmail, sendNewAppointmentEmail } from '../services/emailService.js'
import nodemailer from 'nodemailer'

const router = Router()
const appointmentsRepo = getRepository('appointments.json')
const servicesRepo = getRepository('services.json')

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

        // Get establishment for custom prices
        const establishmentsRepo = getRepository('establishments.json')
        const establishment = await establishmentsRepo.findById(establishmentId)
        if (!establishment) throw new AppError('Estabelecimento não encontrado', 404)

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

// Cancelar agendamento
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const appointment = await appointmentsRepo.update(req.params.id, {
            status: 'cancelled'
        })

        if (!appointment) {
            throw new AppError('Agendamento não encontrado', 404)
        }

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
