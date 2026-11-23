// Check da tradução de erro de login.
// Roda com: node src/services/authErrors.test.js
//
// O que isto protege: a tela do Portal do Parceiro anunciava "credenciais
// inválidas" para QUALQUER falha, então servidor fora do ar e armazenamento
// bloqueado viravam "senha errada" e o dono trocava uma senha que estava
// certa. Cada causa precisa continuar aparecendo com o próprio nome.
import assert from 'node:assert/strict'

globalThis.window = { localStorage: null, sessionStorage: null }
const warnOriginal = console.warn
console.warn = () => {}
const { loginErrorMessage } = await import('./authErrors.js')
console.warn = warnOriginal

// 401 de verdade: só aqui pode falar em senha incorreta.
assert.match(loginErrorMessage(new Error('Credenciais inválidas')), /incorretos/i)

// Servidor fora do ar ou sem internet: nunca pode virar "senha errada".
const rede = [
    'Não foi possível conectar ao servidor (https://x/api). Verifique sua conexão',
    'Failed to fetch',
    'NetworkError when attempting to fetch resource.',
    'Load failed',
]
for (const m of rede) {
    const out = loginErrorMessage(new Error(m))
    assert.match(out, /servidor/i, `"${m}" deve falar de servidor`)
    assert.doesNotMatch(out, /senha incorret/i, `"${m}" NÃO pode acusar senha errada`)
}

// Armazenamento bloqueado: precisa orientar a abrir fora do app.
const storage = [
    'The operation is insecure.',
    'QuotaExceededError',
    'Access is denied for this document.',
    'Failed to read the localStorage property',
]
for (const m of storage) {
    const out = loginErrorMessage(new Error(m))
    assert.match(out, /armazenamento/i, `"${m}" deve falar de armazenamento`)
    assert.doesNotMatch(out, /senha incorret/i, `"${m}" NÃO pode acusar senha errada`)
}

// Desconhecido: mostra o que veio, em vez de inventar uma causa.
assert.match(loginErrorMessage(new Error('falha esquisita 500')), /falha esquisita 500/)
assert.match(loginErrorMessage(new Error('')), /Não foi possível entrar/i)
assert.match(loginErrorMessage(null), /Não foi possível entrar/i)

// Login recusado por algo que a pessoa resolve: aviso fixo + botão certo.
const { loginProblem } = await import('./authErrors.js')
const erro = (code, message = 'msg do servidor') => Object.assign(new Error(message), { code })
const destinos = (p) => p.actions.map(a => a.to)

assert.equal(loginProblem(erro('EMAIL_NOT_FOUND', 'Não encontramos')).message, 'Não encontramos')
assert.deepEqual(destinos(loginProblem(erro('EMAIL_NOT_FOUND'), 'customer', ' Ana+1@x.com ')), ['/cadastro?email=Ana%2B1%40x.com'])
assert.deepEqual(destinos(loginProblem(erro('EMAIL_NOT_FOUND'), 'customer', '')), ['/cadastro'])
assert.deepEqual(destinos(loginProblem(erro('EMAIL_NOT_FOUND'), 'admin', 'a@x.com')), ['/parceiro/cadastro'])
assert.deepEqual(destinos(loginProblem(erro('NO_ACCOUNT_HAS_BOOKINGS'), 'customer', 'a@x.com')), ['/cadastro?email=a%40x.com'])
assert.deepEqual(destinos(loginProblem(erro('WRONG_PASSWORD'), 'admin')), ['/recuperar-senha'])
assert.deepEqual(destinos(loginProblem(erro('ACCOUNT_IS_PARTNER'), 'customer')), ['/admin/login'])
assert.deepEqual(destinos(loginProblem(erro('ACCOUNT_IS_CUSTOMER'), 'admin')), ['/entrar'])
// Rede, servidor fora do ar, e-mail não confirmado: não é aviso de conta.
assert.equal(loginProblem(erro(undefined, 'Failed to fetch'), 'customer'), null)
assert.equal(loginProblem(erro('EMAIL_NOT_VERIFIED'), 'customer'), null)
assert.equal(loginProblem(null, 'customer'), null)

console.log('✅ authErrors: todos os casos passaram')
