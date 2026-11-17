import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { generateToken, hashPassword, comparePassword, generateResetToken, verifyResetToken, decodeToken, passwordProblem } from '../utils/auth.js'
import { sendPasswordResetEmail, sendAccountInviteEmail } from '../utils/email.js'
import { recordTermsAcceptance } from '../utils/terms.js'
import { AppError } from '../middleware/error.middleware.js'
import { authMiddleware } from '../middleware/auth.middleware.js'
import { rateLimit, byIp, byBody, byIpAnd } from '../middleware/rateLimit.middleware.js'

// Freios contra força bruta e spam (ver rateLimit.middleware.js para o porquê dos números).
const loginLimit = rateLimit('login', [
    // Sem limite só por e-mail de propósito: ele deixaria qualquer um trancar a
    // conta de outra pessoa errando a senha dela de vários IPs.
    { key: byIpAnd('email'), max: 10, windowMinutes: 15 },  // mesma pessoa errando
    { key: byIp, max: 100, windowMinutes: 15 },             // um IP testando muitas contas
])
const registerLimit = rateLimit('register', [
    { key: byIp, max: 20, windowMinutes: 60 },
])
const forgotLimit = rateLimit('forgot', [
    { key: byIpAnd('email'), max: 3, windowMinutes: 60 },   // mesmo pedido repetido
    // Teto por e-mail mais folgado: segura o bombardeio de uma caixa vindo de
    // vários IPs sem deixar um estranho gastar os 3 pedidos do dono de verdade.
    { key: byBody('email'), max: 10, windowMinutes: 60 },
    { key: byIp, max: 20, windowMinutes: 60 },
])
const resetLimit = rateLimit('reset', [
    { key: byIp, max: 20, windowMinutes: 15 },
])

const router = Router()
const usersRepo = getRepository('users.json')
const adminsRepo = getRepository('admins.json')
const establishmentsRepo = getRepository('establishments.json')
const appointmentsRepo = getRepository('appointments.json')

// Grava quando a conta entrou pela última vez. Serve para um eventual
// controle de inatividade no futuro — hoje o sistema não guardava isso em
// lugar nenhum, então não havia como saber quem parou de usar.
//
// Nunca pode derrubar o login: se a gravação falhar (coluna ainda não criada,
// banco lento, o que for), o erro é só registrado e a pessoa entra normal.
async function registrarUltimoLogin(repo, id) {
    try {
        await repo.update(id, { lastLoginAt: new Date().toISOString() })
    } catch (err) {
        console.warn('[auth] Não foi possível registrar o último login:', err.message)
    }
}

/**
 * Procura um agendamento feito com esse e-mail.
 *
 * Serve para distinguir "nunca vi esse e-mail na vida" de "essa pessoa é
 * cliente da casa, só nunca criou conta" — o segundo caso é o de quem foi
 * agendado manualmente pelo estabelecimento.
 *
 * Nunca lança: se o banco falhar, devolve null e a recuperação de senha segue
 * seu curso normal. Essa busca é um extra, não pode derrubar a rota.
 */
async function encontrarAgendamentoPorEmail(emailLower) {
    try {
        // Caminho rápido: igualdade exata, que cobre a maioria dos registros.
        const direto = await appointmentsRepo.findOne({ customerEmail: emailLower })
        if (direto) return direto

        // O e-mail do agendamento é gravado exatamente como a pessoa digitou,
        // sem normalizar (ver appointments.routes.js), então pode ter vindo com
        // maiúsculas ou espaços. Varredura comparando tudo em minúsculas para
        // alcançar esses casos.
        const todos = await appointmentsRepo.findAll()
        return todos.find(a => (a.customerEmail || '').toLowerCase().trim() === emailLower) || null
    } catch (err) {
        console.error('[auth] Falha ao procurar agendamento por e-mail:', err.message)
        return null
    }
}



// Login de usuário
router.post('/login', loginLimit, async (req, res, next) => {
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

        await registrarUltimoLogin(usersRepo, user.id)

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
router.post('/register', registerLimit, async (req, res, next) => {
    try {
        const { name, email, password, phone, termsAccepted } = req.body

        if (!name || !email || !password) {
            throw new AppError('Nome, email e senha são obrigatórios', 400)
        }
        const problemaSenha = passwordProblem(password)
        if (problemaSenha) throw new AppError(problemaSenha, 400)
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
router.post('/admin/login', loginLimit, async (req, res, next) => {
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

        await registrarUltimoLogin(adminsRepo, admin.id)

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
router.post('/admin/register', registerLimit, async (req, res, next) => {
    try {
        const { name, email, password, establishmentId, termsAccepted } = req.body

        if (!name || !email || !password || !establishmentId) {
            throw new AppError('Dados incompletos', 400)
        }
        const problemaSenhaAdmin = passwordProblem(password)
        if (problemaSenhaAdmin) throw new AppError(problemaSenhaAdmin, 400)
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
router.post('/forgot-password', forgotLimit, async (req, res, next) => {
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
            // Sem conta com esse e-mail. Antes a rota parava aqui e devolvia
            // sucesso sem enviar nada: a pessoa via "verifique seu e-mail" e
            // ficava esperando para sempre uma mensagem que nunca foi pedida.
            //
            // Quem cai aqui quase sempre foi agendado manualmente pelo
            // estabelecimento (fluxo que existe de propósito, ver
            // appointments.routes.js) e nunca se cadastrou. Para essa pessoa não
            // há senha a recuperar — o que ela precisa é criar conta. Então, se
            // o e-mail já aparece em algum agendamento, mandamos um convite de
            // cadastro no lugar do link de redefinição.
            //
            // A resposta continua idêntica à do caminho com conta, de propósito:
            // é isso que impede descobrir de fora quais e-mails têm cadastro.
            const agendamento = await encontrarAgendamentoPorEmail(emailLower)

            if (agendamento) {
                console.warn(`[auth] forgot-password: ${emailLower} não tem conta, mas tem agendamento. Enviando convite de cadastro.`)
                try {
                    await sendAccountInviteEmail((agendamento.customerEmail || emailLower).trim())
                } catch (err) {
                    // Falha de envio aqui não pode mudar a resposta da rota,
                    // senão vira justamente o vazamento que queremos evitar.
                    console.error('[auth] Falha ao enviar convite de cadastro:', err.message)
                }
            } else {
                console.warn(`[auth] forgot-password: ${emailLower} não tem conta nem agendamento. Nada enviado.`)
            }

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
router.post('/reset-password', resetLimit, async (req, res, next) => {
    try {
        const { token, newPassword } = req.body

        if (!token || !newPassword) {
            throw new AppError('Token e nova senha são obrigatórios', 400)
        }
        const problemaSenhaNova = passwordProblem(newPassword)
        if (problemaSenhaNova) throw new AppError(problemaSenhaNova, 400)

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
