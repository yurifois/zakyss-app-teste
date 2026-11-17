import jwt from 'jsonwebtoken'
import { AppError } from './error.middleware.js'

export function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Token não fornecido', 401)
    }

    const token = authHeader.split(' ')[1]

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        req.user = decoded
        next()
    } catch (error) {
        // Código estável: o app desconecta a pessoa e explica o motivo na tela
        // de entrar (ex.: depois de uma troca do JWT_SECRET, que invalida todas
        // as sessões de uma vez).
        throw new AppError('Token inválido ou expirado', 401, 'SESSION_INVALID')
    }
}

// Para rotas públicas que mostram MAIS quando quem pede está logado (ex.: a
// tela de confirmação de agendamento). Nunca recusa: token ausente ou inválido
// só significa req.user vazio, e a rota decide o que mostrar.
export function optionalAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
        try {
            req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET)
        } catch {
            req.user = undefined
        }
    }
    next()
}

// Igual ao optionalAuthMiddleware, mas recusa um login GUARDADO que não vale
// mais (ex.: depois de uma manutenção que troca o segredo). Sem login nenhum
// segue como visitante. Usado no agendamento: antes, quem tinha um login antigo
// agendava "como visitante" sem perceber — o app achava que estava logado e o
// servidor ignorava o token em silêncio.
export function optionalAuthRejectStaleMiddleware(req, res, next) {
    const authHeader = req.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) return next()
    try {
        req.user = jwt.verify(authHeader.split(' ')[1], process.env.JWT_SECRET)
    } catch {
        throw new AppError('Sua sessão foi encerrada. Entre novamente para concluir o agendamento.', 401, 'SESSION_INVALID')
    }
    next()
}

export function adminMiddleware(req, res, next) {
    if (req.user?.type !== 'admin') {
        throw new AppError('Acesso restrito a administradores', 403)
    }
    next()
}

export function customerMiddleware(req, res, next) {
    if (req.user?.type !== 'customer') {
        throw new AppError('Acesso restrito a clientes', 403)
    }
    next()
}

// O estabelecimento de um admin é o que está DENTRO do token assinado. Nunca
// confiar no establishmentId que vem no corpo ou na URL sem comparar com ele:
// era exatamente assim que qualquer conta conseguia mexer no salão dos outros.
export function isAdminOf(user, establishmentId) {
    if (user?.type !== 'admin' || user.establishmentId == null) return false
    const target = parseInt(establishmentId)
    return Number.isInteger(target) && String(user.establishmentId) === String(target)
}

export function assertAdminOf(user, establishmentId) {
    if (!isAdminOf(user, establishmentId)) {
        throw new AppError('Você não tem permissão para acessar este estabelecimento', 403)
    }
}

// Middleware para rotas do tipo /:establishmentId/... — só o admin daquele
// estabelecimento passa. Use depois do authMiddleware.
export function requireEstablishmentAdmin(paramName = 'establishmentId') {
    return (req, res, next) => {
        assertAdminOf(req.user, req.params[paramName])
        next()
    }
}
