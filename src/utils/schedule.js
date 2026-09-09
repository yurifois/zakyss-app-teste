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
