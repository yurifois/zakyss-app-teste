/**
 * Monta o retrato completo de um dia: todos os horários do expediente, o que
 * cada um está fazendo (livre, reservado, almoço, bloqueado) e quais serviços
 * cabem em cada um.
 *
 * Antes o app só devolvia a lista de horários livres, e o horário ocupado
 * simplesmente sumia da tela — o que confundia cliente e estabelecimento, que
 * não sabiam POR QUE não dava pra agendar. Aqui todo horário aparece, sempre
 * com um motivo legível.
 *
 * Função pura (recebe os dados prontos) pra poder ser testada sem banco.
 */

const OCCUPYING_STATUSES = ['pending', 'confirmed']

export const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
}

export const toTime = (minutes) =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

const overlaps = (startA, durA, startB, durB) => {
    const a = toMinutes(startA), b = a + durA
    const c = toMinutes(startB), d = c + (durB || 30)
    return a < d && b > c
}

const rangeOverlaps = (start, duration, range) => {
    const a = toMinutes(start), b = a + duration
    return a < toMinutes(range.end) && b > toMinutes(range.start)
}

// Texto curto cabe na caixinha do serviço; o longo vai no tooltip (title).
export const MOTIVOS = {
    fechado: 'Estabelecimento fechado neste horário',
    almoco: 'Pausa para almoço',
    reservado: 'Horário já reservado',
    semServico: 'Nenhum serviço cabe neste horário',
    expediente: 'Ultrapassa o fim do expediente',
    ultrapassa: 'Ultrapassa a agenda do estabelecimento',
    semProfissional: 'Nenhum profissional disponível',
    disponivel: null
}

export const MOTIVOS_LONGOS = {
    [MOTIVOS.fechado]: 'O estabelecimento bloqueou este horário na agenda.',
    [MOTIVOS.almoco]: 'Este horário cai na pausa para almoço do estabelecimento.',
    [MOTIVOS.reservado]: 'Este horário já está reservado por outro agendamento.',
    [MOTIVOS.expediente]: 'A duração deste serviço passa do fim do expediente deste dia.',
    [MOTIVOS.ultrapassa]: 'Não é possível agendar esse serviço nesse horário por ultrapassar a agenda do estabelecimento.',
    [MOTIVOS.semProfissional]: 'Nenhum profissional habilitado neste serviço está livre neste horário.',
    [MOTIVOS.semServico]: 'Nenhum serviço cadastrado cabe neste horário.'
}

