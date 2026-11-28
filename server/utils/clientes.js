// Regras compartilhadas da ficha de cliente (CRM do salão) e do cartão fidelidade.

export const normalizePhone = (phone) => (phone || '').replace(/\D/g, '')

// Mesma chave que as anotações e os pacotes já usam: telefone normalizado,
// ou e-mail quando não há telefone.
export const clientKeyOf = (apt) =>
    normalizePhone(apt.customerPhone) || `email:${(apt.customerEmail || '').toLowerCase().trim()}`

// Lançamento financeiro manual vira um "agendamento" técnico — não é cliente.
export function isManualFinance(apt) {
    try {
        return JSON.parse(apt.notes)?.type === 'MANUAL_FINANCE'
    } catch {
        return false
    }
}

// Configuração do cartão fidelidade de um salão, sempre num formato válido.
export function loyaltyConfig(establishment) {
    const p = establishment?.loyaltyProgram || {}
    const visitas = parseInt(p.visitsRequired)
    return {
        enabled: !!p.enabled && Number.isInteger(visitas) && visitas >= 2,
        visitsRequired: Number.isInteger(visitas) && visitas >= 2 ? visitas : 10,
        reward: String(p.reward || '').trim() || 'um benefício do salão',
    }
}

// A cada N atendimentos concluídos ganha 1 prêmio; prêmios usados são
// descontados. progresso = quantos já tem rumo ao próximo.
export function loyaltyStatus(config, atendimentosConcluidos, premiosUsados) {
    if (!config.enabled) return null
    const conquistados = Math.floor(atendimentosConcluidos / config.visitsRequired)
    return {
        visitsRequired: config.visitsRequired,
        reward: config.reward,
        progress: atendimentosConcluidos % config.visitsRequired,
        available: Math.max(0, conquistados - premiosUsados),
        redeemed: premiosUsados,
    }
}
