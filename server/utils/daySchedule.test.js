// Check do motor de agenda do dia. Roda com: node server/utils/daySchedule.test.js
import assert from 'node:assert/strict'
import { buildDaySchedule, MOTIVOS } from './daySchedule.js'

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
assert.equal(at('11:00').services.find(x => x.id === 4).reason, MOTIVOS.almoco, 'e o motivo é o almoço, não some da tela')
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
assert.equal(at('09:00').services.find(x => x.id === 4).reason, MOTIVOS.reservado)

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

console.log('✅ daySchedule: todos os casos passaram')
