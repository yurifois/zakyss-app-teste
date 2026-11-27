import { Router } from 'express'
import { getRepository } from '../repositories/index.js'
import { authMiddleware, customerMiddleware } from '../middleware/auth.middleware.js'
import { passwordProblem, comparePassword } from '../utils/auth.js'
import { AppError } from '../middleware/error.middleware.js'

const router = Router()

// Todas as rotas daqui são da conta de CLIENTE. Admin e cliente vivem em tabelas
// diferentes e os ids se repetem: sem conferir o tipo do token, o admin nº 5
// passava na checagem "id do token == id da URL" e lia/editava o cliente nº 5.
const usersRepo = getRepository('users.json')
const appointmentsRepo = getRepository('appointments.json')
const anamnesisResponsesRepo = getRepository('anamnesis_responses.json')
const clientNotesRepo = getRepository('client_notes.json')
const customerPackagesRepo = getRepository('customer_packages.json')

const normalizePhone = (phone) => (phone || '').replace(/\D/g, '')
const ANONIMO = 'Cliente removido'

// Buscar usuário por ID
router.get('/:id', authMiddleware, customerMiddleware, async (req, res, next) => {
    try {
        if (parseInt(req.user.id) !== parseInt(req.params.id)) {
            throw new AppError('Não autorizado', 403)
        }

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
router.put('/:id', authMiddleware, customerMiddleware, async (req, res, next) => {
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

        // Endereço vai para uma coluna jsonb: guarda só os campos da tela,
        // como texto curto, em vez de qualquer objeto que chegar.
        if (updates.address !== undefined && updates.address !== null) {
            if (typeof updates.address !== 'object' || Array.isArray(updates.address)) {
                throw new AppError('Endereço inválido', 400)
            }
            const campos = ['cep', 'street', 'number', 'complement', 'neighborhood', 'city', 'state']
            updates.address = Object.fromEntries(
                campos.map(c => [c, String(updates.address[c] ?? '').trim().slice(0, 200)])
            )
        }

        const user = await usersRepo.update(req.params.id, updates)

        if (!user) {
            throw new AppError('Usuário não encontrado', 404)
        }

        // Mesma armadilha da avaliação: sem a coluna address, o Supabase
        // descartava o endereço em silêncio e a tela dizia "salvo".
        if (updates.address !== undefined && user.address === undefined) {
            console.error(`[Users] Endereço do usuário ${req.params.id} não foi gravado (coluna address ausente?)`)
            throw new AppError('Não foi possível salvar o endereço agora. Tente de novo mais tarde.', 500)
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
router.put('/:id/password', authMiddleware, customerMiddleware, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body
        const requestedId = parseInt(req.params.id)
        const tokenUserId = parseInt(req.user.id)

        if (tokenUserId !== requestedId) {
            throw new AppError('Não autorizado', 403)
        }

        const problemaSenha = passwordProblem(newPassword)
        if (problemaSenha) throw new AppError(problemaSenha, 400)

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
router.get('/:id/appointments', authMiddleware, customerMiddleware, async (req, res, next) => {
    try {
        if (parseInt(req.user.id) !== parseInt(req.params.id)) {
            throw new AppError('Não autorizado', 403)
        }

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
router.get('/:id/favorites', authMiddleware, customerMiddleware, async (req, res, next) => {
    try {
        if (parseInt(req.user.id) !== parseInt(req.params.id)) {
            throw new AppError('Não autorizado', 403)
        }

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
router.post('/:id/favorites/:establishmentId', authMiddleware, customerMiddleware, async (req, res, next) => {
    try {
        if (parseInt(req.user.id) !== parseInt(req.params.id)) {
            throw new AppError('Não autorizado', 403)
        }

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

// Excluir a própria conta (LGPD, art. 18, VI). Pede a senha para confirmar.
//
// Apaga: a conta, as fichas de anamnese (dados de saúde) e as anotações
// privadas que os salões fizeram sobre a pessoa.
// Anonimiza (não apaga): agendamentos passados e pacotes. Eles são o caixa e
// os relatórios do salão — apagar quebraria o financeiro dele —, então ficam
// sem nome, e-mail, telefone e observações.
// Recusa se houver agendamento futuro ativo: o salão estaria esperando alguém
// que sumiu. A pessoa cancela antes, pelo app.
router.delete('/:id', authMiddleware, customerMiddleware, async (req, res, next) => {
    try {
        if (parseInt(req.user.id) !== parseInt(req.params.id)) {
            throw new AppError('Não autorizado', 403)
        }
        const user = await usersRepo.findById(req.params.id)
        if (!user) throw new AppError('Usuário não encontrado', 404)

        const { password } = req.body || {}
        if (!password || !(await comparePassword(password, user.password))) {
            throw new AppError('Senha incorreta. Digite a senha da sua conta para confirmar a exclusão.', 401)
        }

        const email = String(user.email || '').toLowerCase().trim()
        const doUsuario = await appointmentsRepo.findAll({ userId: user.id })
        const pelaEmail = email ? (await appointmentsRepo.findAll()).filter(a =>
            !a.userId && String(a.customerEmail || '').toLowerCase().trim() === email) : []
        const agendamentos = [...doUsuario, ...pelaEmail]

        const hoje = new Date().toISOString().slice(0, 10)
        const futuros = agendamentos.filter(a => ['pending', 'confirmed'].includes(a.status) && a.date >= hoje)
        if (futuros.length > 0) {
            throw new AppError(
                `Você tem ${futuros.length} agendamento(s) futuro(s). Cancele em "Meus agendamentos" antes de excluir a conta.`,
                409, 'HAS_FUTURE_APPOINTMENTS'
            )
        }

        for (const a of agendamentos) {
            await anamnesisResponsesRepo.deleteMany({ appointmentId: a.id })
            await appointmentsRepo.update(a.id, {
                userId: null, customerName: ANONIMO, customerEmail: null, customerPhone: null, notes: null
            })
        }

        const chaves = [normalizePhone(user.phone), email ? `email:${email}` : null].filter(Boolean)
        for (const clientKey of chaves) {
            await clientNotesRepo.deleteMany({ clientKey })
            for (const pkg of await customerPackagesRepo.findAll({ clientKey })) {
                await customerPackagesRepo.update(pkg.id, { customerName: ANONIMO, customerPhone: null, clientKey: null })
            }
        }

        await usersRepo.delete(user.id)
        res.json({ success: true, data: { message: 'Sua conta e seus dados pessoais foram excluídos.' } })
    } catch (error) {
        next(error)
    }
})

export default router
