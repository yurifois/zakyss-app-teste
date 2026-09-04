// Check das duas proteções de agenda. Roda com: node server/utils/scheduleGuards.test.js
import assert from 'node:assert/strict'

// Cópias das regras validadas (mesma lógica de appointments.routes.js e establishments.routes.js)
function isOutsideWorkingHours(establishment, date, time) {
    const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const hours = establishment.workingHours?.[dayOfWeek]
    if (!hours?.open || !hours?.close) return true
    return time < hours.open || time >= hours.close
}

const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
function findWorkingHoursConflicts(oldHours, newHours, appointments) {
    return appointments.filter(a => {
        const day = dayNames[new Date(a.date + 'T12:00:00').getDay()]
        const oldDay = oldHours[day]
        const newDay = newHours[day]
        const wasInside = oldDay?.open && a.time >= oldDay.open && a.time < oldDay.close
        if (!wasInside) return false
        if (!newDay?.open || !newDay?.close) return true
        return a.time < newDay.open || a.time >= newDay.close
    })
}

// 2026-09-03 é uma quinta-feira
const est = { workingHours: { thursday: { open: '09:00', close: '20:00' }, wednesday: null } }

// --- expediente na criação do agendamento ---
assert.equal(isOutsideWorkingHours(est, '2026-09-03', '09:00'), false, 'abertura entra')
assert.equal(isOutsideWorkingHours(est, '2026-09-03', '19:00'), false, 'dentro entra')
assert.equal(isOutsideWorkingHours(est, '2026-09-03', '20:00'), true, 'fechamento nao entra')
assert.equal(isOutsideWorkingHours(est, '2026-09-03', '08:00'), true, 'antes de abrir nao entra')
assert.equal(isOutsideWorkingHours(est, '2026-09-02', '10:00'), true, 'dia fechado na semana nao entra')

// --- fechar/encurtar expediente com agendamento existente ---
const apts = [{ date: '2026-09-03', time: '09:00', customerName: 'Tania' }]
const aberto = { thursday: { open: '09:00', close: '20:00' } }

assert.equal(findWorkingHoursConflicts(aberto, { thursday: null }, apts).length, 1, 'fechar o dia deve conflitar')
assert.equal(findWorkingHoursConflicts(aberto, { thursday: { open: '14:00', close: '20:00' } }, apts).length, 1, 'encurtar por cima deve conflitar')
assert.equal(findWorkingHoursConflicts(aberto, { thursday: { open: '08:00', close: '22:00' } }, apts).length, 0, 'ampliar nao conflita')
assert.equal(findWorkingHoursConflicts(aberto, aberto, apts).length, 0, 'sem mudanca nao conflita')
assert.equal(
    findWorkingHoursConflicts({ thursday: { open: '14:00', close: '20:00' } }, { thursday: null }, apts).length,
    0,
    'agendamento que ja estava fora do expediente antigo nao bloqueia a mudanca'
)

console.log('✅ scheduleGuards: todos os casos passaram')
