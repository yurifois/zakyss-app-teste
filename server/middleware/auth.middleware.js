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
        throw new AppError('Token inválido ou expirado', 401)
    }
}

export function adminMiddleware(req, res, next) {
    if (req.user?.type !== 'admin') {
        throw new AppError('Acesso restrito a administradores', 403)
    }
    next()
}
