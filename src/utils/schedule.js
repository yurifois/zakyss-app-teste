// 0 = Domingo ... 6 = Sábado, na mesma ordem que Date.getDay()
export const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Dias da semana em que o estabelecimento não atende, a partir do expediente.
 *
 * Dado ausente NUNCA vira "fechado": se workingHours não carregou (erro de
 * rede, cold start), devolve lista vazia. Sem essa guarda, um objeto vazio
 * fazia o calendário do admin pintar TODOS os dias como fechados, dando a
 * impressão de que o estabelecimento tinha fechado meses inteiros.
 */
export function getClosedWeekdays(workingHours) {
    if (!workingHours || Object.keys(workingHours).length === 0) return []
    return WEEKDAY_KEYS
        .map((key, index) => (workingHours[key] ? null : index))
        .filter(index => index !== null)
}

/**
 * Data em YYYY-MM-DD a partir dos componentes locais.
 *
 * toISOString() converte para UTC e vira o dia errado em fusos negativos
 * (no Brasil, qualquer horário antes das 21h viraria o dia seguinte).
 */
export function toDateString(date) {
    if (!date) return null
    if (typeof date === 'string') return date.slice(0, 10)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
