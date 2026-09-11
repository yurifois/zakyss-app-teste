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

// Horário ocupado só vaga por cancelamento ou falta do cliente. Concluído
// continua ocupando: o atendimento aconteceu ali. Esta é a mesma regra da
// criação e da edição do agendamento — se a tela usasse uma regra mais
// frouxa, ela ofereceria horário que o servidor recusa na hora de salvar.
export const FUSO_PADRAO = 'America/Sao_Paulo'

/**
 * Data e hora de agora no fuso do estabelecimento, em texto comparável.
 *
 * Não usa new Date() direto porque o servidor roda em UTC no Render: "15:00"
 * seria lido como 15:00 UTC, ou seja, meio-dia em Brasília — três horas de
 * erro justamente na conta que decide se o horário já passou.
 */
export function agoraNoFuso(tz = FUSO_PADRAO) {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date())
    const p = Object.fromEntries(partes.map(x => [x.type, x.value]))
    return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` }
}

const FREEING_STATUSES = ['cancelled', 'no_show']
const occupies = (status) => !FREEING_STATUSES.includes(status)

export const toMinutes = (time) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
}

export const toTime = (minutes) =>
    `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

// Exportada: a criação e a edição do agendamento precisam da MESMA conta
// que desenha a tela. Cópias separadas já divergiram antes.
export const overlaps = (startA, durA, startB, durB) => {
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
    semHorario: 'Sem horário livre neste dia',
    passou: 'Horário já passou',
    disponivel: null
}

export const MOTIVOS_LONGOS = {
    [MOTIVOS.fechado]: 'O estabelecimento bloqueou este horário na agenda.',
    [MOTIVOS.almoco]: 'Este horário cai na pausa para almoço do estabelecimento.',
    [MOTIVOS.reservado]: 'Este horário já está reservado por outro agendamento.',
    [MOTIVOS.expediente]: 'A duração deste serviço passa do fim do expediente deste dia.',
    [MOTIVOS.ultrapassa]: 'Não é possível agendar esse serviço nesse horário por ultrapassar a agenda do estabelecimento.',
    [MOTIVOS.semProfissional]: 'Nenhum profissional habilitado neste serviço está livre neste horário.',
    [MOTIVOS.semServico]: 'Nenhum serviço cadastrado cabe neste horário.',
    [MOTIVOS.semHorario]: 'Não sobrou nenhum horário neste dia que comporte a duração deste serviço.',
    [MOTIVOS.passou]: 'Este horário já passou. Escolha um horário mais tarde ou outro dia.'
}

