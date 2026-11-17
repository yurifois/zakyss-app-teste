// Testes de autorização: uma conta não pode ver nem mexer no que é de outra.
//
// Roda com:  node --test server/tests/security.test.js
//
// Totalmente isolado: usa o repositório JSON numa pasta temporária, nunca o
// Supabase, e sem RESEND_API_KEY nenhum e-mail sai. O SUPABASE_URL vazio vem
// ANTES de qualquer import do app porque o dotenv não sobrescreve variável que
// já existe — é isso que impede o .env local (que aponta para produção) de
// ser carregado.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

process.env.SUPABASE_URL = ''
process.env.SUPABASE_ANON_KEY = ''
process.env.SUPABASE_SERVICE_ROLE_KEY = ''
process.env.RESEND_API_KEY = ''
process.env.JWT_SECRET = 'segredo-so-para-teste'
process.env.NODE_ENV = 'test'

let server, base, dataDir, tokens

const allDay = { open: '00:00', close: '23:59' }
const workingHours = Object.fromEntries(
    ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].map(d => [d, allDay])
)

const seed = {
    'establishments.json': [
        { id: 1, name: 'Salão A', plan: 'free', workingHours, services: [101], servicePreferences: {}, serviceImages: ['a.png'] },
        { id: 2, name: 'Salão B', plan: 'free', workingHours, services: [102], servicePreferences: {}, serviceImages: ['b.png'] },
    ],
    // admin 1 e cliente 1 têm o MESMO id de propósito (tabelas diferentes)
    'admins.json': [
        { id: 1, email: 'admin-a@teste.local', password: 'x', establishmentId: 1 },
        { id: 2, email: 'admin-b@teste.local', password: 'x', establishmentId: 2 },
    ],
    'users.json': [
        { id: 1, name: 'Cliente Um', email: 'c1@teste.local', password: 'x', phone: '11911111111' },
        { id: 2, name: 'Cliente Dois', email: 'c2@teste.local', password: 'x', phone: '11922222222' },
    ],
    'services.json': [
        { id: 100, name: 'Global', price: 10, duration: 30, categoryId: 'cabelo' },
        { id: 101, name: 'Do A', price: 50, duration: 30, categoryId: 'cabelo', establishmentId: 1 },
        { id: 102, name: 'Do B', price: 60, duration: 30, categoryId: 'cabelo', establishmentId: 2 },
    ],
    'employees.json': [
        { id: 11, name: 'Func A', establishmentId: 1, services: [101] },
        { id: 22, name: 'Func B', establishmentId: 2, services: [] },
    ],
    'appointments.json': [
        { id: 1, establishmentId: 1, userId: 1, services: [101], date: '2030-01-10', time: '10:00', status: 'confirmed',
          customerName: 'Cliente Um', customerPhone: '11911111111', customerEmail: 'c1@teste.local', notes: 'alergia X', totalPrice: 50, totalDuration: 30 },
        { id: 2, establishmentId: 2, userId: null, services: [102], date: '2030-01-11', time: '11:00', status: 'confirmed',
          customerName: 'Convidado', customerPhone: '11933333333', customerEmail: 'guest@teste.local', totalPrice: 60, totalDuration: 30 },
    ],
}

async function call(method, url, { token, body } = {}) {
    const res = await fetch(base + url, {
        method,
        headers: {
            ...(body !== undefined && { 'Content-Type': 'application/json' }),
            ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => null)
    return { status: res.status, json }
}

const readData = async (file) => JSON.parse(await fs.readFile(path.join(dataDir, file), 'utf-8'))

before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zakys-sec-test-'))
    process.env.JSON_DATA_DIR = dataDir
    for (const [file, rows] of Object.entries(seed)) {
        await fs.writeFile(path.join(dataDir, file), JSON.stringify(rows))
    }

    const express = (await import('express')).default
    const routes = (await import('../routes/index.js')).default
    const { errorHandler } = await import('../middleware/error.middleware.js')
    const { generateToken } = await import('../utils/auth.js')

    tokens = {
        adminA: generateToken({ id: 1, email: 'admin-a@teste.local', type: 'admin', establishmentId: 1 }),
        adminB: generateToken({ id: 2, email: 'admin-b@teste.local', type: 'admin', establishmentId: 2 }),
        cliente1: generateToken({ id: 1, email: 'c1@teste.local', type: 'customer' }),
        cliente2: generateToken({ id: 2, email: 'c2@teste.local', type: 'customer' }),
    }

    const app = express()
    app.use(express.json())
    app.use('/api', routes)
    app.use(errorHandler)
    await new Promise(resolve => { server = app.listen(0, resolve) })
    base = `http://127.0.0.1:${server.address().port}/api`
})

