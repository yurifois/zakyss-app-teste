import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

export function generateToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
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
    return jwt.sign(payload, secret, { expiresIn: '1h' })
}

export function verifyResetToken(token, user) {
    const secret = process.env.JWT_SECRET + user.password
    return jwt.verify(token, secret)
}

export function decodeToken(token) {
    return jwt.decode(token)
}