export function buildDaySchedule({
    date,
    workingHours,
    scheduleException = null,
    appointments = [],
    employees = [],
    services = [],
    servicePreferences = {},
    comboServiceIds = [],
    now = agoraNoFuso(),
    slotStepMinutes = 60
}) {
    const weekdayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const weekday = weekdayKeys[new Date(date + 'T12:00:00').getDay()]
    const hours = workingHours?.[weekday]

    if (scheduleException?.isClosed) {
        return { date, closed: true, closedReason: 'Fechado pelo estabelecimento nesta data', slots: [], resumoServicos: [] }
    }
    if (!hours?.open || !hours?.close) {
        return { date, closed: true, closedReason: 'Sem expediente neste dia da semana', slots: [], resumoServicos: [] }
    }

    const lunch = (hours.lunchBreak?.start && hours.lunchBreak?.end) ? hours.lunchBreak : null
    const blockedRanges = scheduleException?.blockedRanges?.filter(r => r?.start && r?.end) || []

    const active = appointments.filter(a => occupies(a.status) && a.date === date)
    const isSolo = employees.length === 0
    const durationOf = (service) => servicePreferences?.[service.id]?.duration ?? service.duration ?? 30

    const openMin = toMinutes(hours.open)
    const closeMin = toMinutes(hours.close)
    const slots = []

    // Só o dia de hoje tem horário vencido; dias futuros estão todos à frente
    const jaPassou = (time) => !!now && date === now.date && time <= now.time

    const livresPara = (time, duracao) => employees.filter(emp => !active.some(apt => {
        const semDono = !apt.assignments || apt.assignments.length === 0
        const desteEmp = !semDono && apt.assignments.some(a => a.employeeId === emp.id)
        if (!semDono && !desteEmp) return false
        return overlaps(time, duracao, apt.time, apt.totalDuration)
    }))

    const habilitado = (lista, serviceId) => lista.some(emp => (emp.services || []).includes(serviceId))

    /**
     * Cabe começar `serviceIds` às `time`, ocupando `duration` minutos?
     *
     * Serve tanto para um serviço quanto para vários somados — é a mesma
     * pergunta, e o cliente pode escolher mais de um. A regra dos profissionais
     * é a mesma que a criação do agendamento aplica no servidor: alguém livre
     * pelo período inteiro e habilitado em cada serviço pedido.
     */
    const avaliar = (m, time, duration, serviceIds) => {
        const deny = (reason) => ({ available: false, reason })
        const ok = { available: true, reason: null }

        // Horário que já passou não é agendável, nem que a agenda esteja vazia
        if (jaPassou(time)) return deny(MOTIVOS.passou)

        if (m + duration > closeMin) return deny(MOTIVOS.expediente)

        // Começar EM cima do obstáculo e esbarrar nele mais adiante são coisas
        // diferentes: a segunda precisa dizer que o serviço é que não coube.
        const comecaEmLunch = lunch && time >= lunch.start && time < lunch.end
        const comecaBloqueado = blockedRanges.some(r => time >= r.start && time < r.end)

        if (lunch && rangeOverlaps(time, duration, lunch)) {
            return deny(comecaEmLunch ? MOTIVOS.almoco : MOTIVOS.ultrapassa)
        }
        if (blockedRanges.some(r => rangeOverlaps(time, duration, r))) {
            return deny(comecaBloqueado ? MOTIVOS.fechado : MOTIVOS.ultrapassa)
        }

        if (isSolo) {
            if (!active.some(apt => overlaps(time, duration, apt.time, apt.totalDuration))) return ok
            const comecaOcupado = active.some(apt => overlaps(time, slotStepMinutes, apt.time, apt.totalDuration))
            return deny(comecaOcupado ? MOTIVOS.reservado : MOTIVOS.ultrapassa)
        }

        const livres = livresPara(time, duration)
        if (serviceIds.every(id => habilitado(livres, id))) return ok

        // Ninguém habilitado no serviço é um motivo diferente de agenda cheia
        if (serviceIds.some(id => !habilitado(employees, id))) return deny(MOTIVOS.semProfissional)

        // Havia gente livre pra começar agora, mas a duração invade um
        // compromisso adiante → "ultrapassa", não "horário reservado"
        const noInicio = livresPara(time, slotStepMinutes)
        return deny(serviceIds.every(id => habilitado(noInicio, id)) ? MOTIVOS.ultrapassa : MOTIVOS.reservado)
    }

    const comboDuration = services
        .filter(sv => comboServiceIds.includes(sv.id))
        .reduce((soma, sv) => soma + durationOf(sv), 0)

    for (let m = openMin; m < closeMin; m += slotStepMinutes) {
        const time = toTime(m)

        // Serviço por serviço: o que cabe começando exatamente neste horário
        const serviceStatuses = services.map(service => ({
            id: service.id,
            ...avaliar(m, time, durationOf(service), [service.id])
        }))

        // E a combinação que o cliente escolheu, somando as durações
        const combo = comboServiceIds.length > 0
            ? avaliar(m, time, comboDuration, comboServiceIds)
            : null

        const availableCount = serviceStatuses.filter(s => s.available).length

        // Status do horário em si: o motivo predominante quando nada cabe
        let status = 'disponivel'
        let reason = null
        if (availableCount === 0) {
            const startsInLunch = lunch && time >= lunch.start && time < lunch.end
            const startsBlocked = blockedRanges.some(r => time >= r.start && time < r.end)
            const takenNow = active.some(apt => overlaps(time, slotStepMinutes, apt.time, apt.totalDuration))

            if (jaPassou(time)) { status = 'passou'; reason = MOTIVOS.passou }
            else if (startsInLunch) { status = 'almoco'; reason = MOTIVOS.almoco }
            else if (startsBlocked) { status = 'fechado'; reason = MOTIVOS.fechado }
            else if (takenNow) { status = 'reservado'; reason = MOTIVOS.reservado }
            else { status = 'indisponivel'; reason = MOTIVOS.semServico }
        }

        slots.push({ time, status, reason, availableCount, combo, services: serviceStatuses })
    }

    // Para a etapa "escolha o serviço": só pode ser escolhido o serviço que
    // tem pelo menos um horário no dia capaz de comportá-lo. Sem isso o
    // cliente escolhe primeiro e descobre depois que não havia horário.
    const resumoServicos = services.map(service => {
        const disponiveis = slots.filter(s => s.services.find(x => x.id === service.id)?.available).length
        if (disponiveis > 0) {
            return { id: service.id, available: true, reason: null, slotsDisponiveis: disponiveis }
        }
        // Quando o dia inteiro dá o mesmo motivo (ninguém habilitado, por
        // exemplo), ele explica melhor do que "sem horário livre".
        const motivos = slots.map(s => s.services.find(x => x.id === service.id)?.reason).filter(Boolean)
        const mesmoMotivo = motivos.length > 0 && motivos.every(r => r === motivos[0])
        return {
            id: service.id,
            available: false,
            reason: mesmoMotivo ? motivos[0] : MOTIVOS.semHorario,
            slotsDisponiveis: 0
        }
    })

    return { date, closed: false, closedReason: null, open: hours.open, close: hours.close, slots, resumoServicos }
}
