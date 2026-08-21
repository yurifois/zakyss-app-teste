import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const cashflowRepo = getRepository('cashflow.json')

// Categorias sugeridas — ficam livres pra digitar "outro" também, sem virar
// um CRUD de categorias à parte (o documento pede "editáveis", mas isso já
// resolve o essencial sem inventar uma tela nova só pra isso).
const CATEGORIES = ['material', 'aluguel', 'comissao', 'marketing', 'taxas', 'equipamento', 'outro']
const STATUSES = ['previsto', 'pago', 'cancelado']

// Listar saídas (despesas) do estabelecimento logado
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const entries = await cashflowRepo.findAll({ establishmentId })
        res.json({
            success: true,
            data: entries.sort((a, b) => new Date(b.date) - new Date(a.date))
        })
    } catch (error) {
        next(error)
    }
})

// Criar saída (despesa)
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const { date, category, description, value, paymentMethod, status } = req.body

        if (!date || !description || value === undefined) {
            throw new AppError('Data, descrição e valor são obrigatórios', 400)
        }
        if (parseFloat(value) <= 0) {
            throw new AppError('O valor precisa ser maior que zero', 400)
        }

        const entry = await cashflowRepo.create({
            establishmentId,
            date,
            category: CATEGORIES.includes(category) ? category : 'outro',
            description,
            value: parseFloat(value),
            paymentMethod: paymentMethod || '',
            status: STATUSES.includes(status) ? status : 'pago'
        })

        res.json({ success: true, data: entry })
    } catch (error) {
        next(error)
    }
})

// Editar saída
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const existing = await cashflowRepo.findById(req.params.id)

        if (!existing || existing.establishmentId !== establishmentId) {
            throw new AppError('Lançamento não encontrado', 404)
        }

        const { date, category, description, value, paymentMethod, status } = req.body
        const updates = {}
        if (date !== undefined) updates.date = date
        if (category !== undefined) updates.category = CATEGORIES.includes(category) ? category : 'outro'
        if (description !== undefined) updates.description = description
        if (value !== undefined) {
            if (parseFloat(value) <= 0) throw new AppError('O valor precisa ser maior que zero', 400)
            updates.value = parseFloat(value)
        }
        if (paymentMethod !== undefined) updates.paymentMethod = paymentMethod
        if (status !== undefined) updates.status = STATUSES.includes(status) ? status : existing.status

        const updated = await cashflowRepo.update(req.params.id, updates)
        res.json({ success: true, data: updated })
    } catch (error) {
        next(error)
    }
})

// Remover saída
router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const existing = await cashflowRepo.findById(req.params.id)

        if (!existing || existing.establishmentId !== establishmentId) {
            throw new AppError('Lançamento não encontrado', 404)
        }

        await cashflowRepo.delete(req.params.id)
        res.json({ success: true })
    } catch (error) {
        next(error)
    }
})

export default router
