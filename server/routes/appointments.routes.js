import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'
import { sendConfirmationEmail } from '../services/emailService.js'

const router = Router()
const appointmentsRepo = getRepository('appointments.json')
const servicesRepo = getRepository('services.json')

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

        // Verificar se o horário já está ocupado
        const existingAppointments = await appointmentsRepo.findAll()
        const conflictingAppointment = existingAppointments.find(apt =>
            apt.establishmentId === parseInt(establishmentId) &&
            apt.date === date &&
            apt.time === time &&
            apt.status !== 'cancelled'
        )

        if (conflictingAppointment) {
            throw new AppError('Este horário já está ocupado. Por favor, escolha outro horário.', 409)
        }

        // Get establishment for custom prices
        const establishmentsRepo = getRepository('establishments.json')
        const establishment = await establishmentsRepo.findById(establishmentId)

        // Calcular preço e duração total usando preços personalizados
        const allServices = await servicesRepo.findAll()
        const selectedServices = allServices.filter(s => services.includes(s.id))

        let totalPrice = 0
        let totalDuration = 0

        selectedServices.forEach(service => {
            // Use establishment-specific prices if available
            const prefs = establishment?.servicePreferences?.[service.id]
            totalPrice += prefs?.price ?? service.price
            totalDuration += prefs?.duration ?? service.duration
        })

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
            assignments: assignments || []
        })

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
            assignments
        } = req.body

        // Buscar agendamento existente
        const existingAppointment = await appointmentsRepo.findById(appointmentId)
        if (!existingAppointment) {
            throw new AppError('Agendamento não encontrado', 404)
        }

        // Preparar dados para atualização
        const updateData = {}

        // Se está mudando data/horário, verificar conflito
        const newDate = date || existingAppointment.date
        const newTime = time || existingAppointment.time

        if (date || time) {
            // Verificar se o novo horário não conflita com outro agendamento
            const allAppointments = await appointmentsRepo.findAll()
            const conflictingAppointment = allAppointments.find(
                apt => apt.id !== parseInt(appointmentId) &&
                    apt.establishmentId === existingAppointment.establishmentId &&
                    apt.date === newDate &&
                    apt.time === newTime &&
                    apt.status !== 'cancelled'
            )

            if (conflictingAppointment) {
                throw new AppError('Este horário já está ocupado. Por favor, escolha outro horário.', 409)
            }

            if (date) updateData.date = date
            if (time) updateData.time = time
        }

        // Se está mudando serviços, recalcular preço e duração
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

            updateData.services = services
            updateData.totalPrice = totalPrice
            updateData.totalDuration = totalDuration
        }

        // Atualizar dados do cliente se fornecidos
        if (customerName) updateData.customerName = customerName
        if (customerPhone) updateData.customerPhone = customerPhone
        if (customerEmail !== undefined) updateData.customerEmail = customerEmail
        if (notes !== undefined) updateData.notes = notes
        if (assignments !== undefined) updateData.assignments = assignments

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

        // Se está confirmando (e não estava confirmado antes), enviar email
        if (status === 'confirmed' && currentAppointment.status !== 'confirmed') {
            // Buscar nome do estabelecimento
            const establishmentsRepo = getRepository('establishments.json')
            const establishment = await establishmentsRepo.findById(appointment.establishmentId)

            // Determinar email do destinatário
            // Prioriza email do perfil do usuário (se existir userId)
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

            // Enviar email de confirmação (não bloqueia a resposta)
            sendConfirmationEmail(
                recipientEmail,
                recipientName,
                appointment.date,
                appointment.time,
                establishment?.name || 'Estabelecimento'
            ).catch(err => console.error('[Appointments] Erro ao enviar email de confirmação:', err))
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
