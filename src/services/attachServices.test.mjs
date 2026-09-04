// Check do agrupamento de serviços. Roda com: node src/services/attachServices.test.mjs
import assert from 'node:assert/strict'

let calls = 0
const catalog = [{ id: 1, name: 'Corte' }, { id: 2, name: 'Escova' }, { id: 3, name: 'Coloração' }]
const getServicesByIds = async (ids) => { calls++; return catalog.filter(s => ids.includes(s.id)) }

async function attachServicesToAppointments(appointments) {
    const ids = [...new Set(appointments.flatMap(a => a.services || []))]
    if (ids.length === 0) return appointments.map(a => ({ ...a, servicesList: [] }))
    const services = await getServicesByIds(ids).catch(() => [])
    const byId = new Map(services.map(s => [s.id, s]))
    return appointments.map(a => ({
        ...a,
        servicesList: (a.services || []).map(id => byId.get(id)).filter(Boolean)
    }))
}

const apts = [
    { id: 10, services: [1, 2] },
    { id: 11, services: [1] },
    { id: 12, services: [3] },
    { id: 13, services: [] },
    { id: 14, services: [99] } // serviço removido do catálogo
]

const out = await attachServicesToAppointments(apts)

assert.equal(calls, 1, 'deve fazer UMA requisição só, não uma por agendamento')
assert.deepEqual(out[0].servicesList.map(s => s.name), ['Corte', 'Escova'])
assert.deepEqual(out[1].servicesList.map(s => s.name), ['Corte'])
assert.deepEqual(out[2].servicesList.map(s => s.name), ['Coloração'])
assert.deepEqual(out[3].servicesList, [], 'agendamento sem serviço fica com lista vazia')
assert.deepEqual(out[4].servicesList, [], 'serviço removido não quebra, some da lista')

calls = 0
assert.deepEqual((await attachServicesToAppointments([])).length, 0)
assert.equal(calls, 0, 'lista vazia não faz requisição nenhuma')

console.log('✅ attachServicesToAppointments: todos os casos passaram')
