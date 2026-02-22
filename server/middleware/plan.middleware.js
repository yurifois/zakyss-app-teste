import { getRepository } from '../repositories/index.js'
import { AppError } from './error.middleware.js'

const establishmentsRepo = getRepository('establishments.json')

/**
 * Middleware para verificar se o estabelecimento tem plano premium
 * Requer que authMiddleware seja executado antes
 */
export const premiumMiddleware = async (req, res, next) => {
    try {
        // O establishmentId pode vir do admin logado ou do parâmetro da rota
        const establishmentId = req.admin?.establishmentId || req.params.id

        if (!establishmentId) {
            throw new AppError('Estabelecimento não identificado', 400)
        }

        const establishment = await establishmentsRepo.findById(establishmentId)

        if (!establishment) {
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        if (establishment.plan !== 'premium') {
            throw new AppError('Recurso exclusivo do plano Premium. Faça upgrade para acessar.', 403)
        }

        // Adiciona establishment ao request para uso posterior
        req.establishment = establishment
        next()
    } catch (error) {
        next(error)
    }
}

/**
 * Verifica se estabelecimento tem pelo menos o plano especificado
 * @param {string} minPlan - 'free', 'professional', ou 'premium'
 */
export const planMiddleware = (minPlan) => {
    const planLevels = { free: 0, professional: 1, premium: 2 }

    return async (req, res, next) => {
        try {
            const establishmentId = req.admin?.establishmentId || req.params.id

            if (!establishmentId) {
                throw new AppError('Estabelecimento não identificado', 400)
            }

            const establishment = await establishmentsRepo.findById(establishmentId)

            if (!establishment) {
                throw new AppError('Estabelecimento não encontrado', 404)
            }

            const currentPlanLevel = planLevels[establishment.plan] || 0
            const requiredLevel = planLevels[minPlan] || 0

            if (currentPlanLevel < requiredLevel) {
                const planNames = { professional: 'Profissional', premium: 'Premium' }
                throw new AppError(
                    `Recurso exclusivo do plano ${planNames[minPlan]}. Faça upgrade para acessar.`,
                    403
                )
            }

            req.establishment = establishment
            next()
        } catch (error) {
            next(error)
        }
    }
}
