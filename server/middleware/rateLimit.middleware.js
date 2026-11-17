import { AppError } from './error.middleware.js'

// Limite de tentativas, em memória.
//
// Antes não havia freio nenhum: dava para testar senhas sem parar e disparar
// e-mails de recuperação para qualquer endereço em loop. Isto corta os dois.
//
// Proteção parcial de propósito: o Render free reinicia a instância quando
// dorme e os contadores zeram junto. Para força bruta e spam isso já basta.
//
// Cuidado ao apertar os números: muita gente de operadora móvel sai pelo mesmo
// IP (CGNAT), então o limite só por IP tem de ser folgado. O aperto de verdade
// é por IP + e-mail, o que também impede alguém de trancar a conta de outra
// pessoa só errando a senha dela de propósito.

const buckets = new Map()

const limpeza = setInterval(() => {
    const now = Date.now()
    for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) buckets.delete(key)
    }
}, 10 * 60 * 1000)
limpeza.unref?.()

const MIN = 60 * 1000

export const byIp = (req) => req.ip
export const byBody = (field) => (req) => {
    const value = String(req.body?.[field] ?? '').toLowerCase().trim()
    return value || null
}
export const byIpAnd = (field) => (req) => {
    const value = byBody(field)(req)
    return value ? `${req.ip}|${value}` : null
}
export const byParam = (param) => (req) => req.params?.[param] || null

/**
 * @param {string} name  nome do grupo (ex.: 'login')
 * @param {Array<{ key: (req) => string|null, max: number, windowMinutes: number }>} rules
 */
export function rateLimit(name, rules) {
    return (req, res, next) => {
        const now = Date.now()
        const toCount = []

        for (const [i, rule] of rules.entries()) {
            const id = rule.key(req)
            if (!id) continue
            const key = `${name}#${i}:${id}`
            let bucket = buckets.get(key)
            if (!bucket || bucket.resetAt <= now) {
                bucket = { count: 0, resetAt: now + rule.windowMinutes * MIN }
            }
            if (bucket.count >= rule.max) {
                const waitMin = Math.max(1, Math.ceil((bucket.resetAt - now) / MIN))
                res.set('Retry-After', String(waitMin * 60))
                throw new AppError(`Muitas tentativas. Aguarde ${waitMin} minuto(s) e tente de novo.`, 429)
            }
            toCount.push([key, bucket])
        }

        // Só conta depois de passar em todas as regras, para uma recusa não
        // gastar a cota das outras.
        for (const [key, bucket] of toCount) {
            bucket.count++
            buckets.set(key, bucket)
        }
        next()
    }
}

// Só para os testes.
export function _resetRateLimits() {
    buckets.clear()
}
