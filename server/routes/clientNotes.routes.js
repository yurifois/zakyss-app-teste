import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const clientNotesRepo = getRepository('client_notes.json')

// Flags objetivas — evita rótulo ofensivo/subjetivo, só fatos que ajudam
// o profissional a se preparar pro próximo atendimento.
const FLAGS = ['atraso', 'falta', 'cancelamento_recorrente', 'pontual', 'comunicacao_dificil', 'boa_comunicacao']

// Ficha interna do cliente: nunca é exposta pro cliente nem pra outros
// estabelecimentos — só o próprio estabelecimento que registrou enxerga.
// clientKey é o mesmo identificador (telefone normalizado, ou email como
// fallback) usado em GET /establishments/:id/clients.

router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const { clientKey } = req.query
        if (!clientKey) throw new AppError('clientKey é obrigatório', 400)

        const notes = await clientNotesRepo.findAll({ establishmentId, clientKey })
        res.json({
            success: true,
            data: notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        })
    } catch (error) {
        next(error)
    }
})

router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const { clientKey, clientName, flags, note, appointmentId, serviceName, appointmentDate } = req.body

        if (!clientKey) throw new AppError('clientKey é obrigatório', 400)
        const cleanFlags = Array.isArray(flags) ? flags.filter(f => FLAGS.includes(f)) : []
        if (cleanFlags.length === 0 && !note?.trim()) {
            throw new AppError('Selecione ao menos uma marcação ou escreva uma observação', 400)
        }

        // Contexto do procedimento: quando a anotação nasce dentro de um
        // agendamento, guarda de qual atendimento ela veio. Campos opcionais —
        // anotação solta pela ficha do cliente continua funcionando sem eles.
        const entry = await clientNotesRepo.create({
            establishmentId,
            clientKey,
            clientName: clientName || '',
            flags: cleanFlags,
            note: note?.trim() || '',
            appointmentId: appointmentId ? parseInt(appointmentId) : null,
            serviceName: serviceName || '',
            appointmentDate: appointmentDate || '',
            createdByName: req.user?.name || 'Admin'
        })

        res.status(201).json({ success: true, data: entry })
    } catch (error) {
        next(error)
    }
})

router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const existing = await clientNotesRepo.findById(req.params.id)
        if (!existing || parseInt(existing.establishmentId) !== establishmentId) {
            throw new AppError('Registro não encontrado', 404)
        }

        const { flags, note } = req.body
        const cleanFlags = Array.isArray(flags) ? flags.filter(f => FLAGS.includes(f)) : (existing.flags || [])
        const cleanNote = note !== undefined ? (note?.trim() || '') : (existing.note || '')
        if (cleanFlags.length === 0 && !cleanNote) {
            throw new AppError('Selecione ao menos uma marcação ou escreva uma observação', 400)
        }

        const updated = await clientNotesRepo.update(req.params.id, { flags: cleanFlags, note: cleanNote })
        res.json({ success: true, data: updated })
    } catch (error) {
        next(error)
    }
})

router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const existing = await clientNotesRepo.findById(req.params.id)
        if (!existing || parseInt(existing.establishmentId) !== establishmentId) {
            throw new AppError('Registro não encontrado', 404)
        }
        await clientNotesRepo.delete(req.params.id)
        res.json({ success: true })
    } catch (error) {
        next(error)
    }
})

export default router