after(async () => {
    await new Promise(resolve => server.close(resolve))
    await fs.rm(dataDir, { recursive: true, force: true })
})

test('serviços: sem login não cria, não edita, não apaga', async () => {
    assert.equal((await call('POST', '/services', { body: { name: 'x', categoryId: 'c', price: 1, duration: 1, establishmentId: 1 } })).status, 401)
    assert.equal((await call('PUT', '/services/101', { body: { name: 'hack' } })).status, 401)
    assert.equal((await call('DELETE', '/services/101')).status, 401)
})

test('serviços: cliente comum não mexe; admin só no próprio salão; global ninguém', async () => {
    assert.equal((await call('POST', '/services', { token: tokens.cliente1, body: { name: 'x', categoryId: 'c', price: 1, duration: 1, establishmentId: 1 } })).status, 403)
    assert.equal((await call('POST', '/services', { token: tokens.adminA, body: { name: 'x', categoryId: 'c', price: 1, duration: 1, establishmentId: 2 } })).status, 403)
    assert.equal((await call('PUT', '/services/102', { token: tokens.adminA, body: { name: 'hack' } })).status, 403)
    assert.equal((await call('DELETE', '/services/102', { token: tokens.adminA })).status, 403)
    assert.equal((await call('PUT', '/services/100', { token: tokens.adminA, body: { name: 'hack' } })).status, 403)
    assert.equal((await call('DELETE', '/services/100', { token: tokens.adminA })).status, 403)

    // caminho legítimo continua funcionando
    const criado = await call('POST', '/services', { token: tokens.adminA, body: { name: 'Novo', categoryId: 'c', price: 30, duration: 20, establishmentId: 1 } })
    assert.equal(criado.status, 201)
    assert.equal(criado.json.data.establishmentId, 1)
    const editado = await call('PUT', '/services/101', { token: tokens.adminA, body: { name: 'Renomeado', establishmentId: 2 } })
    assert.equal(editado.status, 200)
    assert.equal(editado.json.data.establishmentId, 1, 'não pode transferir o serviço para outro salão')
    assert.equal((await call('DELETE', `/services/${criado.json.data.id}`, { token: tokens.adminA })).status, 200)
})

test('estabelecimento: só o dono edita, e plano/nota não mudam por aqui', async () => {
    assert.equal((await call('PUT', '/establishments/2', { token: tokens.adminA, body: { name: 'hack' } })).status, 403)
    assert.equal((await call('PUT', '/establishments/1', { token: tokens.cliente1, body: { name: 'hack' } })).status, 403)

    const r = await call('PUT', '/establishments/1', { token: tokens.adminA, body: { name: 'Salão A+', plan: 'premium', rating: 5, reviewCount: 999 } })
    assert.equal(r.status, 200)
    assert.equal(r.json.data.name, 'Salão A+')
    assert.equal(r.json.data.plan, 'free')
    assert.equal(r.json.data.reviewCount, undefined)
})

test('cadastro público de estabelecimento não escolhe id nem plano', async () => {
    const r = await call('POST', '/establishments', { body: { id: 1, name: 'Novo', plan: 'premium' } })
    assert.equal(r.status, 201)
    assert.notEqual(r.json.data.id, 1)
    assert.equal(r.json.data.plan, 'free')
})

