import { getRepository } from '../repositories/index.js'

// Nota do salão = média das notas que os clientes deram nos agendamentos
// (appointment.rating, de 1 a 5). Sem nenhuma avaliação, fica a nota de
// cadastro (5) com reviewCount 0 — a tela já esconde a nota nesse caso.
export function summarizeRatings(appointments) {
    const notas = (appointments || [])
        .map(a => a.rating)
        .filter(r => typeof r === 'number' && r >= 1 && r <= 5)

    if (notas.length === 0) return { rating: 5, reviewCount: 0 }

    const media = notas.reduce((soma, r) => soma + r, 0) / notas.length
    return { rating: Math.round(media * 10) / 10, reviewCount: notas.length }
}

// Recalcula do zero a partir dos agendamentos (não soma em cima do valor
// antigo), então reavaliar o mesmo agendamento não conta duas vezes.
export async function refreshEstablishmentRating(establishmentId) {
    const id = parseInt(establishmentId)
    const appointments = await getRepository('appointments.json').findAll({ establishmentId: id })
    const resumo = summarizeRatings(appointments)
    await getRepository('establishments.json').update(id, resumo)
    return resumo
}
