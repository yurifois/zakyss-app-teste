// Check do motor de agenda do dia. Roda com: node server/utils/daySchedule.test.js
import assert from 'node:assert/strict'
import { buildDaySchedule, MOTIVOS, MOTIVOS_LONGOS } from './daySchedule.js'

// 2026-09-10 é uma quinta-feira
const DATE = '2026-09-10'
const workingHours = { thursday: { open: '09:00', close: '13:00', lunchBreak: { start: '12:00', end: '12:55' } } }
const services = [
    { id: 1, name: 'Corte', duration: 60 },
    { id: 4, name: 'Coloração', duration: 120 }
]
const employees = [{ id: 9, name: 'Isaac', services: [1, 4] }]
const at = (time) => s.slots.find(x => x.time === time)

// --- dia normal, agenda vazia ---
let s = buildDaySchedule({ date: DATE, workingHours, services, employees })
assert.equal(s.closed, false)
assert.deepEqual(s.slots.map(x => x.time), ['09:00', '10:00', '11:00', '12:00'], 'todos os horários aparecem, inclusive almoço')
assert.equal(at('09:00').status, 'disponivel')
assert.equal(at('12:00').status, 'almoco', 'almoço aparece com motivo, não some')
assert.equal(at('12:00').reason, MOTIVOS.almoco)

// serviço longo não cabe perto do fim do expediente
assert.equal(at('09:00').services.find(x => x.id === 4).available, true, 'coloração 9h cabe (9-11)')
assert.equal(at('11:00').services.find(x => x.id === 4).available, false, 'coloração 11h não cabe (invade almoço)')
assert.equal(
    at('11:00').services.find(x => x.id === 4).reason, MOTIVOS.ultrapassa,
    'começou em horário livre e a duração invadiu o almoço => "ultrapassa a agenda", não "pausa para almoço"'
)
assert.equal(at('12:00').services.find(x => x.id === 1).reason, MOTIVOS.almoco, 'começar DENTRO do almoço continua sendo "pausa para almoço"')
assert.equal(at('11:00').services.find(x => x.id === 1).available, true, 'corte de 1h às 11h cabe')

// --- com agendamento existente ---
s = buildDaySchedule({
    date: DATE, workingHours, services, employees,
    appointments: [{ date: DATE, time: '10:00', totalDuration: 60, status: 'confirmed', assignments: [{ serviceId: 1, employeeId: 9 }] }]
})
assert.equal(at('10:00').status, 'reservado', 'horário ocupado aparece como reservado')
assert.equal(at('10:00').reason, MOTIVOS.reservado)
assert.equal(at('09:00').services.find(x => x.id === 1).available, true, 'corte às 9h ainda cabe antes do agendamento')
assert.equal(at('09:00').services.find(x => x.id === 4).available, false, 'coloração às 9h não cabe mais (bateria no das 10h)')
assert.equal(
    at('09:00').services.find(x => x.id === 4).reason, MOTIVOS.ultrapassa,
    '9h está livre; é a duração que bate no agendamento das 10h => "ultrapassa a agenda"'
)
assert.equal(at('10:00').services.find(x => x.id === 1).reason, MOTIVOS.reservado, 'já começar em cima do agendamento continua "horário já reservado"')

// mensagem longa (tooltip) precisa existir pra todo motivo curto usado
for (const motivo of Object.values(MOTIVOS)) {
    if (motivo) assert.ok(MOTIVOS_LONGOS[motivo], `falta texto longo para: ${motivo}`)
}
assert.match(MOTIVOS_LONGOS[MOTIVOS.ultrapassa], /ultrapassar a agenda do estabelecimento/)

// caber na caixinha: motivo curto não pode ser um textão
for (const motivo of Object.values(MOTIVOS)) {
    if (motivo) assert.ok(motivo.length <= 40, `motivo curto demais longo (${motivo.length}): ${motivo}`)
}

// --- dia fechado por exceção ---
s = buildDaySchedule({ date: DATE, workingHours, services, employees, scheduleException: { isClosed: true } })
assert.equal(s.closed, true)
assert.match(s.closedReason, /Fechado pelo estabelecimento/)

// --- horário bloqueado pelo estabelecimento ---
s = buildDaySchedule({
    date: DATE, workingHours, services, employees,
    scheduleException: { blockedRanges: [{ start: '10:00', end: '11:00' }] }
})
assert.equal(at('10:00').status, 'fechado')
assert.equal(at('10:00').reason, MOTIVOS.fechado)
// corte de 1h às 9h termina 10:00 exatamente quando o bloqueio começa: não conflita
assert.equal(at('09:00').services.find(x => x.id === 1).available, true, 'encostar no limite não é conflito')
// coloração de 2h às 9h iria até 11:00, invadindo o bloqueio
assert.equal(
    at('09:00').services.find(x => x.id === 4).reason, MOTIVOS.ultrapassa,
    'duração que invade bloqueio adiante => "ultrapassa a agenda"'
)

// --- funcionário não habilitado no serviço ---
s = buildDaySchedule({
    date: DATE, workingHours, services,
    employees: [{ id: 9, name: 'Isaac', services: [1] }] // não faz coloração
})
assert.equal(at('09:00').services.find(x => x.id === 4).reason, MOTIVOS.semProfissional)

// --- sem expediente no dia da semana ---
s = buildDaySchedule({ date: DATE, workingHours: { thursday: null }, services, employees })
assert.equal(s.closed, true)
assert.match(s.closedReason, /Sem expediente/)

// --- o que libera um horário ocupado ---
// Regra do negócio: só cancelamento ou falta liberam. Concluído continua
// ocupando. A criação e a edição do agendamento usam exatamente essa regra;
// se aqui fosse diferente, a tela ofereceria horário que o servidor recusa.
const ocupaAs10 = (status) => buildDaySchedule({
    date: DATE, workingHours, services, employees,
    appointments: [{ date: DATE, time: '10:00', totalDuration: 60, status, assignments: [{ employeeId: 9 }] }]
}).slots.find(x => x.time === '10:00').status === 'reservado'

assert.equal(ocupaAs10('pending'), true, 'pendente ocupa')
assert.equal(ocupaAs10('confirmed'), true, 'confirmado ocupa')
assert.equal(ocupaAs10('completed'), true, 'concluído continua ocupando')
assert.equal(ocupaAs10('cancelled'), false, 'cancelado libera')
assert.equal(ocupaAs10('no_show'), false, 'falta libera')

// --- abertura em hora quebrada ---
// O motor antigo da dashboard pulava pra próxima hora redonda (09:30 => 10:00)
// e o estabelecimento perdia a primeira meia hora do expediente. Aqui a grade
// começa na abertura, igual ao que o cliente enxerga.
s = buildDaySchedule({
    date: DATE,
    workingHours: { thursday: { open: '09:30', close: '12:30' } },
    services, employees
})
assert.deepEqual(s.slots.map(x => x.time), ['09:30', '10:30', '11:30'], 'grade começa na abertura real, não na hora redonda seguinte')

console.log('✅ daySchedule: todos os casos passaram')
