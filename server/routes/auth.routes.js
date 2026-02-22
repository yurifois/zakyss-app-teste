import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { generateToken, hashPassword, comparePassword } from '../utils/auth.js'
import { AppError } from '../middleware/error.middleware.js'
import { authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()
const usersRepo = getRepository('users.json')
const adminsRepo = getRepository('admins.json')


// Login de usuário
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            throw new AppError('Email e senha são obrigatórios', 400)
        }

        const user = await usersRepo.findOne({ email })

        if (!user) {
            throw new AppError('Credenciais inválidas', 401)
        }

        const validPassword = await comparePassword(password, user.password)
        if (!validPassword) {
            throw new AppError('Credenciais inválidas', 401)
        }

        const { password: _, ...userWithoutPassword } = user
        const token = generateToken({
            id: user.id,
            email: user.email,
            type: 'customer'
        })

        res.json({
            success: true,
            data: {
                user: userWithoutPassword,
                token
            }
        })
    } catch (error) {
        next(error)
    }
})

// Registro de usuário
router.post('/register', async (req, res, next) => {
    try {
        const { name, email, password, phone } = req.body

        if (!name || !email || !password) {
            throw new AppError('Nome, email e senha são obrigatórios', 400)
        }

        const existing = await usersRepo.findOne({ email })
        if (existing) {
            throw new AppError('Email já cadastrado', 400)
        }

        const hashedPassword = await hashPassword(password)
        const user = await usersRepo.create({
            name,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            phone,
            avatar: null,
            favorites: []
        })

        const { password: _, ...userWithoutPassword } = user
        const token = generateToken({
            id: user.id,
            email: user.email,
            type: 'customer'
        })

        res.status(201).json({
            success: true,
            data: {
                user: userWithoutPassword,
                token
            }
        })
    } catch (error) {
        next(error)
    }
})

// Login de admin
router.post('/admin/login', async (req, res, next) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            throw new AppError('Email e senha são obrigatórios', 400)
        }

        const admin = await adminsRepo.findOne({ email })

        if (!admin) {
            throw new AppError('Credenciais inválidas', 401)
        }

        const validPassword = await comparePassword(password, admin.password)
        if (!validPassword) {
            throw new AppError('Credenciais inválidas', 401)
        }

        const { password: _, ...adminWithoutPassword } = admin
        const token = generateToken({
            id: admin.id,
            email: admin.email,
            type: 'admin',
            establishmentId: admin.establishmentId
        })

        res.json({
            success: true,
            data: {
                admin: adminWithoutPassword,
                token
            }
        })
    } catch (error) {
        next(error)
    }
})

// Registro de admin (para cadastro de estabelecimentos)
router.post('/admin/register', async (req, res, next) => {
    try {
        const { name, email, password, establishmentId } = req.body

        if (!name || !email || !password || !establishmentId) {
            throw new AppError('Dados incompletos', 400)
        }

        const existing = await adminsRepo.findOne({ email })
        if (existing) {
            throw new AppError('Email já cadastrado', 400)
        }

        const hashedPassword = await hashPassword(password)
        const admin = await adminsRepo.create({
            name,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            establishmentId
        })

        const { password: _, ...adminWithoutPassword } = admin
        const token = generateToken({
            id: admin.id,
            email: admin.email,
            type: 'admin',
            establishmentId: admin.establishmentId
        })

        res.status(201).json({
            success: true,
            data: {
                admin: adminWithoutPassword,
                token
            }
        })
    } catch (error) {
        next(error)
    }
})



// Dados do usuário logado
router.get('/me', authMiddleware, async (req, res, next) => {
    try {
        let repo
        if (req.user.type === 'admin') {
            repo = adminsRepo
        } else {
            repo = usersRepo
        }

        const user = await repo.findById(req.user.id)

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        const { password: _, cpf, rg, ...userWithoutSensitive } = user

        res.json({
            success: true,
            data: userWithoutSensitive
        })
    } catch (error) {
        next(error)
    }
})

export default router
