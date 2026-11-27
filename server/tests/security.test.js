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

// Gera o mesmo link que iria por e-mail e "clica" nele.
let linkDeConfirmacao
async function confirmarEmail(file, email, kind) {
    const conta = (await readData(file)).find(c => c.email === email)
    return call('POST', '/auth/verify-email', { body: { token: linkDeConfirmacao(conta, kind) } })
}

before(async () => {
    dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'zakys-sec-test-'))
    process.env.JSON_DATA_DIR = dataDir
    for (const [file, rows] of Object.entries(seed)) {
        await fs.writeFile(path.join(dataDir, file), JSON.stringify(rows))
    }

    const express = (await import('express')).default
    const routes = (await import('../routes/index.js')).default
    const { errorHandler } = await import('../middleware/error.middleware.js')
    const { generateToken, generateEmailVerificationToken } = await import('../utils/auth.js')
    linkDeConfirmacao = generateEmailVerificationToken

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

test('agendamento com login antigo (de antes da manutenção) é recusado, não vira visitante', async () => {
    const jwt = (await import('jsonwebtoken')).default
    const tokenAntigo = jwt.sign({ id: 1, email: 'c1@teste.local', type: 'customer' }, 'segredo-de-antes-da-troca')
    const r = await call('POST', '/appointments', {
        token: tokenAntigo,
        body: { establishmentId: 1, services: [101], date: '2030-03-01', time: '15:00',
                customerName: 'Cliente Um', customerPhone: '11911111111', customerEmail: 'c1@teste.local' },
    })
    assert.equal(r.status, 401)
    assert.equal(r.json.code, 'SESSION_INVALID')
    assert.equal((await readData('appointments.json')).filter(a => a.date === '2030-03-01').length, 0, 'nada foi agendado')
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
    assert.equal((await confirmarEmail('users.json', email, 'customer')).status, 200)

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

test('confirmação de e-mail: conta nova só entra depois de clicar no link', async () => {
    const email = 'nova@teste.local'
    const cad = await call('POST', '/auth/register', { body: { name: 'Nova', email, password: 'senhaforte1', termsAccepted: true } })
    assert.equal(cad.status, 201)
    assert.equal(cad.json.data.verificationRequired, true)
    assert.equal(cad.json.data.token, undefined, 'cadastro não devolve sessão')

    const antes = await call('POST', '/auth/login', { body: { email, password: 'senhaforte1' } })
    assert.equal(antes.status, 403)
    assert.equal(antes.json.code, 'EMAIL_NOT_VERIFIED')

    const conf = await confirmarEmail('users.json', email, 'customer')
    assert.equal(conf.status, 200)
    assert.ok(conf.json.data.token, 'clicar no link já entra')
    assert.equal(conf.json.data.user.password, undefined)

    assert.equal((await call('POST', '/auth/login', { body: { email, password: 'senhaforte1' } })).status, 200)
    // conta confirmada não pode ser recadastrada por cima
    assert.equal((await call('POST', '/auth/register', { body: { name: 'X', email, password: 'outrasenha1', termsAccepted: true } })).status, 400)
})

test('confirmação de e-mail: impostor não aproveita o clique do dono', async () => {
    const email = 'vitima@teste.local'
    await call('POST', '/auth/register', { body: { name: 'Impostor', email, password: 'senhaimpostor', termsAccepted: true } })
    const contaImpostor = (await readData('users.json')).find(u => u.email === email)
    const linkDoImpostor = linkDeConfirmacao(contaImpostor, 'customer')

    // o dono real se cadastra por cima da conta nunca confirmada
    assert.equal((await call('POST', '/auth/register', { body: { name: 'Dono', email, password: 'senhadodono1', termsAccepted: true } })).status, 201)
    assert.equal((await call('POST', '/auth/verify-email', { body: { token: linkDoImpostor } })).status, 400, 'link antigo morreu')
    assert.equal((await confirmarEmail('users.json', email, 'customer')).status, 200)

    assert.equal((await call('POST', '/auth/login', { body: { email, password: 'senhaimpostor' } })).status, 401)
    assert.equal((await call('POST', '/auth/login', { body: { email, password: 'senhadodono1' } })).status, 200)
    assert.equal((await readData('users.json')).find(u => u.email === email).name, 'Dono')
})

test('confirmação de e-mail: contas antigas seguem entrando; link não vale como login', async () => {
    const { hashPassword, generateEmailVerificationToken } = await import('../utils/auth.js')
    const users = await readData('users.json')
    const antiga = { id: 900, name: 'Antiga', email: 'antiga@teste.local', password: await hashPassword('senhaantiga1') }
    await fs.writeFile(path.join(dataDir, 'users.json'), JSON.stringify([...users, antiga]))
    assert.equal((await call('POST', '/auth/login', { body: { email: antiga.email, password: 'senhaantiga1' } })).status, 200)

    const link = generateEmailVerificationToken(antiga, 'customer')
    assert.equal((await call('GET', '/auth/me', { token: link })).status, 401, 'token do link não abre sessão')
})

test('confirmação de e-mail: reenviar responde igual exista a conta ou não', async () => {
    const a = await call('POST', '/auth/resend-verification', { body: { email: 'pendente@teste.local' } })
    const b = await call('POST', '/auth/resend-verification', { body: { email: 'naoexiste@teste.local' } })
    assert.equal(a.status, 200)
    assert.deepEqual(a.json, b.json)
})

test('confirmação de e-mail: redefinir a senha também confirma (o link chegou na caixa do dono)', async () => {
    const { generateResetToken } = await import('../utils/auth.js')
    const email = 'esqueceu@teste.local'
    await call('POST', '/auth/register', { body: { name: 'E', email, password: 'senhaforte1', termsAccepted: true } })
    const conta = (await readData('users.json')).find(u => u.email === email)
    const r = await call('POST', '/auth/reset-password', { body: { token: generateResetToken(conta, 'customer'), newPassword: 'senhanova123' } })
    assert.equal(r.status, 200)
    assert.equal((await call('POST', '/auth/login', { body: { email, password: 'senhanova123' } })).status, 200)
})

test('confirmação de e-mail: parceiro novo também confirma antes de abrir o painel', async () => {
    const est = await call('POST', '/establishments', { body: { name: 'Salão Novo' } })
    const email = 'parceiro@teste.local'
    const cad = await call('POST', '/auth/admin/register', { body: { name: 'P', email, password: 'senhaforte1', establishmentId: est.json.data.id, termsAccepted: true } })
    assert.equal(cad.status, 201)
    assert.equal(cad.json.data.token, undefined)
    assert.equal((await call('POST', '/auth/admin/login', { body: { email, password: 'senhaforte1' } })).json.code, 'EMAIL_NOT_VERIFIED')
    const conf = await confirmarEmail('admins.json', email, 'admin')
    assert.equal(conf.status, 200)
    assert.equal(conf.json.data.admin.establishmentId, est.json.data.id)
    assert.equal((await call('POST', '/auth/admin/login', { body: { email, password: 'senhaforte1' } })).status, 200)
})

test('login que não deu certo diz o motivo: e-mail sem conta, só agendamento, senha errada, login do tipo errado', async () => {
    const tentar = async (url, email) => {
        const r = await call('POST', url, { body: { email, password: 'qualquercoisa1' } })
        return { status: r.status, code: r.json?.code, error: r.json?.error }
    }

    let r = await tentar('/auth/login', 'ninguem@teste.local')
    assert.equal(r.status, 401)
    assert.equal(r.code, 'EMAIL_NOT_FOUND')
    assert.match(r.error, /Não encontramos nenhuma conta com este e-mail.*outro e-mail/)

    // agendou como convidado (agendamento 2), mas nunca criou conta
    r = await tentar('/auth/login', 'Guest@Teste.local')
    assert.equal(r.code, 'NO_ACCOUNT_HAS_BOOKINGS')
    assert.match(r.error, /já tem agendamento com este e-mail/)

    r = await tentar('/auth/login', 'c2@teste.local')
    assert.equal(r.code, 'WRONG_PASSWORD')
    assert.match(r.error, /Senha incorreta/)

    r = await tentar('/auth/login', 'admin-b@teste.local')
    assert.equal(r.code, 'ACCOUNT_IS_PARTNER')

    r = await tentar('/auth/admin/login', 'ninguem@teste.local')
    assert.equal(r.code, 'EMAIL_NOT_FOUND')
    assert.match(r.error, /nenhum estabelecimento com este e-mail/)

    r = await tentar('/auth/admin/login', 'c2@teste.local')
    assert.equal(r.code, 'ACCOUNT_IS_CUSTOMER')

    r = await tentar('/auth/admin/login', 'admin-b@teste.local')
    assert.equal(r.code, 'WRONG_PASSWORD')

    // nenhuma das respostas entrega dado da conta
    for (const email of ['ninguem@teste.local', 'guest@teste.local', 'c2@teste.local']) {
        const resp = await call('POST', '/auth/login', { body: { email, password: 'qualquercoisa1' } })
        assert.equal(resp.json.token, undefined)
        assert.equal(resp.json.user, undefined)
    }
})

// Coloca agendamentos extras direto no arquivo (o repositório JSON relê a cada chamada).
async function addAppointments(rows) {
    const atual = await readData('appointments.json')
    await fs.writeFile(path.join(dataDir, 'appointments.json'), JSON.stringify([...atual, ...rows]))
}

test('avaliação: grava a nota, recalcula a nota do salão e aparece nas avaliações públicas', async () => {
    const base = { establishmentId: 2, services: [102], time: '10:00', totalPrice: 60, totalDuration: 30 }
    await addAppointments([
        { ...base, id: 900, userId: 2, date: '2026-01-10', status: 'completed', customerName: 'Cliente Dois Silva' },
        { ...base, id: 901, userId: 2, date: '2026-01-11', status: 'completed', customerName: 'Cliente Dois Silva' },
        { ...base, id: 902, userId: 2, date: '2030-02-01', status: 'confirmed', customerName: 'Cliente Dois Silva' },
    ])

    // só o dono, só concluído, só de 1 a 5
    assert.equal((await call('PATCH', '/appointments/900/rate', { token: tokens.cliente1, body: { rating: 5 } })).status, 403)
    assert.equal((await call('PATCH', '/appointments/900/rate', { token: tokens.adminB, body: { rating: 5 } })).status, 403)
    assert.equal((await call('PATCH', '/appointments/902/rate', { token: tokens.cliente2, body: { rating: 5 } })).status, 400)
    assert.equal((await call('PATCH', '/appointments/900/rate', { token: tokens.cliente2, body: { rating: 6 } })).status, 400)

    const r1 = await call('PATCH', '/appointments/900/rate', { token: tokens.cliente2, body: { rating: 4, comment: '  Muito bom  ' } })
    assert.equal(r1.status, 200, JSON.stringify(r1.json))
    assert.equal(r1.json.data.rating, 4)
    assert.equal(r1.json.data.comment, 'Muito bom')
    assert.ok(r1.json.data.ratedAt)

    assert.equal((await call('PATCH', '/appointments/901/rate', { token: tokens.cliente2, body: { rating: 5 } })).status, 200)

    let est = (await readData('establishments.json')).find(e => e.id === 2)
    assert.equal(est.rating, 4.5)
    assert.equal(est.reviewCount, 2)

    // reavaliar o mesmo agendamento troca a nota, não conta de novo
    assert.equal((await call('PATCH', '/appointments/901/rate', { token: tokens.cliente2, body: { rating: 3 } })).status, 200)
    est = (await readData('establishments.json')).find(e => e.id === 2)
    assert.equal(est.rating, 3.5)
    assert.equal(est.reviewCount, 2)

    // a página do salão mostra a nota e a avaliação escrita, com nome abreviado
    const pub = await call('GET', '/establishments/2')
    assert.equal(pub.json.data.reviewCount, 2)
    const reviews = await call('GET', '/establishments/2/reviews')
    assert.equal(reviews.status, 200)
    assert.deepEqual(reviews.json.data.map(r => [r.id, r.rating, r.comment, r.name]), [[900, 4, 'Muito bom', 'Cliente S.']])

    // e o salão não consegue maquiar a própria nota pela tela de edição
    await call('PUT', '/establishments/2', { token: tokens.adminB, body: { rating: 5, reviewCount: 99 } })
    est = (await readData('establishments.json')).find(e => e.id === 2)
    assert.equal(est.rating, 3.5)
    assert.equal(est.reviewCount, 2)
})

test('nota do salão: média com 1 casa; sem avaliação fica 5 com 0 avaliações', async () => {
    const { summarizeRatings } = await import('../utils/ratings.js')
    assert.deepEqual(summarizeRatings([]), { rating: 5, reviewCount: 0 })
    assert.deepEqual(summarizeRatings([{ rating: 5 }, { rating: 4 }, { rating: 4 }]), { rating: 4.3, reviewCount: 3 })
    assert.deepEqual(summarizeRatings([{ rating: null }, {}, { rating: 0 }, { rating: 2 }]), { rating: 2, reviewCount: 1 })
})

test('perfil: endereço do cliente é gravado só com os campos da tela', async () => {
    const r = await call('PUT', '/users/2', {
        token: tokens.cliente2,
        body: { address: { cep: '70000-000', street: 'Rua A', number: '10', city: 'Brasília', state: 'DF', extra: 'lixo' } },
    })
    assert.equal(r.status, 200, JSON.stringify(r.json))
    assert.equal(r.json.data.address.street, 'Rua A')
    assert.equal(r.json.data.address.extra, undefined)
    assert.equal(r.json.data.address.complement, '')
    assert.equal((await readData('users.json')).find(u => u.id === 2).address.city, 'Brasília')

    assert.equal((await call('PUT', '/users/2', { token: tokens.cliente2, body: { address: 'texto solto' } })).status, 400)
    assert.equal((await call('PUT', '/users/2', { token: tokens.cliente1, body: { address: { street: 'x' } } })).status, 403)
})

test('funcionário com cliente marcado não pode ser removido; sem agendamento futuro, pode', async () => {
    await fs.writeFile(path.join(dataDir, 'employees.json'), JSON.stringify([
        ...(await readData('employees.json')),
        { id: 33, name: 'Func Ocupado', establishmentId: 2, services: [102] },
        { id: 34, name: 'Func Livre', establishmentId: 2, services: [102] },
    ]))
    const base = { establishmentId: 2, userId: null, services: [102], time: '09:00', totalPrice: 60, totalDuration: 30, customerPhone: '1' }
    await addAppointments([
        { ...base, id: 910, date: '2030-03-01', status: 'confirmed', customerName: 'Maria', assignments: [{ serviceId: 102, employeeId: 33 }] },
        { ...base, id: 911, date: '2030-03-02', status: 'pending', customerName: 'Joana', assignments: [{ serviceId: 102, employeeId: 33 }] },
        // nada disto impede a remoção: já passou, foi cancelado, ou é de outro funcionário
        { ...base, id: 912, date: '2026-01-05', status: 'completed', customerName: 'Antiga', assignments: [{ serviceId: 102, employeeId: 34 }] },
        { ...base, id: 913, date: '2030-03-03', status: 'cancelled', customerName: 'Desistiu', assignments: [{ serviceId: 102, employeeId: 34 }] },
    ])

    assert.equal((await call('DELETE', '/employees/33', { token: tokens.adminA })).status, 403)

    const bloqueado = await call('DELETE', '/employees/33', { token: tokens.adminB })
    assert.equal(bloqueado.status, 409, JSON.stringify(bloqueado.json))
    assert.match(bloqueado.json.error || bloqueado.json.message, /2 agendamento\(s\).*01\/03 09:00 - Maria.*02\/03 09:00 - Joana/)
    assert.ok((await readData('employees.json')).some(e => e.id === 33), 'funcionário continua cadastrado')
    assert.deepEqual((await readData('appointments.json')).find(a => a.id === 910).assignments,
        [{ serviceId: 102, employeeId: 33 }], 'agendamento não é mexido')

    const livre = await call('DELETE', '/employees/34', { token: tokens.adminB })
    assert.equal(livre.status, 200, JSON.stringify(livre.json))
    assert.ok(!(await readData('employees.json')).some(e => e.id === 34))
    assert.deepEqual((await readData('appointments.json')).find(a => a.id === 912).assignments,
        [{ serviceId: 102, employeeId: 34 }], 'histórico fica como estava')
})

test('LGPD: cliente exclui a própria conta — dados de saúde e anotações somem, histórico do salão fica anônimo', async () => {
    const email = 'excluir@teste.local'
    await call('POST', '/auth/register', { body: { name: 'Bia Excluir', email, password: 'senhaforte1', phone: '61988887777', termsAccepted: true } })
    const sessao = (await confirmarEmail('users.json', email, 'customer')).json.data
    const token = sessao.token, id = sessao.user.id

    const ag = await call('POST', '/appointments', { token, body: { establishmentId: 1, services: [101], date: '2030-05-02', time: '14:00',
        customerName: 'Bia Excluir', customerPhone: '61988887777', customerEmail: email } })
    assert.equal(ag.status, 201, JSON.stringify(ag.json))
    const aptId = ag.json.data.id

    // agendamento futuro bloqueia a exclusão
    const bloqueado = await call('DELETE', `/users/${id}`, { token, body: { password: 'senhaforte1' } })
    assert.equal(bloqueado.status, 409)
    assert.equal(bloqueado.json.code, 'HAS_FUTURE_APPOINTMENTS')

    // vira passado e concluído; salão tem ficha de saúde e anotação dela
    const apts = await readData('appointments.json')
    Object.assign(apts.find(a => a.id === aptId), { date: '2020-01-01', status: 'completed', notes: 'alergia a amônia' })
    await fs.writeFile(path.join(dataDir, 'appointments.json'), JSON.stringify(apts))
    await fs.writeFile(path.join(dataDir, 'anamnesis_responses.json'), JSON.stringify([{ id: 1, appointmentId: aptId, establishmentId: 1, answers: ['gestante'] }, { id: 2, appointmentId: 999, establishmentId: 1, answers: [] }]))
    await fs.writeFile(path.join(dataDir, 'client_notes.json'), JSON.stringify([{ id: 1, establishmentId: 1, clientKey: '61988887777', note: 'prefere manhã' }, { id: 2, establishmentId: 1, clientKey: '11900000000', note: 'outra pessoa' }]))

    assert.equal((await call('DELETE', `/users/${id}`, { token, body: { password: 'errada123' } })).status, 401)
    assert.equal((await call('DELETE', `/users/${id}`, { token: tokens.cliente2, body: { password: 'senhaforte1' } })).status, 403)

    const ok = await call('DELETE', `/users/${id}`, { token, body: { password: 'senhaforte1' } })
    assert.equal(ok.status, 200, JSON.stringify(ok.json))

    assert.equal((await readData('users.json')).some(u => u.id === id), false, 'conta apagada')
    const apt = (await readData('appointments.json')).find(a => a.id === aptId)
    assert.ok(apt, 'agendamento continua no histórico do salão')
    assert.deepEqual([apt.userId, apt.customerName, apt.customerEmail, apt.customerPhone, apt.notes], [null, 'Cliente removido', null, null, null])
    assert.equal(apt.totalPrice > 0, true, 'valor do caixa preservado')
    assert.deepEqual((await readData('anamnesis_responses.json')).map(r => r.id), [2], 'só a ficha dela some')
    assert.deepEqual((await readData('client_notes.json')).map(n => n.id), [2], 'só a anotação dela some')
    assert.equal((await call('POST', '/auth/login', { body: { email, password: 'senhaforte1' } })).status, 401)
})

// Fica por último: apaga o salão 1 inteiro.
test('excluir conta: leva tudo do salão, só o dono pode, e funciona mesmo com o salão já sumido', async () => {
    const owned = ['products.json', 'cashflow.json', 'client_notes.json', 'anamnesis_forms.json', 'anamnesis_responses.json', 'packages.json', 'audit_log.json']
    for (const file of owned) {
        await fs.writeFile(path.join(dataDir, file), JSON.stringify([
            { id: 1, establishmentId: 1, nome: 'do A' },
            { id: 2, establishmentId: 2, nome: 'do B' },
        ]))
    }

    assert.equal((await call('DELETE', '/establishments/1', { token: tokens.adminB })).status, 403)
    assert.equal((await call('DELETE', '/establishments/1', { token: tokens.cliente1 })).status, 403)

    // o caso real da conta de teste: admin apontando para um salão que já não existe
    const ests = (await readData('establishments.json')).filter(e => e.id !== 1)
    await fs.writeFile(path.join(dataDir, 'establishments.json'), JSON.stringify(ests))

    const r = await call('DELETE', '/establishments/1', { token: tokens.adminA })
    assert.equal(r.status, 200, JSON.stringify(r.json))

    for (const file of [...owned, 'appointments.json', 'employees.json', 'admins.json']) {
        const rows = await readData(file)
        assert.equal(rows.filter(x => x.establishmentId === 1).length, 0, `${file}: sobrou dado do salão 1`)
    }
    for (const file of owned) {
        assert.equal((await readData(file)).filter(x => x.establishmentId === 2).length, 1, `${file}: apagou dado do salão 2`)
    }
    assert.ok((await readData('services.json')).some(s => s.id === 100), 'serviço global continua')
    assert.ok((await readData('services.json')).some(s => s.id === 102), 'serviço do B continua')
    assert.ok((await readData('admins.json')).some(a => a.id === 2), 'admin do B continua')
})
