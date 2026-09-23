// Check do armazenamento à prova de navegador restrito.
// Roda com: node src/services/safeStorage.test.js
//
// O que isto protege: no Android, abrir o site pelo navegador embutido do
// WhatsApp/Instagram, ou com dados de site bloqueados, faz localStorage
// LANÇAR em vez de devolver vazio. Como o app chama storage no meio do login,
// essa exceção subia e a tela anunciava "credenciais inválidas" com a senha
// certa. Se algum destes casos voltar a falhar, aquele bug voltou.
import assert from 'node:assert/strict'

const SRC = new URL('./safeStorage.js', import.meta.url).href

const storageQueFunciona = () => {
    const m = new Map()
    return {
        getItem: k => (m.has(String(k)) ? m.get(String(k)) : null),
        setItem: (k, v) => m.set(String(k), String(v)),
        removeItem: k => m.delete(String(k)),
        clear: () => m.clear(),
    }
}

const queLanca = (msg, nome) => ({
    getItem: () => null,
    setItem: () => { throw new DOMException(msg, nome) },
    removeItem: () => {},
    clear: () => {},
})

// Cada cenário precisa de um módulo recém-carregado, porque a troca do global
// acontece uma única vez, na importação.
async function carregarCom(win) {
    globalThis.window = win
    return import(`${SRC}?cenario=${Math.random()}`)
}

// Silencia os avisos esperados para a saída do teste ficar legível.
const warnOriginal = console.warn
console.warn = () => {}

// --- navegador normal: usa o storage de verdade ---
{
    const mod = await carregarCom({ localStorage: storageQueFunciona(), sessionStorage: storageQueFunciona() })
    assert.equal(mod.isStoragePersistent(), true, 'storage saudável conta como persistente')
    window.localStorage.setItem('zakys_token', 'abc')
    assert.equal(window.localStorage.getItem('zakys_token'), 'abc')
}

// --- setItem lança (cookies bloqueados / WebView restrito) ---
{
    const mod = await carregarCom({
        localStorage: queLanca('The operation is insecure.', 'SecurityError'),
        sessionStorage: queLanca('The operation is insecure.', 'SecurityError'),
    })
    assert.equal(mod.isStoragePersistent(), false, 'storage que lança não é persistente')
    // O ponto central: gravar e ler NÃO pode lançar, senão o login quebra.
    assert.doesNotThrow(() => window.localStorage.setItem('zakys_token', 'abc'))
    assert.equal(window.localStorage.getItem('zakys_token'), 'abc', 'cai para memória e continua servindo')
    window.localStorage.removeItem('zakys_token')
    assert.equal(window.localStorage.getItem('zakys_token'), null)
}

// --- só acessar window.localStorage já lança ---
{
    const win = { sessionStorage: storageQueFunciona() }
    Object.defineProperty(win, 'localStorage', {
        get() { throw new DOMException('Access is denied.', 'SecurityError') },
        configurable: true,
    })
    const mod = await carregarCom(win)
    assert.equal(mod.isStoragePersistent(), false)
    assert.doesNotThrow(() => window.localStorage.setItem('x', '1'))
    assert.equal(window.localStorage.getItem('x'), '1')
}

// --- cota estourada ---
{
    const mod = await carregarCom({
        localStorage: queLanca('QuotaExceededError', 'QuotaExceededError'),
        sessionStorage: queLanca('QuotaExceededError', 'QuotaExceededError'),
    })
    assert.equal(mod.isStoragePersistent(), false)
    assert.doesNotThrow(() => window.localStorage.setItem('x', '1'))
}

// --- storage simplesmente ausente ---
{
    const mod = await carregarCom({})
    assert.equal(mod.isStoragePersistent(), false)
    assert.doesNotThrow(() => window.localStorage.setItem('x', '1'))
    assert.equal(window.localStorage.getItem('x'), '1')
    assert.doesNotThrow(() => window.sessionStorage.setItem('y', '2'))
}

console.warn = warnOriginal
console.log('✅ safeStorage: todos os casos passaram')
