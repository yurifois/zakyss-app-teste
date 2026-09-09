// Check da guarda que evita "dado ausente = tudo fechado".
// Roda com: node src/utils/schedule.test.mjs
import assert from 'node:assert/strict'
import { getClosedWeekdays } from './schedule.js'

// expediente real do estabelecimento (só domingo fechado)
const real = {
    sunday: null,
    monday: { open: '18:00', close: '20:00' },
    tuesday: { open: '09:00', close: '20:00' },
    wednesday: { open: '09:00', close: '20:00' },
    thursday: { open: '09:00', close: '20:00' },
    friday: { open: '09:00', close: '20:00' },
    saturday: { open: '09:00', close: '19:00' }
}

assert.deepEqual(getClosedWeekdays(real), [0], 'só domingo fechado')
assert.deepEqual(getClosedWeekdays({}), [], 'objeto vazio não pode fechar nada')
assert.deepEqual(getClosedWeekdays(null), [], 'null não pode fechar nada')
assert.deepEqual(getClosedWeekdays(undefined), [], 'undefined não pode fechar nada')
assert.deepEqual(
    getClosedWeekdays({ ...real, saturday: null }),
    [0, 6],
    'domingo e sábado fechados'
)

console.log('✅ getClosedWeekdays: todos os casos passaram')
