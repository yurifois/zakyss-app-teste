import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'
import { statusWhatsApp, conectarWhatsApp, desconectarWhatsApp, enviarTexto, numeroBR } from '../services/whatsapp.js'

// Painel do salão > WhatsApp. Sempre o salão do próprio token.
const router = Router()
const establishmentsRepo = getRepository('establishments.json')
router.use(authMiddleware, adminMiddleware)

const doSalao = (req) => Number(req.user.establishmentId)

router.get('/status', async (req, res, next) => {
    try {
        const est = await establishmentsRepo.findById(doSalao(req))
        res.json({ success: true, data: { ...statusWhatsApp(doSalao(req)), alertPhone: est?.whatsappAlertPhone || '' } })
    } catch (error) { next(error) }
})

router.post('/connect', async (req, res, next) => {
    try {
        res.json({ success: true, data: await conectarWhatsApp(doSalao(req)) })
    } catch (error) { next(new AppError(error.message, 503)) }
})

router.post('/disconnect', async (req, res, next) => {
    try {
        res.json({ success: true, data: await desconectarWhatsApp(doSalao(req)) })
    } catch (error) { next(error) }
})

// Número que recebe o aviso de agendamento novo (celular do dono/recepção).
router.put('/alert-phone', async (req, res, next) => {
    try {
        const phone = String(req.body?.phone || '').trim()
        if (phone && !numeroBR(phone)) throw new AppError('Digite o celular com DDD, ex.: (61) 99999-9999', 400)
        await establishmentsRepo.update(doSalao(req), { whatsappAlertPhone: phone || null })
        res.json({ success: true, data: { alertPhone: phone } })
    } catch (error) { next(error) }
})

router.post('/test', async (req, res, next) => {
    try {
        const est = await establishmentsRepo.findById(doSalao(req))
        const destino = est?.whatsappAlertPhone || est?.phone
        if (!destino) throw new AppError('Cadastre o número que recebe os avisos primeiro.', 400)
        const r = await enviarTexto(doSalao(req), destino, `✅ Teste do Zakys: o WhatsApp do ${est.name} está conectado e os avisos de agendamento vão chegar aqui.`)
        if (!r.sent) {
            const motivo = { 'whatsapp-desconectado': 'O WhatsApp do salão não está conectado.', 'telefone-invalido': 'O número de avisos é inválido.', 'numero-sem-whatsapp': 'Esse número não tem WhatsApp.' }[r.reason] || 'Não foi possível enviar.'
            throw new AppError(motivo, 409)
        }
        res.json({ success: true, data: { sent: true } })
    } catch (error) { next(error) }
})

export default router
