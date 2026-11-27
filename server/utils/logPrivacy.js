// Dados pessoais não vão inteiros para os logs (LGPD: minimização). Os logs do
// Render ficam guardados por dias e são lidos por quem cuida do servidor;
// "an***@hotmail.com" e "Ana C." bastam para investigar um problema.

export function maskEmail(email) {
    const s = String(email || '').trim()
    const at = s.indexOf('@')
    if (at < 1) return s ? '***' : '(sem e-mail)'
    return `${s.slice(0, Math.min(2, at))}***${s.slice(at)}`
}

export function maskName(name) {
    const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
    if (parts.length === 0) return '(sem nome)'
    return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`
}