test('funcionários: admin A não lista, cria, edita, apaga nem vê relatório do B', async () => {
    assert.equal((await call('GET', '/employees/2', { token: tokens.adminA })).status, 403)
    assert.equal((await call('GET', '/employees/1', { token: tokens.cliente1 })).status, 403)
    assert.equal((await call('POST', '/employees', { token: tokens.adminA, body: { establishmentId: 2, name: 'Intruso' } })).status, 403)
    assert.equal((await call('PUT', '/employees/22', { token: tokens.adminA, body: { name: 'hack' } })).status, 403)
    assert.equal((await call('DELETE', '/employees/22', { token: tokens.adminA })).status, 403)
    for (const url of ['/employees/2/audit-log', '/employees/2/report?month=1&year=2030', '/employees/2/detail-report?months=1&year=2030']) {
        assert.equal((await call('GET', url, { token: tokens.adminA })).status, 403, url)
    }
    assert.equal((await call('POST', '/employees/2/report/mark-paid', { token: tokens.adminA, body: { employeeId: 22, month: 1, year: 2030 } })).status, 403)
    assert.equal((await call('POST', '/employees/2/report/mark-pending', { token: tokens.adminA, body: { employeeId: 22, month: 1, year: 2030 } })).status, 403)

    const funcs = await readData('employees.json')
    assert.equal(funcs.find(f => f.id === 22).name, 'Func B', 'funcionário do B ficou intacto')

    // legítimos
    assert.equal((await call('GET', '/employees/1', { token: tokens.adminA })).status, 200)
    assert.equal((await call('GET', '/employees/2/public')).status, 200)
    assert.equal((await call('PUT', '/employees/11', { token: tokens.adminA, body: { name: 'Func A2' } })).status, 200)
})

test('analytics/financeiro: só o admin do próprio salão', async () => {
    assert.equal((await call('GET', '/analytics/2', { token: tokens.adminA })).status, 403)
    assert.equal((await call('GET', '/analytics/1', { token: tokens.cliente1 })).status, 403)
    assert.equal((await call('POST', '/analytics/2/manual-finance', { token: tokens.adminA, body: { date: '2030-01-01', value: 999, description: 'fake' } })).status, 403)
    assert.equal((await call('GET', '/analytics/1', { token: tokens.adminA })).status, 200)
})

test('uploads: ninguém troca foto/logo/imagem de outro', async () => {
    assert.equal((await call('POST', '/upload/logo/2', { token: tokens.adminA })).status, 403)
    assert.equal((await call('POST', '/upload/service-image/2', { token: tokens.adminA })).status, 403)
    assert.equal((await call('DELETE', '/upload/service-image/2/0', { token: tokens.adminA })).status, 403)
    assert.equal((await call('POST', '/upload/avatar/2', { token: tokens.cliente1 })).status, 403)
    assert.equal((await call('POST', '/upload/avatar/1', { token: tokens.adminA })).status, 403, 'admin com id igual não vira o cliente')
    const est2 = (await readData('establishments.json')).find(e => e.id === 2)
    assert.deepEqual(est2.serviceImages, ['b.png'])
})

test('/users: token de admin com o mesmo id não abre a conta do cliente', async () => {
    assert.equal((await call('GET', '/users/1', { token: tokens.adminA })).status, 403)
    assert.equal((await call('PUT', '/users/1', { token: tokens.adminA, body: { name: 'hack' } })).status, 403)
    assert.equal((await call('GET', '/users/1/appointments', { token: tokens.adminA })).status, 403)
    const me = await call('GET', '/users/1', { token: tokens.cliente1 })
    assert.equal(me.status, 200)
    assert.equal(me.json.data.password, undefined)
})

test('agendamento por id: sem dono, nada de nome/telefone/e-mail/observações', async () => {
    for (const token of [undefined, tokens.cliente2, tokens.adminB]) {
        const r = await call('GET', '/appointments/1', { token })
        assert.equal(r.status, 200)
        for (const campo of ['customerName', 'customerPhone', 'customerEmail', 'notes']) {
            assert.equal(r.json.data[campo], undefined, `${campo} vazou`)
        }
        // o que a tela de confirmação precisa continua lá
        assert.equal(r.json.data.date, '2030-01-10')
        assert.equal(r.json.data.status, 'confirmed')
        assert.ok(Array.isArray(r.json.data.servicesList))
    }
    assert.equal((await call('GET', '/appointments/1', { token: tokens.cliente1 })).json.data.customerPhone, '11911111111')
    assert.equal((await call('GET', '/appointments/1', { token: tokens.adminA })).json.data.customerPhone, '11911111111')
})

