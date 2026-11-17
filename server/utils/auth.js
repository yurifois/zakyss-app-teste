import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

// "Manter-me conectado" marcado: a sessão dura 30 dias, para a pessoa não cair
// toda semana e ter que lembrar de novo qual e-mail usou.
export const REMEMBER_ME_EXPIRES_IN = '30d'

export function generateToken(payload, expiresIn) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: expiresIn || process.env.JWT_EXPIRES_IN || '7d'
    })
}

export function verifyToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET)
}

export async function hashPassword(password) {
    return bcrypt.hash(password, 10)
}

export async function comparePassword(password, hash) {
    return bcrypt.compare(password, hash)
}

export function generateResetToken(user, type) {
    const secret = process.env.JWT_SECRET + user.password
    const payload = { id: user.id, type }
    // 1h era curto demais na prática: se a pessoa não abre o email na hora,
    // o link já morre e ela só vê "inválido ou expirado" sem entender por quê.
    return jwt.sign(payload, secret, { expiresIn: '24h' })
}

export function verifyResetToken(token, user) {
    const secret = process.env.JWT_SECRET + user.password
    return jwt.verify(token, secret)
}

export function decodeToken(token) {
    return jwt.decode(token)
}

// Regra de senha para cadastro, troca e redefinição. Não afeta quem já tem
// conta: senha antiga continua entrando normalmente, a regra só vale para
// senha nova. Teto de 72 bytes porque o bcrypt ignora o que passa disso
// (duas senhas diferentes depois do 72º byte virariam a mesma).
export const PASSWORD_MIN_LENGTH = 8

export function passwordProblem(password) {
    if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) {
        return `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`
    }
    if (Buffer.byteLength(password, 'utf8') > 72) {
        return 'A senha pode ter no máximo 72 caracteres.'
    }
    return null
}
