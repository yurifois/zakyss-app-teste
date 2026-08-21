import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const formsRepo = getRepository('anamnesis_forms.json')
const establishmentsRepo = getRepository('establishments.json')
const responsesRepo = getRepository('anamnesis_responses.json')

// Tipos de campo suportados — sem processamento automático nenhum,
// a leitura das respostas fica por conta do profissional.
const QUESTION_TYPES = ['texto_curto', 'sim_nao', 'multipla_escolha', 'data', 'escala', 'aceite']

const sanitizeQuestions = (questions) => {
    if (!Array.isArray(questions)) return []
    return questions.map((q, idx) => ({
        id: q.id || `q${idx}_${Date.now()}`,
        type: QUESTION_TYPES.includes(q.type) ? q.type : 'texto_curto',
        label: (q.label || '').trim(),
        required: !!q.required,
        options: q.type === 'multipla_escolha' ? (Array.isArray(q.options) ? q.options.filter(o => o?.trim()) : []) : undefined
    })).filter(q => q.label)
}

// Listar fichas do estabelecimento logado
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const forms = await formsRepo.findAll({ establishmentId })
        res.json({ success: true, data: forms.sort((a, b) => a.name.localeCompare(b.name)) })
    } catch (error) {
        next(error)
    }
})

router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const { name, questions } = req.body
        if (!name?.trim()) throw new AppError('Nome da ficha é obrigatório', 400)

        const cleanQuestions = sanitizeQuestions(questions)
        if (cleanQuestions.length === 0) throw new AppError('Adicione pelo menos uma pergunta', 400)

        const form = await formsRepo.create({
            establishmentId,
            name: name.trim(),
            questions: cleanQuestions
        })
        res.status(201).json({ success: true, data: form })
    } catch (error) {
        next(error)
    }
})

router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const form = await formsRepo.findById(req.params.id)
        if (!form) throw new AppError('Ficha não encontrada', 404)
        if (parseInt(form.establishmentId) !== parseInt(req.user.establishmentId)) {
            throw new AppError('Não autorizado', 403)
        }

        const { name, questions } = req.body
        const updateData = {}
        if (name !== undefined) updateData.name = name.trim()
        if (questions !== undefined) {
            const cleanQuestions = sanitizeQuestions(questions)
            if (cleanQuestions.length === 0) throw new AppError('Adicione pelo menos uma pergunta', 400)
            updateData.questions = cleanQuestions
        }

        const updated = await formsRepo.update(req.params.id, updateData)
        res.json({ success: true, data: updated })
    } catch (error) {
        next(error)
    }
})

router.delete('/:id', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const form = await formsRepo.findById(req.params.id)
        if (!form) throw new AppError('Ficha não encontrada', 404)
        if (parseInt(form.establishmentId) !== establishmentId) {
            throw new AppError('Não autorizado', 403)
        }

        await formsRepo.delete(req.params.id)

        // Desanexa a ficha de qualquer serviço que ainda apontava pra ela,
        // pra não deixar agendamento futuro exigindo um formulário que sumiu.
        const establishment = await establishmentsRepo.findById(establishmentId)
        const prefs = establishment?.servicePreferences || {}
        let changed = false
        const updatedPrefs = { ...prefs }
        Object.keys(updatedPrefs).forEach(serviceId => {
            if (updatedPrefs[serviceId]?.anamnesisFormId === form.id) {
                updatedPrefs[serviceId] = { ...updatedPrefs[serviceId], anamnesisFormId: null }
                changed = true
            }
        })
        if (changed) {
            await establishmentsRepo.update(establishmentId, { servicePreferences: updatedPrefs })
        }

        res.json({ success: true })
    } catch (error) {
        next(error)
    }
})

// Respostas de anamnese de um agendamento — só o próprio estabelecimento
// (o profissional responsável) enxerga; sem rota pública nenhuma pra isso.
router.get('/responses/:appointmentId', authMiddleware, async (req, res, next) => {
    try {
        const establishmentId = parseInt(req.user.establishmentId)
        const responses = await responsesRepo.findAll({ appointmentId: parseInt(req.params.appointmentId) })
        const owned = responses.filter(r => parseInt(r.establishmentId) === establishmentId)
        res.json({ success: true, data: owned })
    } catch (error) {
        next(error)
    }
})

// Público — usado na tela de agendamento pra buscar as perguntas de uma
// ficha anexada a um serviço selecionado (sem precisar estar logado).
router.get('/public/:id', async (req, res, next) => {
    try {
        const form = await formsRepo.findById(req.params.id)
        if (!form) throw new AppError('Ficha não encontrada', 404)
        res.json({ success: true, data: { id: form.id, name: form.name, questions: form.questions } })
    } catch (error) {
        next(error)
    }
})

export default router