test('agendamento: admin A não reatribui profissionais no agendamento do B', async () => {
    assert.equal((await call('PATCH', '/appointments/2/assignments', { token: tokens.adminA, body: { assignments: [] } })).status, 403)
})

test('agendamento novo: convidado não pendura agendamento na conta de outra pessoa', async () => {
    const r = await call('POST', '/appointments', {
        body: { establishmentId: 1, userId: 2, services: [101], date: '2030-02-01', time: '14:00',
                customerName: 'Estranho', customerPhone: '11944444444', customerEmail: 'estranho@teste.local' },
    })
    assert.equal(r.status, 201, JSON.stringify(r.json))
    assert.equal(r.json.data.userId, null)

    // cliente logado: vale o id do token, não o do corpo
    const r2 = await call('POST', '/appointments', {
        token: tokens.cliente1,
        body: { establishmentId: 1, userId: 2, services: [101], date: '2030-02-02', time: '14:00',
                customerName: 'Cliente Um', customerPhone: '11911111111', customerEmail: 'c1@teste.local' },
    })
    assert.equal(r2.status, 201, JSON.stringify(r2.json))
    assert.equal(r2.json.data.userId, 1)
})

test('cancelamento sem conta: chutar telefone esbarra no limite', async () => {
    const statuses = []
    for (let i = 0; i < 6; i++) {
        statuses.push((await call('PATCH', '/appointments/2/cancel-guest', { body: { phone: `1190000000${i}` } })).status)
    }
    assert.deepEqual(statuses, [403, 403, 403, 403, 403, 429])
    const apt = (await readData('appointments.json')).find(a => a.id === 2)
    assert.equal(apt.status, 'confirmed')
})

test('login: tentativas seguidas na mesma conta esbarram no limite', async () => {
    const statuses = []
    for (let i = 0; i < 11; i++) {
        statuses.push((await call('POST', '/auth/login', { body: { email: 'c1@teste.local', password: 'errada' + i } })).status)
    }
    assert.deepEqual(statuses, [...Array(10).fill(401), 429])
})

test('recuperação de senha: o mesmo e-mail não pode ser bombardeado', async () => {
    const statuses = []
    for (let i = 0; i < 4; i++) {
        statuses.push((await call('POST', '/auth/forgot-password', { body: { email: 'ninguem@teste.local' } })).status)
    }
    assert.deepEqual(statuses, [200, 200, 200, 429])
})

test('senha: menos de 8 caracteres é recusada no cadastro', async () => {
    const curta = await call('POST', '/auth/register', { body: { name: 'N', email: 'novo@teste.local', password: '1234567', termsAccepted: true } })
    assert.equal(curta.status, 400)
    assert.match(curta.json.error, /8 caracteres/)
    const ok = await call('POST', '/auth/register', { body: { name: 'N', email: 'novo@teste.local', password: '12345678', termsAccepted: true } })
    assert.equal(ok.status, 201)
})

test('manter-me conectado: marcado dá sessão de 30 dias, desmarcado de 7', async () => {
    const email = 'lembrar@teste.local'
    assert.equal((await call('POST', '/auth/register', { body: { name: 'L', email, password: 'senhaforte1', termsAccepted: true } })).status, 201)

    const diasDeSessao = (token) => {
        const { iat, exp } = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
        return Math.round((exp - iat) / 86400)
    }
    const comLembrar = await call('POST', '/auth/login', { body: { email, password: 'senhaforte1', remember: true } })
    assert.equal(comLembrar.status, 200)
    assert.equal(diasDeSessao(comLembrar.json.data.token), 30)

    const semLembrar = await call('POST', '/auth/login', { body: { email, password: 'senhaforte1', remember: false } })
    assert.equal(diasDeSessao(semLembrar.json.data.token), 7)
})
