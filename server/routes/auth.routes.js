import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { generateToken, hashPassword, comparePassword, generateResetToken, verifyResetToken, decodeToken } from '../utils/auth.js'
import { sendPasswordResetEmail } from '../utils/email.js'
import { recordTermsAcceptance } from '../utils/terms.js'
import { AppError } from '../middleware/error.middleware.js'
import { authMiddleware } from '../middleware/auth.middleware.js'

const router = Router()
const usersRepo = getRepository('users.json')
const adminsRepo = getRepository('admins.json')
const establishmentsRepo = getRepository('establishments.json')


// Login de usuário
router.post('/login', async (req, res, next) => {
    try {
        const { email, password } = req.body

        if (!email || !password) {
            throw new AppError('Email e senha são obrigatórios', 400)
        }

        const normalizedEmail = email.toLowerCase().trim()
        const user = await usersRepo.findOne({ email: normalizedEmail })

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
        const { name, email, password, phone, termsAccepted } = req.body

        if (!name || !email || !password) {
            throw new AppError('Nome, email e senha são obrigatórios', 400)
        }
        if (!termsAccepted) {
            throw new AppError('Você precisa aceitar os Termos de Uso e a Política de Privacidade', 400)
        }

        const normalizedEmail = email.toLowerCase().trim()
        const existing = await usersRepo.findOne({ email: normalizedEmail })
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

        await recordTermsAcceptance({ userId: user.id, userType: 'customer' })

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

        const normalizedEmail = email.toLowerCase().trim()
        const admin = await adminsRepo.findOne({ email: normalizedEmail })

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
        const { name, email, password, establishmentId, termsAccepted } = req.body

        if (!name || !email || !password || !establishmentId) {
            throw new AppError('Dados incompletos', 400)
        }
        if (!termsAccepted) {
            throw new AppError('Você precisa aceitar os Termos de Uso e a Política de Privacidade', 400)
        }

        const normalizedEmail = email.toLowerCase().trim()
        const existing = await adminsRepo.findOne({ email: normalizedEmail })
        if (existing) {
            throw new AppError('Email já cadastrado', 400)
        }

        // ---------------------------------------------------------------
        // Reivindicação do estabelecimento.
        //
        // Esta rota é pública de propósito: o cadastro de parceiro cria o
        // estabelecimento e, um segundo depois, registra o dono dele. O que
        // faltava era fechar a porta DEPOIS disso. Sem estas checagens,
        // qualquer pessoa podia mandar o número de um estabelecimento alheio
        // e receber na hora um token de administrador dele, com acesso à
        // agenda, à ficha dos clientes e ao fluxo de caixa.
        //
        // Não afeta quem já está dentro: a regra só decide se um NOVO
        // administrador pode nascer, e nenhum dado existente é tocado.
        // ---------------------------------------------------------------
        const targetEstablishmentId = parseInt(establishmentId)
        if (!Number.isInteger(targetEstablishmentId)) {
            throw new AppError('Estabelecimento inválido', 400)
        }

        const establishment = await establishmentsRepo.findById(targetEstablishmentId)
        if (!establishment) {
            throw new AppError('Estabelecimento não encontrado', 404)
        }

        const jaTemDono = await adminsRepo.findOne({ establishmentId: targetEstablishmentId })
        if (jaTemDono) {
            throw new AppError(
                'Este estabelecimento já possui um responsável cadastrado. ' +
                'Se a conta é sua, use "Esqueci minha senha" para recuperar o acesso.',
                403
            )
        }

        const hashedPassword = await hashPassword(password)
        const admin = await adminsRepo.create({
            name,
            email: email.toLowerCase().trim(),
            password: hashedPassword,
            establishmentId: targetEstablishmentId
        })

        await recordTermsAcceptance({ userId: admin.id, userType: 'admin' })

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

// Solicitar recuperação de senha
router.post('/forgot-password', async (req, res, next) => {
    try {
        const { email } = req.body

        if (!email) {
            throw new AppError('E-mail é obrigatório', 400)
        }

        const emailLower = email.toLowerCase().trim()
        
        let user = await usersRepo.findOne({ email: emailLower })
        let type = 'customer'

        if (!user) {
            user = await adminsRepo.findOne({ email: emailLower })
            type = 'admin'
        }

        if (!user) {
            // Retorna sucesso mesmo se não encontrar para evitar enumeração de e-mails
            return res.json({ success: true, data: { message: 'Se o e-mail existir, um link de recuperação foi enviado.' } })
        }

        const token = generateResetToken(user, type)

        await sendPasswordResetEmail(user.email, token)

        res.json({ success: true, data: { message: 'Se o e-mail existir, um link de recuperação foi enviado.' } })
    } catch (error) {
        next(error)
    }
})

// Redefinir senha
router.post('/reset-password', async (req, res, next) => {
    try {
        const { token, newPassword } = req.body

        if (!token || !newPassword) {
            throw new AppError('Token e nova senha são obrigatórios', 400)
        }

        // Decode token to find the user
        const payload = decodeToken(token)
        if (!payload || !payload.id || !payload.type) {
            throw new AppError('Link de recuperação inválido ou expirado', 400)
        }

        let user = null
        if (payload.type === 'admin') {
            user = await adminsRepo.findById(payload.id)
        } else {
            user = await usersRepo.findById(payload.id)
        }

        if (!user) {
            throw new AppError('Link de recuperação inválido ou expirado', 400)
        }

        try {
            verifyResetToken(token, user) // Verifica expiração e assinatura com a senha antiga
        } catch (err) {
            // Distingue "expirou" de "inválido" pra dar um retorno acionável
            // (o usuário lê "expirou" e sabe que é só pedir de novo).
            if (err.name === 'TokenExpiredError') {
                throw new AppError('Esse link de recuperação expirou. Solicite um novo.', 400)
            }
            throw new AppError('Link de recuperação inválido. Solicite um novo.', 400)
        }

        const hashedPassword = await hashPassword(newPassword)

        if (payload.type === 'admin') {
            await adminsRepo.update(user.id, { password: hashedPassword })
        } else {
            await usersRepo.update(user.id, { password: hashedPassword })
        }

        res.json({ success: true, data: { message: 'Senha alterada com sucesso.' } })
    } catch (error) {
        next(error)
    }
})

export default router