export function buildDaySchedule({
    date,
    workingHours,
    scheduleException = null,
    appointments = [],
    employees = [],
    services = [],
    servicePreferences = {},
    slotStepMinutes = 60
}) {
    const weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const weekday = weekdayKeys[new Date(date + 'T12:00:00').getDay()]
    const hours = workingHours?.[weekday]

    if (scheduleException?.isClosed) {
        return { date, closed: true, closedReason: 'Fechado pelo estabelecimento nesta data', slots: [] }
    }
    if (!hours?.open || !hours?.close) {
        return { date, closed: true, closedReason: 'Sem expediente neste dia da semana', slots: [] }
    }

    const lunch = (hours.lunchBreak?.start && hours.lunchBreak?.end) ? hours.lunchBreak : null
    const blockedRanges = scheduleException?.blockedRanges?.filter(r => r?.start && r?.end) || []

    const active = appointments.filter(a => OCCUPYING_STATUSES.includes(a.status) && a.date === date)
    const isSolo = employees.length === 0
    const durationOf = (service) => servicePreferences?.[service.id]?.duration ?? service.duration ?? 30

    const openMin = toMinutes(hours.open)
    const closeMin = toMinutes(hours.close)
    const slots = []

    for (let m = openMin; m < closeMin; m += slotStepMinutes) {
        const time = toTime(m)

        // Serviço por serviço: o que cabe começando exatamente neste horário
        const serviceStatuses = services.map(service => {
            const duration = durationOf(service)
            const deny = (reason) => ({ id: service.id, available: false, reason })

            if (m + duration > closeMin) return deny(MOTIVOS.expediente)

            // O horário em si está livre, mas a duração invade algo adiante?
            // Esse caso merece mensagem própria: o cliente escolheu um horário
            // que aparece livre e precisa entender por que o serviço não cabe.
            const comecaEmLunch = lunch && time >= lunch.start && time < lunch.end
            const comecaBloqueado = blockedRanges.some(r => time >= r.start && time < r.end)

            if (lunch && rangeOverlaps(time, duration, lunch)) {
                return deny(comecaEmLunch ? MOTIVOS.almoco : MOTIVOS.ultrapassa)
            }
            if (blockedRanges.some(r => rangeOverlaps(time, duration, r))) {
                return deny(comecaBloqueado ? MOTIVOS.fechado : MOTIVOS.ultrapassa)
            }

            if (isSolo) {
                const comecaOcupado = active.some(apt => overlaps(time, slotStepMinutes, apt.time, apt.totalDuration))
                const conflita = active.some(apt => overlaps(time, duration, apt.time, apt.totalDuration))
                if (!conflita) return { id: service.id, available: true, reason: null }
                return deny(comecaOcupado ? MOTIVOS.reservado : MOTIVOS.ultrapassa)
            }

            const freeEmployees = employees.filter(emp => !active.some(apt => {
                const unassigned = !apt.assignments || apt.assignments.length === 0
                const assignedToEmp = !unassigned && apt.assignments.some(a => a.employeeId === emp.id)
                if (!unassigned && !assignedToEmp) return false
                return overlaps(time, duration, apt.time, apt.totalDuration)
            }))

            const canDo = freeEmployees.some(emp => (emp.services || []).includes(service.id))
            if (canDo) return { id: service.id, available: true, reason: null }

            // Ninguém habilitado no serviço é um motivo diferente de agenda cheia
            const anyoneQualified = employees.some(emp => (emp.services || []).includes(service.id))
            if (!anyoneQualified) return deny(MOTIVOS.semProfissional)

            // Havia profissional livre pra começar agora, mas a duração invade
            // um compromisso adiante → é "ultrapassa", não "horário reservado"
            const livreNoInicio = employees.some(emp => {
                if (!(emp.services || []).includes(service.id)) return false
                return !active.some(apt => {
                    const unassigned = !apt.assignments || apt.assignments.length === 0
                    const assignedToEmp = !unassigned && apt.assignments.some(a => a.employeeId === emp.id)
                    if (!unassigned && !assignedToEmp) return false
                    return overlaps(time, slotStepMinutes, apt.time, apt.totalDuration)
                })
            })
            return deny(livreNoInicio ? MOTIVOS.ultrapassa : MOTIVOS.reservado)
        })

        const availableCount = serviceStatuses.filter(s => s.available).length

        // Status do horário em si: o motivo predominante quando nada cabe
        let status = 'disponivel'
        let reason = null
        if (availableCount === 0) {
            const startsInLunch = lunch && time >= lunch.start && time < lunch.end
            const startsBlocked = blockedRanges.some(r => time >= r.start && time < r.end)
            const takenNow = active.some(apt => overlaps(time, slotStepMinutes, apt.time, apt.totalDuration))

            if (startsInLunch) { status = 'almoco'; reason = MOTIVOS.almoco }
            else if (startsBlocked) { status = 'fechado'; reason = MOTIVOS.fechado }
            else if (takenNow) { status = 'reservado'; reason = MOTIVOS.reservado }
            else { status = 'indisponivel'; reason = MOTIVOS.semServico }
        }

        slots.push({ time, status, reason, availableCount, services: serviceStatuses })
    }

    return { date, closed: false, closedReason: null, open: hours.open, close: hours.close, slots }
}
