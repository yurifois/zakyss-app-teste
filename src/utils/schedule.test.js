// Check dos utilitários de agenda. Roda com: node src/utils/schedule.test.js
import assert from 'node:assert/strict'
import { getClosedWeekdays, toDateString, WEEKDAY_KEYS } from './schedule.js'

// --- dias fechados ---
assert.deepEqual(getClosedWeekdays(null), [], 'dado ausente nunca vira "tudo fechado"')
assert.deepEqual(getClosedWeekdays({}), [], 'objeto vazio nunca vira "tudo fechado"')
assert.deepEqual(
    getClosedWeekdays({ sunday: null, monday: { open: '09:00', close: '18:00' } }),
    [0, 2, 3, 4, 5, 6],
    'só o dia com expediente fica aberto'
)
assert.equal(WEEKDAY_KEYS.length, 7)

// --- data em texto ---
// O bug clássico: toISOString() converte para UTC e, em fuso negativo, joga a
// data para o dia seguinte. No Brasil isso acontece a partir das 21h.
const noite = new Date(2026, 8, 10, 23, 30) // 10/set/2026, 23h30 local
assert.equal(toDateString(noite), '2026-09-10', 'usa o dia local, não o dia em UTC')
assert.equal(noite.toISOString().slice(0, 10), '2026-09-11', 'confirma que toISOString erraria o dia aqui')

assert.equal(toDateString(new Date(2026, 0, 5)), '2026-01-05', 'mês e dia com zero à esquerda')
assert.equal(toDateString('2026-09-10'), '2026-09-10', 'texto passa direto')
assert.equal(toDateString('2026-09-10T12:00:00.000Z'), '2026-09-10', 'corta a hora do texto ISO')
assert.equal(toDateString(null), null)

console.log('✅ schedule: todos os casos passaram')
