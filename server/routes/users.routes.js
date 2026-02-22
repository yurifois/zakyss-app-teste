import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()
const usersRepo = getRepository('users.json')
const appointmentsRepo = getRepository('appointments.json')

// Buscar usuário por ID
router.get('/:id', authMiddleware, async (req, res, next) => {
    try {
        const user = await usersRepo.findById(req.params.id)

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        const { password: _, ...userWithoutPassword } = user

        res.json({
            success: true,
            data: userWithoutPassword
        })
    } catch (error) {
        next(error)
    }
})

// Atualizar perfil
router.put('/:id', authMiddleware, async (req, res, next) => {
    try {
        const requestedId = parseInt(req.params.id)
        const tokenUserId = parseInt(req.user.id)

        console.log(`[Users] Tentativa de atualização - Token ID: ${tokenUserId}, Request ID: ${requestedId}`)

        if (tokenUserId !== requestedId) {
            throw new AppError('Não autorizado', 403)
        }

        // Só incluir campos que foram enviados (não undefined)
        const updates = {}
        const allowedFields = ['name', 'email', 'phone', 'avatar', 'address']

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field]
            }
        })

        const user = await usersRepo.update(req.params.id, updates)

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        const { password: _, ...userWithoutPassword } = user

        res.json({
            success: true,
            data: userWithoutPassword
        })
    } catch (error) {
        next(error)
    }
})

// Alterar senha
router.put('/:id/password', authMiddleware, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body
        const requestedId = parseInt(req.params.id)
        const tokenUserId = parseInt(req.user.id)

        if (tokenUserId !== requestedId) {
            throw new AppError('Não autorizado', 403)
        }

        const user = await usersRepo.findById(req.params.id)
        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        // Importar bcrypt dinamicamente
        const bcryptModule = await import('bcryptjs')
        const bcrypt = bcryptModule.default

        // Verificar senha atual
        const isValid = await bcrypt.compare(currentPassword, user.password)
        if (!isValid) {
            throw new AppError('Senha atual incorreta', 400)
        }

        // Hash da nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10)
        await usersRepo.update(req.params.id, { password: hashedPassword })

        res.json({
            success: true,
            message: 'Senha alterada com sucesso'
        })
    } catch (error) {
        next(error)
    }
})

// Agendamentos do usuário
router.get('/:id/appointments', authMiddleware, async (req, res, next) => {
    try {
        const appointments = await appointmentsRepo.findAll({ userId: parseInt(req.params.id) })

        res.json({
            success: true,
            data: appointments.sort((a, b) => new Date(b.date) - new Date(a.date))
        })
    } catch (error) {
        next(error)
    }
})

// Favoritos
router.get('/:id/favorites', authMiddleware, async (req, res, next) => {
    try {
        const user = await usersRepo.findById(req.params.id)

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        res.json({
            success: true,
            data: user.favorites || []
        })
    } catch (error) {
        next(error)
    }
})

// Toggle favorito
router.post('/:id/favorites/:establishmentId', authMiddleware, async (req, res, next) => {
    try {
        const user = await usersRepo.findById(req.params.id)

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        const establishmentId = parseInt(req.params.establishmentId)
        const favorites = user.favorites || []
        const index = favorites.indexOf(establishmentId)

        if (index > -1) {
            favorites.splice(index, 1)
        } else {
            favorites.push(establishmentId)
        }

        await usersRepo.update(req.params.id, { favorites })

        res.json({
            success: true,
            data: favorites
        })
    } catch (error) {
        next(error)
    }
})

export default router
